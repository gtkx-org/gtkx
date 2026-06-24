# Rendering pipeline

How a React element tree becomes live GTK4/libadwaita widgets, and how those widgets emit events back into React. The path crosses three packages and converges on a single GLib main-loop thread:

- `@gtkx/react` — a custom `react-reconciler` host config that mutates a tree of GObject wrappers.
- `@gtkx/ffi` — TypeScript that turns the native addon's descriptor-driven primitives into GObject-shaped operations: construction, value marshalling, signals, subclassing, and the GType↔class registry.
- `@gtkx/native` — a Rust napi addon that owns the GLib thread and performs every `libffi` call into GTK.

The build-time generator emits the wrapper classes, the Type-descriptor vocabulary, and the reconciler metadata tables consumed below. [./architecture.md](./architecture.md) is the orientation hub for the two generated binding stores and the descriptor contract; [./codegen.md](./codegen.md) covers the generator mechanics. Setup, prerequisites, and commands live in [../README.md](../README.md).

## Layered view

```
React element tree (JSX, element types = GTK type names)
        │  react-reconciler (mutation mode)
        ▼
@gtkx/react host config
  create instances · apply props · attach children · suppress feedback signals
        │  construct, get/set property, connect signal, registry lookup
        ▼
@gtkx/ffi
  Type descriptors · value marshalling · trampolines · registries
        │  native primitives
        ▼
@gtkx/native (Rust)  ──▶  single GLib main-loop thread
  Type codecs · libffi calls · dlopen'd symbols · toggle refs · trampolines
        ▼
system GTK4 / GLib / libadwaita
```

## The host node model

A reconciler host node is one of two things: a **wrapper** — the JS object backing a live GObject — or a relationship node that carries no GObject backing. Relationship nodes express connections that are not plain widget parenting (a prop that takes an element, a collection-valued prop, a layout child, a stack or notebook page, an overlay, a tab label, a text run, and similar). Such a node has no live object behind it; it exists only so the reconciler can map a parent/child relationship to a method call or property set instead of to GTK widget parenting.

Per-node bookkeeping (name, kind, current props, parent, children, owning signal store, root container) does not live on the node itself. It is held in an external side table keyed by node, so a wrapper stays a clean GObject and a relationship node can still carry tree structure it could not otherwise hold. All reconciler code reads relationships through that side table, never off the GObject.

The host config runs in mutation mode and is the primary renderer.

## Render path (mount and update)

### Instance creation

Creating an instance dispatches on the element type. Relationship element types produce a relationship node; every other type resolves the registered wrapper class for that type name from the FFI class registry and constructs a backing GObject. Only construct-time properties — determined from the generated config tables folded over the type's inheritance chain, not from runtime GObject introspection — are passed at construction; a small set of order-sensitive construct properties is deliberately deferred and applied afterward. Construction marshals each property into a value, calls into native to create the object, and registers the resulting wrapper.

### Prop commit

Mount and update both apply props with feedback signals suppressed (see [Event path](#event-path-gtk--react)). Application diffs old against new props. Each changed prop resolves to a signal connection, a plain GObject property write, or a generated imperative or collection operation; a *removed* prop is reset to a config-provided default, so omitting a prop actively reverts GTK state rather than leaving it. Accessibility props on widgets are routed through a dedicated path.

How a named prop maps to GObject behavior is driven entirely by the generated config tables, compiled per type name and merged along the instance's GType inheritance chain and interfaces. The descriptor kinds — property write, collection diff, imperative method, and signal connection — are the contract; their data comes from codegen.

### Child attachment

Appending, inserting, and removing children first updates the side-table children array, then dispatches the relationship through an **ordered** list of attach/detach strategies. The first strategy that matches a (child, parent) pair wins, so ordering is significant: the generic widget-container strategy is last, and a guard strategy deliberately throws when a child that should have been passed through a prop is placed directly under its parent.

Each strategy turns the pair into concrete GTK calls — an element-valued prop sets a property, a collection prop calls an add method, a page is added to a stack or notebook, layout metadata is configured, an overlay is added, and the generic strategy parents the widget (with reorder and autowrap handling where the container requires it). A relationship-node parent re-syncs its GTK state whenever its children change.

### Text and lists

Text is realized through host context rather than as real child nodes: the reconciler tracks whether the current subtree is a label or text-buffer host and turns a raw string into a text-run node, throwing if a string appears anywhere text is not expected. Label content is rebuilt by concatenating text-run children; buffers are rebuilt by re-inserting text, tags, paintables, and anchors. Rebuilds are deferred and flushed at the end of a commit.

List-family widgets run a parallel data path: a controller owns the GTK model and item factory, and rendered cell or header content is projected back into React through a portal into factory-created containers.

### Commit bracketing

A commit is bracketed so the whole React batch executes back-to-back against GTK as a single main-loop turn instead of yielding mid-commit. The reconciler freezes the GLib thread at the start of a commit, drains deferred text/list rebuilds at the end, then unfreezes. During a freeze the GLib thread runs a dedicated drain loop (see [Single thread and serialization](#single-thread-and-serialization)).

## Event path (GTK → React)

GTK emits a signal on the GLib thread into a **trampoline** — a `libffi` closure. The closure reads the C arguments according to their Type descriptors, hands them to the JS thread, runs the user handler, and writes any return or out-parameter values back into C memory before returning. The same machinery carries vfuncs and plain callbacks.

A signal store prevents GTK→React feedback loops. Every connected handler is wrapped so that, while a commit is in flight, non-lifecycle signals are suppressed, and running any handler itself re-entrantly blocks all signals. Only an explicit lifecycle allowlist (realize/unrealize, map/unmap, show/hide, destroy, resize, render) fires while blocked, so handlers must not rely on observing intra-commit change signals. On an uncaught render error the root force-unblocks all signals to avoid a stuck state.

## The FFI boundary contract

Every native operation is parameterized by a plain-object **Type descriptor**, built by factories in `@gtkx/ffi` and bundled as the namespace that generated bindings import. The descriptor is the serialized marshalling contract: the same object shape is produced in TypeScript and parsed in Rust, so both sides agree on how each value crosses the boundary. Pointer-bearing descriptors carry an ownership marker that decides reference counting and freeing on both sides; it is safety-critical, since it selects ref/sink/unref versus a no-op.

The pieces `@gtkx/ffi` layers on top of the native primitives:

- **Handle map** — associates each wrapper with the opaque native handle for its live object; marshalling unwraps JS objects back to pointers through it.
- **Class registry** — maps a runtime GType to the most-derived registered wrapper class, walking the GObject parent chain when there is no exact match, and resolving interface handles to their implementing class.
- **Wrapper identity** — enforces one JS wrapper per live GObject: native is asked for an existing wrapper first, and only when none exists is a new one created and, for true GObject-derived types, registered with a toggle reference. Boxed, struct, and fundamental wrappers only get a handle-map entry.
- **Value marshalling** — bridges JS values and GLib values in both directions, dispatching on the GType derived from the descriptor, and wraps GObject construction and property get/set.
- **Signals** — connecting a signal wraps the user handler in a trampoline; emitting a signal builds the argument vector, invokes the GLib emission, and reassembles out-params and the return into a tuple.
- **Subclassing** — registering a subclass derives the parent GType, discovers overridden class and inherited-interface vfuncs, wraps each as a trampoline, and hands native the vtable descriptors. Overriding construct-time slots is rejected; such initialization must run in the subclass constructor after `super(...)`.

## The native boundary contract

`@gtkx/native` exposes a fixed set of napi functions that the FFI layer binds against, covering outbound calls, memory read/write/alloc, type lookup, subclass registration, wrapper get/set, and freeze/unfreeze. Native initialization runs once as an import side effect to spawn the GLib thread; it is not part of the callable surface. Each value crossing the boundary is described by the same Type descriptor union and carries an opaque handle over a native pointer.

### Single thread and serialization

One thread owns the GLib main context and main loop; the JS thread stays separate. That thread is single-lifecycle: initialization is one-shot and quit is terminal, so the runtime cannot be reinitialized after quit.

All GLib/GTK work is serialized through a single mailbox. A napi call queues its work onto the GLib thread and blocks the JS thread waiting for the result — while still draining its own inbox so GLib-initiated callbacks (event handlers, vfuncs) can run. This is what lets a native call re-enter JS without deadlocking. Re-entrancy is kept ordered by tagging each queued task with the current callback depth and draining only tasks at or above the depth a blocking round-trip is waiting on, so nested commit and handler work proceeds in the right order.

### Outbound calls and Type codecs

On the GLib thread, an outbound call builds a `libffi` call signature from the argument and result Type descriptors, encodes each argument, resolves the target symbol through a cache that `dlopen`s the named library (trying soname candidates in order and never unloading), invokes it, and decodes the return and any out-parameters back into values. Updated out-parameter values are written back into their JS cells once control returns to the JS thread.

The Type descriptor union drives all of this: each variant knows how to encode a JS value into a `libffi` argument, decode an FFI result back into a JS value, and read or write itself through a raw pointer slot (for struct fields, out-params, and vfunc returns). GObject decoding takes a reference and sinks floating or unowned objects under specific conditions, carrying a pending reference that wrapper registration later consumes or releases.

### Trampolines (callbacks and vfuncs)

A **trampoline** is a `libffi` closure whose handler reads C arguments into JS values, invokes a JS function across the mailbox, and writes the JS return into the C return slot; out and inout parameters are seeded from inbound pointers and flushed back after the call. Borrowed string and container returns are retained and freed on the next invocation, since the C caller does not take ownership. The same mechanism installs vfunc pointers into class and interface vtables for subclass registration. Closure lifetime follows the callback scope — freed when its encoded value drops, freed via a destroy-notify, freed one-shot for async callbacks, or intentionally leaked for callbacks that must live for the process.

### Freeze and drain loop

A freeze enters a long-lived GLib task that drains queued native calls back-to-back without yielding to the GLib idle scheduler, so a burst of calls executes as one main-loop turn; unfreezing exits it. Freezes are reference-counted, so nesting is safe. This is the mechanism the React commit relies on to apply a whole batch atomically.

### Wrapper lifetime (toggle references)

A wrapper's lifetime is tied to its GObject through a toggle reference plus a napi reference. The toggle-notify callback flips the napi reference between strong and weak as the object's external reference count crosses one, so the JS wrapper stays alive exactly while GTK or other native code holds a reference, and JS GC can reclaim it only once GTK holds the last one. Cleanup is finalizer-driven and scheduled onto the main loop, guarded against rebind-versus-finalize races, so wrapper disposal is asynchronous relative to JS GC. A decoded GObject carries a pending reference so its extra decode-time reference is released if no wrapper is ever installed.
