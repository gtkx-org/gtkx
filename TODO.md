# GTKX v1 — Production Readiness Plan

Seven architectural goals to land before v1. Phases 1–3 are complete and verified; the remaining
phases follow hard dependencies: the data-table conversion (Phase 4) precedes the children→props
migration (Phase 5), which precedes the per-namespace entrypoint split and the optional-library
unmerge (Phase 6), with documentation and the release gate last (Phase 7). This branch is
`feat/v1`: replaced mechanisms are removed outright, with no dual-path compatibility windows.

## Goals

1. `gtkx.config.ts` is exported (resolved) as `virtual:gtkx-config` — the canonical channel for
   app-specific config in all private packages. `applicationId` flows through it and is the
   default value of the `applicationId` prop on `GtkApplication`/`AdwApplication`.
2. `elementMap`, `arrayProps`, `slots`, `containerSlots` all flow from `gtkx.config.ts`
   (built-ins always merged in front), as **data only**. The reconciler imports
   `virtual:gtkx-config` and uses them directly.
3. Non-container child handling becomes containerSlot props of GObject elements
   (`<GtkButton addController={<><GtkGestureClick /></>} />`). Children are reserved for actual
   containers (`GtkBox`, …, including virtual ones like `GMenu`).
4. Optional namespaces are isolated by the module graph: namespace-dependent richness lives in
   dedicated packages (`@gtkx/animate` value-imports `@gtkx/gi/adw`), everything else is native
   GObject elements driven by data rows. The reconciler core stays namespace-blind data
   interpretation, optional-namespace table rows are inert string-keyed data, and optional
   libraries are genuinely optional — no force-merged defaults, no virtual module, no runtime
   presence detection.
5. All HOCs and the base React runtime live in `@gtkx/react`; `@gtkx/jsx/*` modules depend on
   them one-directionally, exactly as `@gtkx/gi/*` depends on `@gtkx/ffi`.
6. `@gtkx/react-gi` is renamed to `@gtkx/jsx`.
7. The codegen overlay system is removed entirely; generated packages use only runtime helpers
   exposed by `@gtkx/ffi` and `@gtkx/react`.

## Verified current state

- Phases 1–3 are complete (see their checklists): `virtual:gtkx-config` serves the resolved
  config through the shared `@gtkx/config` renderer; the store is `@gtkx/gi` + `@gtkx/jsx`; the
  overlay is gone — override templates live in `packages/codegen/src/templates/<ns>/`, GL is the
  hand-written `@gtkx/gl` package, and `@gtkx/ffi` owns the non-introspectable helpers
  (`@gtkx/ffi/cairo`, listener tracking).
- Audit (2026-06-10, four-agent sweep of `packages/react/src`): **zero value-level imports of
  optional namespaces** (Adw, GtkSource, WebKit) exist anywhere in `@gtkx/react`. Every
  occurrence is `import type` — `gtype-predicates.ts:2,4`, `jsx.ts:1,9`, `web-view.tsx:1-2`,
  `use-widget-animation.ts:1`, `array-props.ts:17`, `element-map.ts:14`, `top-level.tsx:1`,
  `text-buffer-controller.ts:4,6`, `list.tsx:1,3`, `list-controller.ts:1`,
  `prop-descriptor-table.ts:14` — and `package.json` declares no `@gtkx/gi`/`@gtkx/jsx`
  dependency in any field; type resolution rides the `.gtkx` store symlinks.
- Runtime optional-namespace access goes through two namespace-agnostic mechanisms: the
  `hasType` predicates walking the live GType registry (an unloaded namespace contributes no
  ancestry names, so guards are correctly false) and `requireClassByName` → the ffi class
  registry, throwing a clear import-the-namespace error. Intrinsic element names are plain
  strings resolved at `createInstance` (`"AdwComboRow"`, `"WebKitWebView"`). No namespace-level
  function is called anywhere (no `Adw.init`); enum values arrive as numbers from callers.
- The `WebKitWebView` HOC exists only to connect `load-changed` directly, bypassing commit-time
  signal blocking; under the freeze mechanism that protects against nothing. Every block window
  (`withSignalsBlocked` around each `commitUpdate`, `host-config.ts`) sits inside
  `freeze()`…`unfreeze()`, and a frozen GLib thread runs `run_freeze_loop`
  (`packages/native/src/dispatch.rs`), draining mailbox tasks without iterating the main loop —
  async-source signals (WebKit's IPC-driven `load-changed` included) cannot be dispatched while
  handlers are blocked. Only synchronous side effects of the commit's own mutations fire inside
  a block window, which is what the `LIFECYCLE_SIGNALS` exemption (`signal-store.ts`) covers.
  The generated `onLoadChanged` signal prop is therefore equivalent (the signal store already
  swaps handlers without reconnecting); Phase 6 deletes the HOC instead of moving it.
- Every optional-namespace table entry is expressible in the D2 verb vocabulary
  (`AdwToggleGroup` toggles are native `<AdwToggle>` children attached by a method-verb row;
  `AdwAlertDialog.responses` is a multi-call add row; the stack `page` prop is a guarded
  setter; top-level recognition is a GType-name list; `PAGE_META_SETTERS` is already duck-typed
  data). Exactly two touch points are code-shaped: the stateful stack-page attach (the attach
  call returns a page handle later meta setters target — stays interpreter code per the locked
  direction) and the text-buffer GtkSource integration, which dissolves in Phase 5 (T5.7) by
  making the buffer a regular element.
- `GtkSource-5.gir` defines `language`, `style-scheme`, `highlight-syntax`,
  `highlight-matching-brackets`, and `implicit-trailing-newline` as GObject properties and
  `cursor-moved`/`highlight-updated` as signals on `GtkSource.Buffer` (Gtk defines
  `enable-undo` on `GtkTextBuffer`), so a buffer element's generated bindings already carry the
  entire surface the `GtkSourceView` HOC re-types. The HOC's only abstractions are the
  string→object manager resolution and the `highlightSyntax` cross-prop default — both dropped
  deliberately: apps call `LanguageManager`/`StyleSchemeManager` themselves, and GTK's own
  property defaults apply.
- `resolveLibraries` (`packages/cli/src/codegen/library-resolver.ts`) still force-merges
  `DEFAULT_LIBRARIES = [Gtk-4.0, Adw-1, GtkSource-5, WebKit-6.0]`, existing precisely so the
  react type-only imports and `jsx.ts` augmentations always resolve. Phase 6 removes both the
  type coupling and the merge.
- `@gtkx/react` → `@gtkx/jsx` coupling: five `declare module "@gtkx/jsx/…"` augmentation blocks
  (`packages/react/src/jsx.ts:926-1022`; only the gtksource and adw blocks target optional
  namespaces) plus type-only Props imports. Phase 6 inverts them.
- `element-map.ts` value-imports Gtk, Gsk, and Graphene — all mandatory (Gsk and Graphene are in
  Gtk-4.0's GIR closure). Phase 4's data conversion reduces these toward zero `@gtkx/gi` imports
  in the reconciler core.
- The website docs are stale: `website/docs/getting-started.md` still imports intrinsics from
  `@gtkx/react`. Phase 7 rewrites them for the final import model.
- CI/publish scripts (`scripts/publish.ts`, `ci-asan.sh`, `ci-miri.sh`, `ci-bench.sh`) are
  unaffected by the remaining phases.

## Decisions

- **D1 — Config loader home.** Resolved (Phase 1): `@gtkx/config` leaf package owns
  `GtkxConfig`, `defineConfig`, validation, the c12 loader, and the virtual-module renderer;
  `@gtkx/cli` re-exports `defineConfig`.
- **D2 — Data verb vocabulary (goal 2).** Extend the `attach-rules.ts` schema (`MethodVerb`,
  `VerbArgs`, `detachGuard`) into the single serializable vocabulary for all tables. Required
  shapes, all strings and finite conditions: method names + argument shapes from element fields,
  getter-based guards, guarded setters (`call` + presence condition + skip-when-getter-equals +
  require-getter-truthy), construct-by-name rows (GType-name string + setter map + attach
  method), multi-call add rows, an ordered-insert shape (`insertColumn` position-from-anchor),
  and a returned-handle shape (attach call returns a handle stored in attach state; later meta
  setters target it; detach guards on attachment). Whatever cannot be expressed in that
  vocabulary is not config data — it becomes an enhanced component in `@gtkx/react` (per the
  locked dumb-reconciler direction), never a closure in a table.
- **D3 — No `virtual:gtkx-libs`.** Resolved: dropped. The audit showed optionality is a
  build-time configuration concern with no runtime-capability component: `@gtkx/react` already
  has zero value imports of optional namespaces, and a build-time virtual module would duplicate
  what the module graph expresses directly. Optional namespaces are isolated by per-namespace
  entrypoints (goal 4); optional table rows are inert string-keyed data (a row keyed by
  `"AdwToggleGroup"` never matches in an app that never registers that GType, at zero cost);
  failures surface at import resolution instead of runtime throws.
- **D4 — Stop force-merging `DEFAULT_LIBRARIES`.** Resolved direction, lands in Phase 6 (T6.6),
  strictly after the type-level decoupling: only `Gtk-4.0` and its GIR-transitive closure stay
  mandatory.
- **D5 — GL namespace ownership post-overlay.** Resolved (Phase 3): standalone hand-written
  `@gtkx/gl` package depending on `@gtkx/ffi` only.
- **D6 — Store directory rename.** Resolved (Phase 2): `node_modules/.gtkx/jsx`.
- **D7 — Config key naming.** Rename `widgetSlots` → `slots` in the v1 cutover (validation
  errors name the new key), and add the new `elementMap` and runtime-`arrayProps` keys
  alongside. Lands in Phase 4.
- **D8 — Disposition of remaining wrapper kinds (goal 3 scope).** Controllers, layout managers,
  shortcuts, actions, and action groups move to props. Pages (`GtkStackPage`,
  `GtkNotebookPage`), layout children (`GtkGridChild`, `GtkFixedChild`), overlay children,
  `GtkColumnViewColumn`, and `GMenu`/`GMenuItem` remain children — their parents are actual
  containers (of pages, positioned children, overlays, columns, items). Their longer-term
  conversion to native GObject elements is the locked dumb-reconciler direction and tracked
  there, not in this plan.
- **D9 — User-facing surface for namespace-specific enhanced components.** The animation
  components ship as their own package: apps import `AnimatePresence`, `AdwTimedAnimation`,
  and `AdwSpringAnimation` from `@gtkx/animate`. The one remaining namespace-specific enhanced
  component in `@gtkx/react` is `AdwComboRow` (list machinery); whether `@gtkx/jsx/adw`
  re-exports it — and whether the Gtk enhanced components (`GtkColumnView`, `GtkMenuButton`, …)
  move behind `@gtkx/jsx/gtk` for symmetry — is settled when Phase 6 starts.

## Phase 1 — Goal 1: `virtual:gtkx-config` as the resolved config channel

The component-side defaulting already works; this phase is plumbing consolidation.

- [x] **T1.1** Create `@gtkx/config` (per D1): `packages/cli/src/config.ts` and
      `packages/cli/src/codegen/config-loader.ts` moved there (`config.ts`, `loader.ts`,
      `virtual.ts`); `@gtkx/cli` re-exports `defineConfig`. New exports: `ResolvedGtkxConfig`,
      `resolveGtkxConfig`, `loadResolvedGtkxConfig`, `createGtkxConfigLoader` (memoizing),
      `renderGtkxConfigModule`, the virtual-module ids, and the shared ambient declaration
      `@gtkx/config/virtual`. `.dependency-cruiser.cjs` gained the `config-no-workspace-deps`
      leaf rule; `knip.json`, root `vitest.config.ts` coverage, and `AGENTS.md` updated.
- [x] **T1.2** `virtual:gtkx-config` exports the **resolved config** as a `config` constant
      (every `GtkxConfig` field normalized), keeping the metadata re-export until Phase 4
      replaces it. All servers render through `renderGtkxConfigModule`; the ambient declaration
      lives in `@gtkx/config/virtual` (referenced by `@gtkx/react`, `@gtkx/cli/env`), replacing
      the per-package copies that would conflict in multi-package TypeScript programs.
- [x] **T1.3** `packages/vitest/src/plugin.ts`: loads the project's real `gtkx.config.ts` via
      `@gtkx/config` lazily on the module's first request (so the combined `gtkx()` pipeline,
      whose `gtkx:config` plugin shadows it, never triggers a second load); empty resolved
      config when none exists.
- [x] **T1.4** `packages/testing/src/render.tsx`: the harness application keeps its fixed
      `org.gtkx.testing` id on purpose. The application component under test already defaults to
      the configured id, and two same-id `Gtk.Application` instances in one process collide on
      the D-Bus object path GTK derives from the id (menubar export breaks — verified against
      gtk-demo's menu-activation tests).
- [x] **T1.5** Duplicate config loads collapsed: `gtkxVitePlugins()` creates one
      `createGtkxConfigLoader()` shared by `gtkxConfig`, `gtkxResources`, and
      `gtkxReactCompiler` (each still defaults to its own loader for standalone use).
- [x] **T1.6** Dev runner / MCP registration: a live `Gio.Application` still gates MCP startup,
      and the registered identity is the config `applicationId` when declared, else the live id
      (`getConfiguredApplicationId` on `DevRunnerDeps`).
- [x] **T1.7** Templates: `app.tsx.ejs` renders `<GtkApplication>` with no `applicationId` prop;
      `claude/SKILL.md.ejs` and `claude/EXAMPLES.md.ejs` snippets updated and documented as
      config-defaulted; `gtkx.config.ts.ejs` keeps the entry.
- [x] **T1.8** Examples: `hello-world`, `tutorial`, `browser`, `gtk-demo` declare
      `applicationId` in `gtkx.config.ts` and render their application components without the
      prop. New coverage in `examples/gtk-demo/tests/application-id.test.tsx` proves the config
      default and the explicit-prop override through the real virtual-module pipeline. The
      gtk-demo menu-activation tests were also corrected to activate `win.`-prefixed actions,
      matching the menubar's own `action="win.X"` entries (the actions attach to the window).

Exit (verified 2026-06-10): `pnpm build` 18/18, `pnpm test` 25/25 (gtk-demo 666 tests),
`pnpm typecheck` 21/21, `pnpm lint` clean (biome, knip, knip --production, depcruise, cargo
fmt/clippy), jscpd 0 clones across the touched packages.

## Phase 2 — Goal 6: rename `@gtkx/react-gi` → `@gtkx/jsx`

Mechanical, done early so all later work is written once against the final name. 251 occurrences
across 173 files; the checklist below covers the places a find-replace misses or breaks.

- [x] **T2.1** Codegen: `react-gi-store.ts` renamed to `jsx-store.ts` (manifest name,
      self-symlink, store writer), hard-coded specifiers in `react/imports.ts`, pipeline docs,
      and the internal identifiers (`ReactGiImports` → `JsxImports`, `generateReactGiFiles` →
      `generateJsxFiles`, `writeReactGiStore` → `writeJsxStore`, the `CodegenRunner` `reactGi`
      option → `jsx`, …) plus the codegen integration tests.
- [x] **T2.2** Store directory renamed to `node_modules/.gtkx/jsx`; `run-codegen.ts` and
      `store-resolver.ts` (`jsxStoreDir`/`jsxLinkDir`, pruning paths) and their tests updated;
      `AGENTS.md`/`CLAUDE.md` architecture and store docs updated.
- [x] **T2.3** `packages/vitest/src/plugin.ts`: doc text and the `server.deps.inline` regex
      (now `@gtkx\/(ffi|gi|react|jsx|testing|css)`); the virtual-module source updates via the
      shared `@gtkx/config` renderer.
- [x] **T2.4** The metadata specifier lives in `@gtkx/config`'s `renderGtkxConfigModule`
      (`@gtkx/jsx/metadata`) with its test; `packages/cli/env.d.ts` carries no package
      reference.
- [x] **T2.5** `packages/react/src/jsx.ts`: the five `declare module "@gtkx/jsx/…"` blocks —
      specifier change only; Phase 6 removes the blocks.
- [x] **T2.6** `knip.json` workspace entry is `.gtkx/jsx`; `.dependency-cruiser.cjs` has no
      name-based pattern for the generated package, so no change was needed.
- [x] **T2.7** CLI templates (3 files), all examples, `packages/e2e`, `packages/testing`,
      `@gtkx/react` type imports and `requireClassByName` error text, `AGENTS.md`/`CLAUDE.md`.
      Website docs and README contain no occurrences (their import-model rewrite is Phase 7).
- [x] **T2.8** Gate (verified 2026-06-10): `grep -rn "react-gi\|reactGi\|ReactGi"` over the
      repo (excluding `TODO.md`, which documents the rename) returns nothing, including file
      names and `pnpm-lock.yaml`; store regenerates as `.gtkx/jsx` with manifest `@gtkx/jsx`;
      `pnpm build` 18/18, `pnpm test` 25/25, `pnpm typecheck` 21/21, `pnpm lint` clean, jscpd
      0 clones.

## Phase 3 — Goal 7: remove the overlay folder and its separate typecheck project

Redesigned direction: the `overlay/` folder and the in-memory typecheck project disappear.
Override sources stay part of codegen, relocated under `packages/codegen/src/templates/` as
**template files** — raw `.ts` assets the generator embeds into the store, excluded from
codegen's own TS program, validated downstream when CLI-compiled output is consumed and by the
integration tests. GL is not GI at all and becomes its own hand-written package. `@gtkx/ffi`
becomes the home of non-introspectable functions plus shared runtime helpers for all GI
packages (à la tslib), so templates are thin glue importing only `@gtkx/ffi` and generated
modules — never `@gtkx/native` — which lets the depcruise carve-out die.

- [x] **T3.1** New `@gtkx/gl` workspace package (`packages/gl`) from `overlay/gl/{gl,constants}.ts`
      (hand-written, no GIR backing; depends on `@gtkx/ffi` only). `gl.test.ts` moved from
      `packages/ffi/tests/gl/` (38 tests pass against a realized `GLArea`); the gtk-demo OpenGL
      demos import `@gtkx/gl` with the workspace dependency added; knip workspace entry
      (entry exports unreported — the bindings surface is intentionally wider than monorepo
      usage), root coverage include, `AGENTS.md` package table.
- [x] **T3.2** `@gtkx/ffi` gained the non-introspectable helpers:
      - `@gtkx/ffi/cairo` subpath: descriptor constants, glyph/cluster buffer allocators,
        `parsePath` (ffi's own ABI-stable path-data-type codes — the `PathData` surface was
        already string-tagged so nothing user-visible changed), extents readers,
        `cairoVersion`/`cairoVersionString` (tagged `@public`; consumed through the embedded
        barrel), plus re-exports of `alloc`/`call`/`read`/`write` and the
        `NativeHandle`/`FfiType` types so no template imports `@gtkx/native`.
      - `listeners.ts` in the main barrel: WeakMap listener tracking +
        `disconnectSignalHandler` backing `on/once/off/disconnect`.
      - biome naming-convention overrides extended to `cairo.ts` and `listeners.ts`.
- [x] **T3.3** Override templates live at `packages/codegen/src/templates/<ns>/`
      (cairo, gdk, gobject, graphene, gtk), authored in FINAL emitted form — barrels reference
      `./<ns>.js` and `./overrides/<name>.js` directly, so `retargetBarrelSpecifier`,
      `barrelNeedsGenerated`, and the standalone-overlay machinery are deleted. The gobject
      template delegates to the ffi listener helpers; cairo templates import
      `@gtkx/ffi/cairo`. `gi-store.ts` reads `TEMPLATE_ROOT` under `src/templates` (resolves
      from both `src/` and `dist/` execution since `src` ships); the emitted subdirectory is
      `overrides/`; `dsl/context.ts` bootstrap imports follow. `typecheck-store.ts` and the
      `writeStore` `validate` hook are deleted; `transpileDeclaration`'s error reporting stays
      as the syntactic safety net. `patches/typescript@6.0.3.patch` stays: it guards
      module-specifier resolution inside declaration emit, which the redesign keeps using.
- [x] **T3.4** Config sweep done: codegen `files` drops `overlay`; codegen `tsconfig.lib.json`
      excludes `src/templates`; knip codegen project negates `src/templates/**`; biome override
      path moved to `packages/codegen/src/templates/**`; `turbo.json` typecheck inputs dropped
      the overlay entries; `.dependency-cruiser.cjs` deleted the `(?!overlay/)` carve-out
      (`codegen-native-type-only` now covers all of `packages/codegen/`) and updated the header;
      `sonar-project.properties` exclusions retargeted to the templates directory; root vitest
      coverage excludes the templates (embedded assets execute under store paths).
- [x] **T3.5** `packages/codegen/overlay/` is gone (every file `git mv`/`git rm`'d); the store
      regenerates with `overrides/` directories and no `gl` namespace. The template surface is
      covered by the existing suites (`packages/ffi/tests`: cairo 1070-line suite,
      gobject object/signals/value, gtk-constants; `packages/gl/tests`; gtk-demo drawing and
      css-editor tests through the store).

Exit (verified 2026-06-10): `packages/codegen/overlay/` and `typecheck-store.ts` deleted; no
file under `packages/codegen/src` imports `@gtkx/native` (depcruise enforces it with no
carve-out); `pnpm build` 19/19, `pnpm test` 27/27 tasks, `pnpm typecheck` 22/22, `pnpm lint`
clean, jscpd 0 clones across ffi/gl/codegen.

## Phase 4 — Goal 2: tables flow from config as data

The built-in tables are data owned by codegen; the React pipeline merges them in front of the
project's config rows and bakes the result into the generated `@gtkx/jsx/metadata` module, so
the reconciler receives every table pre-merged through `virtual:gtkx-config` — the same channel
as `SIGNALS`/`DEFAULT_PROPS` — and interprets rows without merging anything itself. Rows keyed
by optional-namespace GType names (`"AdwToggleGroup"`, `"AdwAlertDialog"`, `"AdwDialog"`,
`"AdwViewStack"`) are inert when the type never registers, so they cost nothing in a Gtk-only
app. The vitest plugin stays thin (its virtual module re-exports the same metadata) and
framework-internal tests get built-ins automatically.

- [x] **T4.1** Serializable schema per D2: every row type lives in `@gtkx/config`
      (`src/table-schema.ts` — `ElementMapRule` with `method`/`orderedInsert` verbs,
      `ArrayPropRow` with `clear`/`remove`/`add`/`construct`/`set`/`appendOnce` verbs,
      `CallStep`/`CallArg`/`ConstructStep`, presence conditions, plus the built-in-only shapes:
      `PropRule` setter groups and signal rows, `AddMethodRule`, `PageMetaSetter`) next to the
      validators for the config-extensible subset.
- [x] **T4.2** Built-ins converted:
      - `ATTACH_RULES` → `BUILT_IN_ELEMENT_MAP`, including the column row as an
        `orderedInsert` verb (`insertColumn`/`removeColumn`/`getColumns`).
      - The column machinery left the core entirely: `GtkColumnViewColumn` constructs
        generically (the component passes the cell factory and optional sorter as construct
        props — the bespoke path in `construct.ts` is gone), the `ColumnViewColumn` component
        registers its `ColumnController` on the list controller shared through a column-view
        React context, and `GtkColumnView` subscribes to the new `attach-events.ts`
        ordered-insert notifications to coalesce column settles. The GObject-keyed
        `column-view-registry.ts` is deleted.
      - `ARRAY_PROPS` → data rows (multi-call add for `AdwAlertDialog.responses`); the
        `instanceof`/predicate guards dropped. `AdwToggleGroup` toggles are not an array prop
        at all: `<AdwToggle>` is a native GObject child attached by a built-in method-verb
        element-map row (`add`/`remove`), so the `ToggleProps` item type is gone and the
        construct-by-name verb remains config-only vocabulary.
      - `PROP_DESCRIPTOR_TABLE` → `BUILT_IN_PROP_RULES` (toggle-group selection, stack `page`
        guarded setter, `GtkTextTag` setters, `GtkWindow` `onClose` signal row). Dialog-button
        and action behavior became codegen compound HOCs from `@gtkx/react` — `withColorDialog`,
        `withFontDialog`, `withActionAccels`, `withActionScope` — wired by ancestry in
        `compounds.ts` (`COMPOUND_HOC_RULES`), so app imports stay `@gtkx/jsx/<ns>`. Action
        accelerators resolve their scope through `ActionScopeContext` provided by
        `withApplication` (`app`), `withApplicationWindow` (`win`), and `withActionScope`
        (the group's `prefix`). The `GtkSourceView` row stays until T5.7; the text factories
        remain the designated exception. The unused `registerTeardown`/`Instance.teardown`
        plumbing and the `isAdwViewStack`/`isAdwToggleGroup`/`isAdwAlertDialog` predicates are
        deleted.
      - Top-level recognition is the `TOP_LEVEL_TYPES` list via `hasType`;
        `META_OBJECT_ADD_METHODS` carries the per-GType page-add priority rows while the
        returned-handle mechanics stay in the meta-object interpreter; `PAGE_META_SETTERS`
        moved to the tables module unchanged.
      - The built-in tables and merge helpers live in `packages/codegen/src/react/tables.ts`
        (the data-only successor of the deleted `slots.ts`).
      - Stateful wrapper mappings stay interpreters in `element-map.ts`; menus and text-buffer
        stay code per the locked direction. The shared `callMethod` reflective dispatch lives
        in `nodes/internal/reflect-call.ts`.
- [x] **T4.3** `GtkxConfig`: `widgetSlots` → `slots` (D7), `elementMap` added, `arrayProps`
      rows carry `itemType` + runtime verbs; validators with path-precise errors and tests.
- [x] **T4.4** The built-in tables flow from codegen to the reconciler through
      `virtual:gtkx-config`: the React pipeline merges them with the project's config rows and
      bakes the result into the generated `@gtkx/jsx/metadata` module
      (`ELEMENT_MAP`/`ARRAY_PROPS`/`PROP_RULES`/`TOP_LEVEL_TYPES`/`META_OBJECT_ADD_METHODS`/
      `PAGE_META_SETTERS`/`SLOTS`/`CONTAINER_SLOTS`, declared in `@gtkx/config/virtual`), the
      same channel as `SIGNALS`/`DEFAULT_PROPS`. `attach-rules.ts`, `array-props.ts`,
      `prop-descriptor-table.ts`, and `element-map.ts` import the merged tables from the
      virtual module; the hard-coded closures are gone, `element-map.ts` sheds its Adw type
      imports and predicates (`hasType` row conditions), and Gtk/Gsk/Graphene value imports
      remain inside the stateful interpreters. The store fingerprint mixes in the serialized
      table config (`serializeUserTables`), so editing `slots`/`containerSlots`/`arrayProps`/
      `elementMap` in `gtkx.config.ts` regenerates the store.
- [x] **T4.5** Codegen owns the built-ins outright and reads its own `react/tables.ts` for
      Props emission (`row.itemType`), compounds, and the metadata bake; it depends on
      `@gtkx/config` for the row types and never on `@gtkx/react`
      (`.dependency-cruiser.cjs` enforces `codegen-no-react`).
- [x] **T4.6** No e2e rewrite was needed: no test or bench references the converted internals,
      and the behavior-level suites pass unchanged against the table dispatch (e2e 640, full
      run 27/27 tasks). CodSpeed baselines may still shift; annotate the bench run when CI
      reports.
- [x] **Defect fixed en route:** unmounting a menu re-inserted its items submenu-less into the
      live model for an instant (GTK menu trackers react to `items-changed` synchronously
      inside the commit), making `GtkPopoverMenuBar` warn "Don't know how to handle this item"
      — reproduced on the unmodified tree in a clean worktree. `menu-attach.ts` now defers
      item re-snapshots to the commit flush (`scheduleMenuItemResnapshot`, coalesced per item,
      skipped for items not yet in a menu): by flush time a removed item has left its menu and
      a surviving item's props and links are final.
- [x] **Refinements:** `createApplication` renamed to `withApplication`, matching every other
      compound HOC. `AdwToggleGroup` toggles became native `<AdwToggle>` children (e2e suite
      and the tutorial migrated; live `Adw.Toggle` objects make prop updates plain property
      sets). The animation machinery moved to the new `@gtkx/animate` package —
      `AnimatePresence`, `AdwTimedAnimation`, `AdwSpringAnimation`, the animatable-property
      types, and the CSS driver — which value-imports `@gtkx/gi/adw` directly (the
      `requireClassByName` lookups and `as typeof` casts are gone) and depends on `@gtkx/react`
      only for the now-public `useMergedRefs`; e2e, the tutorial, and the tutorial docs import
      from `@gtkx/animate`.
- [x] **Second defect fixed en route:** under parallel load, virtualized cell binds delivered
      on GTK's frame pacing flushed portal re-renders after a test helper had returned,
      tripping React's not-wrapped-in-act warning (present at HEAD at lower volume; the column
      context rewrite amplified it). `@gtkx/testing` now settles inside its helpers: `act`
      runs its callback (synchronous throws still propagate synchronously), then awaits a few
      `GLib.PRIORITY_DEFAULT_IDLE` round-trips — each firing after pending layout and redraw —
      with a macrotask drain per round, all within the act scope; `waitFor`'s `asyncWrapper`
      performs the same settle before restoring `IS_REACT_ACT_ENVIRONMENT`. `settle` is
      exported for GTK calls made outside any helper. Full turbo runs now report zero act
      warnings (previously 17).

Exit (verified 2026-06-10): a user config adding `elementMap`/`arrayProps`/`slots`/
`containerSlots` rows works end-to-end with no codegen package patching (validators + merge
helpers + interpreters covered by config/codegen tests); no closure carrying behavior remains
in any table; `pnpm build` 19/19, `pnpm test` 27/27 tasks (e2e 640, zero GTK warnings),
`pnpm typecheck` 22/22, `pnpm lint` clean (biome, knip ×2, depcruise 588 modules), jscpd 0
clones across react/config/codegen/cli.

## Phase 5 — Goal 3: children → containerSlot props

Builds on Phase 4's tables: a containerSlot prop is a table row; the compound layer renders the
prop value into the existing `container-slot` wrapper.

- [x] **T5.1** The container-slot interpreter in `element-map.ts` handles GObject children: it
      tracks wrapper child instances, attaches each through the first matching element-map data
      rule (`addController`, `insertActionGroup` with the child's `prefix`, `addShortcut`,
      `addAction`) or the wrapper's method for plain widgets, and detaches through the rule's
      verb (falling back to `unparentWidget` for rule-less widgets). Fragment support, ordering,
      and idempotent re-attach kept (`attachState` now stores instances).
- [x] **T5.2** Promoted: `addController` and `insertActionGroup` on `GtkWidget` (every widget
      inherits them), `addShortcut` on `GtkShortcutController`, `addAction` on
      `GtkApplicationWindow`, and `layoutManager` as a `GtkWidget` slot (setter semantics, raw
      property + notify suppressed). Slot tables are subtree-scoped: a row keyed by a type
      applies to its whole GType subtree. `GtkApplication` is deliberately NOT promoted —
      app-level actions render into the application container, which has no JSX element to
      carry a prop, so they stay children (as do `GSimpleAction` children of
      `GSimpleActionGroup`). Naming follows the GTK method.
- [x] **T5.3** `createWidgetComponent(elementName)` in `@gtkx/react` resolves an element's slot
      surface at first render by walking the registered class's GType ancestry (`classHasType`)
      against the merged `SLOTS`/`CONTAINER_SLOTS` from `virtual:gtkx-config`, splits slot- and
      container-slot props into metadata wrapper children, and forwards the rest to the
      intrinsic. Codegen emits one annotated line per element
      (`export const GtkButton: (props: GtkButtonProps) => ReactNode =
      createWidgetComponent<GtkButtonProps>("GtkButton")`), HOC-wrapped where classified;
      per-widget component bodies, intrinsic consts, and the unused `WidgetSlotNames` type are
      gone. Virtual subcomponents (`GtkStackPage`, …) still own their names. Hand-written
      enhanced components (`GtkDrawingArea`, the list family, `WebKitWebView`) render their
      hosts through the same factory, so promoted props work on them too; `ColumnViewColumn`
      dropped its manual `headerMenu` wrapper in the process.
- [x] **T5.4** A promoted-nesting guard mapping sits ahead of the data rules: when a data rule
      matches a `(child, parent)` pair AND a slot/containerSlot prop covers that rule on the
      parent's GType chain (container slots match the verb's attach method; slots match the
      property a `set<Prop>` attach method writes), attaching throws
      `<X> cannot be a child of <Y>: pass it through the \`prop\` prop instead.` Relationships
      without a prop surface — `GtkTextBuffer` under a text view, project `elementMap` rows —
      keep attaching as children.
- [x] **T5.5** Kept as children per D8: stack/notebook pages, grid/fixed layout children,
      overlay children, `GtkColumnViewColumn`, `GMenu`/`GMenuItem`, transparent wrappers, text
      kinds.
- [x] **T5.6** All usage sites migrated: 21 gtk-demo files + the tutorial app (controllers,
      shortcuts, constraint layouts, window actions, action groups), 7 e2e suites + helpers,
      `@gtkx/testing` user-event tests, website docs (getting-started, tutorial 4 and 8), the
      CLI's `WIDGETS.md.ejs` template, and the `@gtkx/react` JSDoc examples.
      `MISSING_LAYOUT_MESSAGE` reworded for the `layoutManager` prop shape. Two defects found
      and fixed en route: (1) a layout-child wrapper attached while the host still carried its
      default layout manager never bound — the `layoutManager` slot write now re-runs the
      parent's layout-child wrapper attaches (`resyncLayoutChildWrappers`); (2) enhanced
      components spread `{...rest}` onto raw intrinsics and dropped promoted props — fixed by
      rendering their hosts through `createWidgetComponent`.
- [x] **T5.7** `GtkTextBuffer`/`GtkSourceBuffer` are regular elements: a built-in method-verb
      row (`setBuffer`/`setBuffer(null)` with a parent `getBuffer` detach guard) attaches a
      buffer child to any `GtkTextView`; content (text runs, `GtkTextTag`, anchors, paintables)
      nests under the buffer element, and bare text children are otherwise allowed only in
      labels. The buffer props and signals are the generated GIR surface; the `TextBufferProps`
      and gtksource `jsx.ts` augmentations, the view-level buffer prop rules, the GtkSource
      references in `TextBufferController`, and the `isGtkSource*` predicates are deleted;
      `source-viewer.tsx` and the source-view/text-view suites migrated.

Exit (verified 2026-06-11): `grep` over examples finds no controller/layout-manager/action
elements nested as children; gtk-demo gesture, constraint, hypertext, and source-viewer flows
work (gtk-demo 666/666); full gates green — `pnpm build` 20/20, `pnpm test` 28/28 (e2e 671,
zero act warnings), `pnpm typecheck` 33/33, `pnpm lint` clean (biome, knip ×2, depcruise 605
modules).

## Phase 6 — Goals 4 + 5: type decoupling; optional libraries genuinely optional

Optionality is enforced by the module graph. Adw-dependent richness lives in its own package —
`@gtkx/animate` value-imports `@gtkx/gi/adw` directly (fully typed, no `requireClassByName`,
no `as typeof` casts) and only apps that use animations install it — while `@gtkx/react` keeps
the namespace-agnostic runtime plus registry-driven list machinery. No `@gtkx/react/<ns>`
subpath entrypoint exists or is planned: every candidate dissolved (animations → package,
toggles and source view → native GObject children, dialog buttons and actions → data rows +
compound HOCs, web view → generated signal prop). This phase completes the decoupling at the
type level and makes optional libraries genuinely optional.

- [ ] **T6.1** Delete `web-view.tsx`: the freeze loop precludes async-signal dispatch during
      commits, so the generated `onLoadChanged` prop on the intrinsic `WebKitWebView` element
      is equivalent to the HOC's direct connection. `examples/browser` migrates to the
      intrinsic; the callback receives the GIR signal signature, with the view reachable
      through a ref.
- [ ] **T6.2** Invert the Props typing (goal 5): base prop shapes are declared in `@gtkx/react`
      and the generated Props interfaces extend them; delete the five
      `declare module "@gtkx/jsx/…"` blocks in `packages/react/src/jsx.ts` and every remaining
      `@gtkx/jsx` / optional-`@gtkx/gi` type import from `@gtkx/react`
      (`gtype-predicates.ts` annotations included; the `isAdwDialog`/`isAdwComboRow` predicates
      stay registry-driven with structural return types).
- [ ] **T6.3** Per D9: settle where `AdwComboRow` surfaces (`@gtkx/jsx/adw` re-export of the
      `@gtkx/react` list component); update CLI templates and `claude/` skill snippets to the
      final surface.
- [ ] **T6.4** Enforcement in `.dependency-cruiser.cjs`: nothing under `packages/react/src` may
      import `@gtkx/jsx` (type-only included) or `@gtkx/gi/{adw,gtksource,webkit}`; the
      generated store (analyzed through the `.gtkx` symlink) may import `@gtkx/react`;
      `@gtkx/animate` may import `@gtkx/gi/adw`.
- [ ] **T6.5** Implement D4: `library-resolver.ts` stops force-merging `Adw-1`, `GtkSource-5`,
      `WebKit-6.0`; only `Gtk-4.0` and its GIR-transitive closure remain mandatory. The repo
      root and example configs list what they actually use; dev server reloads on
      `gtkx.config.ts` library changes. `@gtkx/animate` documents that it requires `Adw-1` in
      `libraries`.

Exit: an app with `libraries: ["Gtk-4.0"]` builds, typechecks, and runs with no Adw/GtkSource/
WebKit bindings generated; `examples/browser` (WebKit) still works; `pnpm lint` (depcruise)
enforces the one-way direction; `pnpm typecheck` passes with zero react→jsx imports.

## Phase 7 — Documentation, examples, and release verification

- [ ] **T7.1** Rewrite website docs for the final import model (`@gtkx/react` namespace-agnostic
      runtime, `@gtkx/jsx/<ns>` intrinsics + namespace components per D9, `@gtkx/gi/<ns>`
      classes): `getting-started.md` is stale today (imports intrinsics from `@gtkx/react`); the
      tutorial's menus/shortcuts and gestures pages change with Phase 5.
- [ ] **T7.2** Refresh `AGENTS.md`/`CLAUDE.md` (architecture section, `.gtkx` store layout,
      per-namespace entrypoints, conventions), README, and TypeDoc coverage for every new public
      export (`@gtkx/config`, schema types, ffi helper modules, `@gtkx/react/<ns>`
      entrypoints).
- [ ] **T7.3** Full gate: `pnpm install && pnpm codegen && pnpm build && pnpm test:all &&
      pnpm typecheck && pnpm lint && pnpm coverage && pnpm docs`; `scripts/ci-asan.sh` and
      `ci-miri.sh` (ffi gained marshalling-adjacent code in Phase 3); CodSpeed run for the
      Phase 4/5 reconciler changes; build and launch every example via `gtkx build`.
