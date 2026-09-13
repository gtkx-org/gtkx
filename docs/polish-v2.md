# GTKX 2.0 polish audit

The stable release is scheduled for 1 December 2026. Work starts from `c7f7134b` on `feat/polish-v2` and follows the [development principles](../website/contributing/principles.md).

This is the working record for reviewing every tracked file. A search result, passing test, or review of a neighboring file does not count as reading a file. The inventory below records the starting scope; the review batches name the files actually read and the findings still open. No package is complete yet.

## Working method

1. Choose a folder and list its tracked files with `git ls-files`. Read each file and trace the consumers needed to understand its contract.
2. Check package responsibility, memory and lifecycle behavior, supported inputs, type invariants, shared sources of truth, test quality, and consumer relevance against the principles.
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
| `components` | 50 | Pending |
| `animated` | 19 | Pending |
| `cairo` | 32 | Pending |
| `gl` | 6 | Pending |
| `css` | 21 | Pending |
| `forms` | 17 | Pending |
| `i18n` | 17 | Pending |
| `navigation` | 66 | Pending |
| `storybook` | 31 | Pending |
| `config` | 18 | Pending |
| `cli` | 262 | Pending |
| `create-gtkx` | 31 | Pending |
| `mcp` | 26 | Pending |
| `testing` | 60 | Pending |
| `vitest` | 12 | Pending |
| `e2e` | 117 | Relevant regression coverage reviewed with each fix; full suite audit pending |
| `eslint` | 36 | Pending |
| `utils` | 60 | Pending |

Outside the packages, the starting scope includes 397 example files, 174 website files, 15 scripts, 23 GitHub configuration files, 3 patches, 30 root files, and one file each under `docs`, `.nx`, and `.vscode`. All remain open for a full file review, including documentation read for context during this first batch.

## Batch 1: architectural boundaries

### Native API and allocation access

All 23 files in `packages/native/src/api` were read: `alloc.rs`, `bind.rs`, `bind_field.rs`, `call.rs`, `copy.rs`, `get_fundamental_wrapper.rs`, `get_type.rs`, `get_wrapper.rs`, `init.rs`, `keep_alive.rs`, `log_listener.rs`, `new_object.rs`, `parent_death.rs`, `quit.rs`, `read.rs`, `register_class.rs`, `resolve_type.rs`, `set_fundamental_wrapper.rs`, `set_wrapper.rs`, `symbol_address.rs`, `type_class.rs`, `vtable.rs`, and `write.rs`.

`packages/native/src/api.rs` and `handle.rs` were also read completely. Supporting reads traced the affected paths in `ffi/codec.rs`, the struct, boxed, buffer, callback, numeric, boolean and fundamental codecs, and `ffi/closure.rs`. Those supporting reads do not close the entire FFI folder. Validation also included complete reads of `scripts/asan-native.ts` and `scripts/rust-nightly.ts`.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| N1: field access loses allocation bounds | Field reads/writes and inline aliases could bypass recorded allocation bounds. A shared range check now covers bound/unbound field access and both sides of copies. Aliases retain their declared size or remaining owner extent. | Fixed; native integration regressions cover exact fits, nested aliases, siblings, invalid offsets and undersized copy sources |
| N2: JavaScript receives raw native addresses | `symbol_address.rs` returns an address; `bind.rs` accepts one. Runtime closure and decoded-callback paths transport pointers as integers. Opaque ownership and lifetime contracts must replace these together with their callers. | Open; requires a coordinated native/runtime migration |
| N3: native code owns binding policy | `register_class.rs` implements class, signal, interface and CSS policy; field and call codecs perform value conversion. Runtime must own the semantics while Rust retains the native memory and ABI operations. | Open; map and move one contract at a time |

The memory fix does not establish that unknown-size native pointers are bounded or that the entire native API is safe. Those contracts remain part of the native/FFI review.

N2 also includes numeric pointer inputs in `ffi/codec/buffer.rs` and decoded callback address pairs in `ffi/closure.rs`. Decoded callbacks do not participate in handle borrow-scope invalidation; runtime currently guards repeat invocation only for async-scoped callbacks. The replacement must model the native owner's lifetime and callback expiry, including a call-scoped callback retained by JavaScript after its invocation ends. Existing address tests establish the current integer API, not the required opaque safety contract.

N3 includes signal naming/accumulators, interface prerequisites and property overrides, CSS naming, object-construction policy, output-ref updates and recognition of async completion signatures. Wrapper identity policy must also be separated from the native toggle/finalizer mechanics that uphold lifetime safety. No concrete defect was identified in the reviewed initialization, shutdown, keep-alive or log-listener mechanics. Parent-death supervision serves real consumer subprocesses; its thread and fallback paths must be evaluated against that use case, not removed merely because they exist.

### Runtime call and callback path

Files read in `packages/runtime/src`: `arg.ts`, `bind.ts`, `callback.ts`, `closure.ts`, `fn.ts`, `folded-lengths.ts`, `native-value.ts`, and `tuple.ts`.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| R1: closure setup manipulates native addresses | `closure.ts` reads a C callback address as `biguint64`, resolves the generic marshal as a bigint, and passes those integers to native calls. `native-value.ts` receives `fnPtr`/`userData` integers and rebinds callbacks from them. These are the runtime callers for N2. | Open; migrate with the safe native pointer contract |
| R2: conversion ownership is split | `fn.ts` passes most inputs directly to native codecs, while `native-value.ts` separately converts collections, wrappers and callback values. Moving marshalling into runtime requires a single conversion path for arguments, returns, fields, callbacks and inout values. | Open; preserve generated binding behavior during migration |
| R3: callback shapes are weakly modeled | `callbackFromNative` casts the native result to a partial pointer pair and silently returns an unrecognized shape. `wrapCallback` checks whether its already function-typed parameter is callable. Model the actual boundary variants explicitly as part of callback migration. | Open; no behavior change made in this batch |

No new finding was identified in `arg.ts`, `bind.ts`, `folded-lengths.ts`, or `tuple.ts` during this initial pass beyond the shared contracts above. They still need review alongside all of their callers and relevant tests before closure.

### Codegen overrides

All 10 files in `packages/codegen/overrides` were read: `glib/index.ts.ejs`, `glib/regex.ts.ejs`, `gobject/index.ts.ejs`, `gobject/object-class.ts.ejs`, `gobject/object.ts.ejs`, `gobject/param-spec-getters.ts.ejs`, `gobject/param-spec.ts.ejs`, `gobject/value.ts.ejs`, `gtk/index.ts.ejs`, and `gtk/widget-class.ts.ejs`.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| C1: ParamSpec override implements behavior and duplicates types | The template owned branding, name types and wrapper construction. `runtime/src/param-spec-override.ts` now owns the implementation; `property-types.ts` supplies the shared name types used by registration. The template supplies its generated ParamSpec class to a typed runtime factory. | Fixed; generated imports/declarations and real class/interface/GType override behavior verified |
| C2: remaining templates contain executable adapters | Other templates still own receiver/handle conversion and wrapping instead of directly attaching runtime implementations. | Open; review and migrate each adapter with its generated consumer tests |
| C3: codegen redeclares shared descriptor information | `src/analysis/descriptor.ts` redeclares native `Ownership` and descriptor-name/type information. Some options also contain generation expressions, which must remain distinct from the underlying native descriptor fields. | Open; derive shared fields from their owner while retaining generation-only expression metadata |
| C4: override import lists are repeated | `src/store/gi/bootstrap.ts` and the GLib/GObject index templates repeat the override module lists. ESM caching prevents duplicate execution, but the lists can drift. | Open; establish a single generation source for the lists |

The GLib, GObject and GTK index templates already contain wiring only. Remaining executable adapters are in regex methods, object-class/widget-class peek methods, fluent object methods, ParamSpec getters and GValue methods. The override review found architecture and type-ownership violations, not an independently reproduced behavior defect in those templates.

Property-map extraction still has duplicated type logic between runtime registration and override typing. The canonical name types resolve the duplication addressed by C1; they do not close the rest of that type-model review.

Knip cannot follow the EJS template's use of the new runtime exports. `knip.json` therefore records the generated-only factory/type module alongside its existing exception for `runtime/src/internal.ts`. The generated consumer check verifies the actual use; no production fallback or artificial call site was added to satisfy the repository tool.

### Reconciler

Files fully read in `packages/react/src/reconciler`: `host-config.ts`, `instance.ts`, `node.ts`, `registry.ts`, `apply-props.ts`, `behaviors.ts`, `child-routing.ts`, `placement.ts`, `metadata.ts`, `signals.ts`, `root.ts`, `root-element.ts`, and `devtools.ts`.

Other files fully read in `packages/react/src`: `element-behaviors.ts`, `element-config.ts`, `bootstrap.ts`, `config.ts`, `index.ts`, `internal.ts`, all six files in `components`, and `hooks/use-presented-instance.tsx`. The review also covered `packages/codegen/src/react/element-config.ts`. Selected declarations in `prop-types.ts` and relevant integration tests were read for context; that does not close either file or the test suite. `style.ts`, `text.ts`, accessibility utilities and the remaining hooks are still pending.

| Finding | Evidence and consequence | State |
| --- | --- | --- |
| X1: nullable drag icon throws | `GtkDragSourceProps.icon` permits null, but the behavior dereferenced it. The behavior now models null and passes `setIcon(null, 0, 0)` to GTK. | Fixed; initial null and configured-to-null regressions passed with controller identity/attachment preserved; native fixture visually inspected |
| X2: host behaviors implement a separate lifecycle | `reconciler/registry.ts` exposes initialize/flush/teardown and per-node state. Deferred behaviors install signal watchers and microtask restoration for controlled selection/visibility. | Open; move composed effects into components/hooks, then remove unused host lifecycle machinery |
| X3: Sidebar behavior depends on native implementation details | `element-behaviors.ts` traverses native-created Sidebar descendants, unbinds models and disposes rows after mode changes. Part of `adw-navigation.test.tsx` also asserts that internal structure. | Open; establish the underlying ownership problem and repair its owning layer; moving the same traversal into a hook is insufficient |
| X4: element configuration has two different type models | React's `ElementConfig` omits `acceptedChildTypes`, added through an intermediate object. Codegen's `BuiltinElement` repeats the shape and adds that field. | Open; establish one canonical inert metadata type, then validate generated accepted-child information in a consumer |
| X5: whole-subtree teardown may retain non-widget attachments | `placement.ts` detaches during subtree teardown only when parent and child are widgets with the expected native parent. Controllers, action groups, actions and object-valued slots take another path. | Candidate; reproduce through retained public references and native attachment APIs before changing cleanup |
| X6: adopted page refs may become stale | Slot rebuilds replace native page objects and update `LazyNode.adopted`; stable public React refs may still reference the old object. | Candidate; compare keyed page refs with `stack.getPage(currentChild)` after insertion/replacement |
| X7: omitted drawing callback may stay installed | The shared `value` behavior skips undefined, including removal of the optional `drawFunc` prop. Existing drawing tests cover initial drawing and redraw. | Candidate; reproduce callback removal through a real drawing area |
| X8: host behavior composes additional objects | Menu descriptions recursively create `Gio.Menu` objects; other behaviors create implicit row wrappers and layouts. | Open; separate declarative composition from native host-instance construction and attachment |
| X9: custom-element tests assert internals | Part of `custom-elements.test.tsx` invokes behavior hooks directly and checks consumed prop-name arrays/config merging. | Open; replace these assertions with observable rendering, updating and unmounting of a consumer element |

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
| Workspace typechecking | `mise exec -- pnpm typecheck` passed |
| Workspace lint | 64 tasks passed on the first run; Knip's generated-export finding was corrected in repository configuration and its target passed on rerun |
| Final sanitizer target | `mise exec -- env GTKX_MAX_WORKERS=2 pnpm exec nx run @gtkx/e2e:test:asan` passed 322 addon tests and 480 generated binding tests; the normal native binary was restored afterward |
| Sanitizer tooling checks | ESLint and TypeScript passed for the expanded runner; whitespace checks passed for all changes |
| Independent diff review | Native bounds and ParamSpec factory changes reviewed independently, including widths, alias ownership, copy sources, generic typing and ESM initialization; no blocking findings |
| Audit inventory | Counts checked against all 22 packages and 1,286 tracked package files at `c7f7134b` |

The sanitizer target now runs the native addon and generated binding fixture suites through their own configs. Its Nx inputs include the addon tests/config/entry files so changing a regression invalidates the cached sanitizer result. This keeps the new memory-boundary regressions in CI's sanitizer lane. The normal addon is rebuilt in the runner's existing `finally` block.

## Next work

N1, C1 and X1 are fixed and validated. The next batch covers the remaining native handle and FFI folders, starting with the opaque pointer and callback lifetime contract shared by N2 and R1. Reproduce X5–X7 through public APIs before choosing their fixes. Use the codegen and reconciler findings to plan the dependent migrations without marking those packages complete prematurely.
