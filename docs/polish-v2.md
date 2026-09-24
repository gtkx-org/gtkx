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
| `codegen` | 144 | All override templates, GIR, analysis, writer, direct store, reference and Khronos modules and compile entry read; metadata, imports, inheritance, GIR parsing/freshness, reference props and GL buffer types fixed; broader constructor contracts and remaining inventory pending |
| `react` | 47 | All 48 current source files read; renderer lifecycle findings fixed; repeat review continues |
| `components` | 50 | All files read; all initial findings resolved; repeat review continues |
| `animated` | 19 | All files read; text, prop contracts, dead code, tests and guides fixed; upstream ref compatibility retained |
| `cairo` | 32 | All files read; ownership, error propagation, native values and image-data safety fixed; repeat review found no further defect |
| `gl` | 6 | All files read; exact 64-bit bindings and thin overrides fixed; unsupported debug contracts omitted; repeat review continues |
| `css` | 21 | All files read twice; named-color and registry fixes validated; documentation corrected |
| `forms` | 17 | All current files read; callback refs, shared types and explicit ComboRow IDs fixed; repeat review continues |
| `i18n` | 17 | All files read; contextual lookup and locale formatting fixed; repeat review found no further confirmed defect |
| `navigation` | 66 | All files read; stack option lifetimes, closing headers and lazy route restoration fixed; repeat review found no further local defect |
| `storybook` | 31 | All files read; unset selections, readonly controls, shared types and documentation fixed; upstream strict declaration checking remains open |
| `config` | 18 | All files read; concurrent import isolation fixed; repeat review continues |
| `cli` | 262 | Command, codegen, settings, development, Node runtime, vendored tools, payload, freedesktop, notices, nFPM and deployment target folders read with their callers; consumer, catalog and schema fixes verified; full package pending |
| `create-gtkx` | 31 | All files read; option parsing, installation recovery, duplication and guides fixed; installed TypeScript and JavaScript consumers pass |
| `mcp` | 26 | All files read; configuration refresh/discovery, registration and settings errors fixed; repeat review found no further confirmed defect |
| `testing` | 60 | All files read; deadlines, text queries, clipboard behavior, Unicode and matcher fixes pass; repeat review found no further confirmed defect |
| `vitest` | 12 | All files read; packaged preload, Sway configuration and notification sink fixed; repeat review found no further confirmed defect |
| `e2e` | 117 | All 43 React integration files read; native/testing regressions reviewed with each fix; remaining inventory pending |
| `eslint` | 36 | All files read; public-surface traversal and cache correctness fixed; prefix restriction removed; independent review passed |
| `utils` | 60 | All 59 current files read; maintained helpers replace duplication; process protocol and identity parsing shared; public consumer checks pass |

Outside the packages, the starting scope includes 397 example files, 174 website files, 15 scripts, 23 GitHub configuration files, 3 patches, 30 root files, and one file each under `docs`, `.nx`, and `.vscode`. All top-level scripts, GitHub configuration, root, patch, version-plan and editor files have now been read. The batches below record the reviewed example and website files; their remaining inventories stay open.

## Batch 1: architectural boundaries

### Native API and allocation access

All 23 files in `packages/native/src/api` were read: `alloc.rs`, `bind.rs`, `bind_field.rs`, `call.rs`, `copy.rs`, `get_fundamental_wrapper.rs`, `get_type.rs`, `get_wrapper.rs`, `init.rs`, `keep_alive.rs`, `log_listener.rs`, `new_object.rs`, `parent_death.rs`, `quit.rs`, `read.rs`, `register_class.rs`, `resolve_type.rs`, `set_fundamental_wrapper.rs`, `set_wrapper.rs`, `symbol_address.rs`, `type_class.rs`, `vtable.rs`, and `write.rs`.

`packages/native/src/api.rs` and `handle.rs` were also read completely. Supporting reads traced the affected paths in `ffi/codec.rs`, the struct, boxed, buffer, callback, numeric, boolean and fundamental codecs, and `ffi/closure.rs`. Those supporting reads do not close the entire FFI folder. Validation also included complete reads of `scripts/asan-native.ts` and `scripts/rust-nightly.ts`.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| N1: field access loses allocation bounds | Field reads/writes and inline aliases could bypass recorded allocation bounds. A shared range check now covers bound/unbound field access and both sides of copies. Aliases retain their declared size or remaining owner extent. | Original field/copy paths, inline-array source checks and measured struct-copy extent propagation fixed |
| N2: JavaScript receives raw native addresses | `symbol_address.rs` returns an address; `bind.rs` accepts one. Runtime closure and decoded-callback paths transport pointers as integers. Opaque ownership and lifetime contracts must replace these together with their callers. | Initial native/runtime paths, adjacent callback slots and callback record fields fixed; primitive-pointer and remaining callback lowering remain open |
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
| GL5: debug callback replacements retain every closure forever | Driver callbacks permit foreign-thread delivery and lack the completion boundary required by GTKX’s closure lifetime. | Resolved by omitting unsupported callback registration and its public types; ordinary GL commands and info-log helpers remain |

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

Validation passes 15 installed-consumer cases, 29 generated-binding cases, 13 CLI documentation cases, 98 shortcut/menu/input integration cases, and the affected library, test and root typechecks. The subsequent bounded constructor review confirms the singleton and alternative shortcut contracts. Current named factory prop types include their factory inputs, matching `ComponentProps<typeof Element>`; that naming follow-up is resolved.

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

The error-path review found a separate leak when render fails after native signals are connected but before commit. Native callback wrappers now weakly reference their renderer-owned handler records, so abandoned work can be collected. Mounted widgets and adopted pages retain their active handlers through garbage collection and replacement. The failed-render regression fails against the previous signal wrapper and passes with the fix. All 910 React integration cases pass across 42 files, alongside React/e2e types and touched-file lint.

### MCP package audit

All 26 tracked MCP files and both guides were read. API references now refresh when an imported configuration changes, and project discovery covers the configuration extensions supplied by c12 plus its supported project layouts. Re-registering an application connection removes its previous identity. Invalid project settings now stop startup instead of silently enabling default tools; starting outside a project remains supported.

Registration types derive from Zod, unused connection state and timeout configuration are removed, and RegExp.escape replaces handwritten escaping. Both guides now focus on setup, live inspection, generated bindings and tool selection, leaving tool specifications to the client. The native application fixture uses an Adwaita shell and was visually inspected.

Each bug has a public stdio/socket regression that fails against the previous source. All 60 end-to-end cases pass across six files, alongside source/test types, lint, Knip and the ten-task package build. A repeat review found no further confirmed defect. The earlier combined website build passed page rendering and sitemap generation in 472 seconds; these later MCP guide edits await the next website checkpoint.

### Lint audit follow-up

The public-surface audit identified 305 JSDoc blocks attached to private implementation declarations, mostly GIR parsing and reference-generation types. Those blocks are removed. Comparing the parsed source with comments omitted confirms that the cleanup changes no code.

The rule now follows inferred and nested public types without inspecting implementation bodies or documenting type-filter patterns. Overloads share their first declaration's documentation, private and protected members remain private, and recursive callable signatures terminate through declaration cycle detection. The surface refreshes after saved and unsaved source edits, reverse exports, missing or removed sources, TypeScript path changes, and imported package manifest creation or changes. Separate compiler programs avoid sharing parser-owned symbol graphs.

All 89 remaining ESLint integration and rule cases pass, alongside both typechecks, package lint, Knip and independent review. The obsolete GTK/GLib prefix restriction and its tests are removed at the maintainer's request. React's own children type replaces the testing wrapper's duplicate shape. Existing no-new-comments exemptions now also cover object property constraints, registered class metadata and testing options; these declarations were kept simple instead of adding type indirection to evade documentation checks. Repository-wide Nx lint is the next validation checkpoint.

The naming follow-up restores `gtkModel` and `GTK_LIB` after tracing changes made for the removed prefix restriction. Stale suppression comments are removed. GLib is the default, so `useObjectValue` and `ObjectValueCache` keep their names without the `G` prefix. This convention is recorded in the contributing principles. Remaining library names describe actual libraries. React, components and testing source typechecks and affected-file lint pass; these changes do not alter behavior or public APIs.

### Project scaffolding audit

All 31 tracked create-gtkx files and both getting-started guides were read. One option schema now supplies help, argument types and strict parsing. Repeated flags and aliases honor their last occurrence, and `--no-interactive` works in a real terminal. Invalid project names are rejected instead of silently rewritten; parent directory names remain intact.

The complete dependency manifest is written before installation, so a failed install can be resumed with the package manager's install command. nypm still resolves and saves dependency versions. YAML serialization uses the existing maintained dependency, and repeated filesystem checks, an initial generated-file stub, manifest replacement machinery and package-manager error parsing are removed. Existing overwrite and symlink boundaries remain covered through the CLI.

All 41 public CLI cases pass, including real terminal invocation, supported path edge cases and installation failures, alongside source/test types, package lint and independent review. Citty's boolean ordering defect is reproduced independently and recorded as U11 in the upstream tracker. The release packaging check built and locally published the packages, then exposed a separate fresh-consumer configuration import failure; that fix is tracked below before repeating the complete consumer check.

### Fresh-consumer configuration bootstrap

The release packaging check found that importing `@gtkx/react/config` loaded the custom-element factory and its generated GI dependencies before bindings existed. The factory is now exported from the main React entry point. Configuration retains only generation-safe metadata and types; generated JSX keeps its internal factory import. The v2 custom-element guide and consumers use the main export.

A subprocess regression copies the built React package into a fresh consumer without generated bindings and runs real codegen. It fails with the old export and passes after the move. All three configuration isolation cases and 46 custom-element/signal cases pass, alongside the affected builds, types, lint and independent review. The complete release-consumer retry passes: packages are built and published to a temporary local registry, then fresh TypeScript and JavaScript applications are scaffolded, installed, generated, built, launched and tested. The TypeScript consumer also passes its typecheck. This checkpoint precedes the later utility, testing and native string changes, which require another release check.

### Development process shutdown follow-up

The supervisor treated Node's `ChildProcess.killed` flag as confirmation of process exit. After forwarding a signal, that flag prevented the shutdown deadline from killing a runner whose event loop was blocked. Signal-derived exit statuses also treated every signal except SIGINT as SIGTERM.

The supervisor now sends signals through `ChildProcess.kill` directly and reuses Node's process type. Exit statuses derive from Node's platform signal constants. Four public regressions fail against the previous implementation: hard-killed runner status, two leaked runners after timeout, and SIGHUP status. All 20 lifecycle and development integration cases pass, including graceful shutdown and existing reload behavior, alongside utils/CLI builds, test types, lint and independent review.

### Callback string ownership follow-up

Native callback argument decoding copied full-transfer strings without releasing their native allocation. The decoder now frees the string after copying and before creating the JavaScript value. Borrowed strings retain their existing lifetime. The confirmed scope is explicit native callback descriptors; no installed GIR callback was found with this transfer contract.

Five public cases use GLib's list destructor to exercise Unicode, empty and null lists, repeated owned inputs, and throwing callbacks. The previous decoder retains roughly 984 MB and 991 MB in the two repeated-call cases. The fixed code passes all 30 memory cases, all 370 native package cases, and the complete memory suite under AddressSanitizer/LeakSanitizer without memory errors. Types, lint, rustfmt and Clippy pass. The ordinary native artifact is restored before the release-consumer check.

### Utility package audit

All 59 current tracked utility files were read. es-toolkit replaces the handwritten object, equality, uniqueness and first-character helpers, while Babel supplies JavaScript reserved-word knowledge and type-fest supplies the constructor type. Small adapters preserve source unions, callback arguments, GIR acronym spelling and native wrapper identity. TypeScript-specific reserved names remain local.

The process guard and launcher now share their private message types and process identity reader. Repeated validation of their own typed messages is removed; partial pipe input and operating-system lifetime checks remain. Public generated-consumer cases cover reserved identifiers and discriminated prop unions, and a native rendering case verifies replacement of equally configured widget instances.

All 203 affected integration cases pass: 68 CLI, process and codegen cases and 135 renderer cases. Utility builds, consumer typechecks, package lint, Knip and the frozen install pass. Independent review found no additional defect in these changes.

### Testing package audit

All 60 tracked testing files and both guides were read, alongside eight existing consumer suites. Async polling now enforces its deadline even when the callback remains pending. Label queries and matchers use rendered text, decode native markup through Pango, and keep mnemonic targets inside the mapped query scope. Keyboard input converts Unicode through GDK and advances by complete characters.

Clipboard helpers invoke native actions, preserving readonly and protected text, password restrictions, existing clipboard contents and native undo history. Hook rerenders distinguish omitted props from explicit `undefined`. Class matchers can reuse global and sticky patterns, and empty labels count as empty widgets. Runtime value packing replaces the drop helper's duplicate GValue construction; widget checks and controller lookups are shared. Tests no longer patch widget internals or assert a private normalizer directly.

Regressions fail against the previous implementations. All 254 public integration cases pass across 20 files, including query performance and activation held by another process. Source and full e2e typechecks, package and consumer lint, and the testing build pass. Native clipboard and markup views were visually inspected. The guides now share a concise GTKX-focused structure, with accurate headless setup, query scope and error handling. Independent review found no additional confirmed defect.

### Custom element metadata and subclassing

A production application that retained a GI base class without its generated JSX component could lose inherited property metadata. Removing a custom scale's `digits` prop then left its previous value instead of restoring the native default. Generated GI classes now register their own property and signal metadata. Custom class registration derives declared property metadata from its existing ParamSpecs, so native construction receives construct-only props and later prop removal restores writable defaults.

The separate JSX metadata module and duplicate property-entry type are removed. Three built-application cases cover inherited and declared defaults, omitted props, constructor-time values and rejected construct-only updates. All 428 CLI cases and 910 existing React cases pass, alongside affected builds, typechecks, lint and independent review. The subclassing guides now use complete JSX examples and upstream links instead of API inventories or GtkBuilder instructions; the native example was visually inspected. Website validation remains part of the next combined checkpoint.

### Runtime string conversion

String encoding and decoding now live in runtime. The native descriptor accepts terminated byte storage and retains responsibility for allocation, copying, bounded reads and ownership. Runtime string APIs remain unchanged. Callback returns preserve their declared lifetimes, and native string vectors can carry invalid UTF-8 without constructing Rust UTF-8 string types.

The migration exposed a bounded-buffer overread: filling an allocated character buffer without a terminator caused decoding to read beyond its end. An isolated sanitizer regression confirms the previous heap-buffer-overflow; decoding now searches only the owned buffer. Byte output uses Node-owned backing storage. A confirmed napi-rs copy defect requires an explicit copy after allocation and is tracked as U12 with standalone reproductions against versions 3.12.2 and 3.12.4.

All 376 native package cases, 127 focused integration cases and seven runtime storage cases pass. Sanitizer passes cover 102 native memory cases, the 127 integration cases, all 60 native call cases including six byte-vector regressions, and bounded storage. Typechecks, lint, rustfmt and Clippy pass. Memory checks measure repeated batches after allocation warm-up under the unchanged 40 MiB growth limit; the original callback leak still fails at roughly 993 MB growth. The normal addon and runtime artifacts are restored.

A worker shutdown stress check separately reproduces an intermittent process crash on both the previous and current addon. Instrumented runs have not yet identified its cause; that finding remains open. Container conversion and the remaining R2 responsibilities are also still open.

### Code generation writer audit

All nine files in `packages/codegen/src/writer` and `compile.ts` were read, together with their public CLI generation path. Named imports sharing a module with a namespace import produced invalid syntax; a type-only namespace silently discarded the named imports. Public custom element configuration can reach both cases. The writer now emits separate import declarations.

Three generated-consumer cases cover ordinary named props, both shared namespace forms and incompatible values. They invoke codegen and TypeScript with library checking enabled. All three pass, as do seven existing documentation cases, codegen compilation, CLI test types and lint. Independent review found no further confirmed defect in this scope.

### Hook targets and declarative settings

All 12 hook files were read. Property, signal and settings-binding hooks now receive native instances; state-backed callback refs make JSX creation and replacement observable to React. The mutable-ref union and its private resolver are removed. Settings hooks receive a JSX-created settings instance instead of constructing one internally. Application-owned settings can be shared through React context, including relocatable schema paths.

Subscription setup now invalidates the first cached snapshot, covering native changes between render and subscription and GSettings' requirement to read a key after connecting. An immediate signal handler that throws disconnects its newly installed handler before propagating the error. Eight public regressions fail against the previous implementation and pass with these changes. All 920 React cases, 35 CLI build cases and 19 isolated tutorial cases pass. The full e2e typecheck passes at the default heap size; an explicit generic return type in the settings test helper removes an unnecessary type expansion.

Independent review found a missed video-demo ref consumer. The demo now passes native window instances, and its tick hook follows instance identity directly. This removes repeated registration synchronization and test ref casts. Nullable cursor results and selection notifications follow their declared contracts; selection notifications without an ID preserve the application's explicit selection. All 146 affected demo cases, source/test types and lint pass. The video was inspected through the real application, including fullscreen, exit, close and reopen. Tutorial preferences persisted across remount and were visually inspected. The v2 guides and tutorial use the new hook contracts; stable-version documentation remains unchanged.

### Collection null-result policy

The collection review fully read 15 runtime modules and 16 native codec/storage modules, 7,929 baseline lines. Runtime now owns whether a null collection decodes as an empty array, an empty byte array, or null. Native descriptors and codecs no longer carry that policy. Callback reference transport distinguishes an absent output slot from a slot containing a null collection, preserving the public inout seeds. GByteArray GValue reads use an explicit nullable descriptor and no longer make a separate pointer-probe call. Native ownership, allocation, traversal and bounds are unchanged.

Public native-library fixtures cover calls, outputs, fields, callback inputs, inout seeds and absent slots, with separate native property and GValue coverage. All 376 addon cases, 508 generated-native cases and 204 focused cases pass. The final GValue follow-up passes all 21 cases, including null, empty, populated and invalid values. Runtime/dependency builds, default-heap test types, lint, rustfmt and Clippy pass. Independent review found no blocker in this migration. The normal addon and runtime artifacts are aligned; remaining collection packing and ownership work stays open.

### Cursor ownership and sanitizer validation

Review of PR [#658](https://github.com/gtkx-org/gtkx/pull/658) identified a cursor descriptor that could claim ownership of another argument's buffer. Native binding now rejects that descriptor before a call can be made. Borrowed cursor decoding is unchanged. The regression exercises descriptor rejection only; existing generated bindings cover empty, populated and invalid byte inputs.

All 61 native call cases and 40 generated array cases pass, alongside lint, rustfmt and Clippy. The complete sanitizer target passes 377 addon cases and 509 generated-native cases, with no sanitizer error, and restores the normal addon. Its per-test deadline is now two minutes: CI's five failures were successful 31–42 second operations exceeding the ordinary 30-second deadline. Iteration counts and memory-growth limits are unchanged. Runtime discovery happens before instrumentation, and a failed instrumented build now also enters the normal-build restoration path.

### CI fixture and review follow-up

The first PR run passed ordinary integration tests, typechecking, fresh publication/tutorial consumers and CodeQL. Its remaining failures exposed stale isolated consumers and test timing: copied utility declarations needed their es-toolkit dependency, and the signal fixture still used the removed mutable-ref hook contract. The demo fixture now preserves its optional close callback instead of inventing a no-op. MCP's imported-config refresh test allows the freshness interval plus two reference loads under coverage; a real covered subprocess confirms the refresh succeeds. No production timeout changed.

The combined local checkpoint passed all 66 lint tasks, 63 type/build tasks and 46 test/build tasks. Subsequent inheritance review fixes and release tooling remain subject to the next checkpoint. Copilot's cursor finding is addressed above. Its worker-preload comment does not match the actual worker fixture, which imports the built entry point and passed all 28 headless cases. The suppressed drag/drop suggestion is already covered at the input boundary; self-drop preserves order. A real scaffolder retry replaced malformed package JSON successfully, so the suppressed manifest-recovery comment did not establish a supported-path defect. No review comments or replies were posted.

### Code generation analysis audit

All ten analysis files were read, 2,996 baseline lines, with their callable, async, vtable and interface emission paths. Inheritance comparisons now use the generated return shape: output tuples, skipped returns, folded lengths, caller-allocated outputs and async finish results. Callback parameter types retain their own signatures. Virtual functions use the slot renderer's result with the original parameter indices. Scratch contexts keep comparison imports out of generated modules.

Repeat review exposed ancestor ownership differences. Shared selection now follows emitted methods and runtime mixin precedence: class declarations win, followed by the oldest ancestor's interface methods, retaining interface order within each level. Shadowed GIR methods no longer create false interface omissions. Public CLI generation and strict consumer declarations cover these cases, including incompatible consumer types. All 97 focused cases pass, with 21 analysis cases, alongside codegen/CLI types and lint. Independent review found no additional actionable finding in this scope.

The separate monorepo store-resolution fallback is addressed in the store audit below.

### Release tooling audit

All 14 tracked top-level script files besides the separately reviewed sanitizer runner were read, 2,142 baseline lines, with their workflow and package callers. The local registry now rebuilds its storage on startup, so unchanged package versions can serve updated tarballs. Its servers bind to loopback. Temporary-directory ownership surrounds startup as well as normal operation, so failed startup removes its files and closes listeners. Headless display types derive from their existing implementation.

Two real local-registry starts rebuilt and locally published the workspace. Fresh npm consumers observed values 1 and 2 from the same probe package version across restart. Public command failures on occupied primary and proxy ports leave no temporary directory or listener; the previous command left its directory behind. Owned listener inspection confirms the loopback address. Temporary validation paths were removed from the checkout.

Publication visibility requests now share the polling deadline, and a late successful response cannot pass. The real release command against a local HTTP registry fixture accepted immediate and 200 ms responses, rejected delayed and hanging responses at approximately 500 ms, and restored its manifest on both outcomes. The previous command incorrectly accepted a 1.5-second response with the same 500 ms limit. The obsolete getting-started pin-list synchronization is removed; tutorial dependencies and the documentation version manifest retain their existing synchronization. Root types, affected lint, whitespace checks and independent review pass. Complete release and tutorial consumers are the next checkpoint. Their existing startup smoke check establishes process liveness for eight seconds; visual application checks remain separate.

### Workflow and contributing documentation audit

All 23 tracked GitHub configuration files were read, 1,418 baseline lines. CI now builds the website for pull requests and main updates, including documentation-only changes. The existing code-change filter now requires both the inclusion and Markdown exclusion patterns to match; its job declares the pull-request read permission required by the pinned action. The exact action was run against a temporary Git checkout: unchanged and Markdown-only cases skip code jobs, while code-only and mixed cases select them. Workflow YAML and aliases parse, and independent review found no additional issue in these changes. The website deployment workflow remains release-driven.

All nine Contributing pages were reread against the current implementation. Three pages now identify generated GI classes as the owners of property and signal metadata; JSX retains those classes. The architecture call path distinguishes runtime conversion from native storage preparation. The complete production website build passes all 27 tasks, including current API generation, page rendering and sitemap generation, in seven minutes 21 seconds. The new PR job will keep that validation alongside the code checks.

### Generated store audit

All six direct generated-store modules were read, 1,207 baseline lines, with their CLI resolution and compilation callers. Resolution now requires installed dependencies; a `packages/<name>/package.json` source directory cannot stand in for one. Unused temporary dependency links and their option plumbing are removed because declaration and module transpilation do not resolve imports.

Four public CLI cases cover missing native/runtime dependencies and GI-only consumers with uninstalled React source directories. Existing store publication and generated-consumer cases also pass. Independent review found no additional actionable issue in these changes.

### GIR freshness follow-up

Changing GIR search-directory or root-library order could leave the previous bindings marked fresh. Adding a GIR earlier in the search path had the same effect. Fingerprints now retain configuration order and resolve recorded GIR names through the same lookup used for generation before comparing their contents. Built-in string sorting replaces the handwritten ordinal comparator where order is only needed for stable hashing.

Eight public CLI cases import generated constants after direct and transitive shadowing, search-order changes, duplicate version selections, removals and directory aliases. Missing GIR input fails while preserving the previous usable bindings. The previous implementation selected stale values in four supported cases. All 90 focused integration cases pass, including store publication, generated types and documentation, alongside codegen/CLI/test types, lint and independent review.

### Tutorial introduction and storage audit

The first six v2 tutorial chapters were read in full, 1,038 baseline lines. They now focus on GTKX application setup, imports, slots, signals and the steps needed to build Tasks. React and Zustand explanations link to their own documentation. Repeated code and inaccurate claims about rendering, seeding and serialization are removed. GLib's markup escaping replaces a handwritten helper. Three later chapters were also read, 1,961 baseline lines, to align prerequisite imports and storage snippets; their broader prose audit remains open.

The installed tutorial previously continued with seed data after unreadable or malformed storage and overwrote unsupported-version data during startup. Only a missing file now starts a fresh store. Synchronous hydration failures stop initialization; unsupported saved versions fail without replacing the file. GLib supplies the data directory and atomic file replacement, removing the application's temporary-file implementation and permissive migration guard.

All 20 native application tests, three localization tests, installed consumer types and five cumulative chapter typechecks pass. Five built-app startup cases cover missing and empty stores plus malformed, unreadable and unsupported-version failures with unchanged saved bytes. Live application checks confirm text entry, persistence across restart and preservation of the previous file after a failed save. Both application screenshots were inspected. Local links, code fences and whitespace checks pass. Repository ESLint intentionally excludes the standalone tutorial; library-only forced lint is not part of this validation. The earlier publication checkpoint refreshed the tracked gettext input list and source references without changing translations.

### Second PR review follow-up

At `2decda13`, the PR's main tests, CLI tests, sanitizer, fresh publication consumers, documentation, lint, typechecking and CodeQL pass. Coverage passes 4,778 cases but two real ESLint configuration tests take 5.32 and 5.87 seconds against the default five-second deadline. The ESLint integration project now allows 30 seconds per test. All 89 cases pass under V8 coverage with that configuration, alongside package lint and source/test types. Assertions, hooks and production behavior are unchanged; the remote coverage run still needs to pass.

Copilot repeated the manifest recovery concern already checked through the real scaffolder. Its CSS suggestion requests restoration of the malformed-input containment removed under CSS1. Public CSS input already passes through PostCSS before serialized rules reach the stylesheet; the review supplies no supported-input serialization regression. GTK semantic diagnostics remain delegated to its provider. Independent source and contract review found no actionable production change for either comment. No review replies were posted.

### Root configuration and documentation audit

All 29 directly tracked root files besides the generated pnpm lockfile were read, alongside the editor settings and three version plans. The lockfile was parsed structurally; its dependency resolution remains validated through the existing frozen install and fresh publication consumers. No new configuration defect was confirmed in this scope.

The README advertised beta installation while linking to stable-version documentation and describing the branch as production-ready. It now identifies the 2.0 beta and scheduled release date, links to the matching guides and tutorial, and describes generated native bindings without unsupported universal API claims or third-party maintenance comparisons. Contributor release instructions no longer refer to removed guide pins. README documentation targets resolve to local pages, the release manifest agrees with its status, and independent review and whitespace checks pass.

### Store and tutorial validation checkpoint

At `af1eff2e`, the combined local run passes all 46 test/build tasks across 19 projects, followed by fresh TypeScript and JavaScript release consumers installed from the temporary local registry. Both consumers generate bindings, build, launch and pass their tests; the TypeScript consumer also passes typechecking. The production website passes all 27 tasks, including reference generation, page rendering and sitemap generation. The preceding combined lint and typecheck runs pass 66 and 63 tasks respectively. These checks include the store freshness and tutorial storage changes; subsequent GIR, reference and literal-text fixes require their own validation.

### GIR parsing and record layout audit

All 28 GIR modules were read, 2,172 baseline lines, with their XML and record emission callers. String constants now retain their exact whitespace; flags and non-string literals keep their existing normalization. Parser metadata preserves field, anonymous record and anonymous union declaration order. Non-introspectable fields remain part of native layout but no longer appear in accessors, constructor props or collection element types. Record layout caching follows parsed record identity, so a second generation cannot reuse another project's definition with the same name.

Public generation checks confirmed all four defects without loading record bindings. The fixed generator preserves a padded constant, places an interleaved record's trailing field at offset 12, omits hidden accessors and uses offset 8 after a nested record grows in a subsequent generation. Ten new public generation cases cover exact constant imports with addons disabled, accepted and rejected consumer declarations, generated layout output, successive projects and malformed XML preserving published bindings. All 50 GIR, documentation and store cases pass, alongside codegen/CLI builds, source/test types, lint and independent review. The next combined checkpoint will regenerate installed-library bindings and run their normal sanitizer coverage.

### Reference element configuration follow-up

The eight CLI command modules and six CLI codegen modules were read, 544 and 1,054 baseline lines, with their entry and preparation helpers. All six codegen reference modules were also read, 2,908 baseline lines. A fresh `gtkx docs` run omitted GTKX's built-in props until generated bindings existed. Both CLI reference paths now read generation-safe element configuration directly; the store-existence wrapper is removed.

MCP previously loaded only GIR inputs, so its pages omitted factory props and child constraints and advertised properties excluded from generated JSX. It now supplies built-in configuration and merged project omissions. Each cached reference restores its own configuration before rendering. Three public MCP regressions fail against the previous implementation and pass after the fix, including alternating projects with different omitted props. All 63 MCP cases and all 14 CLI docs cases pass, alongside affected builds, source/test types, lint and independent review. The existing no-new-comments lint exemption covers the new reference option. Project-supplied prop types remain under investigation; this does not close the full reference audit.

### Tutorial lists, search and editor audit

The lists/sidebar, smart views/search and task editor chapters were fully reviewed, 1,966 baseline lines, alongside the adaptive-layout chapter and application/navigation consumers. The three revised pages total 1,301 lines. They preserve saved tasks, provide complete import and component steps, and describe GTKX slots, signals and native lifetime without duplicating React, Zustand or form-library lessons. Claims about navigation, subtitle removal and signal suppression now match the implementation. The existing selection anchor and later chapter prerequisites remain valid.

Search messages could interpret user queries as Pango markup, and sidebar rows did the same to list names. GLib escapes status-page descriptions and action rows display titles without markup. The shared navigation guard now accepts the object-or-undefined type supplied by React Navigation instead of rechecking unsupported primitive/null inputs. Five new public application cases cover ordinary text, markup characters and Unicode; four fail against the previous literal-text implementation. All 25 application cases, three localization cases, installed consumer types and builds pass. Four cumulative chapter consumers typecheck, and the final editor chapter builds and runs independently. Live checks confirm literal text, title drafts surviving importance changes, persisted notes and completed Back navigation; application and chapter screenshots were inspected. Gettext changes update timestamps and source locations only. Independent review, local links, code fences and whitespace checks pass; the production website checkpoint is next.

### GIR, reference and tutorial validation checkpoint

At `ac5309c8`, local lint passes 66 tasks, typechecking passes 63, and the combined suite passes all 46 test/build tasks across 19 projects. Sanitizers pass 377 addon and 509 generated-native cases, 886 total. Fresh TypeScript and JavaScript release consumers install, generate bindings, build, launch and pass their tests; TypeScript also passes typechecking. The production website passes all 27 tasks, including page rendering and sitemap generation.

All remote checks passed for `af1eff2e`, including the coverage cases whose timeout was corrected. At `ac5309c8`, main tests, sanitizers, release consumers, lint, types and CodeQL pass; CLI tests, documentation and coverage remain in progress. Copilot skipped the prior checkpoint because the PR exceeds its 300-file review limit. That is not a clean external review. Independent scoped reviews continue; no review replies were posted.

### Tutorial commands, deletion, preferences and reordering audit

The next four tutorial chapters were read in full, 1,368 baseline lines, alongside 33 application source/configuration/test files and relevant framework contracts. The pages now provide the missing imports, dialog state and navigation steps, retain beta installation instructions and explain GTKX behavior without duplicating upstream lessons. Preferences introduce the settings they use; reminders remain in their own chapter.

Deletion toasts now display titles literally. New tasks use the final stored position after permanent deletions; the reorder action already moves the backing array and renumbers positions together. A JSX-created widget paintable supplies drag icons through a root portal. The synchronous content-provider return remains inside the native signal handler.

All 31 application cases and four cumulative chapter typechecks pass, along with complete tutorial source/test types. Public cases reproduce the old literal-text and append-order failures, including reorder followed by deletion and addition. Real Wayland pointer drags exercise icon preparation and persisted reordering before and after row remounts; drag and literal-toast screenshots were inspected. Repository ESLint intentionally excludes this standalone application. Packaging, localization extraction and the combined website checkpoint will follow this batch.

### GSettings import and development audit

All four CLI settings modules were read, 734 baseline lines, alongside the settings Vite plugin, staging/import helpers and development restart callers. Schema parsing now uses the shared validated XML reader. It resolves inheritance across imported files and keeps one key-kind model for runtime exports and declarations, removing unused enum/choice reconstruction. Invalid or incomplete XML fails before replacing usable consumer declarations.

Schema staging preserves the already-validated unique basenames. Hashing those names could put a derived schema before its base and make a valid native schema set fail to compile. The existing staging owner now registers cleanup before compilation, so failed development starts leave no temporary schema directory. Editing an imported schema first compiles the complete set, then restarts the development process so Gio reads the new keys and defaults. A failed edit preserves the current running application and can recover on the next valid save. Adding schema imports to an already-running source module remains a separate follow-up.

Thirteen public CLI cases pass against both the isolated CLI prototype and the canonical build: same-file and cross-file transitive inheritance, enum/flags/choice kinds, relocatable references, native override defaults, strict accepted/rejected consumer types, invalid XML preserving declarations, failed-start cleanup and live edit/failure/recovery behavior. Each fixture owns its generated store. Independent review, affected lint and CLI test types pass, alongside canonical codegen, CLI and MCP builds. The combined release and website checkpoint follows the configured-props reference batch.

### Latest Copilot follow-up

Copilot reviewed 279 of 621 changed files at `ac5309c8` and requested missing-ID and same-item guards in the tutorial reorder action. Independent review traced every caller: pointer drops validate incoming IDs against the current store; keyboard moves use neighboring visible task IDs; permanent deletion occurs in Trash, where reorder controllers are absent. Normal deletion retains the task ID, and a same-item move preserves its position. Existing pointer, keyboard, remount and reorder/deletion/addition checks cover these workflows. No supported failing path was found, so unsupported-input guards were not restored. This partial review does not establish a clean review of the entire PR. No reply was posted.

### Analysis quality-gate follow-up

Every GitHub workflow job passes at `ac5309c8`. Sonar reports 89.8% coverage on new code and no new duplication, but its reliability gate flags eight uses of built-in ordinal sorting in the fingerprint module. Those inputs need deterministic hashing, not locale-sensitive display order. A file-specific S2871 exception preserves that contract without adding a handwritten comparator. Two S6564 exceptions preserve the public `TextClusterFlags` and `FtSynthesize` type names while accepting numeric bit combinations. The duplicate runtime type imports reported by S3863 are combined. These are scoped analysis settings and an import cleanup; the next remote analysis must confirm the gate passes.

### Configured element props and live references

The 19 changed production TypeScript modules were read completely with their declaration and configuration callers. CLI docs, generated agent references and MCP now include project-configured prop exports. A TypeScript checker replaces the handwritten declaration parser, covering interfaces, inherited generics, utility types and reexports. Reference generation shares the actual GI generator, overrides and declaration emitter. It reads the validated generated store when available and produces the same declarations in memory on a first run; it retains only the rendered catalog and dependency fingerprint.

Built-in declarations resolve from codegen's dependencies, while configured packages resolve from the consuming project. Codegen declares its Cairo dependency explicitly, and Node type resolution works with hoisted installations. Invalid modules, missing or value-only exports and absent GIR types fail before replacing usable reference pages. Generated-consumer checks share their existing installation helper and keep strict declaration checking enabled.

Reference freshness tracks declaration contents and module resolution. A running MCP server also rechecks GIR search priority and all supported configuration candidates, including files that did not exist during its previous load. Public consumers reproduced stale pages after a higher-priority GIR or config appeared; add/remove cases now pass. Relative configured GIR paths resolve from the selected project root across CLI and MCP. Conflicting launch-directory fixtures reproduced the previous wrong-project output through `--cwd` and `projectRoot`.

All nine configured-props cases, 15 CLI docs cases, 28 MCP reference cases and 30 existing strict generated-consumer cases pass. Codegen, CLI and MCP builds, source/test types, affected lint, whitespace checks and independent review pass. The guide describes the resulting reference and relative-path behavior. The combined release, tutorial and website checkpoint follows this commit.

The first combined lint run found two exports left unused by the settings cleanup and the fixture packages copied dynamically into public consumers. The exports are now local, and Knip excludes only that fixture tree, following the existing fixture convention. Knip, affected lint and independent review pass; the combined checkpoint restarts with this cleanup.

### Clean source bootstrap follow-up

The first reference-batch CI run exposed a source-checkout dependency: bootstrap codegen requested React's published declarations before React was compiled. Installed consumers already had those declarations and passed. An explicit repository bootstrap configuration now generates bindings without the agent reference. A separate target builds the CLI and its dependencies before generating that reference; ordinary consumer codegen remains unchanged. Root build/codegen commands and root lint/typechecking include the final reference target without adding a cycle to package builds.

A clean copied checkout with no generated store or package declarations passes postinstall, source bootstrap, CLI dependency compilation and built-CLI reference generation. Its reference includes the built-in callback prop. Both Nx dependency graphs, root types, Knip, affected lint, whitespace checks and independent review pass. The bootstrap configuration is a narrowly registered analysis entry; this introduces no production fallback for the monorepo.

The combined suite passed 45 of 46 tasks. Four CLI store-publication cases rewrote their synthetic configuration without preserving the reference-disabled setting supplied by the initial fixture helper. Their deliberately minimal GTK GIR cannot supply real GTK reference prop types. The shared fixture config now retains that explicit setting during rewrites and shared-store checks. All 42 affected store, publication and configuration-isolation cases pass, alongside affected lint and independent review. Dedicated reference consumer coverage remains enabled.

Copilot reviewed 281 of 649 files at `2bed4b00` and repeated the already tracked GL callback-retention finding. Its summary also mentions hash-table validation without a corresponding new inline finding. This remains a partial review; no reply was posted. Repeat reference review separately reproduced omitted branch-specific props for a discriminated union through the real CLI. That supported declaration case is queued for the next reference batch.

### Published declaration dependency follow-up

At `a8a6f356`, combined lint, typechecking and all 46 test/build tasks pass; 35 tasks reuse valid Nx outputs. The fresh published consumer then fails because React's public declarations reach `react-reconciler` through the root container type, but its declaration package was listed only as a development dependency. `@types/react-reconciler` is now a regular dependency at the same version. Strict declaration checking remains enabled.

Both fresh TypeScript and JavaScript consumers now pass scaffold, binding generation, build, launch and tests; the TypeScript consumer also passes typechecking. All 20 published package shapes pass. The installed tutorial passes its build, launch, types, 31 application tests, three French tests and localized AppImage/deb/rpm launch checks. Flatpak manifest validation passes; this does not claim a source Flatpak build. Independent review and whitespace checks pass. Full website validation is recorded below.

Copilot's latest review covers 281 of 651 files at `a8a6f356` and adds no new inline comments. Its suppressed reorder and manifest suggestions repeat previously reviewed concerns. The summary also mentions two documentation examples without supplying corresponding inline findings. The tracked GL callback issue remains open. Main CI tests, sanitizer, lint, types and CodeQL pass at that commit; publication failed before this dependency correction, and the remaining jobs are still running. No review reply was posted.

### Final tutorial chapters

The reminders, testing, packaging, internationalization and Flatpak chapters were read completely with their application, test and deployment callers. Their revised prose focuses on GTKX and links to upstream documentation. The obsolete store-only testing lesson and complete test-run transcripts are removed. Complete native UI tests replace the invalid setup snippet; the French chapter now supplies its missing test file. Packaging gives the required icon and license steps and distinguishes a generated source manifest from a completed source build.

The English test configuration now fixes its locale. A real consumer with an inherited French environment failed English widget queries before this change and passes afterward. Exact chapter snippets pass strict consumer typechecking and three English plus three French UI cases. French application screenshots were inspected. The minimal packaging configuration passes typechecking and real manifest generation. Imperative notification creation and the example's notification mocks remain tracked work; the prose revision does not close those implementation gaps.

The combined installed tutorial checkpoint passes all 31 application tests, three French tests, build, launch, types, localized AppImage/deb/rpm launches and Flatpak manifest validation. Gettext updates contain source locations and extraction metadata only; translations are unchanged. All 27 website build tasks pass, rendering 6,122 pages and generating the sitemap. Local page links, code fences, whitespace checks and independent review pass. All v2 tutorial chapters have now been read; repeat review continues alongside the remaining application findings.

### Development schema inputs and upstream types

All 17 development modules were read, 1,819 baseline lines, alongside the shared import scanner and Storybook session. Adding, replacing or removing a schema import during Fast Refresh previously left Gio's process-level schema catalog unchanged. Development now records the running process's schema inputs and restarts after validating a changed complete set.

Import discovery reports incomplete scans explicitly. A syntax error in one component no longer makes its schema imports appear removed when another component is saved. Ordinary child refresh preserves the running app and React state. XML edits also wait for complete source discovery; a pending edit is applied after source repair even when the import set is unchanged. Invalid XML preserves the running app until the next valid save.

Vite's own server, module and resolved-config types replace copied declarations. This removes optional-field fallbacks that Vite's actual types do not require. The supervisor's unused process-factory option and stored function are removed; both public command callers already use the same real process launcher.

All 501 CLI cases across 49 files pass, including the new real development sequence, existing shutdown/reload behavior, Storybook, settings, build and deployment cases. The regression observes process identity, mounted React state, continued activity and native schema defaults through nullable lookups. Build, source/test types, affected lint, Knip, whitespace checks and independent review pass. The type cleanup preserves the validated runner's emitted JavaScript.

### Node runtime and payload audit

All six Node runtime modules, two vendored tool modules and five payload modules were read, 525, 136 and 503 baseline lines, with their staging and configuration callers. Maintained npm semver now parses and compares Node releases. The shared minimum remains authoritative; malformed leading-zero and unsafe-integer releases are rejected. Executable failures and version validation no longer depend on matching error-message prefixes.

The runtime-path and generated-launcher cases now execute copies of the real Node binary instead of shell substitutes. All 22 runtime-version cases and three launcher cases pass, covering supported versions, relative paths, literal environment values and arguments, rejected versions, missing runtimes and execution failures. Build, source/test types, affected lint, Knip, frozen installation and independent review pass. Regenerating Nx's stale dependency graph resolves its initial version mismatch without a production change.

The ELF reader still contains handwritten binary parsing; a suitable maintained replacement remains under evaluation. The payload review found no additional confirmed production defect. The ten freedesktop modules were also read, 944 lines. Their handwritten AppStream diagnostic parser can use the existing validator's structured YAML report; that change is the next metadata slice. Notice provenance and explicit package-license files are being reproduced separately.

### Union props and reference snapshots

Configured discriminated unions now retain branch-specific properties and overlapping index signatures in reference pages. TypeScript supplies contextual property types instead of a handwritten union merger. Generated JSX composes configured props through the existing intersection emitter, allowing union aliases while preserving inherited element contracts.

A real declaration edit during generation reproduced old documentation cached with a newer fingerprint. Fingerprints now hash the declarations and resolver metadata actually read by the compiler. Freshness uses the same decoded text, including UTF-8 and UTF-16 BOMs. Returned cache records retain only filenames, resolutions and the digest; compiler graphs and synthetic union probes are discarded.

All 14 configured-props CLI cases, three existing JSX contract cases and 29 MCP reference cases pass. Strict generated-consumer coverage also passes. Natural CLI/MCP race probes fail before the snapshot correction and pass afterward; a filesystem-only synchronization barrier makes the public CLI regression repeatable. Build, source/test types, affected lint, Knip, whitespace checks and independent review pass.

At `f6793578`, CI passes publication consumers, sanitizers, CLI tests, documentation, lint, typechecking and plan checks. Its main suite has five MCP reference test-deadline failures: cold generation takes about 34 seconds and repeated reload sequences take 60–82 seconds. Only the reference test file now allows five minutes per case; shared, request and polling deadlines remain unchanged. The revised 29-case file passes locally in 325 seconds. Coverage analysis is still running. Measured reference startup separately identifies repeated GI declaration generation as the main avoidable cost; fresh generated-store reuse is being prototyped without deferring strict prop validation.

Copilot reviewed 281 of 652 files and added no new inline findings. Its nullable activation suggestions concern tutorial actions that explicitly require string parameters. Gio guarantees the expected type when emitting SimpleAction activation, and the notification targets supply string variants. The other suppressed suggestions repeat previously reviewed cases. This partial review does not close the full audit; no reply was posted.

### Structured AppStream validation

AppStream validation now reads the validator's YAML report through the existing YAML dependency. Handwritten diagnostic matching and English success-summary filtering are removed. Known rule identifiers, native explanations and the existing target-specific warning policy remain available. A terminated validator retains a failed process status instead of being treated as a successful exit.

All 48 deployment, metadata, source-Flatpak and localization cases pass. Public warning cases accept a Debian preview and reject a source-Flatpak preview using the same native warning; malformed metadata and unsupported tags remain rejected. Build, source/test types, affected lint, whitespace checks and independent review pass. The warning cases assert only exit status.

The review also reproduced an upstream AppStream YAML command returning success for missing input. U14 in `~/UPSTREAM.md` records the standalone reproduction and current upstream cause. GTKX supplies freshly written metadata, so no production workaround was introduced. A separate source review found that Debian copyright serialization discards SPDX grouping; a public reproduction and maintained-parser correction remain follow-up work.

### Bundled notice provenance

All eight notice modules were read with the build manifest, metadata reader and target renderers. Deployment previously reread installed packages after the bundle had been built, so replacing a dependency could attach the replacement's terms to old code. Build metadata now records dependency identity, source, copyright and license text at build time. Deployment uses that snapshot even when the installed dependency changes or disappears. The metadata format is version 3; older builds require regeneration.

Explicit npm `SEE LICENSE IN` files are included alongside existing license and notice discovery, without duplicating a file already selected. Build and deployment share the recorded package shape and package manifest reader. Ten public CLI regressions cover replacement, removal, standard and custom filenames, combined notices and unsupported or malformed metadata. All 537 CLI tests across 50 files pass with this change and fresh reference-store reuse. Build, source/test types, affected lint, Knip, whitespace checks and independent review pass.

The source Flatpak review separately reproduced a preview probing an unused local Node executable. Source builds copy Node from their SDK extension, while mixed targets can also carry a local runtime; notices must describe each target's actual runtime. That correction and Debian license-expression grouping remain the next packaging changes. Hardcoded native crate license metadata remains under review.

### Deployment guide

The complete deployment guide was reviewed against the command, configuration and target implementations. The revision is about 65% shorter, replacing complete option catalogs and sample command transcripts with the GTKX workflow and links to exported API types. It preserves targets, architectures, icons, preview and rebuild behavior, runtime choices, native addon assets, installed notices and source Flatpak constraints.

The guide distinguishes runtime FFI from GIR generation, describes target-specific AppStream warnings and separates a generated source manifest from a tested source build. Three snippets pass strict installed-consumer typechecking, six local routes and anchors resolve through VitePress, and upstream links were checked. Independent review and the production website checkpoint pass. The configuration reference currently hides schema-inferred deployment fields, so editor completion supplies the options until that separate reference gap is corrected.

### Reference store reuse and coverage deadlines

Reference generation now reuses an installed GI declaration store only when the existing freshness check matches its ordered GIR inputs and generator version. Missing or stale stores keep the existing in-memory generation path. Strict configured-prop validation remains eager, and no additional cache or retained compiler graph is introduced. Cold MCP reference loading fell from 7.52 to 3.89 seconds in the copied consumer measurement; cached queries remained 5–8 milliseconds.

All 15 configured-props CLI cases pass within the 537-case CLI checkpoint. The added public case generates a store, changes GIR search precedence, restores the earlier inputs and verifies declaration errors without replacing existing pages. Independent MCP probes cover absent, fresh and stale stores, configuration changes, isolation and recovery. Source/test types, affected lint, Knip and independent review pass.

The completed coverage job at `f6793578` has 4,821 passes and 17 failures, all in the MCP reference file. Instrumented cold requests take roughly 90 seconds, exposing SDK request and polling deadlines as well as test deadlines. The reference tests now use 120-second requests and polls, with 600 seconds for multi-reload cases; other consumers retain their existing request defaults. The focused V8 run now passes all 29 reference cases in 807 seconds; subprocess coverage records include 136 codegen and MCP source modules. This establishes instrumented execution, not a coverage percentage. Main CI tests pass at `91d37dab`; its coverage analysis is still running, so the Sonar quality gate remains unconfirmed.

### Package script paths and platform notices

All five nFPM modules were read, 302 baseline lines, with their target wrappers and command path handling. A real Debian deployment launched with `--cwd` failed to package an existing project-relative hook script because nFPM inherited the caller's working directory. The packaging subprocess now runs from the resolved project root, which also supplies the base for relative signing files.

Real Debian and RPM packages retain the configured hook script for relative paths containing spaces and for absolute paths. Missing scripts remain rejected. The six public integration cases pass across focused runs; the Debian inspection uses existing `ar` and `tar` tools after the initial test exposed unavailable `dpkg-deb` on Fedora. Source/test types and affected lint pass. No tool was added to the environment.

Platform notices now describe generated FFI bindings and dynamically supplied libraries. The incorrect runtime-introspection explanation and legal interpretation are removed; source links and license identifiers remain. Independent review and the combined build, lint, typecheck, test, release, tutorial and website checkpoint pass.

### Target-specific Flatpak notices

Source Flatpak previews no longer probe an unused local Node executable. Notice collection now follows the same runtime-selection decision as deployment and supplies separate sections for each target. Source manifests identify their configured SDK extension; local and binary targets retain the actual bundled Node version and license. Mixed deployments preserve both identities.

All 12 new public CLI cases pass, including a missing local executable, custom SDK selection, binary Flatpaks and mixed targets. Existing notice provenance cases pass. The combined build, lint, typechecking and all 46 test/build tasks pass, followed by fresh published TypeScript and JavaScript consumers and the installed tutorial's application, localization and package checks. Independent review passes.

A separate public source-revision case confirms that locally rendered dependency notices can still describe a different revision from the source being built. The next correction takes those sections from the selected revision's own build output. This batch closes runtime identity only.

### Debian license expression grouping

Debian copyright output previously removed SPDX parentheses, changing the meaning of combinations such as `(MIT OR Apache-2.0) AND BSD-3-Clause`. The maintained SPDX expression parser now supplies the syntax tree. Serialization preserves grouped choices using Debian's conjunction syntax, including nested alternatives, exceptions and later-version markers. Original expressions and available license texts remain in the notice body; custom package license labels retain their existing handling.

All 25 public notice-provenance cases pass, including 15 expression cases covering grouping, deduplicated terms, explicit license files and missing terms. The complete canonical build, lint, typecheck and test checkpoint also passes, followed by release consumers and tutorial packaging. Frozen dependency installation and independent review pass. No private-helper or cosmetic error assertions were added.

### Combined checkpoint and CI capacity

The complete local checkpoint passes build, lint, typechecking, all 46 test/build tasks, fresh published TypeScript and JavaScript consumers, the installed tutorial and all 27 website tasks. The website renders successfully in 426 seconds. This checkpoint includes target-specific Node notices, Debian expression grouping and project-relative package hook scripts.

At `91d37dab`, CI passes the main suite, publication, sanitizers, docs, lint, types and CodeQL. The CLI job reaches its 30-minute job limit after reporting 50 passing files, with localization still unfinished; its log contains no failed test assertion. The CLI job now allows 45 minutes. Individual test deadlines and production behavior are unchanged. Workflow YAML parses successfully. Sonar's separate coverage job subsequently reaches its 45-minute limit after reporting 4,344 passing tests across 356 files, with no failed assertion marker. Its longest completed CLI file takes 2,035 seconds under instrumentation, and the MCP reference file is still unfinished. The coverage job now allows 90 minutes; individual test deadlines are unchanged. The quality gate remains unconfirmed until the next complete run.

Copilot reviewed 277 of 683 files at that commit and added no new comments. This partial review does not close the audit or the previously tracked GL callback finding; no reply was posted.

### Real AppImage packaging coverage

The 224-line private AppImage fixture and mocked packager are replaced by public CLI deployments and extraction of real AppImages. The tests compare packaged icon bytes for scalable preference, effective raster size and application-icon context; an unrelated icon remains rejected. Two existing GTKX PNG assets supply stable fixture data.

The pinned appimagetool supports only zstd, although GTKX previously accepted gzip and xz. Configuration now preserves default or explicit zstd and rejects unsupported choices during loading. All six public cases pass, alongside the 50-case canonical notice/AppImage checkpoint, build, source/test types, affected lint and independent review. The known upstream compressor limitation is recorded separately in `~/UPSTREAM.md`.

### Source-revision dependency notices

A public Git fixture reproduced source Flatpaks embedding local dependency 2.0 notices while the pinned revision builds dependency 1.0. Ordinary builds now emit `BUNDLED-NOTICES` from the same recorded package snapshot as their JSON build metadata. Source Flatpak installation combines that selected build's notices with SDK and platform sections. The notice identifies the bundled files' installation directory.

Builds require no deployment configuration. Local deployment and `--skip-build` retain their recorded dependency identity, and generic runtime staging excludes both metadata artifacts through one filename set. The native emitter and notice producer share the existing addon filename. Shared section builders and rendering avoid a separate source-mode implementation.

All seven new public cases fail before the correction and pass afterward, covering selected revisions, mixed targets, ordinary builds, empty dependency sets, failed rebuilds, skipped builds and a missing notice artifact. All 50 canonical notice/AppImage cases, build, source/test types, affected lint and independent review pass. The probes execute actual builds and generated install commands; they do not claim a complete Flatpak sandbox build. The subsequent combined publication and tutorial checks also pass.

### Constant aliases and remaining generator leaves

A real GIR scanner fixture declared a 64-bit constant through an alias; GTKX imported it as the rounded number `9007199254740992` instead of `9007199254740993n`. Constant generation now resolves primitive alias chains once, including the existing GType alias rule. Numeric-looking and padded string aliases remain strings, and boolean aliases retain boolean values.

The two public generated-consumer cases pass on the canonical build, checking 14 exports, exact literal types and rejection of a number consumer for a bigint constant. Constant imports and TypeScript checks disable native addons. Source/test types, affected lint and review pass. Comparing 110 generated JavaScript/declaration files changes only the fixture constants and the real GObject constant whose alias requires bigint. Direct occurrence-based type-shape queries retain their existing pointer/void semantics.

Six GI leaves were read completely: constant, enum, generated-libraries, gtype-binding, value-marshalable and companion, 398 baseline lines. A further six files—element-metadata, constructor-props, doc-spec, callable-doc, item-comparators and signal—were read completely, 1,390 lines, with relevant runtime metadata and alias-declaration callers. The broader constructor/factory and metadata work remains open.

Three distinct upstream scanner defects were reproduced without GTKX: floating-point precision loss, eight-bit unsigned wrapping and negative floating-point sign loss. U15–U17 in `~/UPSTREAM.md` contain permanent standalone reproductions and current upstream source references. No GTKX workaround was added for information already lost from GIR input.

### Target paths and staging ownership

All ten deployment target files were read with their configuration and tool callers, 1,162 baseline lines. Public CLI probes reproduced a project-relative custom AppImage runtime failing, an absolute Flatpak lockfile failing, and a lockfile-copy error leaving temporary staging behind.

Configured runtime and lockfile paths now resolve from the project root while preserving absolute paths. The existing staging-directory helper owns both copying and generator execution, including failures. Source Flatpak installation also reuses the canonical native addon filename.

The nine public integration cases cover relative and absolute paths with spaces, default lockfiles, real AppImage extraction, missing inputs, malformed JSON and temporary-directory cleanup. Three fail before the correction and pass afterward; the isolated target/source-notice batch passes all 28 cases. The canonical build, full lint, typecheck and all 46 test/build tasks pass. Independent review is clean. Fresh published TypeScript and JavaScript consumers, the installed tutorial and the production website also pass at `fdb77c7c`; the website completes in 448 seconds. This checkpoint includes the source-revision notices, real AppImage coverage and constant-alias correction.

Revision-free source manifests remain an observation requiring a separate consumer-contract check. Custom Flatpak branch installation was subsequently confirmed and corrected below.

### Native container writes

Source review found that initialized array writes selected cleanup from the element type alone, overlooking the container layout. Replacement now uses the existing GArray, GPtrArray, GByteArray or list cleanup operation; plain C arrays preserve their existing ownership policy. Fallible field and reference writes also finish encoding before replacing the old value. Encoding failures propagate instead of being converted to a successful null write. Callback return defaults remain unchanged.

Independent source review, Rust formatting, Clippy and affected typechecks pass. All 250 existing field, call, runtime reference and generated collection integration cases pass. The complete sanitizer checkpoint passes 377 addon and 509 generated-native cases, then restores the normal addon. These checks do not close every owned-element cleanup combination; list element ownership and callback seed decoding remain under review.

The array codec and all ten container modules were read with hash tables, references, byte/bigint/buffer/struct codecs, stash ownership, allocation/field/call APIs and typed views. Runtime scalar plans, native-value conversion, hash tables, output storage, calls, descriptor types and fields were also read with their public collection tests. This confirms that runtime already owns string conversion. Moving byte-array value normalization is the next bounded R2 slice; native storage, transfer and release remain native responsibilities.

### Runtime byte-array conversion

Runtime conversion plans now pack numeric GByteArray inputs and choose public byte-view or numeric-array output, including the null policy. Rust retains native allocation, view validation, storage, transfer and release. Decoding copies directly into JavaScript-owned bytes while the native owner is alive, removing an intermediate allocation. The required napi U12 compatibility copy remains unchanged.

Eighteen new public integration cases use generated bindings, runtime calls, GValue and fields with real GLib/GIO functions. They cover byte values and offset views, both transfers and output shapes, null and empty values, invalid inputs, reference seeds, callback inputs and outputs, copied values and asynchronous capture. All 126 affected generated/native cases and 40 runtime cases pass, alongside Rust formatting, Clippy, builds, types, lint and independent review. The sanitizer checkpoint passes 377 addon and 527 generated-native cases, then restores the normal addon. No private-helper tests or mocks were added.

This completes the bounded GByteArray conversion slice. Other container conversion and owned-element destruction contracts remain open.

### Supported Node cache APIs

The compile-cache entry and cleanup store now import Node's cache APIs directly. Their availability checks supported Node versions below GTKX's declared minimum. Disabled and unwritable caching retain Node's existing behavior, and cleanup still preserves the active cache directory.

All ten public compile-cache cases, the CLI build, affected typechecks, lint and independent review pass. Six cache/loading modules were read completely, 382 baseline lines, with the public cache and React compiler suites.

Module hashing now uses Node's resolved module URL for the import scanner and React compiler. This removes extension guessing and the shared fallback hash while retaining published JavaScript and explicit TypeScript source execution. Nine public GIR freshness and live schema-import refresh cases pass, as do the canonical source bootstrap, CLI build, typecheck, lint and independent review.

The React compiler suite now builds through the public CLI and runs the resulting Adwaita application. Six cases check rendered labels and button interactions with default or disabled compilation, ordinary TypeScript and createElement modules, changed source with the same cache, an unwritable cache and invalid input. Private builder calls and compiler-output assertions are removed. All six canonical cases, typechecking, lint and independent review pass. The running window was inspected before and after activation, including screenshots and its live widget tree.

### Flatpak branch installation

Flatpak deployment now installs the complete application, architecture and branch reference already selected by its builder and bundler. The target repository persists between builds, so specifying only the application ID becomes ambiguous after building two branches.

A real Flatpak 1.18.2 repository with stable and beta exports reproduces the noninteractive install failure. Explicit references install each selected branch successfully; a missing branch fails. The probe uses an isolated installation and checks the installed references. The public CLI deployment suites, build, typecheck, lint and independent review pass. This validates reference selection and existing manifest behavior; it does not claim a complete SDK build.

### CLI helper repeat audit

Thirteen internal modules were read completely, 768 baseline lines: application/entry arguments, banners and errors, parent-process ownership, XDG data paths, font/icon paths and staging, file listing and agent rules. Supporting reads covered the shared process-stat reader and its process-group and marked-process callers.

CLI parent ownership now reuses the existing utility parser for Linux process statistics. Its ancestor traversal, process-group checks and process identity comparisons remain intact. All seven public development-process lifecycle cases pass, covering wrapper exit, graceful shutdown, signal status and an unresponsive child. Build, affected types, lint and independent review pass. No helper tests or additional parser were introduced.

Default icon selection now narrows its first candidate once, removing an unreachable second missing-icon branch. Missing, unique and ambiguous icon behavior is preserved. All three existing public icon integration cases, build, typecheck, lint and independent review pass.

### Declarative tutorial reminders

Notifications now use the generated JSX element in an application-owned portal. The notification effect reads the current task before sending, so completed, trashed, removed or rescheduled tasks cannot send a stale reminder. Pending reminders retain their task and due-date identity across renders. The sweep cursor also survives rerenders and catches reminders reached while the application process was paused.

Real desktop-bus integration coverage replaces the two mocked notification tests. The complete installed tutorial passes all 40 application cases, including StrictMode, edits, removal, action activation and a real paused-process case. The French suite passes all three cases. Fresh installation, build, launch, typechecking, localized AppImage/deb/rpm packaging and Flatpak manifest checks pass. Supplemental lint covers the tutorial files excluded from workspace lint. The running task window and editor were inspected through their widget trees and screenshots.

The reminder chapter follows the declarative implementation and keeps React explanations in linked upstream documentation. Translation messages are unchanged. The review covered 38 tutorial files, 3,394 baseline lines, plus the generated notification reference and the final implementation, tests and chapter. Native action activation is covered; GNOME Shell interaction and activation after application exit remain separate contracts requiring review.

### Singleton shortcut construction

Generated construction for GTK's activate, mnemonic and nothing actions now delegates to their native singleton getters. Runtime keeps the factory registration and existing wrapper identity behavior; the generated modules only register the three factories. Other classes retain their existing construction path.

All 11 declarative shortcut cases pass, including direct construction, shared JSX references, removal, remounting and keyboard activation. A running consumer was inspected through its widget tree and screenshot, confirming each action's native behavior and an independent callback shortcut. Builds, full lint and typechecking pass. Knip now recognizes the copied React compiler fixture entry and the generated-only runtime factory export. The constructor review covered 29 files, 6,306 lines, with partial supporting reads recorded separately. Broader constructor and factory-prop contracts remain open.

The combined checkpoint passes build, full lint, typechecking, all 45 non-CLI test/build tasks and the website build. The website completes in 431 seconds. The CLI run passed 575 cases but failed nine cases across five files because older build tests executed source plugins through Vitest, whose module resolution differs from Node's cache-hashing URLs.

Those five suites now build through the public CLI and the existing isolated consumer fixture. Environment overrides apply only to the child process. Acquired fixture resources are registered for cleanup before later setup can fail. All 26 affected canonical cases, types, lint and independent review pass. The complete CLI suite still needs a fresh checkpoint; no production source-extension fallback was added.

### JSX generation repeat review

All 12 JSX store modules and the JSX store writer were read completely, 1,799 lines, with the element reference renderer. A public generated consumer confirmed that omitting `label` from GtkToggleButton still left the inherited GtkButton prop accepted. Generated bases now omit inherited native property and notify keys before applying the current element's replacement props. The maintained distributed omission type is re-exported through the existing React internal dependency.

The inherited configured-interface correction now filters omitted properties from references too. Four public omission cases cover class, interface, prerequisite and cross-namespace inheritance, replacement props and discriminated branches. Custom-only union omissions remain outside the documented GObject-property contract.

Named factory property bags now include their own required inputs and match component props and intrinsic JSX. Factory-only base types keep those inputs out of native subclasses. The three added factory cases and all 37 existing consumer and omission cases pass in the canonical checkout. The suites share one public TypeScript consumer launcher. Independent repeat review covers 17 complete files, 2,736 lines, and reports no further findings in this slice.

### Reference output and abstract bases

Reference paths now normalize trailing separators before generating links and fingerprints. Root paths no longer create protocol-relative links. Abstract classes retain their inherited-prop pages and type-only imports, while renderable inventories exclude them. Factory-backed abstract elements remain available. Generation, references and API lookup share the existing mountability rule.

Independent review covers six production files, 2,408 lines, plus the public tests and their shared consumer helper. Isolated public checks pass for four path forms, page hierarchy, API lookup and accepted or rejected JSX imports. All 25 canonical reference cases pass, along with full build, types and lint. The final production website build passes in 441 seconds, including the introduction and controlled-selection prose corrections.

### Pending native allocation ownership

Pending transfers now release through Rust ownership, with explicit disarming after successful handoff. This removes manual cleanup loops while preserving callback lifetime, field replacement, rollback and container backing order. The existing external ownership policy for untracked fields remains unchanged.

Rust formatting and Clippy, a fresh native release build and runtime integration pass. The sanitizer checkpoint passes all 377 addon and 527 generated-native cases, then restores the normal addon. Independent source review is clean for this six-file change. The cleanup removes fragile manual paths; it does not claim a reproduced supported-input memory failure. Broader collection and callback ownership work remains open.

### Schema-derived settings values

Generated schema modules now expose enum and flag nickname mappings and choice values alongside the existing key kinds. `useSetting` derives enum and choice types from that metadata, while flag combinations remain numeric. Manual schema definitions retain their previous behavior. The tutorial derives its preference types and enum values from the XML instead of repeating the schema's ordering and identifiers.

The parser preserves choice and nickname whitespace, resolves declarations across files and inheritance, and accepts GLib's integer literal forms. Runtime rendering reuses the shared JavaScript string encoder. Enum-only schema imports now produce matching empty runtime and declaration modules, allowing them to supply referenced enum definitions without requiring a schema of their own.

All 18 public CLI settings cases and 49 native hook cases pass in the isolated candidate. Full workspace types and lint pass after adding the new private metadata constraint to the existing TypeDoc exclusions. The e2e project uses the public application test plugin and generated schema declarations; its repository configuration shares the root GIR bindings and retains uncompiled runtime tests. Nx excludes that configuration from inference, matching the example projects' bootstrap arrangement.

The first complete suite exposed a stale local e2e binding store left by the configuration attempt. Its links and generation were moved outside the checkout; no production resolver change was needed. All 82 settings and layout cases pass against the shared bindings. The complete CLI checkpoint passes, and the e2e rerun passes all 1,177 application/runtime cases and 527 generated-native cases. Fresh TypeScript and JavaScript consumers pass local-registry installation, codegen, build, launch and tests; the TypeScript consumer also passes typechecking. The installed tutorial passes all 40 application cases and three French cases, plus launch, types, localized AppImage/deb/rpm packaging and Flatpak manifest checks. Translation source locations follow the moved settings declarations; messages are unchanged.

### Guide consistency and native examples

The async, error handling, navigation, subclassing and modals guides now keep complete signatures in the API reference and shared React concepts in upstream documentation. Navigation describes the actual stack selection behavior. Window guidance distinguishes explicit application-window transient parents from the default used by plain windows, and explains the initial null returned by `useParentWindow`.

The new async example owns its file dialog declaratively. Its complete consumer passes strict TypeScript and real MCP interactions for file selection, user dismissal and a 20-second cancellable timeout. Widget trees and screenshots were inspected, and all owned processes were stopped. The four-guide pass checks 24 code fences and 21 local routes; the adjacent modals pass checks four unchanged JSX examples and seven routes. The combined production website build passes.

### GTKX introduction and migration review

Both introduction pages now describe verified GTKX behavior and link to the feature guides. Unsupported comparisons with other projects and the promise that every npm package works are removed. Version-specific default libraries and the UI-thread constraint remain explicit.

The pass reads 17 full files, 1,188 lines, plus supporting implementation excerpts. All 20 local routes resolve. The bounded 2.0 migration review confirms the inspected configuration, runtime minimum, exports and tuple changes; it finds no additional stale contract. There is no new widget example to execute. The final website checkpoint includes these edits.

### Components and Cairo guide review

The two guides were checked against 15 complete implementation and integration files: 17 full files and 2,334 lines in total. The Components guide incorrectly described `onRowSelected` as exclusively reporting user actions. Its shorter explanation now distinguishes GTKX's suppressed writes from other native selection changes, while preserving optional control and pending-row behavior. Existing integration coverage supports this correction. No snippets or links changed. The Cairo guide has no confirmed issue in this scope.

### Remaining GL callback lifetime contract

The repeat lifetime review reads 12 complete core files, 2,263 lines, plus relevant descriptor and handle paths. Current closure dispatch is tied to the Node thread. Callback retirement and native executable-memory reclamation need separate guarantees; clearing a GL callback does not establish the asynchronous completion boundary needed by a reclamation implementation. The [KHR_debug contract](https://registry.khronos.org/OpenGL/extensions/KHR/KHR_debug.txt) permits delayed and foreign-thread delivery when synchronous output is disabled. No driver stress or stale-callback probe was run, and no GL state change is proposed. GL5 remains open.

### Contiguous byte outputs and callback string seeds

Runtime now chooses the public byte-view or numeric-array shape for contiguous uint8 outputs, sharing the GByteArray conversion policy. Native receives its existing byte transport descriptor and retains allocation, storage and transfer responsibilities. Numeric-array inputs remain unchanged. Pointer collections, non-byte arrays and inline records retain their existing paths. The napi U12 compatibility copy remains in place.

String callback inout seeds now copy their borrowed bytes before invoking JavaScript. Runtime still owns UTF-8 conversion, and fixed-capacity string buffers keep their existing behavior. Source review confirmed that lengthless string seeds previously became null; no pre-fix native probe was run.

The 25 new public cases cover byte returns, fields, references and callbacks, plus string seed preservation, replacement, null, empty and Unicode values, and invalid callback outputs. Four native fixture suites share their existing compiler setup through one test helper. All 163 affected native cases, 672 runtime cases and five GL cases pass. Fresh builds, full types and lint, Rust formatting, Clippy and independent review pass; all 59 checked public declaration files remain unchanged. The sanitizer run passes 377 addon and 552 generated-native cases, 929 total, then restores the normal addon.

### GL debug callback arguments

The GL debug callback descriptor now supplies the native registration function's user-data argument and describes the callback's ignored user-data value as a pointer. Clearing the callback consequently supplies both required null pointers. This is a source-confirmed ABI correction, validated by the existing five ordinary GL integration cases and the combined checkpoint above. No pre-fix malformed call or stress probe was run. The explicit callback lifetime is unchanged; GL5 remains open.

### Khronos generation and buffer consumer types

All 13 Khronos TypeScript modules were read completely, 2,789 lines, with the package generator, public GL tests and native buffer codec. The generic buffer parameter union admitted numbers while rejecting the opaque handles accepted by native. It now uses the existing GLpointer alias. Explicit byte-offset parameters retain their numeric descriptors and declarations.

A strict public consumer rejects mapped-buffer handles before regeneration and accepts them afterward. Typed views, empty views and null remain accepted; numeric generic-buffer inputs are now rejected. Explicit numeric offsets still compile and bigint offsets remain rejected. These compiler checks disable native addons. The canonical package build, affected lint, all five ordinary GL integration cases and independent source review pass. No native pointer probe was run; GL5 remains open.

### Final v2 guide coverage

Animations, CSS, OpenGL and Storybook were read completely, 530 baseline lines, with 39 complete supporting files totaling 3,829 lines. Together with the recorded earlier batches, all 20 v2 guides now have explicit full-read evidence. CSS and Storybook have no additional confirmed finding in this scope.

Animation guidance now describes retaining a viable window clock without promising the newest mapped window or unconditional completion. The OpenGL guide focuses on GTKX integration, replaces incomplete rendering fragments with a complete component, and links to the upstream rendering reference and existing examples. It also accounts for resize-triggered rendering when automatic rendering is disabled.

The exact component and its Adwaita consumer pass strict TypeScript. Real MCP interaction resizes the running window from 520×360 to 840×620; inspected screenshots show the gray GL surface filling both sizes. All owned processes were stopped. Independent review confirms context, resize and error contracts. The production website checkpoint passes in 438 seconds, including these two guide edits.

### Contributing architecture repeat review

All nine Contributing pages were read completely, 992 lines, with their navigation and implementation owners. The full supporting inventory totals 25 files and 3,025 lines; all 78 repository link targets resolve. The architecture now identifies the element hook that reapplies accessibility on mapping, and the principles include the established upstream workaround retention policy. Runtime byte conversion, generated settings and JSX descriptions remain consistent with the current implementation. Independent review is clean. The production website checkpoint passes in 439 seconds, including both prose changes.

### Owned list replacement and callback borrowing

Source review confirms that initialized GList and GSList replacement releases list nodes without releasing owned elements. Callback seed decoding borrows the outer list but still uses the elements' original transfer policy. The next correction must address both contracts together: adding element cleanup alone would conflict with seed decoding that consumes those elements.

Initialized replacement now releases owned elements before list nodes. Borrowed field reads and callback seeds copy strings and retain independent handle ownership; noncopyable elements reject reads without consuming the installed list. Ordinary return transfers and separate node/item construction rollback retain their existing behavior. Allocation, traversal and release remain native responsibilities. No stale-memory reproduction or native probe was run.

Destructor lookup happens before acquiring transferred storage and propagates resolution errors. Stored-value cleanup and rollback of newly acquired references share that lookup while preserving their distinct fundamental-reference requirements. Releasable structs carry their declared cleanup into rollback.

The 22 new public GList/GSList cases cover reads, replacement, empty/null values, independent object and record ownership, callback seeds and rejected inputs. Rust formatting, Clippy, the native/runtime build, full workspace types and affected test lint pass. The ordinary checkpoint passes 377 addon, 672 runtime and 102 generated collection/string/callback cases. All 951 sanitizer cases pass, including 574 generated-native cases; the normal addon is restored. Independent production and test reviews are clean.

The next source review confirms related borrowed-seed ownership in non-list pointer arrays. It also identifies nonterminated owned-array replacement selecting string-vector cleanup and GPtrArray replacement lacking a consistent item-destruction contract. These separate stages remain open; successful owned-element replacement tests must follow their corresponding cleanup corrections.

### Borrowed array fields and callback seeds

One internal native read policy now distinguishes ordinary declared transfers from borrowing the entire container and its elements. Sized, fixed, terminated, GPtrArray and pointer-form GArray callback seeds share that policy. Borrowed nested arrays propagate it recursively, and inline record reads retain independent ownership. Ordinary return transfers keep their separate outer and item ownership rules.

All 32 new public cases pass. They observe valid strings, objects, records, boxed values and fundamental references before an ordinary callback exception; native cleanup then leaves only the independently retained values alive. Additional cases cover null/empty containers, inline records and nested field reads. Finalization counters observe cleanup without reading displaced storage. No pre-fix native execution or malformed-layout probe was run.

Rust formatting, Clippy, the native/runtime build, full types and full lint pass. The ordinary checkpoint passes all 377 addon, 672 runtime and 606 generated-native cases. All 983 sanitizer cases pass, followed by restoration of the normal addon. Independent production and test reviews are clean. The subsequent stages address bounded and terminated replacement; GPtrArray/GArray item destruction remains open, so this does not close the complete Copilot ownership finding.

### Original extents for bounded array replacement

Initialized sized-array callbacks now capture the original extent before JavaScript changes the length Ref. Replacement resolves the item destructor before encoding, releases each displaced owned pointer using that captured count, then releases the outer allocation. Fixed fields use their declared extent. String-vector cleanup applies only to terminated string arrays; inline and scalar buffers retain outer-only cleanup. Array and hash-table writes share the same prepare, encode, swap and release sequence.

All 18 new public cases pass, covering growth, shrinkage, clearing, fixed fields and callbacks, copied records, independent object references, null/allocated-empty storage, output-only initialization and rejected JavaScript values. The ordinary checkpoint passes 377 addon, 672 runtime and 624 generated-native cases. All 1,001 sanitizer cases pass, followed by restoration of the normal addon. Rust formatting, Clippy, the CLI build, full workspace types and full lint pass; independent production and fixture reviews are clean.

This preserves individual pointer slots on rejected replacement; it does not make every callback output transactional. The field API supplies no sibling length context, so replacing a populated sized field with owned pointer items rejects before mutation. GPtrArray/GArray destruction remains a separate stage.

### Terminated native handle replacement

Null-terminated object, record, boxed and fundamental arrays now release each displaced owned handle before the outer allocation. Decoder and replacement cleanup share the existing sentinel iterator. Destructor lookup still precedes encoding and replacement; strings retain their separate vector cleanup, and inline/scalar buffers retain their existing policy.

All 14 new public cases pass, covering repeated fields and callback replacement, independent copies/references, null/empty storage, output-only initialization, rejected inputs and failed destructor resolution. The complete ordinary checkpoint passes 377 addon, 672 runtime and 638 generated-native cases. All 1,015 sanitizer cases pass, and the normal addon is restored. Rust checks, build, full workspace types/lint and the additional test typecheck/lint pass. Independent production, fixture and combined consistency reviews are clean.

### Reference-counted container ownership contracts

A further source review reads 12 complete files, 2,267 lines, and traces ten additional sections. Full transfer of a GPtrArray or GArray does not establish exclusive ownership: GLib's ref functions return the same container with another owned reference. Clearing, stealing or changing a destroyer can therefore affect another owner. The current descriptor also cannot distinguish leaves independently transferred to the caller from leaves released by the container's own destroyer.

Both conventions occur in introspectable libraries. OSTree's sign-engine result retains an object-unref destroyer, while AppStream's GI category helper explicitly clears its destroyer before returning. Known received values may use full outer ownership with borrowed, independently retained leaves. Persistent replacement storage needs a separate explicit cleanup contract. Generic cleanup and a decision about the upstream metadata remain open; no shared-container mutation or external report was added.

The existing return-transfer override now gives `ostree_sign_get_all` that container-owned shape. Each returned object gains an independent reference before the outer array releases its own references. The correction preserves the existing `g_value_reset` override and changes no runtime or native policy. Source review covers installed OSTree 2026.4 and upstream 2020.4 and 2025.7; this is a GTKX lowering correction, with no established upstream annotation defect.

All three public generated-consumer cases pass ordinarily and under AddressSanitizer: usable engines, independent repeated enumeration and rejection of an unknown engine. The normal addon is restored. Existing GValue coverage passes all 21 cases, and the CLI build, repository typechecks, affected lint and independent review pass. The CI image now declares the required `libostree-dev` GIR package. No pre-fix native call or fault reproduction was run; generic container ownership remains open.

GPtrArray and GArray descriptors now offer explicit container ownership of their elements, independently of the outer transfer. Reads retain or copy elements before consuming the owned outer reference. Encoders for strings and object references install the native element destructor after successful acquisition; scalars need none. A rejected replacement preserves that slot's storage. Existing aliases retain their contents and destructor. Runtime derives the option from the canonical native descriptor type; existing defaults and the OSTree override are unchanged.

All 36 new public integration cases pass with real native holders and aliases. They cover both layouts, borrowed and owned inputs and returns, field and callback replacement, null and allocated-empty values, rejected writes and noncopyable records. The full native/runtime checkpoint passes 1,729 cases across 109 files. All 1,051 sanitizer cases pass, and the normal addon is restored. Native build, Rust formatting and Clippy, affected TypeScript and lint, and independent production/fixture source reviews pass.

This completes the first explicit container-owned stage. No descriptor infers exclusive ownership from an outer reference count.

The subsequent Separate-element stage releases each independently owned pointer element before one outer reference when replacing an initialized GPtrArray or non-inline GArray. It resolves release operations before acquiring or publishing replacement storage. Native Object aliases explicitly retain their own leaf references as well as the array reference; an outer reference alone does not preserve separately owned leaves.

All 24 new cases and 68 existing focused controls pass. The full ordinary native/runtime checkpoint passes 1,753 cases across 110 files. Final Rust formatting and Clippy, canonical e2e types and affected lint pass. Independent production and fixture reviews are clean. All 1,075 native sanitizer cases pass, followed by the new generated subclass callback consumer under AddressSanitizer; the normal addon is restored. The direct-container GIR inventory covers 73 installed files and 241 occurrences, with no inout declarations. The two existing seed producers that install destroyers now use Container ownership explicitly. Custom and inline resource construction, nested-container ownership, partial decode cleanup and further producer-specific metadata remain open.

Six additional public cases return from the callback without replacing its Ref value, exercising the existing writeback path for unchanged seeds. Both array layouts cover strings, objects and copyable records with null, empty and populated values, retained reads and native release counts. All 30 Separate-container cases pass ordinarily and under AddressSanitizer, with the normal addon restored. No production change was needed for this acceptance coverage.

### Compiler factory investigation

U18 records an observed React Compiler closure-hoisting failure with a standalone compiler example and public compiled GTKX application controls. The named-function and compiler-disabled controls render the expected native label; the arrow factory raises ReferenceError. React's documented component-hook-factories rule rejects this pattern, and the existing upstream report remains unconfirmed. This does not establish a supported GTKX application regression. Evidence and that limitation are recorded in `~/UPSTREAM.md`; no production workaround or external post was added.

### Installed tutorial action activation

The open-task action now queues navigation before activating the application. The application activation handler presents an existing window, while its declarative window mounts on a service launch. Completing a task keeps the operation in the background. The tutorial chapter contains the exact updated App implementation and explains this GTKX lifecycle.

Three retained integration cases use the real private desktop bus and native application windows. They verify the selected task, window identity across repeated actions and activation, persisted completion before a window exists, and rejection of an incompatible action target. Their final assertions pass with canonical tutorial types. Supplemental test lint passes with the fixture API's empty destructured parameter allowed; the repository's existing tutorial lint exclusion remains unchanged.

The publication workflow now tests cold activation of the actual extracted Debian package. Its private bus loads the relocated installed service; repeated activation keeps the same process and window, cold completion persists without creating a window, and later activation opens that same process. Both bus-aware and observed-process cleanup cover failures. The complete workflow passes fresh installation, build, launch, types, all 43 application cases, all three French cases, localized AppImage/deb/rpm checks and Flatpak manifests. Full repository typechecking and lint pass. The chapter's production website build passes.

The live consumer was also inspected through MCP task selection, native window trees and screenshots. All owned application, bus and compositor processes were stopped. GNOME Shell notification-card interaction and focus policy remain separate desktop validation work; no production bus configuration workaround was added.

### Required shortcut constructor inputs

A repeat source audit read 28 implementation/test files, 6,138 lines, plus four generated reference pages. Direct CallbackAction construction was concrete even though its native factory initializes a required callback. SignalAction, NamedAction and AlternativeTrigger also exposed optional/nullable inputs that their native construction contracts require. Generic property validation checks supplied entries and native critical handling occurs after construction; these checks did not establish the missing preconditions.

CallbackAction now follows the existing factory-initialization path: its generated type is abstract, and its JavaScript constructor throws before entering native construction. Its static factory and JSX callback prop retain their behavior. All three strict consumer cases, the public JavaScript guard case and 11 existing shortcut integration cases pass. Independent review is clean. No invalid native construction or pre-fix reproduction was executed.

SignalAction.signalName, NamedAction.actionName and AlternativeTrigger.first/second now share one required-property contract across GI constructors and JSX. Required props remain non-null, and inherited requirements keep constructor arguments mandatory even when a descendant adds optional props. All four generated-consumer cases pass with strict library checking, including a declaration-only inheritance fixture. Existing defaultable concrete triggers remain accepted. Independent source and test reviews are clean. This corrects omitted and nullable inputs; it does not add validation for unsupported upstream string values.

### React integration test repeat audit

All 43 React integration files were read completely across six bounded batches, covering 16,055 baseline lines. Exact paths and hashes are recorded with each audit. Callback spies that observe supplied application handlers are distinct from replacements for external dependencies.

Nine control update/removal cases now rerender their existing root; eight also assert native widget identity. Scale-mark cases observe visible labels, removal and GTK's documented placement classes. All 44 cases pass, with affected types/lint and independent review. The application cases drop an unused stderr implementation replacement and assert native window counts directly; all 24 pass with affected lint and independent review.

Accessibility cases now use public property, state and accessible-name matchers. Exact label assertions exposed two fixture mistakes: a generic role that prohibits naming, and two children competing for a single-child window. A group role and a shared box correct those fixtures without changing production matchers. All 34 cases pass, with affected types/lint and independent review.

Three more navigation update/removal cases now rerender their existing root and retain native identity. Presence assertions require real pages; the NotebookPage case actually removes its prop, the useId case mounts both consumers under one root, and the default-container case omits that argument. All 29 cases pass, with the final default-argument adjustment checked separately. SpinRow fixtures now declare their adjustments through JSX; all 22 preferences cases pass, and the listener-removal case also confirms the second value change. Application menus now use JSX in owned roots while preserving native-object prop coverage; all 24 application cases pass. No production behavior changed.

Eleven dialog transitions now update their mounted objects, and closing a dialog observes the actual native close route. The GL fixture checks a rendered green pixel, declares its shader input location and releases its resources; shader failure checks compilation status without inspecting logs. All 51 dialog and GL cases pass. Property-hook cleanup now checks the public signal subscription before mounting, while mounted and after unmounting, including blocked handlers; all 32 hook cases pass.

Host cases assert rendered behavior, and manually owned layout-effect roots always unmount. Overlay updates retain widget and parent identity; VFL removal preserves an independently installed constraint. All 88 host, layout and layout-effect cases pass. The first VFL fixture encountered a known GTK solver defect, recorded as U20 in `~/UPSTREAM.md`. Its required nonnegative-width constraint preserves the intended test while avoiding the affected branch. GTK 4.24.0 includes the upstream correction; the checked 4.22.5 source remains affected. Window size updates now retain the mounted window and assert exact requested dimensions; all 28 window cases pass. Affected lint, types and independent source reviews pass.

Menu actions now run through visible menu items, and menu/notebook transitions retain their mounted models. Notebook insertion and reordering use exact native page order and actual tab text; GTK's default labels are available through the public NotebookPage tab property. Shortcut removal observes the retained controller, and trigger replacement checks the actual trigger. All 47 menu and notebook cases pass across the affected runs.

TextView and SourceView signal suppression now proves that displayed text changes on the same view and that a subsequent user edit reaches its handler. Text tags check weight, underline and their applied ranges; rebuilt anchors require the updated button label. All 66 text/source cases pass. The four tutorial regressions pass, including identity and actual callback activation after a retained header button loses its action name.

All 12 Sidebar cases check real mode writes and rooted suffixes while preserving native property, GValue and Breakpoint routes. All 37 signal cases pass with declarative adjustment, overlay and portal-target fixtures; the portal case checks both commit suppression and subsequent user activation. All 79 widget cases pass with public subscription cleanup, visible credit sections and removal of log-output assertions. Settings cleanup and target replacement inspect real detailed-signal connections, while slot tests observe native attachment, retained siblings, removal, ordering and portal key lifetimes. All 86 settings/slot cases pass. Affected types, lint and independent reviews pass.

Stack tests now observe native page order and user-driven controlled navigation; all 18 pass. Style cases use public color, authored classes and measurements without generated-class assertions; all 21 pass. A retained widget is reattached through a native-object-valued JSX prop before measuring its reset style, allowing GTK's rooted CSS lifecycle to refresh its size cache. The earlier detached measurement assumption was a test error, with no production defect established.

List, grid, tree and accessibility fixtures now share a declarative item factory. A per-factory external store records native setup, bind, unbind and teardown events for React portals. Tests observe native model replacement, current callback delivery, selection preservation, disappearance, recovery and subscription cleanup on explicit React unmount. They preserve GTK's pooling lifetime rather than requiring immediate destruction when a model entry disappears. All 87 affected cases pass, followed by all 938 cases across the 43 React files and the shared ComboRow display-value consumer. Affected lint, types and independent reviews pass. These fixture corrections establish no separate production regression.

A four-file follow-up preserves intentional native menu props, snippet assembly without a generated child slot and synchronous tree-model factory returns. Ordinary menu action setup and the WebKit settings property observer now use JSX; all 27 affected cases pass. Moving a snippet fixture's buffer ownership into JSX exposed text-mark cleanup criticals after the assertions completed. That tentative buffer change was withdrawn pending the upstream correction below.

The generated `newv` consumer now asserts successful object construction and three rejected JavaScript calls without inspecting error wording or classes. The guard is confirmed before native entry, and the corrected consumer passes.

### Generated async and marshalling consumers

Preparing an actual generated GTask consumer exposed a source-confirmed argument bug: promise wrappers inserted a cancellable argument even when the GIR function declared none, displacing its completion callback. The shared generator now uses its existing argument adapter for that shape. Instance, static and namespace methods retain their public signatures; runtime and native policy are unchanged.

Generated adapters and native descriptors were inspected against the fixture's C signatures before its first execution. The consumer covers result tuples, plain values, constructed objects, cancellation, requested errors and callbacks whose finish belongs to another source object. Six emitted-string cases now compile strict accepted and rejected public consumers for byte sequences, GValues, async finishes and consumed inout records. Their declaration-only fixtures remain separate from real native execution. All 15 generated-consumer cases pass, alongside 13 runtime async/Pango controls and 117 byte-array, container and GValue controls. The compiler helper now rejects abnormal termination instead of accepting it as an expected type error. The CLI build, affected types, lint and independent reviews pass.

A follow-up reads three complete CLI binding/type/throws suites, 848 lines, with 436 supporting helper and GIR lines. The older compiler wrappers now distinguish abnormal termination from ordinary rejected consumers, preserve each suite's strict compiler options and share the existing process helper. StaticNarrow consumers use the public generated package export. All 77 cases across the three affected suites pass, with affected types and lint. The two emitted-descriptor assertions are replaced by a public generated consumer and a real native fixture. The fixture returns a numeric result that distinguishes native GError propagation from an ordinary false result, alongside callback success, replacement, recovery and strict accepted/rejected declarations. Both throws-suite cases and the existing async fixture control pass; this change is committed at `cd470d45`.

The 17 former binding cases are replaced by public compiler consumers, with existing native coverage and declaration-only gaps recorded separately. All 48 binding cases pass across the initial run and the focused correction. The corrected consumer receives an abstract Chain rather than constructing it; a separate rejected program preserves its construction boundary. These test findings do not by themselves establish additional production defects.

Preparing those consumers exposed a separate production issue: undecoded virtual-method callback slots lowered function and user-data pointers to `biguint64` descriptors and exposed them as `bigint`. The existing synthetic tests asserted that output, so agreement with those tests did not establish the required safe contract.

The applied correction routes adjacent notified callbacks through the existing opaque callback decoder, folds their data and destroy slots, and omits unsupported layouts and callback returns from both metadata and public members. One shared alias resolver keeps callable aliases consistent with those decisions. The CLI build passes; emitted JavaScript and declarations match the real fixture ABI, including compile-time checks of the native slot offsets. The public native callback consumer passes, proving nullable delivery, retained use, subclass chain-up, rejected inputs, exception cleanup and exact destruction counts. All 47 additional public type, marshalling, throws and async controls pass. Generic callback and primitive-pointer lowering remain open; no raw-address call or unsupported native layout was executed.

A bounded N2 follow-up reads 19 complete code files, 4,253 lines, and 20 further excerpts. It confirms remaining generic data-pointer returns and named callback record fields; four installed GIR files also yield a machine-only candidate inventory, not a list of confirmed emitted APIs. Callback-field admission needs one shared correction for accessors, constructor inputs and reference output while retaining the physical layout. Generic data pointers still require an explicit extent and lifetime; retaining their containing object does not protect storage that a later operation replaces.

### Record field capability and layout

Callback record fields now share an alias-aware admission rule across accessors, constructor inputs, nested field exposure and API reference output. Direct callbacks, callback aliases and collections of callbacks are omitted until they have a supported callable lifetime contract. Ordinary callback-taking functions remain available. Removing public accessors preserves every physical field slot, so surrounding scalar fields retain their native offsets.

The fixture review also found that fixed-size array fields always contributed inline storage to record layout, even when their enclosing C type declared a pointer. Layout now distinguishes that pointer from an inline array, including inline arrays whose elements are pointers. Source review of the installed introspection scanner confirms that annotated pointer fields can carry both a pointer C type and a fixed size. A machine scan of 73 installed GIR files finds 485 fixed-size fields that retain their inline layout; it establishes no affected installed field or upstream bug.

Both fixtures' generated allocation sizes and accessed offsets match C compile-time assertions before native execution. All 19 public consumer cases pass, covering native values, scalar writes, inline and pointer arrays, callback aliases, null callbacks, rejected inputs and record-reference output. The reference case uses the exported record lookup API; JSX reference output does not create boxed-record pages. Both native consumers also pass under AddressSanitizer, and the normal addon is restored. All 92 existing binding, record, inline-array, vtable and reference controls pass. Fresh generation of installed bindings is followed by 2,937 passing native, runtime and renderer cases across 173 files. Independent production and fixture reviews and affected types and lint pass.

The maintainer clarified that complete upstream API coverage is not a goal. Remaining raw-pointer APIs should be hidden or represented by throwing stubs when they do not fit the supported safe GLib/GObject contract. A tentative byte-copy implementation for three pointer-returning methods was stopped before any shared change or execution.

The existing hidden-symbol list now omits `Bytes.getRegion`, `Variant.getData`, `MemoryOutputStream.getData` and `MemoryOutputStream.stealData` from generated bindings, declarations and reference output. No runtime or native implementation is added. All 11 public consumer checks pass: existing byte APIs, eight rejected uses of omitted members, matching reference pages and native imports with ordinary byte operations. The stream is closed before `stealAsBytes`, which retains its distinct ownership-transfer contract. Fresh generation, builds, workspace typechecking, affected lint and independent source reviews pass. A subsequent check with installed GJS 1.88.1 confirms that its `get_region` exists but returns null for valid full-buffer and subsection requests; GTKX keeps the omission.

### Raw-pointer property admission

One alias-aware admission rule now excludes raw-pointer and non-introspectable properties from generated accessors, binding descriptors, JSX values and notify handlers, element metadata and reference pages. It preserves genuine integers, GType, objects, boxed values and annotated arrays. `MemoryOutputStream.data` previously selected an integer GValue descriptor for a native pointer property; its constructor also exposed non-introspectable destroy and realloc options. No unsupported property was executed to establish that mismatch.

Constructors prohibit unsupported option values through finite optional-never entries. This matters when a class has only omitted properties: it must retain a typed forwarding constructor instead of inheriting the root's broad object parameter. Descendants can still add legitimate properties, and only admitted binding descriptors are registered. The constructor constraint forbids values; it does not claim these keys disappear from TypeScript's `keyof`.

All 24 new public checks pass: strict accepted declarations, 21 independently rejected consumers, class and element reference pages, and ordinary memory-stream operations with prototype absence checks. The alias and inheritance fixture is declaration-only and never loaded as a native library. The final reference oracle passes after removing checks for notify headings the reference renderer never creates. All 24 existing native property controls pass. Independent production and test reviews are clean within this scope.

A separate source review covers 15 complete files, 3,320 lines, and identifies remaining primitive-pointer method inputs, results and collection leaves. `Gio.Task`, `GLib.Source` and generic HashTable methods supply concrete examples. Folded callback companions, typed object comparators and existing runtime overrides need to remain supported when applying a shared callable gate. Callback signatures and unbounded-array fallbacks remain separate open work.

### Pointer callables and record fields

Shared type traversal now rejects primitive pointer inputs, results and nested collection leaves in ordinary callables and properties. Folded callback companions, intrinsic byte arrays, typed handles and the existing GValue boxed overrides remain supported. Override signatures also supply their public reference signatures, preserving `getBoxed<T>()`. All 33 public callable checks pass. Existing null property tests use public runtime value conversion; tests no longer pass numeric words to an untyped pointer array or invoke removed HashTable methods.

Record accessors, constructor writes and references use the same pointer classification. Finite optional-never constructor entries prevent records with only omitted fields from accepting those options. Physical fields still determine layout and copy eligibility. All 21 public field checks pass, including aliases, nested collections, constructor options, native TreeIter copies and matching references. The 19 existing callback-field and layout controls pass. Their native fixtures verify surrounding fields; the declaration-only pointer fixture is never loaded as a native library.

The record review covers 14 complete files, 2,451 lines, with additional excerpts recorded separately. Independent production and consumer reviews are clean within this scope. Unknown-length arrays and namespace lifetime operations remain separate findings.

### Effective callback contracts

Callback descriptors, declarations and reference pages now share their existing user-data selection. This corrects the public arity of AsyncReadyCallback and similar callbacks. Unsupported pointer payloads, results and nested callback contracts are omitted, including Task thread callbacks and generic byte-array comparators. Existing object comparator adaptations run before admission and remain available for ListStore and CustomSorter. Supported vtable callbacks retain their companion and ownership requirements.

All 28 public callback checks pass, including actual source dispatch, normal and cancelled task completion, object comparator identity, rejected consumers and reference signatures. Existing AsyncInitable tests now invoke the actual two-argument callback. Two child-process error cases use ordinary asynchronous completion instead of an unsupported thread callback. Their status checks require the completion callback to have run, and make no assertion about error text. No native callback implementation or new wrapper is added.

The initial callback review covers nine complete files, 1,382 lines; implementation and independent reviews record their additional full reads and excerpts. This does not close all signal, vfunc or callback lifetime work.

### GTypeInstance identity

Omitting its pointer method left TypeInstance structurally empty, allowing unrelated JavaScript values in TypeScript. TypeInstance now owns an erased nominal declaration shared by generated classes and interface instance types. The interface declaration retains that identity when a prerequisite uses Omit. Boxed records remain distinct, and native-created TypeInstance wrappers need no fabricated runtime field.

All 13 public checks pass: objects, fundamentals, interfaces, registered subclasses, rejected non-instances and actual Object/ParamSpec GValue round trips. Six obsolete suppressions are removed from valid fundamental consumers. Seventeen complete files, 3,028 lines, were reviewed with supporting excerpts; independent production and test reviews are clean. This is a declaration correction, not a new validator for arbitrary untyped native calls.

### Namespace instance ownership

The generated `typeFreeInstance` function could directly free storage still retained by GTKX wrappers. It is now omitted through the existing hidden-symbol list. Three public checks pass: a rejected compiler consumer, namespace absence with safe instance inspection, and reference absence. The review follows the GIR, pinned GLib implementation, borrowed argument conversion and wrapper lifetime markers without invoking the deallocator.

Ten complete files, 2,767 lines, were read with supporting excerpts; independent review of the two-file fix is clean. Class and default-interface unref functions are no-ops in the installed GLib, so this review does not claim another active free defect there. Broader method-level destruction and container ownership remain in the R2 audit.

### Unknown-length array admission

Arrays without a declared length, fixed size or terminator are now omitted from callable, callback, alias, property and record-field contracts. Vtable admission uses the same classification. Nested arrays and aliases follow the shared type traversal; intrinsic byte arrays retain their own length. Alias generation and reference output share one admission rule. Physical record layout is unchanged.

All 28 public checks pass, covering accepted bounded arrays, rejected declarations and constructor options, matching references and real native alternatives. Pixbuf's sized `getPixels` shadow, Bytes input, address parsing and UTF-8 cursor results remain supported. The declaration-only fixture is never loaded as a native library; the vtable change has source review rather than a new executable fixture. Independent production and test reviews are clean. Fresh generation is followed by 2,965 passing native, runtime and renderer cases across 176 files, and workspace types, lint, Rust checks and Knip pass.

The installed GIR scan finds 65 unknown-array nodes across 73 files; that discovery count is not a count of previously emitted APIs. Signal admission and scalar types whose C spelling declares a pointer remain separate findings. No new native or runtime implementation is added.

A repeat copy-capability review found that fixed array fields declared as C pointers still qualified plain records for memcpy ownership. Value-safe record classification now distinguishes those pointers from inline arrays, including aliases. This removes automatic constructors and full-transfer results without a supported destructor while preserving explicit boxed copy functions and physical layout. Four new compiler rejections, updated inline/reference controls and all six existing native field-layout cases pass: 12 focused checks in total. Affected types, lint and independent review pass. The new declarations are never executed as native functions; no affected installed record is claimed.

### Signal admission

Generated signal dispatch, handler and emit maps, JSX props, metadata and references now share one admission rule. It omits primitive pointers, unknown-length arrays, callback-valued payloads and non-introspectable signals, including aliases and nested collections. Actual signal parameters named data remain payloads rather than being mistaken for callback user data.

This removes WebKit.BackForwardList.changed, whose GIR exposes a temporary native list as a generic pointer, and the non-introspectable Gtk.TreeModel.rows-reordered JSX prop. Supported object, boxed, byte, integer and annotated-array signals remain available. All 24 public compiler and reference cases pass, including inherited interface signals and supported owner precedence. The synthetic fixture is declaration-only. Fresh generation passes all 2,965 native, runtime and renderer cases, alongside workspace types, lint, Rust checks and Knip. Independent production and consumer source reviews are clean.

The initial review covers 18 complete files, 4,310 lines, with pinned producer evidence and additional excerpts. A machine scan of 73 installed GIRs and 944 signals finds five signals with generic pointer parameters and no callback-valued signal. No unsupported signal was executed. Scalar C-pointer declarations and broader callback retirement remain separate work.

### Scalar C-pointer admission

Scalar types whose C declarations require unsupported pointer storage are now omitted from callable, callback, signal, vtable, alias and record-field contracts. The shared classifier follows aliases and collection elements while preserving typed out/inout parameters, including `gpointer` typedef spelling. Ordinary integers, enums, GType, handles and annotated arrays keep their existing descriptors. Physical record layout is unchanged.

This removes unsupported Hmac buffer methods, Pixbuf.readPixels, ByteArray.data and InputMessage.numControlMessages. Existing byte-based HMAC functions, sized pixel APIs and the Unicode array corrections remain available. All 38 public compiler, reference and native consumer checks pass across the final focused runs. The accepted fixture uses public typeFromName; its initial static-marker assumption was incorrect. The declaration-only fixture is never loaded as a native library.

The broader suite exposed two obsolete tests. Regress.interface-signal is actually registered with G_TYPE_POINTER despite its integer GIR annotation; interface delivery is now tested through Gio.ActionGroup.action-added. The callee-allocated gint8** vfunc has no supported scalar Ref descriptor, and its previous test only called the JavaScript override directly. Its override and direct assertion are removed while the C-dispatched scalar out controls remain. All 69 signal/vfunc checks and the final 2,965 native, runtime and renderer cases pass. Workspace checks pass after the affected type/lint rerun; independent production and test reviews are clean within this scope.

The initial source review covers 12 complete files, 1,318 lines, with further reads, installed-GIR scans and peer inventories recorded separately. Scalar aliases whose C names conceal another typedef and property C metadata not retained by the parser remain review limits. No native copying or numeric-pointer support is added.

### Callback exceptions and native cleanup

Native code now retains callback exceptions while the enclosing call, object construction or GLib dispatch iteration finishes its normal output conversion and cleanup. Later callbacks in that scope still consume owned arguments before skipping JavaScript. The original exception is then delivered through the existing error channel. Nested calls can catch their own errors and continue without poisoning the enclosing scope.

This closes a supported exception path that left Node unable to publish owning handles while native code continued returning values. Wrapper-association errors now return to the constructor's caller through the same scope instead of selecting fatal reporting during construction. Array transfer policies, boxed copy functions and object adoption are unchanged.

All 33 new public integration cases pass: owned array returns and out parameters, repeated callbacks, a caught nested error, asynchronous delivery and recovery, constructor hooks and setters, and association failure. The fixtures use real GLib containers, Object finalization counters, free-only records and wrapper collection. No unsupported native API or failing allocation is invoked. The async child verifies four native finalizations; its helper disables exit-time leak checking, so that child's evidence is its observed cleanup rather than a standalone leak-sanitizer result.

The complete normal suite passes 2,998 cases across 179 files. Fresh native/e2e types, lint and Rust checks pass with the cache bypassed, followed by clean checks for the constructor tests and the complete workspace. Fresh generated declarations also exposed three missing override modifiers in existing callback vfunc tests; those are corrected. Independent production, fixture and ABI reviews are clean. All 1,137 native sanitizer cases pass, and the normal addon is restored.

The follow-up entry audit enumerates all 29 exported native functions and reads 37 complete files, 4,721 lines, with additional excerpts and peer inventories. Other decoder failures, custom destructor re-entry and unrelated callback retirement remain separate review work. U22 records the independently checked napi External publication ownership candidate; GTKX's exception boundary does not replace upstream allocation rollback.

### Inline-array source bounds

Array packing now checks each original handle's recorded extent before copying an inline record. The previous path replaced it with an unbounded borrowed handle first, losing that information. The existing handle helper preserves lifetime, invalidation and data-kind checks. No extent is invented for native memory whose size is unknown.

Ten public addon cases cover fixed arrays and GArray packing: exact allocations, bounded aliases, independent copies, rejected undersized or null elements, unchanged destination values after rejection, and supported null and empty containers. Sources remain live, no raw addresses are supplied, and no pre-fix native execution is used. The normal native, runtime and renderer checkpoint passes 2,952 cases across 175 files. All 1,091 native sanitizer cases pass, and the normal addon is restored. Workspace TypeScript, lint, Rust checks and Knip pass. The final test refactor splits the two empty-array assertions into explicit cases for lint; all ten cases pass again, with native types and lint clean. Independent production and fixture reviews are clean.

The measured struct-copy path also retains the size it passes to g_memdup2. Fourteen public addon cases verify independent copies, exact extents, rejected out-of-range access, bounded aliases, null fields and array packing without replacing a valid destination on failure. Custom copy functions and memory with unknown bounds are unchanged. Independent production and test reviews pass. The combined pointer-contract checkpoint passes 2,965 normal native, runtime and renderer cases across 176 files, and all 1,104 sanitizer cases, with the normal addon restored. Workspace types, lint, Rust checks and Knip pass.

### Runtime shutdown and public error contracts

A repeat source review found that one throwing exit callback prevented subsequent callbacks and native shutdown from running. Shutdown now attempts every registered callback and native cleanup before propagating the original error, or an AggregateError when multiple callbacks fail. Reentrant and repeated shutdown still runs once. Five real child-process cases cover ordinary shutdown, order, reentrancy, and one or multiple failures. The children retain native keep-alive until shutdown and must exit naturally. All 12 focused lifecycle cases pass.

Error-domain tests now use generated GLib enums and real GErrors. The callback error fixture passes opaque OptionContext and OptionGroup handles instead of integer addresses, with its C ABI and single native owner reviewed before execution. All three domain cases and four callback error cases pass. The complete runtime suite passes all 678 cases across 67 files, with affected types, lint and independent source reviews.

Four Contributing pages and three callback implementation files were read completely, 1,050 lines. Architecture and callback prose now distinguish runtime value semantics from native ABI/storage ownership, and document the validated shutdown behavior. Callback options now derive their fields from the canonical descriptor, preserving explicit undefined values for scope and destroy kind. Strict accepted and rejected public consumers, affected types and lint pass. Runtime defaults and execution are unchanged. GL callback retirement and asynchronous delivery remain open.

### GtkSourceView snippet mark cleanup

U21 in `~/UPSTREAM.md` records a GtkSourceView cleanup defect. Finalizing a snippet removes its text marks, while chunks retain references to those marks. If the buffer then goes away, chunk cleanup attempts to delete already-detached marks. The installed 5.20.0 source and checked upstream master share that implementation.

A minimal upstream patch checks the mark's deletion state before removing it and always releases its reference. The reviewed patch builds against the official source in `~/upstream-work/gtksource-snippet-marks`, without installing libraries or changing the environment configuration. After verifying the actual loaded library path in both the parent and test worker, all 37 signal cases pass with the previously withdrawn JSX-buffer fixture and no unhandled cleanup errors. The system library is unchanged and the canonical default-buffer fixture remains. The patch, source hashes, review and validation evidence are retained for upstream; no external report was posted.

### Root configuration repeat audit

All 29 human-maintained root files were read again, 1,799 lines, with exact paths and hashes recorded. Supporting release and animation callers bring the full-read scope to 2,808 lines. No new root configuration defect was confirmed. The generated lockfile was parsed structurally, checking 31 importers and 265 dependency entries against manifests; it was not claimed as a complete line-by-line read.

The three repository patches, three version plans and editor settings were also read completely. Their pinned compatibility changes and release metadata still match current consumers; no additional finding was confirmed.

The release script now uses the existing maintained semver dependency to parse prereleases, retaining the policy against unnamed numeric channels, including identifiers larger than JavaScript's safe integer range. Seven isolated fixtures exercise the real release script and Nx: beta increments, channel changes, stable releases, build metadata, both numeric rejection paths and dry runs. They verify release artifacts or unchanged files as appropriate, with no remote publication. All seven pass, alongside the frozen install, full repository types and lint.

### Vitest root and configured search paths

All 34 Vite, build and plugin files were read, 5,190 lines. Vitest preflight now selects the same configured project root as the other plugins. Font and settings staging preserve the worker's configured data and schema directories before falling back to the parent environment, using the existing path helpers.

All six public integration cases pass. They cover a relative root without a parent configuration, a missing library followed by recovery, multiple Vitest projects, and actual icon, font and schema discovery. The external schema is compiled with the real GLib tool and read alongside an imported project schema. CLI build, types, lint and independent source review pass. The combined workspace types, lint, Rust checks and Knip also pass.

### Unsupported GL debug contracts

The debug callback binding and its message types are omitted. The driver may deliver callbacks on another thread, and deregistration does not establish when retained executable closures can be reclaimed. These contracts do not fit the supported Node callback boundary. Removing the handwritten override does not reactivate a generated binding: callback-pointer parameters are already rejected by Khronos planning. This closes GL5 within the supported API without changing driver state or adding callback machinery.

The generated packed debug-log function is also omitted. Its numeric output arrays have the required capacity, but its string result stops at the first NUL and loses subsequent messages already removed from the driver's log. Ordinary single-string info-log helpers remain. Both omissions were established from source and the upstream contracts, without invoking unsupported entrypoints.

All seven strict public compiler cases and five GL integration cases pass. Regenerated reference pages exclude both debug functions and the removed callback types, and retain all three info-log helpers. Independent production, test and reference reviews pass. The combined ordinary checkpoint passes 2,998 cases across 179 files; all 101 workspace check tasks pass. The earlier 1,137-case sanitizer checkpoint remains the latest native validation; these omissions change no Rust code.

### Writable string destination omissions

GLib.strlcpy and GLib.strlcat are omitted from generated modules, declarations and function references. Their GIR input strings do not represent the separate writable destination capacity or return the mutated destination. Two entries in the existing hidden-symbol list resolve that unsupported contract; explicit-capacity runtime Ref bindings remain unchanged.

All seven public consumer cases pass: accepted ordinary string functions, four rejected imports or member accesses, public reference presence and absence, and real namespace imports with Unicode, empty-string and rejected-NUL controls. Independent source review, CLI build, types, lint and all 101 workspace check tasks pass. No unsupported destination call was executed. The separate fixed-capacity string-reference migration remains open.

### Fixed-capacity string reference preparation

Runtime now prepares fixed-capacity Ref string buffers: it selects the seed, encodes UTF-8, truncates to the available bytes and leaves a terminator. Rust receives an owned byte transport and independently checks its extent and termination before native entry. It retains allocation, lifetime and bounded output extraction. The existing runtime result path decodes all outputs before updating public references. No descriptor fields or native APIs were added.

All 19 new public integration cases pass, covering seeded appends, null and empty references, byte-based Unicode truncation, invalid inputs and native buffer admission. The existing bounded output-error case also verifies that the original reference remains unchanged. All 102 focused cases pass; the 35 runtime, callback and GL controls also passed before the migration. The full ordinary suite passes 3,017 cases across 179 files. Sanitizers pass 1,143 addon and generated-native cases plus all 20 runtime string-storage cases, followed by restoration of the normal addon. All 101 workspace check tasks and independent source review pass.

A separate no-length string review reads 19 complete files, 3,181 lines, and inventories 78 GIR files. The seven introspectable char** inout functions found by that scan are already excluded by the canonical indirection gate. Output-only pointer slots and incoming callback references retain their separate supported contracts. No new implementation is justified by that bounded producer review; remaining reference and container policy stays in R2.

### Constructor and reference prop repeat reviews

The singleton and alternative shortcut review reads 14 complete files, 2,987 lines, with pinned GTK source. Native NeverTrigger construction already preserves singleton identity; the three action singleton factories and AlternativeTrigger's required props agree with their native contracts. Complete named factory props already include the factory inputs. No additional defect was confirmed in this scope.

The reference-prop review reads ten complete files, 1,250 lines, including the compiler program, package manifest and public union fixtures. Dependency snapshots and module-resolution checks track actual declaration inputs, while the existing TypeScript compiler resolves utility, inherited and contextual union types. Existing public tests cover freshness, hoisted dependencies and rejected declarations without replacing valid pages. No additional defect was confirmed; those tests were read without an unnecessary rerun for unchanged source.

Preserved read evidence is now reconciled against 2,108 tracked paths. The recorded states distinguish a matching full-file hash, a different hash, an explicit unversioned full read and no preserved full-read record. These are evidence states, not completion counts: earlier whole-package reviews lack some of their original file-level records. The snapshot, exact evidence links and next bounded batches are retained with the other audit artifacts.

### Managed directory contracts

Generated GLib.Dir.close is omitted because it closes the shared directory stream while other wrappers retain the same boxed object. Acquiring another boxed reference cannot preserve that stream. Normal final unref still closes and frees managed directories. Dir.readName now returns string | null in declarations and reference pages, matching ordinary directory exhaustion through one canonical GIR metadata correction.

All six public cases pass: accepted nullable readers, three rejected contracts, reference output and real temporary-directory reads. The native consumer covers Unicode names, exhaustion, rewinding, empty directories and missing-path errors. It never calls close or tests invalidated objects. CLI build, types, lint, all 101 workspace check tasks and independent source review pass. U23 in ~/UPSTREAM.md records the missing upstream nullable annotation, with source snapshots and validation under ~/upstream-work/glib-dir-nullable. Keep that correction until supported upstream releases include the annotation.

The neighboring lifetime review distinguishes reference-preserving conversions and Source.destroy from unsupported destruction contracts. Tree.destroy is also omitted: its borrowed receiver consumes a reference without retiring the managed wrapper. The installed GIR inventory supplies no established Tree producer, but supported consumer GIRs can return this registered boxed type. All nine combined directory/Tree cases pass, preserving compiler-only Tree reader checks and verifying declaration, reference and module absence. No native Tree lifetime operation was executed. CLI build, affected checks and independent review pass.

### Cache, accessibility and settings repeat reviews

Four CLI cache/staging files, 116 lines, and sixteen complete supporting files, 1,401 lines, were read. Existing public cache and compiler cases were reviewed without adding tests for unchanged behavior. No new defect was confirmed in this scope.

Four React accessibility/settings files, 540 lines, were read with their public callers. GIO's automatic sensitivity binding follows its own native property lifetime; unbinding another property does not remove it. That behavior is preserved without a flag change or additional binding-ownership machinery. The source review found no actionable implementation defect in this bounded slice.

### Compiler and disposal test contracts

The JSX compiler suite now uses the existing isolated consumer helper. Its negative programs require a normal nonzero compiler exit; an interrupted compiler can no longer count as a rejected type contract. All three public cases pass with their existing programs and compiler strictness preserved. The asset-import suite now shares the same normal-exit guard for project configuration checks, retaining its 60-second deadline. Both existing asset consumers and the three file-consumer controls pass after that change. CliRun.status now matches its existing non-null runtime invariant.

The six disposed-listener cases now observe real callback delivery, disconnection and collection while keeping their emitters alive. They cover pending on/once handlers, duplicate cleanup, separate healthy emitters and hidden native-dialog destruction. Mocks, log assertions and handler-ID ordering are removed. All 31 focused runtime cases pass, alongside affected types, lint and independent source review. No production behavior changed.

Fourteen CLI command, argument and supporting files, 931 lines, were read completely. No new production routing defect was confirmed. The asset compiler test correction above resolves the separate finding exposed by those supporting reads.

### Window and application property types

Four generated properties no longer accept ReactElement values whose standard GTKX components portal away from the property slot: MountOperation.parent, NativeDialog.transientFor and Window.transientFor/application. Native object references, nullish values, inherited Adwaita props, standalone declarative windows and ordinary widget-valued JSX remain supported. One shared predicate drives JSX and reference types; native property classification and notify behavior are preserved.

All nine strict public compiler/reference cases and 52 existing window/application renderer cases pass. The compiler fixture uses the default implicit Adwaita dependency after correcting an invalid explicit library declaration in its initial setup. CLI build, regenerated bindings, affected types, lint and independent production/test reviews pass. No portal or reconciler behavior changed.

### Development runner Node options

The development supervisor now uses Node's normal fork inheritance. It no longer removes custom export conditions or reparses NODE_OPTIONS. The removed filter served a monorepo source-resolution workaround and also collapsed whitespace inside quoted option values.

Three real CLI cases first reproduced the lost conditions and altered quoted title; default startup and invalid-option controls passed. All five cases now pass, checking actual conditional package resolution, process title, environment and application arguments. All seven existing process-supervision controls also pass. The change removes 25 lines of custom parsing and adds no dependency. CLI build, types, lint and independent source review pass.

The remaining outbound Ref review reads 23 complete files, 4,021 lines. The non-scalar envelope already distinguishes omitted output pointers from allocated output storage after runtime conversion. Generic field allocation cannot replace its consuming output reads without adding ownership machinery. That migration is not justified. Native retains the allocation and consuming-read mechanics needed by the runtime conversion plans.


### No-length output reference admission

No-length byte references now accept only null or undefined seeds. These allocate a pointer-sized output slot; initialized values previously selected a direct byte buffer despite the output-pointer contract. Unsupported initialized seeds now reject before native entry. Optional omitted output pointers, fixed-capacity buffers and incoming callback references retain their separate contracts.

All six additional public cases pass, covering both empty seeds and rejected empty/nonempty byte and string values while preserving the caller's reference on failure. The full ordinary suite passes 3,023 cases across 179 files. Sanitizers pass all 1,146 addon/generated-native cases plus 32 runtime string-storage and call-result cases; the normal addon is restored. All 101 workspace check tasks and independent source review pass. No unsupported initialized call was executed before the fix.


### Application queries and executable suggestions

Application-scoped queries now traverse only windows owned by that application. Global screen queries still include all windows. A real application consumer verifies two owned windows, an unrelated window, removal of every owned window and later restoration while retaining the same application and query scope.

Suggested query arguments now use JSON string encoding. Public consumers load and execute the generated calls against rendered widgets, preserving names containing quotes, backslashes and newlines. Missing suggestions and ambiguous matches retain their observable behavior. Existing nested-scope and hidden-page checks now assert actual widget selection; the role logger no longer uses a console mock.

All 60 focused cases pass across six integration files, along with testing/e2e types, touched-file lint and independent source review. The repeat query review identifies a separate all-match suggestion issue, and an authored effect cleanup error can interrupt later render cleanup. Those new findings remain open for the next bounded fixes.


### Contributing documentation repeat review

The development, testing and technology-stack pages were read completely: 404 lines, with their documented commands checked against current package, build and test configuration. No incorrect command or dependency claim was found. The testing page and linked principles now match the current repository rule: unit tests require an explicit argument for extremely complex logic needing exhaustive coverage. This is a prose-only alignment; no new test or implementation change is needed.


### Node dispatch resource ownership

Environment cleanup now destroys the dispatch async context and deletes its retained resource reference before clearing the environment pointer. Reference-creation failure releases the acquired context, and cleanup-hook registration failure releases both published resources. Explicit quit retains its existing environment lifetime. The change balances the resources created by GTKX without adding a shutdown registry or changing worker admission.

All 3,036 ordinary cases pass across 181 files, including existing natural worker exit, explicit quit, worker termination and conflicting-owner controls. All 1,146 addon/generated-native sanitizer cases and all 101 workspace check tasks pass; the normal addon is restored. Independent source review checks both successful cleanup and partial-install rollback. No forced allocation or registration failure was introduced.

The broader worker teardown finding remains open. Deferred wrapper, object and closure cleanup can outlive the original environment, and existing hooks do not enumerate every native owner. A complete fix must preserve finalizer reference ownership and native disposal when JavaScript entry is unavailable. Restricting successor threads alone would not release those resources. Source inventories and independent release-order reviews preserve these obligations; they do not attribute the historical intermittent worker failure.


### Suggestions for multiple matches

A suggested replacement query now requires agreement across every returned widget. A shared tooltip query over differently named buttons keeps both results; a homogeneous result still enforces its shared preferred query. Single-match suggestions and explicit suggestion disabling retain their behavior.

The real custom-query consumer reproduced the original first-result-only suggestion. All three added cases pass after the correction, covering synchronous/asynchronous matches, homogeneous policy, disabling and missing-result errors. The complete renderer/testing project passes 1,202 cases across 67 files, with affected types, lint and independent source review passing.


### Render cleanup after effect errors

An effect cleanup error no longer leaves its owned harness window open or prevents later active renders from unmounting. Window destruction runs after the unmount attempt, and both cleanup levels share the existing sequential error collector. All render cleanup attempts still finish before the screen and clipboard reset; caller-supplied containers remain caller-owned.

Two real component consumers reproduced the leaked window and skipped later root; the supplied-container control already passed. All three now pass, including repeated cleanup, preserved cleanup order, fresh rendering and supplied-window reuse. The complete renderer/testing project passes all 1,202 cases; affected types, lint and independent source review pass. Error assertions check rejection without inspecting messages or error formatting.


### Async and hook test oracles

Three existing cases now observe the public behavior they name. Timeout and error-factory customizations record actual callback entry; hook consumers rerender with changed initial props and verify state, memo and ref identity where those contracts require preservation. These checks add no mocks or test cases and do not inspect error formatting. They pass within the 1,202-case renderer/testing checkpoint, with affected types, lint and independent source review.

The underlying async/hook review reads 21 complete files, 2,233 lines, including two primary suites with 442 lines. The next text-input review has identified a separate Unicode byte-length mistake in an admitted Editable fallback; the whole-string length correction is recorded below.


### Unicode insertion through Editable delegates

The plain Editable insertion path now uses GTK's whole-string length sentinel. Its former JavaScript character count was passed as a UTF-8 byte count. AdwSpinRow reaches this existing path through its native SpinButton delegate. No recursive delegate handling or custom encoding is added.

All eight new public typing/pasting cases pass, covering ASCII and Unicode selection replacement, character-based caret positions, empty insertion and rejected NUL text followed by recovery. The complete renderer/testing project passes 1,210 cases across 68 files. Affected types, lint and independent source review pass. Source review establishes terminated string storage and GTK's length contract; no truncated Unicode call was executed before the fix.


### Current example guide links

Nine guide and tutorial links in six current example READMEs now target the v2 documentation. The unprefixed routes intentionally document 1.6. All nine v2 targets exist; landing, relative and third-party links are preserved. The bounded link review reads 16 complete sources, 896 lines, and checks current package/version ownership without requiring a new test.

The current async, error-handling and subclassing guides were read completely: 384 lines, with 27 complete supporting/current files totaling 3,596 lines. Historical 1.6 differences are excluded from findings. No new current-guide defect was established. The Label subtype example uses GTKX's dynamic native-class mechanism; an opaque C class declaration alone is not a GTKX registration failure.

All 33 tracked Hello World and Animations files were also read completely, 1,350 lines. Their current guide links are corrected above. The three animation indexing cleanups and their native visual validation are recorded below. No visual behavior change or new visual validation is claimed by that source review.


### Boxed 64-bit hash-table values

Native hash-table iteration now copies a non-null 64-bit bigint value from its scalar storage cell. The previous value read interpreted that cell's address as the integer. Direct integer pointer words, floating-point values, null-entry behavior and key decoding retain their existing paths. The correction changes no descriptor shape or generated API availability.

All 16 new public runtime cases pass through GLib's real g_hash_table_ref, with borrowed input tables and independently returned full references. They cover exact signed/unsigned boundaries, repeated independent Maps, empty tables, scalar normalization, rejected values and direct integer/float controls. The complete ordinary suite passes 3,066 cases across 184 files. Sanitizers pass 1,146 addon/generated-native cases plus 48 runtime hash-table and reference cases; the normal addon is restored. All 101 workspace check tasks and independent source review pass. No pre-fix address-value call was executed.

The source inventory reads 17 complete files, 4,083 lines, and separately scans 78 GIR files with 231 hash-table occurrences. The OSTree timestamp field has a documented boxed-value contract but is already accessor-ineligible; this is not evidence of an emitted installed getter. Bigint-key output admission and full-input boxed-numeric ownership remain separate open contracts. The latter cannot distinguish full-entry transfer from container-only transfer with the current primitive descriptors; its outbound rejection proposal is being reviewed before implementation.


### Animation example data invariants

The chain and trail demos now use their actual item labels directly. The springs-list count derives from its preset tuple, and its lookup no longer repeats the caller's modulo operation or invents a zero target. Narrow index assertions express the already-established preset and upstream hook bounds; no runtime guard, helper abstraction or dependency was added.

All three existing app cases and a temporary native walkthrough pass using the example's own Vitest configuration. The walkthrough checks all three presets, toggles the trail and replays the chain. All three captured native windows were visually inspected, with their expected labels, bars and controls present. App types and touched-file lint pass. The temporary fixture was removed; its source and screenshots remain with the audit artifacts.

The Browser example review reads all eight tracked files, 331 lines, plus its relevant signal/rendering contracts. No new confirmed defect was found, and unchanged behavior required no new test.

### TextView action cleanup

Text insertion now closes each native TextBuffer user action even when an insertion, deletion or action observer throws. Multi-character selected typing retains its separate deletion and insertion undo groups; pasting and single-character replacement retain one group. Completed native edits remain undoable, and subsequent edits start fresh actions.

Five public regression cases failed before the correction; all 12 new cases now pass, including undo/redo, empty edits and recovery after observer errors. The complete renderer/testing project passes 1,222 cases across 69 files. Both affected TypeScript projects, touched-file lint and independent source review pass. The review checks GTK's begin/end ordering against the deferred JavaScript error boundary; no unsupported native input or failure injection is used.

### GTK demo button behavior

The Expander demo now declares its intended initial nonresizable window state. Its existing test observes that real initial value before expanding and collapsing. Spinner checks require both expected widgets, and invalid time/hex input checks observe the native reset to zero. The native update policies and month-value preservation are unchanged.

The initial window-state case failed before the metadata correction. All 42 existing button cases pass after it, along with actual app/test TypeScript projects and touched-file lint. A temporary walkthrough opens Expander through the actual application sidebar and Run button, verifies all resize transitions and captures both disclosure states. Both native screenshots were inspected; the temporary fixture is preserved with the artifacts and removed from the suite. Independent source review passes.

The button review reads eight complete primary files, 951 lines, and five supporting files, 936 lines. A repeat read identifies redundant indexed fallbacks in the SpinButton demo. Supporting App reads also reveal that open demo windows share the sidebar selection and window metadata; multiple open demos need independent ownership. These separate findings remain open.

### Independent demo windows

Each Run action now retains its selected demo, close action and context for that opening. Changing the sidebar no longer replaces existing window contents. Repeated openings have independent title/default-widget state, and a stable per-opening close callback avoids restarting dialog effects during unrelated parent renders. IDs come from a ref because allocating one does not itself render anything.

Two actual App consumers reproduced changed window contents and a default button reassigned to another password window. Both pass after the correction, covering retained widget identity and text, independent expansion, unavailable Run on the introduction, separate password validation/default activation, closing and fresh reopening. All 649 GTK Demo cases pass across 79 files. Actual app/test TypeScript projects, touched lint and independent source review pass. Four captured native windows were visually inspected; temporary capture calls were removed from the final tests.

Dynamic Words titles and dialog-effect dependencies were checked through their existing context and lifecycle consumers, without claiming extra public scenarios. The bounded source review also identifies older app/context tests that assert intermediate tree arrays or mock native inspector/printing methods. Their replacement with observable app behavior remains separate work.

### SpinButton data invariants

The SpinButton demo no longer supplies empty strings or January for indices guaranteed by its checked input shape and native adjustment range. Narrow string assertions express those bounds. A required hexadecimal regex capture cannot parse as NaN, so that unreachable fallback is removed without changing accepted syntax or update policy.

All 25 existing SpinButton cases pass, together with a temporary native walkthrough opened through the actual app. The walkthrough verifies initial and formatted values plus December-to-January wrapping; both screenshots were inspected. Actual app/test TypeScript projects, touched lint and independent source review pass. The temporary fixture is archived and removed. Initialization and teardown ordering were checked before relying on the month adjustment's bounds.

### Outbound numeric hash-table ownership

Native encoding now rejects full-transfer hash tables whose floating-point or 64-bit bigint cells require ownership metadata that the descriptor cannot express. The shared admission check runs before entry allocation and callback publication, and class registration resolves every vfunc before publishing the type. Null clearing, borrowed inputs and decoded native results remain supported. Rejected field replacement preserves the original table.

All 43 new public native/runtime consumer cases pass through an exact C fixture. They cover full native results and out parameters, incoming callback arguments, borrowed callback results, unsupported outgoing transfers, callback and vfunc registration, nested signature admission, null callbacks and field replacement recovery. The fixture does not invoke rejected callbacks. No pre-fix ownership collision was executed.

The complete ordinary suite passes 3,121 cases across 186 files. Sanitizers pass 1,189 addon/generated-native cases plus 48 runtime cases, and the normal addon is restored. All 101 workspace tasks pass. Independent production and fixture reviews are clean; exact sources, inventories and logs are archived. Canonical GIR omission of these unsupported outgoing contracts is the next separate change. Bigint-key decoding and broader reference/container ownership remain open.

### Sidebar and context consumer tests

The Sidebar/context suites now render the real provider and Sidebar, with application-equivalent search wiring. Fourteen public cases replace direct parsing, intermediate tree and hook-state assertions. They observe displayed row order, native selection, actual click/search behavior, empty and unmatched results, recovery, accessibility and retained widget identity when search visibility changes. Missing-provider coverage checks rejection without inspecting error text.

All 14 cases pass, together with actual app/test types, touched lint and the 101-task workspace checkpoint. Independent source review is clean. The replacement removes the unnecessary callback mock and adds no production behavior. Inspector and printing method mocks remain separate work; this bounded result does not establish a fully unmocked application suite.

### Generated numeric hash-table transfer admission

Generated APIs now omit full/container numeric hash-table contracts where JavaScript would encode unsupported entry ownership. Ordinary decoded returns and out parameters, incoming named callback arguments, borrowed tables and transfer-free aliases retain their existing contracts. Vfunc admission also accounts for calling its generated super member, and a received native callback must have encodable inputs. Nested transfer policy is shared with descriptor rendering.

The strict public CLI/reference matrix reproduced 19 failures before the correction and passes all 22 cases afterward. All 67 existing scalar-pointer, callback-signature and vtable-callback consumer controls also pass. Actual codegen/CLI TypeScript projects, touched lint and workspace checks pass. The synthetic GIR is used only for generation, strict compilation and reference queries; it is never imported as a native library. Independent production and fixture reviews are clean.

The change preserves physical vtable layout and follows actual alias descriptor lowering. It does not add generic nested input encoding, repair unrelated inout lowering or reinterpret bigint keys. Those limits remain separate. Exact patches, full-read inventories, baseline/final checks and workspace recovery logs are archived.

### Native App and dialog consumers

App shortcuts and menu actions now open the real GTK Inspector, printing dialog and Page Setup dialog. The tests observe mapped native windows, transient ownership, actual cancellation, dialog removal and the surviving application window. Expected demo titles are explicit; native method mocks and intermediate parser assertions are removed.

All six focused App/smoke cases pass, as do all 649 permanent GTK Demo cases at the combined dialog checkpoint. Native screenshots were inspected. Actual app/test types, lint and all 101 workspace tasks pass. Independent source review is clean. Shared test helpers observe public window state and restore the Inspector after each consumer.

### Page Setup callback nullability

Canonical GIR parsing now corrects GtkPageSetupDoneFunc's missing nullable page_setup annotation. The generated callback requires an argument but accepts PageSetup or null, matching actual Apply and Cancel results. Existing nullable corrections share the same parser policy; no runtime wrapper or native descriptor change is needed.

The public compiler/reference matrix reproduced four failures before the correction and passes all seven cases afterward. Six real Page Setup consumers pass, including Cancel and Apply with absent or JSX-created initial settings. All 101 workspace tasks and independent source review pass. The reference assertion uses the public qualified Gtk.PageSetup name. U24 in ~/UPSTREAM.md records the upstream metadata issue and evidence; retain this compatibility correction until supported releases include the annotation.

Real dialog checks also exposed GTK's separate orientation grouping defect, recorded as U25. Current GTKX completion tests select initially inactive Reverse landscape. That valid transition does not fix or conceal the separately archived native failure.

### Declarative printing and Page Setup

Printing operations and settings are now JSX objects owned by their mounted demo. Native begin-print, draw-page and completion callbacks remain signal props; the imperative run call waits for committed objects. Page Setup settings follow the same ownership pattern. Print failures reach the existing error dialog or the caller's explicit error handler.

Four public export consumers pass: empty output, multipage output, ordinary filesystem failure propagation and error-callback delivery. All 649 permanent GTK Demo cases pass, plus two temporary App walkthroughs that open, cancel and reopen the converted dialogs. Both native screenshots were inspected. The temporary fixture is archived and removed. All 101 workspace tasks and independent source reviews pass.

No physical print job was submitted. Native error-alert interaction and external unmount during an active print job have no new validation claim. GTK's orientation defect remains recorded separately as U25; the declarative conversion does not change that upstream behavior.

### Printing layout units and upstream orientation validation

The printing header now converts its available width to Pango units before ellipsizing. The body loop uses its established dense-array bound instead of substituting empty content. All four PDF/error consumers, application types, touched lint and independent source review pass. Narrow-paper ellipsization has source verification only; the export controls do not establish its visual result.

U25's two-line GTK resource correction passes eight standalone GJS Apply cases and an actual GTKX Page Setup walkthrough using GLib's per-process resource overlay. Every orientation has exclusive selection and returns the requested value. The initial native screenshot was inspected. The system GTK installation is unchanged, and no rebuilt library is claimed. The upstream patch and functional evidence are preserved under ~/upstream-work/gtk-page-setup-orientation; no external report was posted.

### Ambiguous numeric hash-table keys

Native descriptor resolution now rejects signed and unsigned bigint hash-table keys before table decoding, field access or callback/class publication. This also covers runtime GType keys, whose native descriptor cannot distinguish a pointer word from an allocated integer cell. Generated callables, callbacks, fields, properties, signals and vfuncs omit matching contracts while preserving physical layouts and non-executable aliases. Supported integer and double keys and boxed numeric values keep their existing behavior.

All 56 public native cases and 42 compiler/reference cases pass. The baseline exposed three reference failures and an invalid generated JSX bigint-key Record declaration; its negative compilation results were not independent evidence until the accepted program compiled cleanly. The complete ordinary checkpoint passes 3,134 cases across 186 files. Sanitizers pass 1,250 cases. A final function-length extraction passes independent review and all 56 focused native cases again under sanitizers; the normal addon is restored. All 101 workspace tasks pass.

No ambiguous key was created or decoded by the tests. The installed GIR scan found no affected numeric-key producer. GType-valued tables and a separate GType alias declaration/descriptor mismatch remain open follow-ups. Exact patches, inventories, baseline diagnostics, peer reviews and final logs are archived.

### Forms repeat review and worker teardown obligations

All 20 current forms files were read completely again, with 13 complete supporting files and separately recorded excerpts. No new supported-consumer defect was found. Explicit ComboRow IDs, dependency-owned form types, ref cleanup and public submission/reset/error coverage remain consistent. This source review adds no runtime or visual validation claim.

The worker teardown follow-up separates JavaScript reference detachment, native callback ownership and owner-thread resource retirement. The maintainer selected cleanup before termination: finish native operations or cancel and await them, disconnect native callback registrations, then quit and acknowledge cleanup before parent termination. Standalone worker initialization remains supported. The contributing and v2 async guides now state that contract, with independent source review.

Forced termination with live native work is outside that contract. Owned deferred releases and finalizers after environment cleanup still need correction, including native parent fallback during object retirement. This narrower implementation review remains open; no main-thread-only restriction or suspect shutdown probe was introduced. The documentation change alone does not close the cleanup finding.

### GType-valued hash-table admission

Runtime descriptor compilation now rejects a GType used directly as a hash-table value while its semantic marker is still available. The corresponding generated APIs are omitted through the shared table-slot admission rule. Recursive arrays, references, callbacks and nested tables reach the same check. Scalar GTypes and ordinary allocated bigint table values retain their existing contracts; no native storage policy is added.

All ten new runtime rejection cases fail before the correction, with the scalar control passing. The compiler baseline reproduces all 19 new declaration omissions and three reference failures while its accepted control passes. Afterward, all 67 focused native cases, 61 compiler/reference cases and 710 runtime cases pass. All 67 native cases also pass under sanitizers, the normal addon is restored, and all 101 workspace tasks pass. Independent production and test reviews are clean.

Tests use valid null/empty inputs, null results and callback acceptors that never invoke the supplied function; no pointer-word table is created. The installed GIR scan found no affected producer. An alias whose C spelling is GType but whose target is gsize still has a separate declaration/descriptor mismatch; that canonical normalization is the next bounded correction.

### Canonical GType aliases

GIR aliases whose own C spelling is GType now normalize to the canonical GType during parsing. Descriptor generation, constants, JSX props and table admission follow that same target. Generated alias declarations and reference pages share their bigint rendering, including alias chains and GObject.Type, without recursive type declarations. Ordinary gsize aliases remain numbers.

The selected compiler baseline reproduced eight failures, and a separate real generated-module consumer rejected a valid GObject type before native entry because the old descriptor expected a number. After correction, all 74 compiler/reference and generated-native cases and all 101 workspace tasks pass. The native consumer uses actual libgobject functions with a registered type, documented zero-name behavior and pre-entry invalid-value rejection. No ambiguous table or synthetic class is invoked. Independent production and test reviews are clean; exact evidence is archived.

### OSTree finder result ownership

The two public OSTree finder finish functions now copy boxed result elements before releasing their owning GPtrArray. The correction uses two exact entries in the existing return-transfer policy. OSTree's transfer-full annotation is valid; this selects GTKX's receiving behavior for its destructor-owning aggregate. Runtime, native representation and outgoing vfunc descriptors are unchanged.

A generated-module consumer creates real local repositories and a committed collection ref, then exercises both public async finder routes. Empty results, populated results, cancellation, recovery and continued use of earlier results pass. The same program passes strict compilation; all three existing signing-engine controls also pass. The finder program passes with AddressSanitizer, the normal addon is restored, and all 101 workspace tasks pass. Independent source review is clean. Current generated descriptors and public signatures were inspected before native execution; the unsafe original ownership pairing was not executed.

Direct and parent vfunc receiving remains a separate finding because the same descriptor serves incoming native arrays and outgoing JavaScript implementations. This correction preserves the working outgoing path and does not establish generic container convergence. Exact source, generated snapshots, reviews and validation logs are archived.

### Worker native-owner cleanup

Native release jobs now remain owned by the thread that created them, including jobs queued before quit and finalizers invoked after environment cleanup begins. Retirement detaches JavaScript callbacks before releasing native resources. Registered dispose/finalize trampolines then call their captured native parent directly. Wrapper finalizers delete their own Node reference, and foreign toggle notifications resolve an opaque identity to the original owner without dereferencing expired wrapper state.

Both completed-operation and cancelled-and-awaited worker consumers pass. Each disconnects its signal registration, quits and acknowledges cleanup before termination. Four independently counted native owners finalize exactly once on the original thread: a raw handle, a wrapper, a registered subtype and an already-collected wrapper awaiting native release. Native parent disposal runs without JavaScript re-entry. Static callback-reference detachment is verified by source review; the counters do not independently measure those Node references.

All 18 focused worker/runtime cases, 3,146 ordinary native/runtime/renderer cases, 1,262 sanitizer cases and 101 workspace tasks pass. The normal addon is restored. Independent production and fixture reviews are clean. The unsupported unconditional-termination test is replaced; standalone initialization, natural exit and owner-conflict controls remain. No unsafe teardown baseline was run, and this correction is not established as the cause of the earlier unexplained worker failure. Exact ownership evidence, patches, source inventories and logs are archived.

### OSTree native finish vfunc admission

The generated OSTree finder finish slot now marks native calls unsupported. Direct generated calls, native super calls, callVfunc and callParent reject before argument conversion or binding the native slot. The same slot metadata drives the reference guidance. Its physical layout and outgoing descriptor remain unchanged, so registered JavaScript implementations still work through native dispatch and ordinary JavaScript calls.

All three focused CLI cases pass, including strict compilation, reference guidance and the existing populated finder consumer. Each rejected route receives its own completed Config task from the actual finder; the task retains ownership of its unpropagated result. Both public resolver routes invoke the authored JavaScript override successfully. The generated consumer also passes with AddressSanitizer. The combined worker/OSTree checkpoint passes 3,146 ordinary cases, 1,262 sanitizer cases and all 101 workspace tasks; the normal addon is restored. Independent production and test reviews are clean.

Only the unsafe native receiving direction is restricted. This does not establish generic container output support, and the unsafe original receiving path was never executed. Generated metadata was inspected before execution, and exact patches, source inventories and validation logs are archived.

### Construct-only property inheritance

Generated property maps now preserve unavailable inherited keys as never-valued entries, and the runtime's public property helpers exclude those entries. This keeps Gst.ControlBinding declarations compatible with their inherited metadata while rejecting writes to its construct-only name and object properties. Construction, reads, inherited writable properties and protected native methods retain their existing types.

The strict installed-Gst consumer reproduced the declaration failure before the change. All seven final compiler cases and 24 existing hidden-property consumer cases pass. All 101 workspace tasks pass. Independent production and test reviews are clean. A scan of 73 installed GIR files found no additional change in property read/write availability among the other direct inherited redeclarations; that scan is not a claim of exhaustive property support. Exact diagnostics, source inventories, patches and validation logs are archived.

### Callback output admission and Variant ownership

Generated callbacks and vfuncs now omit caller-allocated container outputs that have no writeback implementation, including C arrays, lists and hash tables. Pointer-to-pointer inout record callbacks are also omitted where their C shape cannot use the direct-handle convention. Physical vtable layouts remain intact. Ordinary owned-byte APIs, supported output references and in-place TextIter mutation retain their contracts.

The corrected compiler baselines reproduce the omissions independently, with accepted controls passing. An earlier baseline was affected by the separate Gst declaration failure; those negative compiler statuses are excluded from the evidence. No unsupported container-output or pointer-cell callback was invoked.

The supported Icon subclass control exposed a separate floating GVariant ownership defect. Full adoption now converts its floating reference to a hard reference before publishing the wrapper. Subsequent callback returns and borrowed container insertion can then acquire their own references. This is a native ownership correction; packing, descriptors and other fundamental families remain unchanged.

All 46 final compiler/reference/generated-native cases pass, including direct native parent serialization, borrowed Variant container coexistence, nullable overrides and invalid icon input. All 115 existing focused controls, 3,146 ordinary cases and 101 workspace tasks pass. Sanitizers pass 1,287 cases plus the generated Icon consumer, and the normal addon is restored. The extra public consumer checks live values and semantic reads; it does not claim to observe garbage collection. Independent production and test reviews are clean. The adjacent fundamental ownership review establishes no additional supported defect in its recorded scope. Exact inventories, failed and corrected controls, patches and validation logs are archived.

### CLI restart observations and repeated ownership review

CLI development tests now observe application process IDs and source revisions to distinguish hot reload from a restart. Translation and font changes must start exactly one new application process; component refresh and recovery must retain the existing process. Assertions on production diagnostic wording are removed, while resource, translation, font, recovery and cleanup checks remain.

All 14 selected CLI cases pass, with CLI typechecking and touched-file lint passing. The accompanying source review covers 24 complete files and 4,649 lines without establishing a new production defect. The change is confined to the consumer fixture and its observations. Independent review of the complete final test and exact patch is clean.

A separate container review covers 15 complete files and 3,970 lines, plus recorded excerpts and an inventory of 73 installed GIR files. It establishes no additional supported ownership defect. The admitted inline producers examined carry scalar fields; generic resource-bearing inline records and nested ownership remain outside that conclusion. Exact source inventories and validation logs are archived.

### Nullable action query outputs

Generated ActionGroup.queryAction and vfuncQueryAction now allow null for parameter type, state type, state hint and state. One compatibility catalog corrects the exact function and anonymous interface callback metadata. Optional output storage, boolean values, ownership and native layout retain their contracts.

The compiler baseline reproduces eight unsafe non-null output assumptions and rejection of a valid nullable subclass, with the boolean control passing. All 12 final CLI compiler, reference and native-consumer cases pass. Real actions cover stateless, parameterized, stateful, disabled and missing actions; native dispatch, native parent calls and individual getters cover nullable overrides and omitted output storage. All 28 related runtime cases and all 101 workspace tasks pass. Independent production and consumer reviews are clean. U26 in ~/UPSTREAM.md records the missing upstream annotations with pinned and current primary sources.

### Listener removal observations

The existing on/off and once/off tests now emit after removal, so they exercise whether the listener was disconnected. The suite uses ordinary callback counters, and the detailed-signal case verifies both registrations fire before removal and remain silent afterward. All 14 existing listener cases are retained; no production change or private-helper test is added.

All 20 selected listener and disposal cases pass on the final test, and all 101 workspace tasks pass. Independent review is clean. The accompanying signal review covers 14 complete files without establishing another supported production defect in that scope. A separate GL5 repeat confirms the unsupported callback and debug-log exports remain omitted; it does not claim new callback support. Source inventories and exact evidence are archived.

### Nullable directory, icon and socket outputs

The canonical parameter catalog now corrects FileEnumerator.iterate's EOF values, LoadableIcon's optional content type across ordinary and virtual completion paths, and the absent sender address returned by connected socket receives. Optional storage remains distinct from nullable data. Ownership, scalar results and unsupported pointer APIs retain their contracts; listener address results remain non-null.

All 21 public compiler, reference and native-consumer cases pass, along with all 101 workspace tasks. Directory consumers retain successful objects across later iteration and check empty directories and closed-enumerator errors. Real file/byte icons exercise sync, async, explicit finish, native parent calls, nullable and populated MIME overrides, cancellation and recovery. Connected loopback TCP checks cancellation, owned-byte receiving, null sender addresses and EOF; receiveMessage has source/compiler/reference coverage only.

Each compiler baseline has an independent passing control. The initial icon accepted program also contained an unrelated Bytes data typing error; that failure alone is excluded from the regression evidence. After correcting its EOF handling, the accepted baseline is repeated with only the catalog change reverted and fails as expected. The final strict consumer passes. Independent source and test reviews are clean. U27–U29 in ~/UPSTREAM.md preserve primary sources and validation; no upstream reports were posted. These metadata changes require no native production change, and this batch makes no new sanitizer claim.

### Nullable line and settings-tree outputs

The canonical parameter catalog now allows a null line from IOChannel.readLine at EOF and a null path from SettingsBackend.flattenTree on an empty tree. Both corrections follow exact producer assignments; status, lengths and key/value arrays retain their types.

Each compiler/reference baseline fails three cases while its independent control passes. All nine final cases and all 101 workspace tasks pass. Real regular-file reads cover ASCII/Unicode lines, newline variants, empty files, EOF and invalid UTF-8 errors. The existing boxed Tree input is supported, but no installed admitted Tree producer was found; its empty result is source-verified with compiler/reference coverage only. No pointer factory or native production change was added. Independent source reviews are clean. U30 and U31 in ~/UPSTREAM.md preserve the upstream evidence and these validation limits.

The bounded GLib scan checks seven output contracts after filtering 175 pointer-spelled output rows; it establishes no further nullable correction for the selected Regex and URI results. A separate Ref review covers 20 complete files and finds no justified migration across the current runtime-semantics/native-ownership boundary. Neither review closes the broader R2 scope. Source inventories, exact drafts, reviews and validation logs are archived.

### Regex subject ownership through native copies

MatchInfo now uses a distinct owning boxed type that retains both the native match and its exact subject bytes. GValue copies can outlive the original JavaScript wrapper safely. Runtime code owns subject encoding, matching and replacement callbacks; the native layer owns the two references and exposes an owner-retaining view for generated methods. Overrides install the runtime implementation without duplicating method descriptors.

All nine new public lifetime cases pass, including original-wrapper collection, nested GValue copies, Unicode positions, empty and unmatched subjects, retained replacement-callback matches, expired callback builders, errors and recovery. The focused ordinary checks pass 83 cases; the regenerated standalone lifetime/lifecycle checks pass 29. The final sanitizer run passes 1,223 cases and restores the normal addon. All 101 workspace tasks pass. Independent production and final consumer reviews are clean.

The first sanitizer attempt used a stale separate generated fixture and failed the nine new cases before exercising their intended contracts; it reported no sanitizer memory error. Explicit fixture regeneration and inspection preceded the successful complete run. No unpatched alias/GC probe was executed. This corrects GTKX ownership of GLib's documented borrowed subject and is not an upstream GLib defect. Exact sources, reviews, failed and successful validation logs are archived.

### Character arrays and borrowed deserializer cursors

GIR arrays of UTF-8 elements whose C type is a single character pointer now use byte-array descriptors. String-pointer vectors retain their existing representation. Generated Regex replacement and splitting methods accept bytes; the owning full-match and replacement-callback adapters also accept bytes while preserving their string overloads. HarfBuzz blob reads return independent byte copies. Its writable blob accessor is omitted because a copy cannot provide the promised native mutation.

Both HarfBuzz deserializers now return bounded copies of their remaining input, using the existing borrowed-cursor descriptor. Their output no longer follows the incorrect owned-string metadata. Cursor outputs cannot replace the original input as the source of its length. U32 in ~/UPSTREAM.md records the upstream annotation problem and the limits of a transfer-only correction.

Empty length-bounded scalar arrays and typed views now receive valid native storage while retaining a logical length of zero. This fixes direct Regex calls that previously passed null for empty arrays. The correction reuses existing aligned allocation code and preserves explicit null; it does not add resource-bearing array support. Public cases cover empty number arrays, fresh byte arrays and empty subviews without modifying their backing storage.

The compiler/reference baseline reproduces nine failures with two independent controls passing; unsafe original blob/cursor calls were not executed. The 45-case CLI checkpoint passes, including 32 existing array controls. After the empty-input correction, all 13 expanded new CLI cases, 3,163 ordinary cases across 188 files and 101 workspace tasks pass. Sanitizers pass 1,231 addon/generated-native cases plus both generated CLI consumers, and the normal addon is restored. The 17 ownership cases include byte subviews, number arrays and retained callback matches. Independent final production and consumer reviews are clean.

Validation caught and corrected missing public Regex overloads and an incorrect partial-parser test expectation. The separate empty-input baseline fails safely at GLib's null guard before dereferencing data. These failed checks and their corrections are preserved. A repeat scan of 78 GIR files finds the same 21 relevant character-pointer arrays; its recorded scope establishes no further native layout defect. The subsequent signal review finds emitted container contracts that current GValue conversion cannot handle. Those findings remain open, separately from this completed batch.

### Scalar GArray signal emission

The runtime now packs scalar GArrays into GValues using the existing native container codec. The GValue retains the array after the setter's temporary ownership ends. Scalar admission shares the existing ABI conversion and storage predicate; resource-bearing arrays remain excluded. No native implementation or generated call shape changes are needed.

All four public MountOperation cases reproduce the missing conversion before the fix and pass afterward. Generated emission reaches both a listener and a registered class override, including empty arrays, copied values, numeric rejection and recovery. The focused run passes 73 cases, the ordinary run passes 3,167 cases across 189 files, and all 101 workspace tasks pass. All 13 targeted sanitizer cases pass, including existing boxed-property controls, and the normal addon is restored. Independent production and consumer reviews are clean.

Descriptor-aware scalar reads use the same borrowed codec; generic GArray type inference and descriptorless reads are not added. The separate signal inventory covers 73 installed GIR files and 669 generated emission cases. Pointer-array and string-map emission findings remain open, and an installed-only WebKit pointer-array candidate still needs consumer and ownership review. The repeat R2 review also records native JavaScript-to-GError formatting policy as a separate migration candidate. Exact inventories and validation evidence are archived.

### String-map signals and supported emission storage

Generated Soup content-sniffed emission now accepts its declared Map of string keys and values. The runtime uses the existing native hash-table codec; the GValue retains the table and its owned strings through emission. Descriptor-aware reads produce independent Maps. This adds no native implementation, generic Map inference or descriptorless container read support.

Generated Application.open, Settings.change-event and fixed C-array signal emissions are omitted where the GValue path cannot retain their pointer storage. Their connect/on handlers, JSX props and reference entries remain available. Terminated string-vector, scalar GArray and string-map emissions remain supported. The change introduces no raw-pointer adapter.

The four Soup baseline cases fail before native emission and all 64 final focused runtime cases pass. Three independent compiler baselines reproduce the unsupported emission promises, with accepted compiler and reference controls passing. All 28 final compiler/reference cases, 3,171 ordinary cases across 190 files and 101 workspace tasks pass. All 17 targeted sanitizer cases pass, and the normal addon is restored. Independent production and consumer reviews are clean. No unsupported C-array emission was executed.

This closes the four generated emission gaps found in the recorded inventory, including the preceding scalar GArray correction. The installed-only WebKit pointer-array candidate and signal return/output review remain separate work. Exact source inventories, baselines, generated excerpts and validation logs are archived.

### Object-array signal and property values

The runtime now packs GPtrArrays of GObjects into GValues with independent references to the array and every object. Typed property reads return wrapped objects through the existing native codec. Other element families and generic array inference remain unchanged. This closes the conversion gap identified in WebKit's form-controls-associated signal without adding native implementation code.

Eight public integration cases use registered GObjects and real actions. They cover typed signal delivery, copied GValue retention, empty and null arrays, property replacement, and signal/notification errors followed by recovery. The corrected signal baseline fails five cases and the property baseline fails three. All 72 final focused cases pass. The broader checkpoint passes 3,176 cases across 191 files; the three later property cases pass in the focused run. All 101 workspace tasks pass, followed by the final affected type/lint checks. All 25 targeted sanitizer cases pass, and the normal addon is restored. Independent final reviews are clean.

The tests do not construct WebKit process objects or claim forced collection of the original wrappers. Source review establishes the native references; the tests exercise observable retention and later object use. The first ambiguous empty-array test row was replaced and its baseline rerun. Exact drafts, superseded checks, source inventories and final validation are archived.

A separate return/output review reads eight complete files and records 306 installed signal result/output slots as a scan. The sampled scalar, caller-allocated boxed, inout and declared-signal contracts establish no additional defect; the scan is not a complete disposition of every slot. Remaining callback error conversion and the wider audit stay open.

### Callback error conversion in runtime

Runtime now converts throwing callbacks and virtual methods into owned GErrors, preserving wrapped GLib domains and codes. Native validates the supplied boxed handle, copies it into available error storage and preserves the original exception when that storage is absent or occupied. Error recognition and formatting have one runtime implementation; native retains ABI, ownership and exception-delivery responsibilities. This also fixes wrapped GErrors losing their status when the previous native conversion reconstructed them as ordinary JavaScript errors.

The corrected baseline reproduces four failures with ten passing controls. All 55 focused cases, two generated CLI consumers and 3,189 ordinary cases across 192 files pass. Workspace checks pass after correcting a Rust lint about copying Env by value. Sanitizers pass 416 addon, 820 generated-native, 50 runtime and two generated CLI cases; the normal addon is restored. A final assertion checks the supplied GError remains usable after copying, and all five addon error cases pass again. Independent production, consumer and applied-runtime reviews are clean.

An initial incorrect type-resolver library caused test setup failures and is excluded from regression evidence. Input-status checks now precede throwing calls. The boxed error remains alive through its External in the active N-API local scope; GObject leases are not its owner. Exact drafts, source inventories, corrected evidence and validation logs are archived.

The subsequent installed signal-container repeat accounts for all 17 container input parameters among 944 signals in the same 73 GIR files. It establishes no further input-container gap in that scope. A separate callback review confirms that optional lifetime defaults and completion-sibling eligibility belonged to native descriptor conversion; the callback-lifetime section records their migration while native retention and expiry safeguards remain required.

### Host error-channel observations

The three host log-channel cases now emit authored GLib warnings or criticals and assert process exit status. They no longer trigger unrelated widget/CSS failures or assert diagnostic text and marker output. The existing real asynchronous-error consumer remains intact. This changes tests only.

All 16 focused host cases pass, alongside the 3,189-case ordinary checkpoint, workspace checks and 820-case generated-native sanitizer run. Independent review is clean. The accompanying host review covers seven primary files and 27 complete files overall without establishing another supported production defect. Exact test drafts, inventories and validation logs are archived.

### Queued native owners at process exit

Native now treats destruction of its thread-local cleanup queue as a terminal state. Dropping a queued GObject owner during explicit process exit can then notify its toggle reference without accessing destroyed thread-local state or N-API. Ordinary quit and reinitialization retain their existing behavior. This does not add forced termination with live native operations or registrations.

A standalone child reproduces the original SIGABRT while empty and natural exits pass. All four final process cases pass, including preservation of a nonzero exit status. The broader checkpoint passes 3,194 cases across 193 files in complementary native/runtime and renderer runs. Workspace checks pass after the required Rust formatting correction. Sanitizers pass 416 addon, 820 generated-native and 43 runtime cases, then restore the normal addon. Independent source reviews are clean for the reproduced ownership path.

The initial test worker printed passing assertions before aborting, and Vitest still returned success. The standalone regression checks the child's actual status and signal. U33 in ~/UPSTREAM.md records a GTKX-independent reproduction of this Vitest shutdown-status candidate. No upstream report or production test-runner workaround was added. Exact source inventories, failed and successful runs, patches and reviews are archived.

### Passive closure data at process exit

A completed GTask can retain a copied GValue containing a boxed GClosure after its callback and main-context work have finished. Releasing that passive result during explicit process exit previously reached the destroyed live-callback registry. Closure destruction now skips registry removal only when that thread-local registry is unavailable, while still releasing retained resources and the JavaScript callback reference.

The direct pre-fix child records the caught terminal panic; its exit status remained zero, so the seven lifecycle and status cases are coverage rather than a failing regression oracle. The final direct child is silent and preserves natural, zero and nonzero exits. The broader checkpoint passes 3,197 cases across 193 files. Sanitizers pass 416 addon, 820 generated-native and 46 runtime cases, then restore the normal addon. Both independent source reviews are clean and record this evidence limitation. Exact drafts, inventories, patches and validation logs are archived.

### Callback lifetime convention ownership

Runtime now normalizes optional callback scopes and decides whether a notified callback without a destroy notifier is released with its asynchronous completion. It passes native an explicit scope and release plan. Native retains the structural ownership checks: notified scope without a notifier becomes retained scope, and completion-tied release requires user data, retained scope and no destroy notifier. Direct native consumers must state their scope.

The old implementation fails five of the 50 focused cases: it retains the explicit native completion-tied callback after completion and accepts four invalid release plans. The runtime compatibility cases already pass that baseline. All 50 final cases pass, including the real native and runtime Regress completion paths, user-data-only call lifetime, callback failure recovery and valid OptionContext parsing after rejection. The broader checkpoint passes 3,203 cases across 193 files. Sanitizers pass 417 addon, 825 generated-native and 46 runtime cases, then restore the normal addon. All 101 workspace checks pass. The sanitizer build also exposed a renamed standard-library atomic update method; the behavior-preserving update passes strict Clippy. The frozen source draft and independent review are clean, with exact inventories and validation evidence archived.

### Terminated inline records and retained registration tables

Native now appends one zeroed record only when packing an explicitly terminated inline record array. Logical input length, counted arrays, fixed arrays and GArray storage keep their existing layouts. A valid empty Gio application option-entry call now receives the required sentinel instead of a null pointer. Codegen omits the four enum and flags registration APIs whose GLib contracts retain the caller's temporary packed table: the two namespace registrations and the two TypeModule registrations.

The old native path passes 40 array controls and fails the empty option-entry case at GLib's non-null precondition. The old generated surface passes 32 controls and fails six omission checks across types, references and runtime namespace shape; no retained-storage method is invoked. The final 41 array cases and 38 generated-consumer cases pass. The broader checkpoint passes 3,204 cases across 193 files. Sanitizers pass 417 addon, 826 generated-native and 46 runtime cases, then restore the normal addon. All 101 workspace checks pass. The first post-fix consumer run used a stale built codegen package and is preserved as a setup failure; rebuilding codegen and the CLI produced the passing generated surface. Exact installed-GIR scans, upstream source traces, drafts and validation evidence are archived.

### Pango boxed lifetime methods

Generated records no longer expose a method whose C identifier is the record's declared free function. The shared GIR model applies that rule once for emitted modules and API reference pages. Pango AttrIterator lacks equivalent lifecycle metadata, so its exact destroy symbol remains an explicit omission. Copying and ordinary attribute and iterator operations retain their generated contracts; unrelated methods such as GLib.Source.destroy remain available.

The safe compiler and namespace baseline fails six of seven cases without invoking either destructor. All 16 final Pango and GLib lifetime cases pass across strict types, reference pages and real native consumers. A complete installed-GIR scan finds eight declared free-function collisions; seven were already omitted by the existing free and unref rule, leaving Pango.Attribute.destroy as the sole additional removal. All 101 workspace checks pass. No sanitizer rerun is claimed because this batch changes only parsed API admission and generated output. Independent review confirms the shared-model placement and installed-surface scope. Pango AttrIterator's missing copy/free metadata is recorded as U34 in `~/UPSTREAM.md`; no upstream report was posted. Exact patches, scans and validation logs are archived.

### Public table-return coverage and field ownership

Seven tests that supplied fabricated native output entries are replaced by eight real hash-table call cases. They check independent Maps, object identity, copied boxed and plain records, nested object arrays, empty input, rejected input and recovery. Both full-string field fixtures now clear their final native allocation and verify the empty slot. No production conversion change is added.

All 39 final cases pass normally and under sanitizers, alongside the 3,194-case broader checkpoint and workspace checks. The first draft incorrectly supplied wrappers to a low-level API that expects caller-unwrapped handles; its five pre-entry failures are preserved as a test setup error. After that correction, the tests exposed the separately fixed process-exit abort. Independent final source review is clean. The wider test-quality review covers 35 complete files; a separate byte-reference scan establishes no affected installed generated consumer. Exact scopes and validation evidence are archived.

### Collection handle validation and mixed array ownership

Native collection encoders now validate each object, boxed and fundamental handle against its declared element codec before copying, referencing or calling native code. The covered C arrays, inline record arrays, GArrays, GPtrArrays and hash-table entries reject mismatched handles and remain usable after rejection. This keeps the check at the safe FFI boundary and leaves conversion policy in runtime and generated descriptors.

Gdk.ContentProvider.newUnion has a narrower ownership contract than its GIR annotation can express: GTK copies the outer pointer array, then assumes ownership of each provider reference. An exact codegen override therefore emits a borrowed outer array with full-transfer elements. The general transfer model remains unchanged, and U35 in `~/UPSTREAM.md` records the GTK/GI limitation and an independent GJS Valgrind reproduction. The compatibility override remains until supported upstream releases describe the contract accurately.

All 176 focused collection cases pass. The complete native sanitizer target passes 417 addon and 830 generated-binding cases, then restores the normal addon. All 101 workspace type, lint, Rust and dependency checks pass. Independent native-boundary and descriptor reviews are clean. Exact ownership traces, GJS reproduction logs, patches and validation evidence are archived.

### Retryable class registration

Runtime now prepares declared property accessors without publishing them on a class until native GType registration succeeds. A rejected duplicate type name therefore leaves the submitted JavaScript class reusable. The successful attempt installs the same accessor objects captured by native property dispatch before interface mixins, element metadata and user class initialization run. Failures after static GType registration remain irreversible.

The old implementation fails both public retry cases because the rejected attempt leaves a non-configurable declared-name map and stale accessors behind. The final tests retry property-bearing and propertyless classes with distinct declarations, then exercise construction, ordinary accessors, native GValue dispatch, notification, range rejection and recovery. Both focused cases, 170 related registration cases, all 741 runtime cases and all 101 workspace checks pass. Independent source and test reviews are clean.

### Generated namespace and reference alignment

Codegen and API reference indexing now share the same admission decision for GIR namespace functions moved onto emitted class, interface or record members. Reference generation resolves those targets in the source namespace even though it renders signatures in a synthetic documentation namespace. It therefore no longer advertises namespace exports that generated ESM and TypeScript omit.

A fresh 15-namespace Adwaita and GTK store exposes 236 stale reference entries before the fix and none after it. The public Pango integration covers three moved namespace names and their documented record-member replacements. All seven cases and all 101 workspace checks pass, including generated declarations and a real native consumer. The bounded comparison found no other top-level reference/export mismatch.

### Remaining full-transfer input arrays

The generated inventory now accounts for 35 direct full-transfer C-array inputs across 19 namespaces, plus the separate callback, signal and vfunc contexts. GTK ClosureExpression and TryExpression are the only remaining direct calls whose implementations borrow the outer pointer array while taking every element. Exact parameter overrides now emit borrowed outer arrays with full-transfer expression elements. The general GIR transfer rules and the 32 metadata-consistent direct calls remain unchanged.

Three public expression cases cover closure evaluation, fallback evaluation, wrong-handle rejection and recovery. All 30 focused GTK cases pass. The complete sanitizer target passes 417 addon and 833 generated-native cases, then restores the normal addon. Isolated leak checks reproduce 16,000 leaked bytes across 1,000 calls for each constructor with full outer-array transfer and report no leak with element-only transfer. All 101 workspace checks pass. U36 in `~/UPSTREAM.md` records the annotation limitation alongside the source inventory.

### Memory input stream data ownership

Generated Gio bindings no longer expose MemoryInputStream.newFromData or addData. Those APIs retain a transferred byte buffer until a caller-supplied native destroy callback releases it; a null callback leaks the buffer, while a JavaScript callback would retain native-pointer disposal policy in Node. The existing newFromBytes and addBytes methods with GLib.Bytes provide the complete safe route, including construction, appending and empty input, without a runtime override or native special case.

The public compiler and consumer suite rejects all four call and member forms, omits both methods from runtime and reference surfaces, and exercises the byte-owning alternatives. All 15 cases pass after rebuilding codegen and the CLI; the initial run against stale build output is excluded as setup evidence. The migrated runtime promisify suite passes all nine cases, and all 101 workspace checks pass. GJS 1.88.1 also rejects both raw-data methods because their DestroyNotify relationship is not introspectable.

### React text resource cleanup

The remaining React source review reads 13 complete files, 1,482 lines: the property model, text and style reconcilers, and the application, controlled-value, latest-ref, merged-ref, object-value, parent-window, presented-instance, property, setting and signal hooks. Together with the earlier reconciler, component and accessibility/settings reviews, all 48 current files under `packages/react/src` have now been read. No further finding was confirmed in the property, style or hook paths.

Removing a declarative GtkTextTag left it registered in its buffer's tag table, and removing a GtkTextMark left it attached to the buffer. The reconciler now removes both native resources when their JSX elements unmount, under the same mutation boundary used to rebuild text content. Independent review also found that replacing a tag with the same native name had to clear the displaced tag's ownership record before its later unmount. All three public regressions fail before the corrections and pass afterward. All 45 text-view cases and all 930 React integration cases across 43 files pass, followed by the React and end-to-end typecheck and lint targets and all 101 workspace checks.

### Virtual-method input array lengths

Generated virtual methods no longer expose the native length companion of a sized input array. Overrides receive the array itself, while runtime derives the native count for direct and parent calls from that same public value. This removes an independent count that could disagree with the allocated array and makes callback and call directions follow one descriptor-defined shape. Native remains responsible only for encoding the values and invoking the slot.

The complete generated scan covers 1,102 virtual-method descriptors and finds 14 affected array relationships across Gio and GTK, including a length that precedes its array. The compiler fixture covers both parameter orders. A real Gio.Application override receives files and its hint, chains to the parent implementation and handles changing array lengths. The old declaration rejects that override and the old callback shape supplies the native count in place of the hint. All 22 codegen-analysis cases and all 742 runtime cases pass, alongside affected types and lint. Independent review finds no other signal or virtual-method lowering defect in the bounded 38-file review.

### Font metadata parsing

The CLI now reads font family metadata with the maintained `@cantoo/fontkit` package. A 579-line local parser for OpenType, TrueType collections, WOFF and WOFF2 is replaced by a 15-line adapter that preserves WWS, preferred and legacy family-name precedence, handles collections and removes duplicates. Invalid font imports still fail through the existing public build error.

The existing production build cases exercise WOFF2, OpenType, WOFF and multi-family TrueType collections, plus an invalid file. Relative-root Vitest coverage exercises staged WOFF and WOFF2 files. All 37 cases pass, alongside CLI build, typecheck and lint. The dependency ships its own types and supports the exact buffer and collection API this path needs.

### Nested array admission

Generated bindings no longer expose 24 nested string-array calls that the native codec cannot execute. Every input and inout form requires a generic nested item encoder that GTKX deliberately does not provide. Fixed and length-bounded outputs require the same unsupported contiguous item codec. The shared admission rule resolves aliases and follows direction and storage layout, so it retains the three safe null-terminated returns and pointer-walking GList, GSList and GPtrArray outputs. GioUnix.DesktopAppInfo.search remains available.

The pre-fix public inventory confirms that all 24 omitted calls throw before returning a usable value. Regenerated JavaScript and declarations contain only the three supported fixture returns. The focused native run passes 59 array and GioUnix cases. Regenerating the full fixture store also found one stale Interface3 integration consumer from the earlier virtual-method length correction; its override now receives only the public array value. All 98 selected native cases, the complete end-to-end test typecheck and affected lint pass.

### Navigation example repeat audit

All 22 tracked Navigation example files were read completely, 777 lines, with the current drawer, stack, tab, theme and prevented-removal package contracts. The application remains declarative, route params stay typed and composed behavior remains outside the reconciler. No supported-consumer defect or test-quality violation was confirmed.

All nine native application cases pass, including nested navigation, Back handling, retained reply drafts, sidebar control, tab selection and theme updates. The complete example TypeScript projects and lint pass. This source and integration review adds no visual-change claim.

### Storybook example repeat audit

All 17 tracked Storybook example files were read completely, 536 lines, with the current story composition, preview ownership, controls and action contracts. Dialog and window ownership stay declarative, and stories exercise application behavior through the public renderer. No supported-consumer defect or test-quality violation was confirmed.

All eight native integration cases pass across composed component, dialog and standalone-window stories, including updates, errors and unmount cleanup. The complete example TypeScript projects and lint pass. This source and integration review adds no visual-change claim.

### Blog documentation audit

All eight tracked blog files were read completely, 1,029 lines. The seven release posts remain versioned accounts of their releases rather than current API guidance; their migration links point to the matching stable or v2 sections. The 2.0 beta post states the current runtime, ESM, codegen and release-hardening contracts concisely and sends detailed migration steps to the upgrade guide. No documentation correction was confirmed in this scope.

### Website release infrastructure audit

All 14 tracked website root and script files were read completely, 939 lines. Version promotion, stable-reference pinning, generated output ownership and TypeDoc routing remain project-specific build operations with one source of version metadata. The current 1.6 tag and commit pin, root and v2 output paths and retention policy agree. No supported release or documentation defect was confirmed.

The website TypeScript project and affected lint pass. The reference pin query returns the declared stable tag and commit without changing generated output.

### Current v2 guide audit

All 20 current guide files were read completely, 2,597 lines. They remain concise, GTKX-specific introductions that defer React, GNOME and complete API details to their upstream documentation or generated reference. The testing guide's error-handling link and two stable modal-guide links pointed to headings that no longer exist. The error-handling guide also referred to an OpenGL example that is no longer present. The links now target the current sections, and the stale example claim points readers to the generated GLib.Error API.

Every Markdown fragment target across the website resolves. The production VitePress render passes against the complete current and stable documentation trees.

### CLI source transforms and bundle inspection

React Compiler and Fast Refresh now use the CLI's shared source-language model. Both paths therefore handle `.mjs` and `.mts` application modules, exclude declaration modules consistently and preserve query-bearing Vite identifiers. Plain TypeScript passes through SWC's maintained type erasure before the Refresh transform because its TypeScript parser does not emit registrations for `createElement` components; the source maps are composed across both stages.

The self-contained bundle check now classifies actual `require`, `require.resolve` and `import.meta.resolve` calls. It no longer treats every call that receives `import.meta.url` as module resolution, so applications may observe their module URL without a literal label being mistaken for a package dependency. A bare unresolved `import.meta.resolve` remains rejected.

Pre-fix acceptance runs reproduced redundant renders for both new compiler fixtures, process restarts for both live-edit fixtures and the harmless module-URL build failure. All six compiler cases, 13 self-contained bundle cases and 15 development cases pass after the corrections. CLI library and test TypeScript, affected lint and the final focused live-refresh rerun pass.

### Latest remote checkpoint

At `fdb77c7c`, every main CI job passes, including all 591 CLI tests across 55 files in 2,172 seconds. The expanded CLI budget accommodates that run. CodeQL passes. The instrumented suite passes all 4,930 tests across 382 files in 3,175 seconds; Sonar analysis and its quality-gate check both pass. The 90-minute coverage budget accommodates the complete run.

Copilot reviewed 275 of 705 files and added no new inline comments. Its summary repeats the nullable action, manifest replacement and callback lifetime concerns already tracked. The declared string action parameter and existing malformed-manifest coverage retain their recorded dispositions; GL callback lifetime remains open. This partial review does not close the audit, and no reply was posted.

At `e99630eb`, every main CI job and CodeQL pass, including CLI tests, types, lint, documentation, publication and sanitizers. The Sonar coverage and quality-gate run also passes. Copilot reviewed 278 of 730 files and added no inline comments. Its summary retains manifest replacement and GL callback concerns and mentions unknown signal handling. The signal conversion callers receive actual Node child-exit signals or the explicitly handled Linux signals; unsupported signal names do not justify an extra production fallback. No review reply was posted.

At `fce4428b`, non-CLI tests, types, lint, documentation, publication, sanitizers and CodeQL pass. The CLI job reaches its 45-minute limit after 517 passing cases across 42 completed files, with no failed case reported. Its two preceding complete runs took about 39 and 41 minutes; new consumer suites increase the work. The job budget is now 60 minutes, preserving its worker count and individual test deadlines. Sonar passes all 5,000 instrumented cases and completes coverage in 64 minutes. Its scan workflow succeeds, but the separate quality gate fails the new-code reliability requirement: rust:S9168 flags `PendingTransfer::disarm` using `mem::forget`. The pointer has intentionally transferred to its native owner. Clearing the guard's pointer before its existing destructor runs makes that relinquished ownership explicit. Local Rust, integration and sanitizer checks pass; a new remote gate is pending.

Copilot reviewed 267 of 753 files and identified the borrowed array-seed ownership issue. The list, array decoder, bounded replacement and terminated-handle corrections are validated; reference-counted container destruction remains open. GitHub code quality also flagged a computed `__proto__` data property in the settings integration test. The JavaScript contract and standalone controls confirm a false positive; U19 in `~/UPSTREAM.md` records the evidence without a production workaround or suppression. No review reply or upstream report was posted.

At `c820078f`, every main CI job and CodeQL pass. The CLI suite completes all 616 cases across 59 files in 3,010 seconds, within its revised budget. Sonar's 5,091 instrumented cases across 393 files pass in 2,759 seconds; both the scan workflow and separate quality gate pass, with no new issues. Copilot reviewed 265 of 770 files and added no inline comments; its summary repeats manifest persistence, GL callback lifetime, byte-array decoding and direct Storybook composition concerns. The malformed-manifest public consumer already verifies retry behavior. A separate byte-array source review covers 20 complete files, 3,754 lines, plus nine excerpts, 1,699 lines, and finds no supported ownership defect: owned results retain their cleanup guard through copying, while borrowed reads retain their owners. The NAPI copy compatibility remains necessary. All 14 public Storybook composition edge and error cases pass; typed direct composition and unknown module validation have distinct entry contracts, with no supported-input bug established. GL callback lifetime remains open. No review reply was posted.

At `80498349`, every main CI job and CodeQL pass. The CLI suite completes all 620 cases across 61 files in 2,529 seconds. The Sonar workflow and separate quality gate also pass. Copilot declined this revision because the PR exceeds its 300-file review limit. This is a review limitation, not a clean assessment. Bounded independent source reviews continue, and no review reply was posted.

At `85604874`, the main test job reports one toolbar-height failure after 1,177 passing renderer cases. Its attachment assertion passed, but the height was read before the next GTK allocation. The test now waits for the actual positive height after addition and zero height after removal, preserving its identity, attachment and content checks. All 49 slot cases and the broader 2,937-case local checkpoint pass. The change adds no production delay or timeout extension. Types, lint, publication, sanitizers, docs and CodeQL pass remotely. The CLI suite passes all 635 cases across 62 files in 3,385 seconds, within its existing job budget. The Sonar run on `linux-8-core` was cancelled after the maintainer reported the free-runner change merged. Its scan and quality gate remain unconfirmed. Further pushes wait until the branch includes that runner change; the rebase will follow the maintainer's instruction.

Copilot reviewed 246 of 817 files and raised one tutorial context concern: a translated notification snippet used `due` without showing its enclosing function. The preceding reminders chapter defines that parameter. The prose now names and links `buildReminder(task, due)`, and the assembled function passes strict public TypeScript checking. No review reply was posted. This partial review does not establish convergence.

The CLI job budget is now 90 minutes. Its last remote run took 56 minutes before the additional public compiler and reference coverage in this batch. The worker count and individual test deadlines are unchanged. YAML parsing and the job settings check pass locally; the expanded suite still needs a remote checkpoint after the runner update is incorporated.

## Next work

The latest ordinary checkpoint passes 3,204 cases across 193 files. The cumulative sanitizer run passes 1,289 addon, generated-native and runtime cases, then restores the normal addon. Workspace TypeScript, lint, Rust checks and Knip pass. Recent completed batches cover owning regex matches, character-array and cursor contracts, supported signal-container values, runtime callback-error conversion, terminal owner cleanup, callback lifetime policy and terminated inline record inputs. Their bounded reviews and validation limits are recorded above. Audit inventories, reviews, patches and logs remain under the home-backed `build/polish-v2/pointer-contracts` directory. Local changes still require a remote checkpoint after the runner update is incorporated.

Continue repeat audits and the remaining R2 conversion work. Custom and inline container resources, remaining CLI consumer contracts and the unread example, website and end-to-end inventories remain open. Continue broader container output/storage and remaining public test-quality reviews. The OSTree finder public finish-return correction and its restricted native vfunc receiving direction are validated; JavaScript overrides remain supported. Worker native-owner retirement is corrected and validated under the approved cleanup-before-termination contract; it is not established as the cause of the earlier unexplained worker failure. Caller-allocated container callback outputs and pointer-cell record inout callbacks are now omitted where unsupported; the supported Icon preservation control also exposed and verified the floating Variant adoption correction. No suspect destruction call or unsupported callback was executed. U22 in ~/UPSTREAM.md records the source-confirmed napi External publication ownership candidate, with primary source evidence preserved under ~/upstream-work/napi-external-publication. Track that candidate and the reviewed GtkSourceView cleanup patch through upstream releases. GNOME Shell notification-card interaction and focus policy remain separate desktop validation work. Keep the existing compatibility code until official upstream releases include its fixes and GTKX's supported versions no longer need it. Zero findings has not been reached.
