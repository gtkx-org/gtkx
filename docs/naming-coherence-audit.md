# GTKX Naming-Coherence Audit

A semantic naming sweep of the monorepo — functions, types, files, folders, and
modules — aimed at making the codebase read like one coherent piece in a single
canonical style. Mechanical concerns a linter already owns (letter-casing,
formatting, import order) are out of scope; the documented generated-binding
divergences (`@gtkx/gi` mirroring `@girs` GIR names, GType acronym casing,
`ConstructorProps` camelCase) are excluded.

**Method.** 17 independent auditors (10 per-package coherence passes + 7
cross-cutting axis passes: noun families, verb lexicon, file/folder structure,
type suffixes, domain concepts, abbreviations, public API) produced 138 raw
findings. These were clustered into 77 distinct issues, and every one was then
adversarially verified — a skeptic first tried to *justify* the divergent names
before condemning them. Result: **21 confirmed**, 56 rejected as justified
distinctions or misreads.

---

## 1. Canonical lexicon

For each contested family, the one word/pattern that should win and what it replaces.

| Concept | Canonical | Replaces | Scope |
| --- | --- | --- | --- |
| Return a source-string fragment | `render<X>` | string-returning `build<X>`, string-returning `write<X>` | codegen writers |
| Append onto a module/context (void) | `emit<X>` | — (keep) | codegen writers |
| Produce a complete file's source | `generate<X>Module` / `generate<X>File` | — (keep) | codegen pipeline |
| Return the final assembled string | `toSource()` | `ModuleBuilder.emit()`, `ImportsBuilder.emit()` | codegen DSL |
| Filesystem write | `write<X>` | — (reserve for disk only) | codegen store-fs |
| Emit CSS rules into the sheet | `insertRules` | `flush` (emit sense) | `@gtkx/css` |
| Exact map lookup | `get<X>` | `findNativeObject` (a pure map get) | `@gtkx/ffi` registry |
| Hierarchy-walking lookup | `find<X>` | `get<X>` + a `walkHierarchy` flag | `@gtkx/ffi` registry |
| Detach a child from its parent | `detachChild(child, container)` / `attachChild(child, container)` | `removeChildFromParent(parent, child)` | react node layer |
| Wrap-and-bind a page child | `attachPage` / `detachPage` | `addPage` / `removePage` | single-child page nodes |
| Settings/property accessor pair | `get<X>` / `set<X>` | `readSetting` / `writeSetting` | react hooks |
| Single native-binding record | `<X>Descriptor` | `ClassVfuncMetadata`, `NativeSignalRegistration` | `@gtkx/ffi` |
| Per-class binding container | `<X>Registry` / `<X>Table` | `SignalMetadata`, the `struct` locals | `@gtkx/ffi` |
| Factory-returned lifecycle/control object | `<X>Handle` | `McpServerInstance` | cross-package |
| The wrapped backing GObject (react) | `BackingInstance` / field `backingInstance` | `Container` / `ContainerClass` / `Node.container` | `@gtkx/react` types |
| Reconciler root | `Container` (React HostConfig term only) | — (reserved) | `@gtkx/react` host-config |
| GValue construction stem | `valueFrom<Source>` shared by the marshalling surface and its private builders | `newFrom` / `newFromObject` / `fromJS` mismatch | `@gtkx/ffi` gvalue |
| JS wrapper of a native instance (variable) | `instance` | `obj` | `@gtkx/ffi` |
| A `Gtk.Widget` parameter (testing internals) | `widget` | `element` (except RTL-mirrored public names) | `@gtkx/testing` |
| Threaded context parameter | `context` (mirrors the `*Context` type suffix) | `ctx` | codegen writers |
| Application identifier | `applicationId` / `--application-id` / `GTKX_APPLICATION_ID` | `appId` / `--app-id` / `GTKX_APP_ID` | whole repo (incl. MCP wire field) |
| Log/status string parameter | `message` | `msg` | `@gtkx/cli` |
| The `@gtkx/native` worker thread | "GLib thread" / `GlibThread*` / `GLIB_THREAD_STATE` | "GTK thread" / `GtkThread*` / `GTK_THREAD_STATE` | `@gtkx/native` |

The lexicon is internally consistent: `render*` wins every "return a source
string" contest, which frees `write*` to mean only filesystem effects; `Container`
is reserved for React's reconciler-root, which frees `BackingInstance` for the
wrapped-instance union; `get*`/`find*` split on exact-vs-walking behavior.

---

## 2. Findings by theme

### Misleading names

**`output-resolver.ts` resolves a *store*, not output.** *High.*
Every symbol in `packages/cli/src/codegen/output-resolver.ts` talks about the
codegen store (`findCodegenRoot`, `CodegenStore`, `resolveCodegenStore`,
`giStoreDir`, `jsxStoreDir`); nothing mentions "output", and the filename breaks
the `<noun>-resolver.ts` pattern of its siblings `gir-resolver.ts`
(`resolveGirPath`) and `library-resolver.ts` (`resolveLibraries`).
→ Rename to `store-resolver.ts`; update the lone import in `run-codegen.ts:8`.

**`flush` means both "emit CSS" and "tear down the sheet" in `@gtkx/css`.** *High.*
`css.ts:12` `flush(input)` compiles and inserts rules (an *emit*); `style-sheet.ts:60`
`flush()` removes the provider and resets all state (a *teardown*). One word, opposite
operations, in one package. → Rename the `css.ts` private helper to `insertRules`
(calls at `css.ts:69,136`). Leave `StyleSheet.flush` — it is pinned by the
`@emotion/sheet` contract referenced in `cache.ts:26`.

**Native entrypoint documented `start`, exported `init`.** *High.*
The napi export is `init` (`module/init.rs:42`, `native-binding.d.cts:22`, consumed
at `index.ts:158`), but `lib.rs:10`'s doc table lists a `start` row and
`js_bridge.rs:22` says "Set once during `start()`". No `start` exists. → Doc-only:
change the `lib.rs:10` row to `init` and the `js_bridge.rs:22` comment to `init()`.

**Worker thread named both "GLib thread" and "GTK thread".** *High.*
The OS thread is `gtkx-glib` running a `glib::MainLoop` and touching no GTK, yet
`state.rs` types it `GtkThread`/`GtkThreadState`/`GTK_THREAD_STATE` and prose across
`call.rs`/`alloc.rs` says "GTK thread" (29×) while `init.rs`/`stop.rs`/`dispatch.rs`
say "GLib thread" (9×). `stop.rs` even holds `GtkThread::global()` while reporting
"GLib thread exited". → Rename to `GlibThread*`/`GLIB_THREAD_STATE`; normalize prose
to "GLib thread" (leaving genuine references to GTK structs/functions).

### Verb lexicon

**Codegen uses four verbs for "produce TypeScript source".** *High.*
`emit*` (append to `ModuleContext`, void) and `render*` (return a string) are a
principled split, but `build*` is a redundant fourth verb for the return-a-string
role — `buildClassMembers` (`writers/class.ts:71`), `buildInterfaceMembers`
(`interface.ts:63`), `buildPlainTypeMembers` (`callables.ts:323`), `buildPropBlock`
(`react/jsx.ts:90`), `buildElementConsts` (`compounds.ts:153`), `buildBoxedMembers`
(`boxed.ts:57`). `renderElementWriteStatements` (`boxed-field-accessor.ts:137`)
returns void despite the render=string rule, and `ModuleBuilder.emit()`
(`dsl/module.ts:66`) / `ImportsBuilder.emit()` (`imports.ts:80`) overload `emit` to
mean "return the assembled string". → Rename string-returning `build*`→`render*`;
the void outlier→`appendElementWriteStatements`; both builder `.emit()`→`toSource()`
(call sites `pipeline.ts:62`, `module.ts:68`). Keep `generate*` for whole-file
producers.

**`renderTsType` defined twice with divergent signatures.** *High.*
`writers/ts-type.ts:38` exports `renderTsType(ctx, ref, isNullable)` with helper
`writeBaseType`; `react/props.ts:267` defines a private `renderTsType(repository,
ref, nullableHint, imports)` with helper `renderBaseType` — two implementations of
"produce a TS type string" under one identifier, differing in carrier and
nullability-flag name. `writeBaseType` and `writeArgsLiteral` (`function.ts:28`) are
also the only `write*` helpers that return a string instead of writing to disk.
→ `writeBaseType`→`renderBaseType`; `writeArgsLiteral`→`renderArgsLiteral`; qualify
the react one to `renderReactPropType`; standardize the flag on `isNullable`.

**Child detach: `removeChildFromParent` vs `detachChild`, inverted args.** *Medium.*
`widget.ts` holds `detachChild(child, container)` / `attachChild(child, container)`
(the dominant pair) and `removeChildFromParent(parent, child)` (`widget.ts:47`) —
parent-first, a strict subset of `detachChild`'s removable branch, called only from
`stack-page.ts:124`. → Replace that call with `detachChild(oldChild,
this.getParentWidget())` and delete `removeChildFromParent`. Keep `unparentWidget`
(distinct single-arg parent-resolving helper).

**`get` vs `find` registry lookups don't encode behavior.** *Medium.*
In `ffi/src/registry.ts` the intent is `get*` = direct map lookup, `find*` = walk
the GType hierarchy — but `findNativeObject` is a pure `objectRegistry.get(pointerId)`
(no walk, identical shape to `getNativeClass`), and `findNativeClass` exposes the
walk as a `walkHierarchy` boolean (called `findNativeClass(gtype, false)` in
`gvalue.ts:99`). → Rename `findNativeObject`→`getNativeObjectById`; drop the
`walkHierarchy` flag so `find*` always walks and exact callers use `get*`.

**Single-child page nodes: three verb pairs for one job.** *Medium.*
`StackPageNode` uses `addPage`/`removePage` (`stack-page.ts`); `NotebookPageNode`
uses `attachPage`/`detachPage` (`notebook-page.ts`); the `AttachOnParentVirtualNode`
family uses `attachToParent`/`detachFromParent`. All do the identical
wrap-child-into-parent job. → Rename `StackPageNode`'s pair to `attachPage`/
`detachPage`, matching its sibling and the base-class vocabulary.

**`read`/`write` vs `get`/`set` accessor pairs in react hooks.** *Low.*
`use-setting.ts` names its accessors `readSetting`/`writeSetting` but its dispatch
tables `GETTERS`/`SETTERS`, while `widget-metadata.ts` uses
`getAccessibleMetadata`/`setAccessibleMetadata`. → Rename to `getSetting`/`setSetting`
so the function verbs match the tables and the sibling module.

### Type suffixes

**`SignalDescriptor` declared independently in two packages.** *Medium.*
`ffi/src/signals.ts` `SignalDescriptor` is the native per-signal record
(`trampoline`, `invoke`, `emitTypes`, `returnGType`); `react/.../apply-props.ts`
`SignalDescriptor` is a prop-application union member alongside `ImperativeDescriptor`
/`ArraySyncDescriptor`. Same word, unrelated shapes, disambiguated only by import
path. → Rename the react one to `SignalPropDescriptor` (matching its
`*Descriptor` prop-role family); consolidate the two duplicate `SignalHandler`
type declarations onto the `unknown` variant.

**`Descriptor` vs `Metadata` for FFI per-class records.** *Medium.*
Single-element records mix suffixes (`RegisterClassVfuncDescriptor`,
`NativeClassDescriptor` vs `ClassVfuncMetadata`, `NativeSignalRegistration`), and the
per-class containers/register functions all say `Metadata` even where they hold a
`Descriptor` (`signals.ts` stores a `ReadonlyMap<…, SignalDescriptor>` under a type
named `SignalMetadata`; `register-class.ts` aliases the same collection to a local
`struct`). → Use `<X>Descriptor` for single records and `<X>Registry`/`<X>Table` for
containers, with register functions named after the container.

**`Handle` vs `Instance` for factory-returned lifecycle objects.** *Medium.*
`RenderHandle` (`render.tsx`) and `GracefulShutdownHandle` (`utils/.../graceful-shutdown.ts`)
use `Handle`; `McpServerInstance` (`mcp/src/server.ts:329`) uses `Instance` for the
directly parallel start/stop lifecycle object — and its own JSDoc calls it a "handle"
twice. → Rename `McpServerInstance`→`McpServerHandle`. Keep `UserEventInstance`
(a method bundle mirroring `@testing-library/user-event`'s `setup()`, not a lifecycle
handle).

### Noun families

**GValue construction named two ways across adjacent FFI modules.** *Medium.*
`value-marshal.ts` exposes `valueFromFfi`/`valueFromJS`/`valueFromObject`/`valueToJS`,
each a zero-logic pass-through to a private builder in `gobject/gvalue.ts` named
`newFrom`/`newFromObject`/`fromJS` — and those three disagree among themselves
(`new-` prefix on two, dropped on the third). → Share one `valueFrom<Source>` stem
across the surface and its builders (or fold the pass-throughs into `gvalue.ts`);
add a `valueToJS` private mirror for read/write symmetry.

**JS wrapper variable named both `obj` and `instance`.** *Low.*
`handles.ts` and `registry.ts` name the JS wrapper `obj`; `object.ts`,
`pending-construction.ts`, `signals.ts` name it `instance`. They interleave —
`registry.ts wrapHandle` passes `instance` into `setHandle(obj, …)`. → Rename the
`obj` parameters to `instance`.

**`Gtk.Widget` parameter named `element` vs `widget` in testing.** *Medium.*
`user-event.ts` and `wait-for.ts` call the widget `element`; `widget-text.ts`,
`queries.ts` (matchers), `role-helpers.ts`, `pretty-widget.ts`, `screenshot.ts` call
it `widget`; `queries.ts` even traverses with `node` while its matchers receive
`widget`. → Use `widget` for internal `Gtk.Widget` parameters; keep `element` only on
the RTL-mirrored public `waitForElementToBeRemoved`.

### Domain concepts

**`Container` carries three meanings in `@gtkx/react`.** *Medium.*
`types.ts` names the wrapped-instance union `Container`/`ContainerClass` (`Gtk.Widget
| Gtk.Application | Gtk.EventController | …`) — but in GTK "container" means a
child-holding widget, so a `Container` here usually is *not* one. React's HostConfig
simultaneously uses `Container` for the reconciler root (`appendChildToContainer`,
`getOrCreateContainerNode`), and `node.ts` has a `container` field. → Rename the union
to `BackingInstance`/`BackingInstanceClass` and the `Node.container` field to
`backingInstance`; reserve `Container` for the HostConfig root generic and the
React-named host methods.

### File / folder / module structure

**`dev-*` flat files vs the feature-subfolder pattern.** *Medium.*
In `packages/cli/src`, `create/`, `codegen/`, `mcp/`, and `vite-plugins/` each get a
subfolder, but the `dev` feature is a flat cluster (`dev-protocol.ts`,
`dev-runner.ts`, `dev-runner-deps.ts`, `dev-runner-main.ts`, `dev-supervisor.ts`) that
cross-imports as one unit, with only `commands/dev.ts` entering from outside.
`create/deps.ts` (foldered) vs flat `dev-runner-deps.ts` shows the same split.
→ Move into a `dev/` subfolder dropping the prefix (`dev/runner.ts`, `dev/deps.ts`,
`dev/runner-main.ts`, `dev/supervisor.ts`, `dev/protocol.ts`); update intra-cluster
imports, `commands/dev.ts`, the `bin/` shim, and mirror under `tests/dev/`. Verify
with a clean typecheck (the bin path resolves at runtime against `dist`).

### Abbreviations

**`ctx` vs `context`.** *Medium.* Codegen writers thread `ctx: ModuleContext`
(`writers/*.ts`, `dsl/context.ts`) while react/cli/testing spell `context` for the
same role, and every `*Context` type name is spelled out. → Rename the value-level
`ctx`→`context` across `packages/codegen/src` (and `@param` JSDoc); type names unchanged.

**`appId` vs `applicationId`.** *Medium.* `config.ts`/`config-loader.ts` use
`applicationId`; the MCP layer, dev runner, and scaffolder abbreviate (`McpClientOptions.appId`,
`CreateOptions.appId`, `TemplateContext.appId`), and `dev-runner.ts` holds both forms.
→ Rename every casing to the `application` form repo-wide — `applicationId` in code, `--application-id` flag,
`GTKX_APPLICATION_ID` env/define, and the `@gtkx/mcp` wire-schema + MCP tool field. (Only the Flatpak
internally consistent protocol contract — migrate separately or translate at the
client boundary.)

**`msg` vs `message`.** *Low.* `create/scaffolder.ts`, `create/deps.ts`, and
`vite-plugins/gsettings.ts` use `msg` for the log/status string; `dev-runner.ts`
spells `message`. → Rename to `message`. (Leave `connection-registry.ts`
`send(message: IpcMessage)` — a structured payload, a different concept.)

---

## 3. Prioritized rename checklist

Highest impact first (severity, then cross-file reach).

1. **`@gtkx/native` — unify the GLib thread.** `state.rs`: `GtkThread*`/`GTK_THREAD_STATE`→`Glib*`/`GLIB_*`; update call sites in `module/init.rs`, `stop.rs`, `call.rs`, `types/{numeric,fundamental,boxed}.rs`; normalize "GTK thread" prose.
2. **`@gtkx/native` — fix `start`/`init` docs.** `lib.rs:10` row + `js_bridge.rs:22` comment (doc-only).
3. **`@gtkx/css` — rename the emit helper.** `css.ts` `flush`→`insertRules` (calls at 69, 136); leave `StyleSheet.flush`.
4. **`@gtkx/cli` — `output-resolver.ts`→`store-resolver.ts`** (update `run-codegen.ts:8`).
5. **`@gtkx/codegen` — collapse `build*`→`render*`, fix `write*` and builder `emit()`.** Rename the seven string-returning `build*`; `renderElementWriteStatements`→`appendElementWriteStatements`; `ModuleBuilder.emit`/`ImportsBuilder.emit`→`toSource()`.
6. **`@gtkx/codegen` — fix duplicate `renderTsType` + string `write*`.** `writeBaseType`→`renderBaseType`; `writeArgsLiteral`→`renderArgsLiteral`; react `renderTsType`→`renderReactPropType`; `nullableHint`→`isNullable`.
7. **`@gtkx/react` — rename the `Container` union.** `Container`/`ContainerClass`→`BackingInstance`/`BackingInstanceClass`; `Node.container`/`TContainer`→`backingInstance`/`TBackingInstance`; propagate through `node.ts`, `host-config.ts`, `factory.ts`, the node files. Reserve `Container` for the HostConfig root.
8. **`@gtkx/ffi` — `Descriptor`/`Metadata`/`Registry`.** Single records→`<X>Descriptor`; containers→`<X>Registry`/`<X>Table`; register fns named after the container; rename the `struct` locals; rename react `SignalDescriptor`→`SignalPropDescriptor` and consolidate `SignalHandler`.
9. **`@gtkx/ffi` — `get`/`find` registry split.** `findNativeObject`→`getNativeObjectById`; drop the `walkHierarchy` flag.
10. **`@gtkx/ffi` — GValue stem.** Share `valueFrom<Source>` across `value-marshal.ts` and `gvalue.ts`; add a `valueToJS` mirror.
11. **`@gtkx/cli` — `dev-*` flat files→`dev/` subfolder** (+ imports, bin shim, `tests/dev/`; clean typecheck).
12. **`@gtkx/mcp` — `McpServerInstance`→`McpServerHandle`** (`server.ts:329,350`, JSDoc, importers).
13. **`@gtkx/react` — child detach.** Delete `removeChildFromParent`; route `StackPageNode.removePage` through guarded `detachChild`. Rename `addPage`/`removePage`→`attachPage`/`detachPage`.
14. **`@gtkx/testing` — `element`→`widget`** for internal `Gtk.Widget` params (keep `waitForElementToBeRemoved`).
15. **App identifier — `appId`→`applicationId` repo-wide**, including `--application-id` flag, `GTKX_APPLICATION_ID` env, and the MCP wire field (both ends in-repo). Only the Flatpak manifest `app-id` stays.
16. **`@gtkx/codegen` — `ctx`→`context`** across `writers/*.ts` and `dsl/context.ts`.
17. **`@gtkx/ffi` — `obj`→`instance`** in `handles.ts`, `registry.ts`.
18. **`@gtkx/react` — `readSetting`/`writeSetting`→`getSetting`/`setSetting`.**
19. **`@gtkx/cli` — `msg`→`message`** in `scaffolder.ts`, `deps.ts`, `gsettings.ts` (+ test mocks).

---

## 4. Considered but kept (justified divergences)

These were raised by an auditor and, under adversarial scrutiny, judged correct as
they stand — the differing names encode a real distinction or are fixed by an
external contract.

- **`native` in `@gtkx/ffi` is *not* overloaded.** `gvalue-native.ts`, `getNativeObject`/`findNativeObject` ("native pointer"→JS wrapper), `nativeCall`/`nativeStop` (`@gtkx/native` transport), and `registerNativeClass` (GType-backed type) all denote one coherent thing: the underlying C/GObject runtime substrate. The "hand-written low-level" wording in the GValue file describes the file's implementation, not a second meaning of the token. No rename.
- **The `Registry`/`Store`/`Cache`/`Manager` noun family** tracks real architectural roles, not synonyms — e.g. `ConnectionManager` (app routing) over `ConnectionRegistry` (raw sockets) is a deliberate layer split; `*Cache` types are recomputable memoization; `css/cache.ts` is a singleton, not a keyed collection.
- **The teardown verbs are mostly intentional.** `start`/`stop` (servers), `connect`/`disconnect` (client), `closeAll(reason)` vs `clear()` (reject-in-flight vs drop-table), and the reconciler-fixed `detachDeletedInstance` are distinct acts; the only genuine overlap is `ConnectionManager.cleanup()` ≈ `ConnectionRegistry.closeAll()`, a minor item.
- **`compounds-meta.ts`** holds a codegen lookup table (`VIRTUAL_SUBCOMPONENTS`) and contains no `Metadata` identifier; the `*Metadata` family names typed GObject records. Different roles — renaming to `compounds-metadata.ts` would be cosmetic only.
- **`Config` in `@gtkx/testing`** (the `getConfig`/`configure`/`Config` trio) deliberately mirrors `@testing-library/dom`'s public API and is a mutable runtime singleton, distinct from the on-disk `GtkxConfig` and per-call `*Options` bags.
- **`UserEventInstance`** mirrors `@testing-library/user-event`'s `setup()` instance (a method bundle), so `Instance` is right there even though lifecycle objects use `Handle`.
- Lower-confidence items not confirmed under full scrutiny: vite-plugin export names (`gtkxResources` etc.), the two vitest `gtkx` default exports, `ConnectionManagerEventMap` vs `*Events`, and the `captureSnapshot` screenshot helper.

---

*Verdicts are from a multi-pass adversarial review; every confirmed item was checked
against the actual source. Where a high-severity item appears in section 4 rather than
section 2, a fuller verification pass justified the divergent names — treat those as
settled unless new evidence emerges.*
