# GTKX 2.0 polish audit

The stable release is scheduled for 1 December 2026. Work starts from `c7f7134b` on `feat/polish-v2` and follows the [development principles](../website/contributing/principles.md).

This is the working record for reviewing every tracked file. A search result, passing test, or review of a neighboring file does not count as reading a file. The inventory below records the starting scope; the review batches name the files actually read and the findings still open. No package is complete yet.

## Working method

1. Choose a folder and list its tracked files with `git ls-files`. Read each file and trace the consumers needed to understand its contract.
2. Check package responsibility, memory and lifecycle behavior, supported inputs, type invariants, shared sources of truth, test quality, consumer relevance, and opportunities to reuse maintained dependencies against the principles. For documentation, check concise human writing, consistent structure, GTKX-specific scope, and links to API references or official third-party docs instead of duplicated specifications and background lessons.
3. Record a concrete finding with its source, observable consequence or violated principle, and the next coherent change. Distinguish confirmed defects from behavior that still needs reproduction.
4. Fix one coherent responsibility or behavior at a time. For bugs, reproduce through a public API before the fix when doing so is safe. Exercise real native libraries and generated bindings; do not add tests of private helpers.
5. Validate the changed contract's happy path, supported boundaries, and errors. Run the relevant type, lint, integration, and consumer checks. Run native memory changes through the sanitizer suite separately from other native builds and tests.
6. Commit the fix and update this record with the evidence and remaining work. A file with unresolved findings remains open even after it has been read. Revisit callers and generated consumers whenever a shared contract changes.

Review tests and fixtures alongside production code. Tests that assert internals, cosmetic errors, or unsupported behavior need the same scrutiny as implementation code. Generated outputs are checked through their generators and consumer behavior; they are not manually repaired.

## Review order

| Pass | Scope | Completion evidence |
| --- | --- | --- |
| 1 | Native memory, handles, FFI operations; runtime conversion, callbacks, signals, class registration | Safe native ownership and lifetimes; binding semantics owned by runtime; native integration and sanitizer coverage |
| 2 | GIR model, call descriptors, generated GI/JSX, overrides | Executable bindings and declarations share their model; overrides only wire runtime implementations; generated consumer checks |
| 3 | Reconciler, generated element primitives, components and hooks | Thin native host operations; composed behavior above reconciliation; real render/update/unmount tests and visual checks where relevant |
| 4 | Application packages, testing tools, CLI, build and packaging | Supported consumer behavior; no monorepo workarounds in production; installation, development and packaged application checks |
| 5 | Examples, website, scripts, configuration, release automation | Examples follow the principles; documentation matches the resulting contracts; release and platform validation |

Passes overlap where they share a contract. The first batch reads the three architectural boundaries in parallel; subsequent work follows the dependencies exposed by those findings.

## Package inventory

Counts are tracked files at the starting commit, including source, tests, fixtures, configuration and package metadata. They are scope counts, not quality scores or completion percentages.

| Package | Files | Review state |
| --- | ---: | --- |
| `native` | 99 | API folder read; memory access fixed in batch 1; ownership migration open |
| `runtime` | 115 | Initial call/callback path read; ParamSpec override migrated; remaining conversion/ownership work open |
| `codegen` | 144 | All override templates read; remaining generator folders pending |
| `react` | 47 | Core reconciler read; nullable drag icon fixed; lifecycle and metadata migrations open |
| `components` | 50 | All files read; all initial findings resolved; repeat review continues |
| `animated` | 19 | All files read; text, prop contracts, dead code, tests and guides fixed; upstream ref compatibility retained |
| `cairo` | 32 | All files read; ownership, error propagation, native values and image-data safety fixed; repeat review found no further defect |
| `gl` | 6 | All files read; exact 64-bit bindings and thin overrides fixed; callback release remains open |
| `css` | 21 | All files read twice; named-color and registry fixes validated; documentation corrected |
| `forms` | 17 | All current files read; callback refs, shared types and explicit ComboRow IDs fixed; repeat review continues |
| `i18n` | 17 | All files read; contextual lookup and locale formatting fixed; repeat review found no further confirmed defect |
| `navigation` | 66 | All files read; stack option lifetimes, closing headers and lazy route restoration fixed; repeat review found no further local defect |
| `storybook` | 31 | All files read; unset selections, readonly controls, shared types and documentation fixed; upstream strict declaration checking remains open |
| `config` | 18 | All files read; concurrent import isolation fixed; repeat review continues |
| `cli` | 262 | Generated consumer and catalog-reference fixes verified; full package pending |
| `create-gtkx` | 31 | Pending |
| `mcp` | 26 | Pending |
| `testing` | 60 | ComboRow display-value matcher fixed; full package pending |
| `vitest` | 12 | All files read; packaged preload, Sway configuration and notification sink fixed; repeat review found no further confirmed defect |
| `e2e` | 117 | Relevant regression coverage reviewed with each fix; full suite audit pending |
| `eslint` | 36 | Pending |
| `utils` | 60 | Omit preserves source unions; full package pending |

Outside the packages, the starting scope includes 397 example files, 174 website files, 15 scripts, 23 GitHub configuration files, 3 patches, 30 root files, and one file each under `docs`, `.nx`, and `.vscode`. All remain open for a full file review, including documentation read for context during this first batch.

## Batch 1: architectural boundaries

### Native API and allocation access

All 23 files in `packages/native/src/api` were read: `alloc.rs`, `bind.rs`, `bind_field.rs`, `call.rs`, `copy.rs`, `get_fundamental_wrapper.rs`, `get_type.rs`, `get_wrapper.rs`, `init.rs`, `keep_alive.rs`, `log_listener.rs`, `new_object.rs`, `parent_death.rs`, `quit.rs`, `read.rs`, `register_class.rs`, `resolve_type.rs`, `set_fundamental_wrapper.rs`, `set_wrapper.rs`, `symbol_address.rs`, `type_class.rs`, `vtable.rs`, and `write.rs`.

`packages/native/src/api.rs` and `handle.rs` were also read completely. Supporting reads traced the affected paths in `ffi/codec.rs`, the struct, boxed, buffer, callback, numeric, boolean and fundamental codecs, and `ffi/closure.rs`. Those supporting reads do not close the entire FFI folder. Validation also included complete reads of `scripts/asan-native.ts` and `scripts/rust-nightly.ts`.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| N1: field access loses allocation bounds | Field reads/writes and inline aliases could bypass recorded allocation bounds. A shared range check now covers bound/unbound field access and both sides of copies. Aliases retain their declared size or remaining owner extent. | Fixed; native integration regressions cover exact fits, nested aliases, siblings, invalid offsets and undersized copy sources |
| N2: JavaScript receives raw native addresses | `symbol_address.rs` returns an address; `bind.rs` accepts one. Runtime closure and decoded-callback paths transport pointers as integers. Opaque ownership and lifetime contracts must replace these together with their callers. | Fixed in batch 2; opaque function/data handles, callback expiry and async owner retention verified, including the 833-test sanitizer checkpoint |
| N3: native code owns binding policy | `register_class.rs` implemented class, signal, interface and CSS policy; field and call codecs performed value conversion. Runtime now owns class policy and scalar conversion plans while Rust retains native memory and ABI operations. | Partially fixed; remaining storage, container and ownership semantics are tracked by R2 |
| N4: raw object aliases lack an operation lease | After wrapper collection, a retained handle may coexist with a native worker holding the last reference. Checking the finalization marker does not keep that object alive between pointer extraction and native use. | Fixed; GLib operation leases cover native use and recursive aliases; safe worker regression, 1,501 normal tests and 840 sanitizer tests pass |

The memory fix does not establish that unknown-size native pointers are bounded or that the entire native API is safe. Those contracts remain part of the native/FFI review.

N2 also includes numeric pointer inputs in `ffi/codec/buffer.rs` and decoded callback address pairs in `ffi/closure.rs`. Decoded callbacks do not participate in handle borrow-scope invalidation; runtime currently guards repeat invocation only for async-scoped callbacks. The replacement must model the native owner's lifetime and callback expiry, including a call-scoped callback retained by JavaScript after its invocation ends. Existing address tests establish the current integer API, not the required opaque safety contract.

N3 includes signal naming/accumulators, interface prerequisites and property overrides, CSS naming, object-construction policy, output-ref updates and recognition of async completion signatures. Wrapper identity policy must also be separated from the native toggle/finalizer mechanics that uphold lifetime safety. No concrete defect was identified in the reviewed initialization, shutdown, keep-alive or log-listener mechanics. Parent-death supervision serves real consumer subprocesses; its thread and fallback paths must be evaluated against that use case, not removed merely because they exist.

### Runtime call and callback path

Files read in `packages/runtime/src`: `arg.ts`, `bind.ts`, `callback.ts`, `closure.ts`, `fn.ts`, `folded-lengths.ts`, `native-value.ts`, and `tuple.ts`.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| R1: closure setup manipulates native addresses | `closure.ts` reads a C callback address as `biguint64`, resolves the generic marshal as a bigint, and passes those integers to native calls. `native-value.ts` receives `fnPtr`/`userData` integers and rebinds callbacks from them. These are the runtime callers for N2. | Implemented with N2; runtime closure and GValue paths now use opaque handles |
| R2: conversion ownership is split | `fn.ts` passes most inputs directly to native codecs, while `native-value.ts` separately converts collections, wrappers and callback values. Moving marshalling into runtime requires a single conversion path for arguments, returns, fields, callbacks and inout values. | Open; preserve generated binding behavior during migration |
| R3: callback shapes are weakly modeled | `callbackFromNative` casts the native result to a partial pointer pair and silently returns an unrecognized shape. `wrapCallback` checks whether its already function-typed parameter is callable. Model the actual boundary variants explicitly as part of callback migration. | Fixed in batch 2; native-generated callback shape and explicit narrowing at erased input boundaries |

No new finding was identified in `arg.ts`, `bind.ts`, `folded-lengths.ts`, or `tuple.ts` during this initial pass beyond the shared contracts above. They still need review alongside all of their callers and relevant tests before closure.

### Codegen overrides

All 10 files in `packages/codegen/overrides` were read: `glib/index.ts.ejs`, `glib/regex.ts.ejs`, `gobject/index.ts.ejs`, `gobject/object-class.ts.ejs`, `gobject/object.ts.ejs`, `gobject/param-spec-getters.ts.ejs`, `gobject/param-spec.ts.ejs`, `gobject/value.ts.ejs`, `gtk/index.ts.ejs`, and `gtk/widget-class.ts.ejs`.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| C1: ParamSpec override implements behavior and duplicates types | The template owned branding, name types and wrapper construction. `runtime/src/param-spec-override.ts` now owns the implementation; `property-types.ts` supplies the shared name types used by registration. The template supplies its generated ParamSpec class to a typed runtime factory. | Fixed; generated imports/declarations and real class/interface/GType override behavior verified |
| C2: remaining templates contain executable adapters | Templates owned receiver/handle conversion and wrapping instead of directly attaching runtime implementations. | Fixed in batch 2; runtime adapters verified through generated consumer imports and integration tests |
| C3: codegen redeclares shared descriptor information | `src/analysis/descriptor.ts` redeclares native `Ownership` and descriptor-name/type information. Some options also contain generation expressions, which must remain distinct from the underlying native descriptor fields. | Fixed in batch 2; shared types derive from native descriptors and the runtime descriptor builders |
| C4: override import lists are repeated | `src/store/gi/bootstrap.ts` and the GLib/GObject index templates repeat the override module lists. ESM caching prevents duplicate execution, but the lists can drift. | Fixed in batch 2; one override catalog drives template discovery, bootstrap imports and barrel exports |

The GLib, GObject and GTK index templates already contain wiring only. Remaining executable adapters are in regex methods, object-class/widget-class peek methods, fluent object methods, ParamSpec getters and GValue methods. The override review found architecture and type-ownership violations, not an independently reproduced behavior defect in those templates.

Batch 2 also consolidated readable/writable property extraction across registration, overrides, runtime property access and the React property hook.

Knip cannot follow the EJS template's use of the new runtime exports. `knip.json` therefore records the generated-only factory/type module alongside its existing exception for `runtime/src/internal.ts`. The generated consumer check verifies the actual use; no production fallback or artificial call site was added to satisfy the repository tool.

### Reconciler

Files fully read in `packages/react/src/reconciler`: `host-config.ts`, `instance.ts`, `node.ts`, `registry.ts`, `apply-props.ts`, `behaviors.ts`, `child-routing.ts`, `placement.ts`, `metadata.ts`, `signals.ts`, `root.ts`, `root-element.ts`, and `devtools.ts`.

Other files fully read in `packages/react/src`: `element-behaviors.ts`, `element-config.ts`, `bootstrap.ts`, `config.ts`, `index.ts`, `internal.ts`, all six files in `components`, and `hooks/use-presented-instance.tsx`. The review also covered `packages/codegen/src/react/element-config.ts`. Selected declarations in `prop-types.ts` and relevant integration tests were read for context; that does not close either file or the test suite. `style.ts`, `text.ts`, accessibility utilities and the remaining hooks are still pending.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| X1: nullable drag icon throws | `GtkDragSourceProps.icon` permits null, but the behavior dereferenced it. The behavior now models null and passes `setIcon(null, 0, 0)` to GTK. | Fixed; initial null and configured-to-null regressions passed with controller identity/attachment preserved; native fixture visually inspected |
| X2: host behaviors implement a separate lifecycle | `reconciler/registry.ts` exposed initialize/flush/teardown and per-node state. Deferred behaviors installed signal watchers and microtask restoration for controlled selection/visibility. | Fixed in batch 2; composed effects live in components/hooks and host lifecycle machinery is removed |
| X3: Sidebar behavior depends on native implementation details | `element-behaviors.ts` traverses native-created Sidebar descendants, unbinds models and disposes rows after mode changes. Part of `adw-navigation.test.tsx` also asserts that internal structure. | Upstream defect reproduced and patched locally; compatibility retained in runtime until an official upstream release includes the fix, with public integration coverage |
| X4: element configuration has two different type models | React's `ElementConfig` omits `acceptedChildTypes`, added through an intermediate object. Codegen's `BuiltinElement` repeats the shape and adds that field. | Fixed in batch 2; canonical ElementConfig shared with codegen |
| X5: whole-subtree teardown may retain non-widget attachments | `placement.ts` detaches during subtree teardown only when parent and child are widgets with the expected native parent. Controllers, action groups, actions and object-valued slots take another path. | Fixed in batch 2; native removal detaches retained attachments before GTK unroots the subtree |
| X6: adopted page refs may become stale | Slot rebuilds replace native page objects and update `LazyNode.adopted`; stable public React refs may still reference the old object. | Fixed in batch 2; adopted refs update before parent layout effects and honor callback cleanup |
| X7: omitted drawing callback may stay installed | The shared `value` behavior skips undefined, including removal of the optional `drawFunc` prop. Existing drawing tests cover initial drawing and redraw. | Confirmed and fixed in batch 2; omission now clears the native callback, with explicit-null and omitted-prop integration regressions |
| X8: host behavior composes additional objects | Menu descriptions recursively create `Gio.Menu` objects; other behaviors create implicit row wrappers and layouts. | Fixed in batch 2; menu descriptions compose JSX, implicit rows come from native container insertion, and explicit layout elements retain their construct-only content |
| X9: custom-element tests assert internals | Part of `custom-elements.test.tsx` invokes behavior hooks directly and checks consumed prop-name arrays/config merging. | Fixed in batch 2; public custom-element render/update/unmount/error coverage replaces helper assertions |

Window/dialog presentation and application startup are already above reconciliation in the reviewed components and hooks. Keep those responsibilities there. No list-item-factory implementation was found in the bounded reconciler review; its actual package still needs review.

## Validation record

The first batch has passed the full runtime and renderer projects: 1,684 tests across 112 files, excluding the separately scheduled query performance suite. The final sanitizer target passed all 802 addon and generated binding tests. Native regression reproduction, generated consumer validation and static checks are recorded below.

| Check | Evidence |
| --- | --- |
| Native regression reproduction | Six failing read/write/copy cases reproduced against an inline field inside a larger allocation, without leaving that backing allocation |
| Native addon integration | 284 existing tests passed; all 38 new bounds cases passed, covering bound/unbound APIs and struct/boxed copy sources |
| Generated property override integration | 11 focused tests and 167 registration tests passed, including class/interface/GType sources, property spellings, notifications and errors |
| Generated consumer declarations and imports | CLI fixture passed with typed property access, rejection of invalid source unions, and actual ESM evaluation in a fresh process |
| Renderer regression reproduction | Initial null and configured-to-null icon cases failed before the fix; four new renderer cases and two existing drag/drop cases passed afterward |
| Native visual inspection | Rendered and inspected the null-icon fixture; controller remained attached and the native window rendered normally |
| Workspace typechecking | Final `mise exec -- pnpm typecheck` passed all 63 type/build dependency tasks across 30 projects |
| Workspace lint | Final `mise exec -- pnpm lint` passed all 66 ESLint, Rust and Knip tasks across 31 projects |
| Workspace integration | Final `mise exec -- pnpm test` passed all 46 test/build dependency tasks across 19 projects in 4 minutes 23 seconds |
| Documentation production build | VitePress rendered all 6,119 pages and generated the sitemap in 425 seconds |
| Final sanitizer target | `mise exec -- env GTKX_MAX_WORKERS=2 pnpm exec nx run @gtkx/e2e:test:asan` passed 322 addon tests and 480 generated binding tests; the normal native binary was restored afterward |
| Sanitizer tooling checks | ESLint and TypeScript passed for the expanded runner; whitespace checks passed for all changes |
| Independent diff review | Native bounds and ParamSpec factory changes reviewed independently, including widths, alias ownership, copy sources, generic typing and ESM initialization; no blocking findings |
| Audit inventory | Counts checked against all 22 packages and 1,286 tracked package files at `c7f7134b` |

The sanitizer target now runs the native addon and generated binding fixture suites through their own configs. Its Nx inputs include the addon tests/config/entry files so changing a regression invalidates the cached sanitizer result. This keeps the new memory-boundary regressions in CI's sanitizer lane. The normal addon is rebuilt in the runner's existing `finally` block.

## Batch 2: parallel fixes and repeat audits

The second batch follows three independent workstreams: native/runtime contracts, generated binding wiring, and renderer behavior. Each workstream gets another source review after its focused tests pass. New findings from that review stay in the same workstream until corrected and rechecked.

### Generated binding wiring

C2–C4 are implemented and independently re-read within their scope. All ten override templates now contain wiring and declarations; `runtime/src/override-methods.ts` owns the receiver adapters. `codegen/src/store/gi/overrides.ts` supplies one catalog for template inventory, bootstrap imports and barrel exports. Shared descriptor metadata derives from its native/runtime owners, while generation expressions remain generation-specific. Readable and writable property extraction is shared in `runtime/src/property-types.ts`.

Validation passed 79 integration tests, including 15 new public generated-binding cases for regex byte positions/lifetimes/errors, type-class peeking and ParamSpec getters. The generated consumer check passed strict declarations, rejected invalid property/source types, and evaluated generated ESM in a fresh process. Runtime/codegen typechecks, targeted lint and whitespace checks passed.

### Native and runtime contracts

The first opaque-pointer implementation passed 74 focused addon cases, 295 addon cases excluding the concurrent class migration, and 103 generated callback/vfunc/signal cases. Call-scoped callback handles expire after the enclosing invocation; async handles expire before first invocation; notified callbacks retain their destroy notifier. Runtime callback conversion uses the native-generated shape. Inputs erased to `unknown` are narrowed at that boundary.

The repeat audit found and corrected additional pointer escapes through numeric conversion, function handles accepted by data codecs, and GValue pointer bindings. Five wrong-kind and numeric-address regressions were reproduced safely using a native function that compares pointers without dereferencing them. Async buffer arguments now retain their backing handle, including nested field/function ownership and an actual GObject reference when wrapper installation has consumed the original handle's reference. Call-borrowed and one-shot handles cannot escape into an asynchronous call.

Signal validation/registration, accumulators, interface ordering/property overrides and CSS naming have moved into runtime class initialization. Rust retains the class/vfunc allocation and lifetime mechanics. Runtime supplies async-completion metadata and applies native output values to JavaScript references. The construction path validates declared property bindings in runtime, while native enforces the GObject memory contract and finishes ownership cleanup before propagating native criticals. These changes passed 168 runtime registration cases, 42 addon class cases, 112 construction/property cases and 35 property-hook cases.

The second memory review found that class handles discarded their known class extent and that construction accepted undersized GValue buffers. Type-class lookup and class initialization now retain their extent. GValue inputs require their full storage size, with unaligned reads supported. Public addon regressions cover both boundaries. The independent class review also caught signal declarations containing a detail suffix; original names are now validated before canonicalization.

The native/runtime checkpoint passed 1,137 tests across 85 files before scalar migration. The next repeat review found that handles retained after wrapper collection could still carry a freed GObject address. A regression reproduced this using pointer comparison after a registered finalize vfunc ran, without dereferencing freed memory. Native handles now share an actual-finalization marker stored through GLib's qdata API. An initial weak-notify implementation was rejected by dispose/lifecycle tests because weak notification occurs before finalization. Native object codecs return opaque handles consistently; runtime owns wrapper identity selection and default-application comparison.

R2 remains open. Stage 1 moved boolean, Unicode character, enum and flag semantics into compiled runtime conversion plans shared by calls, fields, callbacks, references and collections. Native scalar codecs have been removed. Semantic descriptor types belong to runtime and derive their unchanged ABI fields from native. The combined addon/runtime/generated-native checkpoint passed 1,494 tests across 98 files. The final sanitizer run passed 351 addon and 482 generated-native tests (833 total), then restored the normal addon. The repeat scalar review corrected call arity, callback default returns, enum/flags class-cache collisions, mutable per-access descriptors and atomic publication of decoded reference outputs. A subsequent container slice moved hash-table iterable normalization to one runtime implementation, so direct `t.fn` calls now accept Maps for identity and semantic entry plans; all 23 public GIMarshallingTests hash-table cases pass.

The scalar storage stage now allocates ABI-sized output slots through bounded native handles while runtime owns initialization, conversion, public Ref objects and atomic result publication. Native callbacks lend scoped handles over their scalar pointees, zero caller-allocated out storage before it becomes readable, preserve inout seeds and revoke access after return or failure. Scalar slots retained for async calls keep their owner alive through completion. The complete normal checkpoint passes 1,522 cases across 99 files; the sanitizer checkpoint passes 370 addon and 487 generated-native cases, then restores the normal addon. Independent review found no blocker and added explicit runtime coverage for scalar callback inout seeds. Subsequent R2 stages cover string/container packing and explicit ownership operations. Non-null HashTable inout references remain unsupported until that container stage.

The subsequent N4 review identified a native-worker race after wrapper collection. A deterministic C fixture released the worker's last reference during an FFI call and observed finalization through an independent marker, without dereferencing freed memory. Five cases failed on the previous addon. GLib weak-reference leases now hold objects through the complete native operation, including recursive aliases, field access, copies, callbacks and async retention. Reachable wrappers preserve access to disposed objects. All seven regressions pass, including reentrant calls and exception cleanup. The combined checkpoint passed 1,501 tests across 99 files and 840 sanitizer tests; the normal addon was restored.

### Renderer behavior

X5–X7 were reproduced through public rendering and retained native references. The fixes cover controller/action detachment, replacement of adopted page refs, ref availability before parent layout effects, and removal of drawing callbacks. Shared element metadata uses ElementConfig directly, and custom-element assertions exercise actual rendering/updating/unmounting instead of behavior helpers.

The repeat review caught an initial-layout ref regression, and the broader renderer run caught cleanup occurring after GTK had unrooted constraint layouts. Ref publication now occurs before parent layout effects, and subtree attachment cleanup runs during native removal rather than passive cleanup. Public retained-object and constraint-layout regressions cover both.

X2's controlled-value observers, VFL effects and accessibility map observation have moved into components/hooks. The generated element component merges accessibility observation with consumer refs before regular and lazy element branching. Reconciliation retains only post-commit property writes, and unmount removes queued writes and map listeners. Generic initialize/flush/teardown/context/deferred behavior machinery has been removed. Native host instances retain their own style resources. List props use immutable previous/next values; a test that mutated already-rendered props was corrected to use React's supported update model. The broad renderer run passed 896 cases across 40 files after the remaining type-model and upstream fixes.

For X8, menu descriptions now compose keyed JSX menu/menu-item elements. ListBox and FlowBox use GTK's native implicit rows and preserve row identity through reordering. AdwLayout was reviewed separately: delayed construction supplies its construct-only content for the explicitly declared JSX object, so this is host-instance construction rather than hidden composition.

The repeat type review identified conflicting ToggleGroup selection props. The supported invariant is encoded as a canonical exclusive union. Seven public/rendering and generated-consumer cases pass, accepting both valid forms and rejecting simultaneous values. The strict generated-declaration issue found by that consumer check is recorded below as C5.

### Upstream defects

Three renderer failures reproduced in standalone C without GTKX: GTK 4.22.4 crashes during idle after clearing a presented TextView buffer; libadwaita 1.9.3 can parent a SidebarItem suffix twice after a mode change; and ComboRow default-factory callbacks can outlive their row. Reproductions, versions, source links and patch status are recorded in `/home/eugenio/UPSTREAM.md`.

The TextView workaround lives in a runtime adapter wired by a generated override. It asks GTK's existing getter to materialize its default buffer after a nullable write. All five public write paths, invalid values, repeated replacement and GtkSource's native buffer factory passed 15 integration cases; 40 existing property cases also passed. The independent adapter review found no additional defect.

X3's internal Sidebar traversal has been removed from reconciliation. Its temporary compatibility behavior remains required until the upstream fix is released. An upstream fix was prepared in an isolated libadwaita checkout; no system library has been replaced. The original C reproduction passes with fatal criticals enabled. All 31 upstream checks and seven GTKX Sidebar cases pass against the local patched library. A separate release-tarball stylesheet check bug also has a one-line patch and configure reproduction. The chosen policy is to keep compatibility workarounds until official upstream releases contain the fixes.

Sidebar compatibility now lives in runtime and is installed when its wrapper is registered. A weak mode observer covers direct methods, properties, GValue writes and native changes without adding setter-specific hooks. Twelve public integration cases pass on the installed library, including rejected writes followed by recovery, initial PAGE JSX and native Breakpoint changes. The existing navigation and TextView checks also pass there. The installed libraries remain the validation target.

ComboRow compatibility also lives in a runtime adapter wired by the generated Adw override. It records only the exact default-factory and bound-box signal handler IDs that carry the row as data, then disconnects those IDs at row destruction without touching custom factory handlers or dereferencing the dying row. Six public lifetime and behavior cases cover retained items, replaced factories, bound boxes, rejected writes, shared custom factories and retained rows. The proposed libadwaita patch uses object-bound signal connections and adds an upstream regression; its standalone C reproducer, new ComboRow case and all 67 upstream test binaries pass. The installed library remains unpatched, so GTKX keeps the adapter until an official release contains the fix.

The codegen documentation review also found that handwritten Pick-based props lost their selected members in generated reference pages. Finite string-literal Pick support now preserves the source members, with all 12 CLI documentation cases passing.

### Strict generated declarations

C5 was reproduced in a standalone consumer with one copied set of public packages: local implementation classes incorrectly declared implemented interfaces, merged interfaces disagreed about class/prerequisite member precedence, and generic root signal declarations indexed unconstrained shapes. The compiler also duplicated computed static Symbol.hasInstance declarations in a minimal input without GTKX; that reproduction is U4 in the upstream tracker.

C5 is fixed. Public declarations now model the interface members installed at runtime, resolving class and prerequisite conflicts from the existing analysis. Runtime interface registration owns membership predicates. Classes inherit canonical signal methods and supply their own signal metadata, preserving explicit signal specialization. The repeat review also removed duplicated signal extraction in useSignal and corrected its acceptance of detail suffixes on generated nondetailed signals.

Validation passed nine strict installed-consumer cases, including every generated GI/JSX namespace with library declaration checking enabled, accepted mixins and signal hooks, and rejected incompatible consumers. A further 61 CLI integration cases and 120 runtime/interface cases passed. All 30 workspace typecheck targets passed after source generation and repository project-reference synchronization. JavaScript lint and Knip passed after the runtime's public-documentation lint exception was aligned with the no-new-comments instruction.

The subsequent renderer failure was isolated as U5, the libadwaita ComboRow lifetime bug. After the focused runtime adapter and public regressions, the full installed-library renderer run passes 896 tests across 40 files without asynchronous or unhandled native criticals.

### Documentation audit

The first eight tutorial chapters have been read completely against the documentation principles. They now focus on GTKX behavior and progression, link to official React, TypeScript, Zustand, React Hook Form, React Navigation, GTK and GLib documentation for upstream concepts, and avoid repeating complete API descriptions. Misleading claims about task identity, render guarantees, search reset, dialog ownership and failure handling were corrected. The tutorial now uses GLib's markup escaping instead of maintaining a local replacement routine. Code fences, local routes and focused VitePress rendering pass; the first four chapters also passed the full site build.

The complete site subsequently passed a fresh production build: 6,119 pages rendered and the sitemap generated in 425 seconds.

### Components package audit

All 50 tracked files in `packages/components` were read, including source, internal modules, tests, helpers and configuration. Consumers in forms, React, runtime, the tutorial and GTK demo were traced. A temporary public reproduction under `/tmp` confirms seven failing cases; no package folder can be closed yet.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| COMP1: recycled cells retain another item's React state | Item and section portals are keyed by native host lifetime; reversing two logical values renders `B:A, A:B`. Section identity is discarded by the collection index. | Fixed; logical item and section keys prevent recycled hosts from carrying state across values, with public reorder regressions |
| COMP2: controlled selection and sorting drift | DropDown/ComboRow and ColumnView report rejected native changes but only restore controlled props after another React render. | Fixed; selection, expansion and sorting share one component-level controlled synchronization hook |
| COMP3: source/header types admit invalid combinations | Types admit both sources and section headers for plain items. The current renderer skips a missing section, but the advertised input still has no meaningful header behavior. | Fixed; exclusive sources require sections for a header renderer, preserving empty inputs and inferred payloads |
| COMP4: nullable controlled selection does not clear | `selectedId={null}` becomes the current native selection instead of `Gtk.INVALID_LIST_POSITION`. | Resolved; GTK and libadwaita auto-select a row in nonempty models, so nullable input was removed. Empty models report `null`; the upstream limitation is U6 |
| COMP5: estimated item sizes stay stale | Updating an estimate changes only registry state; realized placeholders retain the old size. | Fixed; surviving placeholders resize when estimates change or are removed, preserving rendered content sizes |
| COMP6: ColumnView accepts discarded children | The inherited generated type accepts `children`, while the component removes them and renders only `columns`. | Fixed; the public type omits `children` and no longer silently strips an unsupported input |
| COMP7: unsupported tree inputs drive production complexity | Cycle tracking, depth-8,000 chains and repeated-ID semantics have extensive implementation and tests despite the stated supported-input principles. | Resolved; finite acyclic trees require stable unique item IDs, and recursive traversal replaces cycle and extreme-depth machinery |
| COMP8: cells redeclare native property descriptors | Accessibility labels/descriptions are written through a local borrowed-string descriptor and raw property names. | Fixed; generated ColumnViewRow accessors own the property descriptors, with public update, clear and resolver-error cases |
| COMP9: fallback display serialization is hand-rolled | The default DropDown renderer catches failed JSON serialization and supplies another representation for unsupported structured values. | Fixed; primitive labels use String, and structured values require renderItem through the public types |
| COMP10: tests assert internals and wall-clock budgets | Tests inspect model splice emissions, enforce timing thresholds and emit a toast signal instead of clicking its visible action. | Fixed; removed internal hierarchy, splice and timing assertions; large lists verify visible updates and scrolling, and toast tests click Undo |
| COMP11: side-effect metadata is inaccurate | The package declares `sideEffects: false`, but collection-model import writes a shared symbol entry to `globalThis`. | Fixed; the cross-copy weak map is initialized only when a collection item is created or read |

The live-size fix passes eight public measurement cases across ListView, GridView and ColumnView. The complete components suite passes 114 tests; component test types and touched-file lint pass. A running native list was visually inspected at 40-pixel, 100-pixel and removed estimates. Only framework placeholders receive size updates; rendered content keeps its own dimensions.

The source union also survives the form ComboRow wrapper and its prop-omission helper. The shared helper uses type-fest's `DistributedOmit`, with no runtime import of that type-only dependency. Public integration cases exercise empty, sectioned and plain sources and preserve form selection through transitions. The complete components suite now passes 115 cases, and all 11 form cases pass. All 19 strict installed-consumer checks pass, rejecting mixed sources, headers without sections and discarded ColumnView children. Root typechecking, affected lint and Knip pass.

The remaining components fixes pass all 120 integration cases. Tree traversal no longer maintains cycle ancestry or manual stacks; an independent review found no regression for supported trees. Row accessibility uses generated accessors. Default dropdown rendering accepts primitive values, leaving nullish content empty; objects need a renderer, including when only the popup renderer is otherwise provided. All 25 strict installed-consumer checks cover these contracts and inferred JSX. Native trees, row labels and dropdown displays/popups were visually inspected.

### OpenGL package audit

All six tracked files in `packages/gl` were read. The generated modules were reviewed through their generator and exercised in a real `GtkGLArea`; the OpenGL guide and demo consumers were traced.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| GL1: 64-bit GL values lose their native range | `GLint64` and `GLuint64` were generated as `number`, and the sole value beyond JavaScript's safe integer range, `GL_TIMEOUT_IGNORED`, was omitted. This made the required `glWaitSync` call impossible and rejected exact timer-query results. | Fixed; signed and unsigned values now use `bigint`, typed arrays use the BigInt views, the full-width enum is emitted, and real sync/timer-query coverage passes |
| GL2: a custom wait loop duplicates OpenGL | `clientWaitSyncLoop` split a wait into one-second calls to work around the old numeric binding. The native command already accepts the entire timeout and defines its wait behavior. | Fixed; the helper and its documentation reference are removed |
| GL3: the debug override changes unrelated context state | Installing a callback also enabled debug output and synchronous delivery, diverging from `glDebugMessageCallback` and hiding two persistent GL state changes. | Fixed; callback registration is transparent, with context-state and message-delivery integration coverage |
| GL4: override discovery parses TypeScript with a regular expression | The package script inferred generated-name collisions by splitting one expected export-block spelling. | Fixed; the existing TypeScript compiler dependency supplies the module's actual exports |
| GL5: debug callback replacements retain every closure forever | The binding uses a `forever` callback because OpenGL has no destroy notifier. Clearing or replacing a context callback cannot release the corresponding runtime closure, so repeated registrations retain callbacks for the process lifetime. | Open; add an explicit runtime-owned callback lifetime that can be released after deregistration without exposing native pointers |

The focused GL codegen now emits all selected enums and compiles its generated modules. Codegen, GL and e2e typechecks and touched-file lint pass. Five real `GtkGLArea` cases pass, including exact signed and unsigned timer-query values, the required server-wait timeout, transparent debug registration and callback delivery.

### CSS package audit

All 21 tracked files in `packages/css` were read, including production code, native integration tests and configuration. The React style consumer and its integration suite were traced with the package.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| CSS1: unsupported malformed input drives custom parsing | Import-time random probes, a token scanner and NUL/containment filters attempted to classify malformed CSS before GTK. They duplicated Stylis and GTK, added a hidden side effect, and tested inputs outside the supported contract. | Fixed; the custom scanners and malformed-input matrix are removed, while GTK retains its development parsing diagnostics |
| CSS2: scoped and global styles suppress each other | One hash set tracked both insertion modes, so serializing identical styles in one mode could prevent the other mode from reaching GTK. | Fixed; scoped and global insertions have separate identities, with both orderings covered through rendered widgets |
| CSS3: named-color escaping corrupts valid CSS text | A fixed placeholder rewrote selectors and string values that already contained its prefix. | Fixed; each serialization selects a token absent from its input and owns the matching restore function |
| CSS4: Emotion labels are detected by character positions | Declaration removal checked two characters rather than the declaration property, allowing unrelated properties to match. | Fixed; removal requires an exact Stylis `label` declaration |
| CSS5: application color definitions disappear | Stylis stringify drops GTK's `@define-color` statements, including aliases used by otherwise valid declarations. | Fixed; a small GTK statement serializer preserves these native rules |
| CSS6: named colors collide with at-rule parsing | Keyword exemptions treat declaration values such as `@media` as rules; the hand-written identifier pattern also misses valid native names. | Fixed; PostCSS identifies declaration values and color-definition parameters before Stylis nesting |
| CSS7: plain strings collide with registry prototypes | `cx("constructor", generatedClass)` loses the raw class, and an empty Emotion registry changes `style` font values with the same name. | Fixed; registered classes use a null-prototype dictionary, and the style prop omits the unused registry |
| CSS8: guides describe removed implementation | Both guides promise containment warnings; the current guide also describes a per-widget provider that no longer exists. | Fixed; concise guides describe the shared provider and link upstream styling documentation |

The complete CSS package passes 16 native integration cases. The focused React style suite passes 20 render cases, and the affected TypeScript and ESLint checks pass. The implementation removes 268 more lines than it adds.

The repeat pass adds six native CSS regressions and one rendered style regression, all confirmed failing before the fixes. PostCSS replaces custom identifier recognition; Stylis retains nesting with a small extension for GTK color statements. All 22 CSS cases and 21 rendered style cases pass, with source/test types, lint and independent review. The native color example was visually inspected. No independently actionable upstream defect was established.

### Declarative shortcut construction audit

Generated JSX now exposes `GtkCallbackAction` with its required `callback` and `GtkShortcutTrigger` with its required `accelerator`. Small components keep callback identity current and remount immutable triggers when their accelerator changes. Host construction delegates to the native factories. Factory-only props, behavior and wrappers apply to their exact type, so concrete trigger subclasses retain their own construction contracts. The tutorial and six GTK demo files use the new elements; native-object props remain supported.

The constructor review also found that owner-class return overrides discarded GIR nullability and output tuples. C6 preserves the native primary result's nullable owner type before folding output parameters, in both emitted bindings and reference signatures. Strict consumer cases cover scalar nullability and nullable constructors with an additional output. The tuple defect was also confirmed in generated `Gst.Structure.fromString` bindings.

Validation passes 15 installed-consumer cases, 29 generated-binding cases, 13 CLI documentation cases, 98 shortcut/menu/input integration cases, and the affected library, test and root typechecks. Singleton and alternative shortcut types still need a broader constructor-model audit. The factory types also retain a naming distinction: their raw named property bags omit factory inputs, while `ComponentProps<typeof Element>` gives the complete element contract. A consistent public name for the complete factory props remains follow-up work.

### Animated package audit

All 19 tracked animated files were read. Six findings are resolved: text normalization now follows React's empty-child semantics and handles bigint text; generated construct-only prop names prevent springs on immutable inputs; animated collections accept readonly arrays instead of unsupported general iterables; unused scheduler ticks are removed; an impossible untyped-input test is removed; and both animation guides focus on GTKX integration and link to React Spring for its APIs.

The construct-only type metadata comes from GIR and the canonical React element configuration. It also supplies named prop types, inherited props, lazy-element omissions and codegen fingerprints, avoiding a separate hand-maintained animation list. Mutable props still accept springs, and native text writes avoid unnecessary React renders.

React Spring 10.1.2 still suppresses refs on ordinary React 19 function components. Its public `createHost` reproduces the failure without GTKX's animation wrapper; U7 and the reproduction are preserved in `/home/eugenio/UPSTREAM.md`. GTKX keeps its compatible wrapper until an official upstream release handles that path.

Validation passes 50 animated tests, 134 focused renderer cases, 15 installed-consumer checks, fresh generation of 19 namespaces and 643 elements, typechecks and lint. A running animated text fixture was visually inspected. React elements and non-text children intentionally use the React render fallback.

### Tutorial continuation audit

The next four chapters were read completely: Trash and Toasts, Preferences and Theming, Drag to Reorder, and Reminders. Both current and v2 versions now use the same concise GTKX-focused progression, with official upstream links for React, TypeScript, GSettings, GTK input, GValue, notifications and application activation. References to a nonexistent `@gtkx/components/adw` entry point and a time selector absent from the editor are corrected.

The example now queues notification navigation until the container is ready, enables reordering only in a manual unfiltered view, supports Alt+Up/Down, and rejects foreign text at the drop boundary. Delete confirmation carries its task in a discriminated union. New-list submission stays disabled for blank names and trims valid input before storing it. Shared settings tables replace repeated UI and theme choices.

Reminders record the notified due value in the persistent task and use stable notification IDs. Zero-minute reminders and delayed sweeps work; a delayed nonzero-lead regression was verified failing against the old condition and passing against the new sweep cursor. Public application tests pass 19 cases, and the built French application passes three translation cases. Live MCP inspection confirmed the main window, task rows, and disabled-to-enabled New List submission; screenshots were visually inspected.

Two cross-package contracts remain open: notifications still need a declarative GTKX API, and schema choice/enum metadata should drive the settings types and integer mapping instead of duplicating that contract in the example.

The combined documentation changes pass a complete VitePress production build, including page rendering and sitemap generation, in 441 seconds.

### Translation catalog references

A message shared by source and deployment metadata retained obsolete source locations after code moved or disappeared. GNU `msggrep` selects the whole shared entry, so joining it back also restored those old references. GTKX now uses the maintained gettext-parser dependency to retain only canonical metadata references before the existing GNU join step.

The public deploy/build regression failed with the old implementation and passes with the fix. All six localization cases and three adjacent CLI i18n cases pass, alongside CLI source/test types, lint and offline frozen-lockfile validation. Regenerated tutorial catalogs contain only current source references and preserve their translations; compiling the French catalog produces a byte-identical MO file.

### Forms package audit

All 18 files tracked in `packages/forms` at this pass were read, with both forms guides, affected component consumers and React Hook Form's public declarations. The new callback-ref regression file brings the package to 19 tracked files.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| FORM1: forwarded callback-ref cleanup is discarded | The local ref dispatcher calls a React callback ref but ignores its returned cleanup. Public replacement/unmount regressions fail for all five form rows. | Fixed; the shared maintained ref-composition helper preserves cleanup and the React Hook Form focus proxy |
| FORM2: nullish ComboRow defaults disagree with the display | A nullable or undefined field remains nullish while its nonempty native row shows the first option. The public field-path type advertises nullable values. | Fixed; require explicit non-nullable string IDs and preserve them while choices reload |
| FORM3: form metadata duplicates upstream types | Field names, binding callbacks and validation state redeclare parts of React Hook Form's contract. | Fixed; derive these shapes from the dependency's public types |
| FORM4: tests and guides duplicate cosmetic/upstream details | An edge test matches validation-message text; guides teach form state and incorrectly imply that context infers field names and missing defaults leave a combo row unselected. | Fixed; removed the cosmetic assertion and rewrote the guides around native bindings with upstream links |

All 18 forms integration cases pass, including seven new ref cases for replacement, unmount, object refs, focus/selection and cleanup errors. Source/test types, full package lint and independent ref review pass. The running focus/selection example was visually inspected. Existing broad FieldValues inputs still need value narrowing; this is an actual dependency boundary rather than an unsupported-input fallback.

FORM2 follows the explicit-ID contract selected by the maintainer. ComboRow field paths now require a non-nullable string, and empty choices preserve the form value until that ID is available again. Four native integration cases cover item and section sources, late loading, reloads, reset, setValue, dirty state and submission. The two reload regressions fail against the previous implementation; all 22 forms cases pass with the fix. Installed-consumer tests reject nullable and optional IDs and validate inferred field names, value types and item renderers; all 30 declaration cases pass. Source/test types, lint, independent review, visual inspection and all 18 Storybook inspector cases pass.

### Testing follow-up

The form source transition exposed a matcher issue: a custom ComboRow visibly rendered its selected label while `toHaveDisplayValue` returned an empty string. A public native regression confirmed it. The matcher now reads the selected factory content or the displayed subtitle independently of accessible-value overrides, excluding unrelated row titles and popup content.

Ten public regressions cover custom rendering, empty selections and models, subtitle mode, updates, open popovers, errors and DropDown compatibility. The broader testing run passed 219 cases before the final two empty-subtitle cases were added; all ten final regressions and six ComboRow lifetime cases pass. Testing/e2e types and affected lint pass. This was a GTKX matcher defect, with no new upstream report needed.

The combined checkpoint passes library builds, affected typechecks, root typechecking, lint, Knip and an offline frozen-lockfile install. Current API references generate successfully into a standalone output directory. The full website production build, page rendering and sitemap generation pass in 430 seconds.

### Internationalization package audit

All 17 tracked i18n files and both guides were read, with the generated translation-type emitter and tutorial consumers. Two public rendering regressions exposed incorrect contextual fallback and locale formatting. A contextual translation identical to its source was replaced by the ordinary translation; gettext lookups now distinguish an absent entry from that valid result. The libc locale name was passed directly to i18next, which prevented Intl number formatting; formatting now uses the process's Intl locale while gettext retains its startup environment.

All five native integration cases pass, including zero/singular/plural fallback and unsupported counts, alongside source/test types and package lint. The rendered French example was visually inspected. The guides now explain GTKX catalog handling and extraction restrictions, with upstream links for React APIs. A repeat source review found no additional confirmed defect in the supported contract.

The pass also reproduced an ESLint contract conflict: the shared object-property naming rule rejected i18next's legitimate `defaultValue_one` and `defaultValue_other` options. Object literal keys now follow the external API being called, while declared type properties retain GTKX's naming convention. The integration tests use the upstream option names directly. The full ESLint package audit remains pending.

### Configuration package audit

All 18 tracked configuration files and both versioned guides were read. The process-wide Node resolution hook used to refresh config dependencies also rewrote unrelated module imports while an asynchronous configuration was loading. That created a second instance of an ordinary application module and could split singleton state. Cache refreshes now apply only inside the active dependency-capture context.

The public subprocess regression covers successful and failed asynchronous loads, imports during and after each load, recovery after failure and a later config dependency value. All 27 configuration loading, selection, build and development reload cases pass, alongside config/CLI typechecks and lint. An independent review found no blocker. The two guides now focus on configuring GTKX and consuming generated modules; the stable guide preserves 1.6 migration behavior, and both link to the reference instead of listing the full API.

### Cairo package audit

All 32 tracked Cairo files were read. String parameters now borrow their inputs instead of transferring temporary allocations to functions that never own them. Queries validate the status returned through paths, patterns, clip lists and scaled fonts. Nullable font variations, typed null recording extents and managed surface devices now match the native contracts. The hand-copied GIR stub, its parser dependency and its parity test were removed; public native-type integration coverage checks the installed Cairo GObject values instead.

`ImageSurface.getData()` copies the native buffer through its byte-array descriptor. Before reading it creates a temporary context, which detects a surface finished through any alias even though Cairo continues to report a successful surface status after freeing the image storage. GTKX will retain this compatibility check until an official Cairo release fixes the upstream lifetime contract. All 250 Cairo cases and four DrawingArea cases pass, alongside package typechecks, lint, Knip and diff checks. The rendered native drawing was visually inspected, and a repeat review found no further confirmed defect.

### Vitest package audit

All 12 tracked Vitest files were read with the CLI consumers and headless-display integration suite. The worker preload now resolves only from the built package layout, removing a source-tree fallback that served the monorepo rather than installed consumers. One generated Sway configuration shape drives both writing and stale-runtime validation.

The private notification sink now implements the required server-information method, assigns and replaces notification IDs consistently, reports only supported capabilities, tracks open notifications and emits the close signal. A real D-Bus integration case exercises server information, allocation, replacement, successful close and rejection of an already closed ID through the complete headless display process. All 28 headless cases pass together. Source and test typechecks, lint and the package build pass.

The Wayland input helper remains local after a dependency review. GTK clients require persistent virtual pointer and keyboard capabilities; a real Sway probe confirmed that a configured fallback seat without devices advertises no capabilities, and no maintained package met the required compositor protocol contract. The missing server declarations in `@homebridge/dbus-native` 0.7.9 are recorded in the upstream tracker; GTKX retains its declaration augmentation until upstream includes them. A repeat review found no further confirmed defect in the package.

### Navigation package audit

All 66 tracked navigation files and both guides were read. Stack options retained removed routes and their header closures for the navigator's lifetime. Options now follow mounted and closing pages, and descriptor snapshots refresh when header options change so closing animations retain the latest header. Tabs and drawers now keep lazy-loading state on each mounted page instead of retaining every route key indefinitely.

Public regressions cover header collection across repeated navigation, updated headers during closing animations, native page removal after pop, replace and reset, and lazy restoration of a previously removed route key. The header and lazy restoration regressions fail against the previous implementations. All 209 native integration cases pass across 28 files, alongside source/test types, lint and Knip. Both header and return-navigation screenshots were visually inspected. Repeated fixture traversal is shared, and the constant-only theme test is removed.

A repeat package review found no further navigation-local defect. Retained renderer metadata is being investigated separately in React because native page removal alone does not establish release of the former React properties.

### Storybook package audit

All 31 tracked Storybook files, the website guide and the repository guide were read. Unset choice arguments previously displayed the first option. Choice controls now use an explicit placeholder and can clear an argument back to undefined. Readonly argument metadata now disables native controls consistently. Both public control regressions fail against the previous implementation.

Storybook's own argument inference and required-argument types replace duplicated conditional types. Typed native signals and typed composition inputs no longer receive redundant validation. The unused action timestamp and unused configurable history limit are removed. The repository guide points to the concise website guide, which links upstream for CSF and decorators.

All 75 native integration cases pass, including rendering, argument inference, controls, action errors and preview lifecycle. Source/test types, lint, Knip and independent review pass. Unset and readonly controls were visually inspected. A minimal import of Storybook's framework-neutral Renderer type exposes an undeclared dependency on its browser React package when dependency declarations are checked strictly. U10 records that upstream defect and reproductions; GTKX's existing skipLibCheck configuration is unaffected.

### Renderer metadata lifetime follow-up

An application retaining an unmounted native widget also retained its former signal closures and children through the renderer's object-to-node map. Removing that map entry after native teardown releases the old properties while preserving the retained object's native values. Cleanup runs during mutation so a portal created into the former parent in the same commit receives fresh metadata; deferred cleanup stranded that portal's children.

Four public regressions cover handler collection and disconnection, child collection, portals after unmount and portal handoff in the same commit. All 144 focused lifecycle, portal, signal and slot cases pass, alongside React/e2e types and touched-file lint. A separate production-mode reproduction fails with the old implementation and passes with the fix. Immediate navigation header collection still follows React's development owner and debug-stack lifetime; repeated navigation releases older headers.

The error-path review found a separate leak when render fails after native signals are connected but before commit. That abandoned-render case remains open and is being fixed through callback ownership rather than development-only cleanup.

## Next work

Continue repeat audits alongside the R2 string/container and ownership stages. Follow with GL callback release, the broader constructor/factory-prop contract, declarative notifications and schema-driven settings types. Keep the TextView, Sidebar, ComboRow, Cairo image-data and React Spring compatibility code until official upstream releases contain the fixes. Continue source and documentation audits after each coherent change; zero findings has not been reached and the remaining inventory still needs review.
