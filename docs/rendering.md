# Rendering pipeline

How a React element tree becomes live GTK4/libadwaita widgets, and how those widgets emit events back into React. The path crosses three packages and converges on a single GLib main-loop thread:

- `@gtkx/react` — a `react-reconciler` host config that mutates a tree of GObject wrappers.
- `@gtkx/ffi` — TypeScript that turns the native addon's descriptor-driven primitives into GObject-shaped operations (construction, GValue marshalling, signals, subclassing, the GType↔class registry).
- `@gtkx/native` — a Rust napi addon that owns the GLib thread and performs every `libffi` call into GTK.

The build-time generator emits the wrapper classes, the `t.*` type-descriptor vocabulary, and the reconciler metadata tables consumed below; [./architecture.md](./architecture.md) is the orientation hub for the two generated binding stores and the `t.*` contract, and the generator mechanics themselves live under `packages/codegen/src/`. Setup, prerequisites, and commands live in [../README.md](../README.md).

## Layered view

```
React element tree (JSX, element types = GTK type names)
        │  react-reconciler (mutation mode)
        ▼
@gtkx/react host config
  createInstance · applyProps · ELEMENT_MAP attach · SignalStore · commit freeze
        │  constructWrapper, get/setGobjectProperty, connectGobjectSignal, registry
        ▼
@gtkx/ffi
  Type descriptors (t.*) · GValue marshal · trampolines · registry · handle map
        │  call / alloc / read / write / registerClass / get|setWrapper / freeze
        ▼
@gtkx/native (Rust)  ── Mailbox ──▶  gtkx-glib thread
  Type enum codecs · libffi CIF · dlopen symbols · toggle refs · trampolines
        ▼
system GTK4 / GLib / libadwaita (dlopen'd by name)
```

## The host node model

The reconciler's host instance type, `Node`, is a union of three things:

- `GObject.Object` — a real wrapper instance backing a GTK/GObject type.
- `WrapperElement` — a symbol-branded marker carrying no GObject backing, used for relationships that are not plain widget parenting.
- `RootElement` — the detached default container sentinel.

Per-node bookkeeping does **not** live on the node. `state.ts` keeps a `WeakMap<Node, State>` where `State` holds `name`/`kind`, the current `props`, `parent`, the `children` array, the `rootContainer`, and the owning `SignalStore`. All reconciler code reads relationships through `stateOf`/`ensureState`, never off the GObject. This keeps the wrapper a clean GI object and lets the marker nodes carry tree structure they could not otherwise hold.

The host config (`host-config.ts`) runs in mutation mode (`supportsMutation: true`), is the primary renderer, and reports a single fixed `DiscreteEventPriority` for every update.

### Wrapper elements

Non-widget JSX constructs are modelled as marker nodes tagged by a string `kind`: slots (props that take an element), container-prop groups (collection-valued props), layout children, stack/notebook pages, overlays, meta-objects, tab labels, and text runs. A marker has no handle; it exists only to express a parent/child relationship that maps to a method call or property set rather than to GTK widget parenting.

## Render path (mount and update)

### 1. Instance creation

`createInstance` dispatches on the element type. A `WRAPPER_NODE_ELEMENT` type produces a marker via `createWrapperInstance`; any other type produces a real backing via `createElementInstance` → `constructBacking` (`instance.ts`):

- `requireClassByName` resolves the registered wrapper class for the type name from the FFI class registry (throwing with guidance if the type's `@gtkx/jsx` namespace was never imported).
- `pickConstructProps` keeps only props that are construct-time properties for that type. The construct-prop set comes from the codegen-emitted `CONSTRUCT_PROPS` config table (imported from `virtual:gtkx-config`) folded over the type's name inheritance chain by `collectConstructableProps` — not from runtime GObject GType introspection. `CONSTRUCTION_SKIP_PROPS` deliberately withholds a small set of order-sensitive construct props so they are applied after construction instead.
- `constructWrapper` invokes the class constructor, which calls `newGobjectWithProperties` in `@gtkx/ffi`. That function marshals each prop into a freshly `g_value_init`'d GValue via `toGvalue`, then issues a native `call` to `g_object_new_with_properties`. The returned opaque `Handle` is bound to the wrapper in the FFI handle map and the wrapper is registered in the reconciler state map.

### 2. Prop commit

`finalizeInitialChildren` (mount) and `commitUpdate` (update) both run `commitInstanceProps` wrapped in `withSignalsBlocked`. For a real backing, `getDescriptors` produces the per-type descriptor table (see below) and `applyProps` (`apply-props.ts`) does the work in two passes:

- **Generic pass** — diffs old vs. new props. Each changed prop resolves to one of: a signal connection (when the name maps to a signal, registered through the `SignalStore`), a construct-only skip, a plain GObject property write (`Reflect.set` → `setGobjectProperty` → GValue → native `call`), or — when a prop is *removed* — a reset to a config-provided default (`resolveDefaultProp`). Omitting a prop therefore actively reverts GTK state rather than leaving it.
- **Descriptor pass** — runs the per-type `array | signal | imperative` descriptors. `imperative` descriptors invoke generated setter steps / method calls; `array` descriptors diff collection props; `signal` descriptors connect through the store with optional arg/return shaping.

Widget instances additionally route accessible props through `applyAccessibleProps` and exclude them from the generic pass.

### 3. Descriptor tables

`prop-descriptor-table.ts` compiles the generated config tables (`ARRAY_PROPS`, `PROP_RULES`, `OBJECT_PROPS`, `VIRTUAL_PROPS` from `virtual:gtkx-config`) into a per-type-name `PropDescriptorTable`. At commit time `getDescriptors` folds these along the instance's GType inheritance chain plus its interfaces into a single merged table, cached by GType. The descriptor kinds and the `signal()`/`imperative()` builders are the contract for how a named prop maps to GObject behavior; their data comes entirely from codegen.

### 4. Child attachment

`appendChild`/`insertBefore`/`removeChild` (`host-config.ts`) first update the side-table `children` array, then dispatch the relationship through `ELEMENT_MAP` — an **ordered** list of `ElementMapping { matches, attach, detach }` strategies. The first mapping whose `matches` returns true wins, so ordering is significant; the generic widget-container mapping is intentionally last, and a `promotedNestingGuard` mapping deliberately throws when a child that should have been passed through a prop is placed directly under its parent. `element-map.ts` is the source of truth for the exact mapping order — read the `ELEMENT_MAP` array there rather than trusting a snapshot of it here.

Each mapping turns the (child, parent) pair into concrete GTK calls: a slot sets a property, a container-prop calls an add-method, a page adds a stack/notebook page, layout-child configures layout metadata, overlay calls `addOverlay`, and the widget-container mapping does `setChild`/`append`/`insert`/reorder with autowrap handling for `GtkListBox`/`GtkFlowBox`. Marker parents re-sync via `resyncWrapper` whenever their children change.

### 5. Text and lists

Text is realized through host context, not as real child nodes. `getChildHostContext` tracks whether the current subtree is a `GtkLabel` or `GtkTextBuffer` text host. `createTextInstance` turns a raw string into a `LABEL_TEXT_KIND` or `BUFFER_TEXT_KIND` marker, and **throws** if the string appears anywhere else. Label text is rebuilt by concatenating text-run children (`label-text-rebuild.ts`); buffers are rebuilt by a `TextBufferController` re-inserting text, tags, paintables, and anchors. Rebuilds are deferred and flushed at commit end.

List-family widgets run a parallel data path: a `ListController` owns the GTK model and `SignalListItemFactory`, and rendered cell/header content is projected back into React via `createPortal` into factory-created containers.

### 6. Commit bracketing

`prepareForCommit` calls `beginCommit()` then native `freeze()`; `resetAfterCommit` drains deferred rebuilds via `runCommitFlush`, then calls `endCommit()` and `unfreeze()`. During a freeze the GLib thread runs a dedicated drain loop (below), so the whole React commit batch executes back-to-back against GTK as one main-loop turn instead of yielding mid-commit. A drain error is routed to the reconciler error sink rather than thrown.

## Event path (GTK → React)

GTK emits a signal on the GLib thread into a `libffi` trampoline closure. The closure reads C args per their `Type`s, packages them as `Value`s, posts a callback task to the Mailbox's node inbox, wakes the JS thread, and blocks pumping the GLib inbox so nested work proceeds. On the JS thread the handler runs; any return or out-parameter values are written back into C memory before the trampoline returns.

The `SignalStore` (`signal-store.ts`) is what prevents GTK→React feedback loops. Every connected handler is wrapped so that while a commit is in flight (`blockDepth > 0`) non-lifecycle signals are suppressed, and running any handler itself blocks all signals re-entrantly. Only the explicit `LIFECYCLE_SIGNALS` allowlist (realize/unrealize/map/unmap/show/hide/destroy/resize/render) fires while blocked. Handlers therefore must not rely on observing intra-commit change signals. On an uncaught render error the root force-unblocks all signals to avoid a stuck blocked state.

## The FFI boundary contract

Every native operation is parameterized by a plain-object **Type descriptor** built by the factories in `descriptors.ts` and bundled as the `t` namespace that generated bindings import. The descriptor (`{ type: 'gobject' | 'boxed' | 'string' | … , ownership, … }`) is the serialized contract: the same object shape is parsed in Rust by `Type::from_js_value`. `ownership` (`'full' | 'borrowed'`) on every pointer-bearing descriptor decides reference counting and freeing on both sides — it is safety-critical, since `full` vs. `borrowed` selects ref/sink/unref versus a no-op.

The pieces `@gtkx/ffi` layers on top of the native primitives:

- **Handle map** (`registry.ts`) — a `WeakMap<wrapper, Handle>`. `getHandle` throws when an instance has no handle; `tryGetHandle` tolerates null. Marshalling unwraps JS objects back to pointers through this map.
- **Class registry** (`registry.ts`) — a `Map<GType, class>` plus a `__gtype__` stamp on each wrapper prototype. `findWrapperClass` resolves a runtime GType to the most-derived registered class, walking the GObject parent chain when there is no exact match; interface handles resolve through `wrapInterfaceHandle`.
- **Wrapper identity** — `resolveWrapper` enforces one JS wrapper per live GObject: it asks native `getWrapper(handle)` first and returns that exact instance if present; otherwise it `Object.create`s the resolved prototype and, for true GObject-derived types, registers a toggle-ref-backed wrapper via native `setWrapper`. Boxed/struct/fundamental wrappers only get a handle-map entry.
- **GValue marshalling** (`gvalue.ts`) — `toGvalue`/`fromGvalue` bridge JS values and GLib `GValue`s, dispatching on the fundamental GType derived from the descriptor. `gobject.ts` wraps `g_object_new_with_properties` and `g_object_get|set_property`. `G_TYPE_POINTER` is read-only: a non-null pointer GValue throws when read back to JS.
- **Signals** (`signal.ts`) — `connectGobjectSignal` wraps the user handler in a trampoline (skip-receiver) and calls `g_signal_connect_data`; `emitGobjectSignal` builds an instance+arg GValue vector, looks up the signal id and detail quark, calls `g_signal_emitv`, and reassembles out-params and return into a tuple.
- **Trampoline** (`handler-trampoline.ts`) — one `wrapHandler` serves signals, vfuncs, and plain callbacks. It wraps incoming native args, optionally binds the first as `this` (receiver `'this'` for vfuncs, `'skip'` for signals, `'none'` for plain callbacks), partitions in/out/inout and caller-allocated buffer params, calls the user function, then writes results back into out-cells and unwraps the return.
- **Subclassing** (`register-class.ts`) — `registerClass` derives the parent GType, discovers overridden class and inherited-interface vfuncs against the per-class/per-interface vfunc registries, wraps each as a `this`-receiver trampoline, and hands native `registerClass` the byte-offset/arg/return descriptors. Overriding the construct-time slots `constructed`/`setProperty`/`getProperty` is rejected — such init must run in the subclass constructor after `super(...)`.
- **Call shape** (`fn.ts`) — builds a callable from a symbol plus per-arg metadata (direction out/inout, callerAllocates, consumed, throws), planning which JS inputs feed which native slots, allocating ref cells for out params, and appending a trailing `GError` ref cell checked by `checkError` when `throws` is set.

## The native boundary contract

`@gtkx/native` exposes a fixed set of napi functions that the FFI layer binds against: `call`, `quit`, `read`, `write`, `alloc`, `getType`, `registerClass`, `setWrapper`, `getWrapper`, `freeze`, `unfreeze`. (`init` is also `#[napi]`, but it is an internal bootstrap that `@gtkx/native` invokes once during its own module load to spawn the GLib thread; it is not re-exported from `@gtkx/native`'s public TS surface and `@gtkx/ffi` never calls it.) Each crossing-value is described by the same `Type` descriptor union and carries `Value`/`Handle` (an opaque `External` over a native pointer).

### Single thread + Mailbox

`init` spawns one thread named `gtkx-glib` that owns the GLib `MainContext`/`MainLoop`; the JS thread stays separate. The `GlibThread` phase machine is `New → Running → NotRunning`: `init` is one-shot and `quit` is terminal, so the runtime cannot be reinitialized after quit.

All GLib/GTK work is serialized through the `Mailbox` (a global `OnceLock` singleton). It holds a `glib_inbox` and a `node_inbox` of queued tasks plus wake signals. A napi call packages work as a `ModuleRequest`, pushes the closure to the GLib inbox (via `glib::idle_add` at `HIGH_IDLE`, or directly when a freeze loop is active), and **blocks** on the JS thread waiting for the result — while still draining its own `node_inbox` so GLib-initiated callbacks can run. This is what lets a native call re-enter JS without deadlocking.

Re-entrancy is kept ordered by **callback-depth tagging**: each GLib task is tagged with the current depth, and a blocking node round-trip waits at `current_depth + 1`, draining only tasks at or above that depth (`dispatch_pending_from_depth`). Nested commit/handler work proceeds in the right order instead of deadlocking or running out of order.

The `ModuleRequest`/`ModuleResponse` traits standardize every entry point: parse JS on the JS thread, `dispatch` the closure to the GLib thread, wait, and convert the result back.

### Outbound call execution

On the GLib thread, `CallRequest::execute` (`module/call.rs`):

1. Builds a `libffi` CIF from the arg `Type`s and the result `Type`.
2. Encodes each `Arg` into an `FfiValue`, arming any pending ownership transfer.
3. Resolves the symbol through a thread-local `LibraryCache` that `dlopen`s the named library (comma-separated soname candidates tried in order, `RTLD_GLOBAL`, cached and never unloaded).
4. Invokes via `libffi`, decodes the return and any inout `Ref` out-params back into `Value`s, disarms transfers consumed by the call, and frees transfer-full sized-array returns.
5. Returns the value plus a list of `RefUpdate`s; back on the JS thread, `to_js_response` writes each updated value into the original JS `{ value }` cell.

### Type codecs

The `Type` enum implements three `enum_dispatch` traits — `FfiEncoder` (JS `Value` → libffi arg), `FfiDecoder` (FFI result → `Value`), and `RawPtrCodec` (read/write through a raw pointer slot, used for struct fields, out-params, and vfunc returns) — combined as `FfiCodec`. `Value` is the Rust mirror of a JS value (`Number`, `BigInt`, `String`, `Boolean`, `Object(NativeHandle)`, `Array`, `BufferView`, `Callback`, `Ref`, `Null`, `Undefined`). For GObjects specifically, decoding (`tracked_gobject_value`) takes a reference and `ref_sink`s floating/unowned objects under specific conditions, carrying a pending ref that `setWrapper` later consumes.

### Trampolines (callbacks and vfuncs)

`build_trampoline` (`trampoline.rs`) creates a `libffi` `Closure` whose handler reads C args into `Value`s, invokes the JS function through the Mailbox, and writes the JS return into the C return slot. Out/inout `Ref` args seed cells from the inbound pointer and flush the returned values back. Borrowed string and borrowed container returns are retained on the `TrampolineData` and freed on the next invocation (the C caller does not take ownership). The same machinery installs vfunc pointers into class/interface vtables for `register_class`. Closure lifetime follows the callback scope: `call` frees when the encoded value drops, `notified` attaches a destroy-notify, `async` frees itself one-shot, `forever` leaks intentionally.

### Freeze / drain loop

`freeze()` enters a long-lived GLib task running `FreezeController::run_loop`, which drains the `glib_inbox` without yielding to the GLib idle scheduler so a burst of native calls executes back-to-back; `unfreeze()` exits it. Freezes are reference-counted, so nested freezes are safe. This is the mechanism the React commit relies on to run a whole batch as one main-loop turn.

### Wrapper lifetime (toggle references)

A wrapper's lifetime is tied to its GObject through a toggle reference plus a napi reference. `set_wrapper` (`module/toggle_ref.rs`) adds a finalizer to the JS wrapper and installs a `WrapperBinding` (napi ref + generation + strong flag) in the GObject's qdata via `g_object_add_toggle_ref`. The toggle-notify callback flips the napi reference between strong and weak as the object's external ref count crosses 1, so the JS wrapper stays alive exactly while GTK or other native code holds a reference, and JS GC can reclaim it only once GTK holds the last ref. Cleanup is finalizer-driven and scheduled onto the main loop (`schedule_cleanup`), guarded by a generation counter and a lookup lock against rebind-vs-finalize races — so wrapper disposal is asynchronous relative to JS GC. A decoded GObject carries a `pending_gobject_ref` so its extra decode-time ref is released if no wrapper is ever installed.
