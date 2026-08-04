# v1.0 release blockers

Defects found while building a real application (TableStar) against the published `1.0.0-rc.4` packages, using only the public CLI, the published docs, and the MCP server. Living document: entries are added as they are found and verified.

Environment for every repro below: Fedora, Node 24.18.1, pnpm 11.18.0, npm 11.16.0, GTK 4.22.4, libadwaita 1.9.1.

---

## 1. `create-gtkx` never finishes on pnpm

**Severity:** blocker. This is the first command a new user runs, and it fails.

**Repro** (clean, with an empty user npmrc so no local config participates):

```sh
mkdir clean && cd clean && printf '' > .npmrc
NPM_CONFIG_USERCONFIG=$PWD/.npmrc pnpm create gtkx@1.0.0-rc.4 demo \
  --application-id com.example.Demo --package-manager pnpm --typescript --vitest --yes
```

**Actual:**

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @swc/core@1.15.47
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.

■  Failed to install dependencies: `corepack pnpm add -D @gtkx/cli@^1.0.0-rc.4 ...` failed.
●  Install them manually by running:
     cd demo
     pnpm install
```

Reproduced on every attempt. npm is unaffected: the identical command with `--package-manager npm` completes cleanly.

**Cause:** the shared `package.json` template wrote the same field for every package manager:

```json
"allowScripts": {
    "esbuild": true,
    "@swc/core": true
}
```

`allowScripts` is an npm field. pnpm does not read it. pnpm takes `allowBuilds` in `pnpm-workspace.yaml`, or `pnpm.onlyBuiltDependencies` in `package.json`. So `@swc/core`'s postinstall was gated, pnpm exited non-zero, and the scaffolder aborted its install step.

This repository already knew the right answer: `pnpm-workspace.yaml` uses `allowBuilds`. The template just did not emit the pnpm form.

**Knock-on effects:**

- The scaffolder aborts before `git init`, so a pnpm-scaffolded project is left without the repository the npm path creates. The two package managers produce different project states.
- The suggested recovery (`cd demo && pnpm install`) does not fix it either. pnpm rewrites `pnpm-workspace.yaml` with a placeholder, `'@swc/core': set this to true or false`, that the user has to resolve by hand before any install succeeds.
- `esbuild` is listed in `allowScripts` but is not in the generated `pnpm-workspace.yaml` placeholder, so the pnpm form needs both entries written explicitly.

**Fix applied:** the build allowance left the shared template and moved to `packages/create-gtkx/src/build-allowance.ts`, which writes the form the selected package manager reads: `allowBuilds` in `pnpm-workspace.yaml` for pnpm, `allowScripts` in `package.json` for npm, `dependenciesMeta` for yarn. `esbuild` and `@swc/core` are both named on every path.

---

## 2. Scaffolded projects never typecheck their tests

**Severity:** high. A type error in a test file passes `typecheck` and CI silently.

**Repro:**

```sh
pnpm create gtkx@1.0.0-rc.4 demo --typescript --vitest --yes
cd demo && pnpm exec tsc --noEmit --listFiles | grep -E '/(src|tests)/'
```

**Actual:** only `src/app.tsx`, `src/gtkx-env.d.ts`, and `src/index.tsx` are checked. `tests/app.test.tsx`, which the same scaffolder just generated, is not.

**Cause:** the generated `tsconfig.json` set `"include": ["src/**/*"]` with `"rootDir": "src"`, while `--vitest` generates `tests/` and a `test` script. Nothing ever type-checked that directory.

**Fix applied:** the emitted `tsconfig.json` includes `tests/**/*` alongside `src/**/*` whenever the testing option is on, and sets no `rootDir`.

---

## 3. Scaffolded projects become a pnpm workspace root with no `packages:` key

**Severity:** high. Every pnpm-scaffolded GTKX app is in this state, and the failure it causes is unbounded memory in an unrelated command.

**Symptom as first seen:** `pnpm exec tsc --noEmit` in a scaffolded project exhausts the heap, at the default limit and still at `--max-old-space-size=8192`, once a `flatpak-builder` output directory exists in the tree. Removing the directory fixes it. Adding that directory to the tsconfig `exclude` does not.

**The symptom is misleading: TypeScript is never reached.** Same project, same tree, with the offending directory present:

```
pnpm exec tsc --noEmit             FATAL heap OOM, signal 6, 57.6s, 6.9 GB
pnpm exec node -e "…"              FATAL heap OOM, signal 6, 65.0s, 6.6 GB   (no tsc at all)
./node_modules/.bin/tsc --noEmit   exit 0, 0.08s, 173 MB                     (no pnpm)
```

**Cause:** `pnpm exec` runs a dependency-status check before spawning anything. That check globs the workspace, and it passes the raw `packages:` field from `pnpm-workspace.yaml` straight through. When the file exists but has no `packages:` key the value is `undefined`, so pnpm falls back to its recursive default `[".", "**"]` and crawls `**/package.{json,yaml,json5}`, ignoring only `node_modules` and `bower_components`, with `followSymbolicLinks` left at its default of true.

`flatpak build-init` leaves exactly one symlink in every output directory, `build-dir/var/run -> /run`, so the crawl walks out of the project. The memory is consumed resolving symlinks, not files: 150,000 plain directories behind the link finish in 0.93s, while 150,000 symlinks exhaust the heap.

`packages/create-gtkx/src/build-allowance.ts` created the file with only an `allowBuilds:` key, which is what made a plain app a workspace root without ever selecting its packages.

**Repro**, with no tsc anywhere in the command:

```sh
mkdir -p mini/src mini/build-dir/var && cd mini
printf '{"name":"mini","version":"0.0.0","private":true}\n' > package.json
printf 'allowBuilds:\n  esbuild: true\n' > pnpm-workspace.yaml
pnpm install --ignore-scripts
ln -s /run build-dir/var/run
NODE_OPTIONS=--max-old-space-size=512 pnpm exec node -e "console.log('ok')"
```

**Fix applied:** `writePnpmAllowance` now writes `packages:\n  - '.'` when the file has no `packages:` key. Verified: with the symlink still present, the same command goes from a signal 6 abort to `ok` in 0.21s, and a freshly scaffolded project survives both `pnpm exec node` and `pnpm exec tsc --noEmit`.

**Two corrections to earlier entries in this file.** The `exclude` previously added to the scaffolder's `tsconfig.json` template did not fix this and has been reverted; it never named the offending directory and could not have, because tsconfig is not read by the process that died. The template's `include` is what keeps TypeScript's own wildcard walk inside `src/`, and that walk has an independent symlink-following blowup of its own that only fires when a tsconfig has neither `files` nor `include`. Keeping `include` is therefore deliberate, not incidental.

Also worth recording: `--max-old-space-size` could never have helped diagnose this, because TypeScript 7.0.2 is a statically linked Go binary that the JS shim `execve`s into, so V8 flags do not reach it.

---

## 4. `llms.txt` omits the entire API reference

**Severity:** medium for 1.0. The file exists and is well-formed, so agents will trust it as the map of the documentation, and it points at only a fraction of the site.

**Repro:**

```sh
curl -s https://gtkx.dev/llms.txt | grep -c reference
curl -s https://gtkx.dev/sitemap.xml | grep -c '/reference/'
```

**Actual:** `llms.txt` links the guide and the tutorial and nothing else. The `/reference/` pages, which are the generated TypeScript API for `@gtkx/components`, `@gtkx/config`, `@gtkx/css`, `@gtkx/gl`, `@gtkx/native`, `@gtkx/react`, `@gtkx/runtime`, `@gtkx/testing`, and `@gtkx/vitest`, make up 2393 of the sitemap's 2425 URLs and appear nowhere in it. `llms-full.txt` inlines the guide and tutorial prose in full and likewise contains no reference content. The blog is absent from both.

**Why it matters:** an agent that reads `llms.txt` to answer "what is the signature of `ColumnView`'s renderer" finds no path to the answer and guesses. The GTK4 and Adwaita binding surface is well covered by the MCP server's `gtkx_search_api` and `gtkx_get_api_docs`, but those serve the *generated* bindings only; the hand-written `@gtkx/*` TypeScript API exists solely on the website.

**Fix applied:** `llms.txt` ends with an `## Optional` section, which is what the llms.txt spec reserves for secondary material, linking the `/reference/` index, each package's reference entry, and the blog. `llms-full.txt` still inlines only the guide and tutorial prose; expanding every symbol page into it was not the gap, a reachable index was.

**Assessment of what is there:** the guide and tutorial coverage is complete and genuinely useful. Every guide page and every tutorial chapter is listed, `llms-full.txt` is 318 KB, which is small enough to read whole, and the prose is dense and accurate. The gap is scope, not quality.

---

## 5. `gtkx build --asset-base` emits `require()` into an ESM bundle

**Severity:** blocker. `--asset-base` exists for Flatpak and system installs, so this breaks the packaging path it was built for.

**Repro:** in any scaffolded project, import anything Vite emits as an asset, then build with `--asset-base`.

```sh
printf 'x' > src/probe.txt
printf 'import u from "./probe.txt?url";\nconsole.log(u);\n' > src/probe-entry.tsx
pnpm exec gtkx build src/probe-entry.tsx --asset-base share/demo
node dist/bundle.js
```

**Actual:**

```
ReferenceError: require is not defined in ES module scope, you can use import instead
```

The emitted bundle contains:

```js
require("path").join(require("path").dirname(process.execPath),`share/demo`,`assets/probe-...txt`)
```

Without `--asset-base` the same build correctly emits `new URL("./assets/probe-...txt", import.meta.url)` and runs.

**Cause:** `packages/cli/src/vite-plugins/built-url.ts` hardcoded `require("path")` into the `renderBuiltUrl` runtime string. Scaffolded projects are `"type": "module"` and the bundle is ESM. Rolldown's automatic `createRequire` shim only covers `require()` it sees while analyzing module source; `renderBuiltUrl` injects its string at render time, after that analysis, so the bare `require` survived into the output.

**Trigger:** an emitted asset, not a third-party dependency. A project with no assets builds and runs cleanly with `--asset-base`, which is why this did not show up on a bare scaffold.

**Fix applied:** the plugin resolves both bases through `URL` instead of `path`. With `--asset-base` it emits a `decodeURIComponent(new URL(...).pathname)` against a `file://` URL built from `process.execPath`, and without it the same expression against `import.meta.url`, so nothing in the runtime string needs `require`.

---

## 6. `gtkx build` silently drops worker modules

**Severity:** blocker. Any real app that moves work off the GTK main loop needs a worker, and the failure is silent at build time.

**Repro:**

```sh
printf 'export const answer = 42;\n' > src/probe-worker.ts
printf 'const w = new Worker(new URL("./probe-worker.js", import.meta.url));\nw.terminate();\n' > src/probe-entry.tsx
pnpm exec gtkx build src/probe-entry.tsx
ls dist/
```

**Actual:** the build reports `✓ built` and `Build complete`. `dist/` contains only `bundle.js` and `gtkx.node`. The worker module is never emitted, and the reference survives verbatim in the bundle:

```js
new Worker(new URL(`./probe-worker.js`,import.meta.url)).terminate()
```

At runtime that URL resolves to a file that does not exist.

`new Worker(new URL(..., import.meta.url))` is the canonical form Vite and Rolldown detect to emit a worker chunk. GTKX's build produced no chunk for it and issued no warning, so the first sign of trouble was a runtime failure in a packaged app.

**Two narrower shapes did the same thing after the canonical form started emitting chunks:** a URL hoisted to a module constant and passed to `new Worker` by name, and an inline specifier that does not resolve to a file on disk. Both built with exit 0 and both left the same dangling reference in the bundle, which is the worst of the available outcomes: emitting a chunk is right, refusing the build is defensible, and shipping a bundle that fails at runtime is neither.

**Why it matters here:** GTKX drives the GLib main context from a libuv prepare callback on the Node main thread, so synchronous JS blocks GTK for its full duration. Workers are the sanctioned answer, and the build could not ship one.

**Fix applied:** `packages/cli/src/vite-plugins/worker.ts` emits a chunk for the canonical inline form, and now fails the build for the two shapes that still produced a dangling reference. A `new URL(spec, import.meta.url)` bound to a variable that is later passed to `new Worker` is reported by name, with the inline call to write instead. An inline specifier that does not resolve is reported with the file and the specifier, and names the corrected specifier when the same path with a TypeScript extension resolves. Both exit non-zero.

The plugin rewrites, so a rewrite has to be provably right; a regex cannot establish that an identifier's binding is exactly one `new URL` and is never reassigned, shadowed, or conditionally initialized, and a wrong rewrite is the same class of silent breakage. Reporting is safe to approximate in the direction rewriting is not, so the hoisted form is detected (declaration and `new Worker(binding)` both present, both outside strings and comments) and refused rather than followed. Matches inside strings, template literals, and comments are skipped, so neither diagnostic fires on quoted or commented-out code.

The supported form is documented in [Async Operations](https://gtkx.dev/guide/async-operations).

---

## 7. The `AdwSidebar` and `AdwMultiLayoutView` families were unusable from JSX

**Severity:** high. The elements mounted without an error and silently dropped everything placed inside them.

`AdwSidebar`, `AdwSidebarSection`, `AdwSidebarItem`, `AdwMultiLayoutView`, `AdwLayout`, and `AdwLayoutSlot` are all generated as mountable JSX elements (`isMountable: true` in the generated `elements.json`). Their child APIs are methods, not properties: `adw_sidebar_insert`, `adw_multi_layout_view_add_layout`. With no behavior to claim the children, the reconciler fell through to setting a named property that does not exist, so children went nowhere and nothing reported it.

Each of these had to close before either family worked:

**No behavior claimed the children.** Nothing in `packages/react/src/adw/element-behaviors.ts` covered either family, so every child took the missing-property path.

**The generated props did not declare the slots a behavior consumes.** Behaviors live in `element-behaviors.ts`, but what codegen emits comes from `element-config.ts`, which had no entry for any type in either family. `AdwSidebarSectionProps` carried no `children`, and `AdwMultiLayoutViewProps` carried only `layoutName` and the inherited widget props, so JSX that ran correctly still failed `tsc`: the element is mountable and the type says it takes nothing.

**`AdwLayout` could not be given content.** `Adw.Layout`'s `content` is construct-only, so the generated class exposes a getter and no setter. Nesting an `AdwLayoutSlot` inside it raised `Adwaita-CRITICAL: Content in AdwLayout cannot be NULL`, which the test harness turns fatal through `G_DEBUG=fatal-criticals`.

**`layoutName` was applied before its layout existed.** `AdwMultiLayoutView` set it while props were applied, which is before the `AdwLayout` children attach, and Adwaita answered `Layout name ... not found`. `AdwViewStack.visibleChildName` and `AdwToggleGroup.activeName` have the same ordering problem and are gated behind a `deferred` behavior.

**Fix applied:** `packages/react/src/adw/element-behaviors.ts` claims the children. `AdwSidebar` and `AdwViewSwitcherSidebar` take `AdwSidebarSection` children, `AdwSidebarSection` takes `AdwSidebarItem` children, and `AdwMultiLayoutView` takes a `layouts` slot plus widgets in named slots that map to `setChild`.

`element-config.ts` declares `children` on `AdwSidebarSection` and points `AdwMultiLayoutView` at a new `AdwMultiLayoutViewProps` in `packages/react/src/adw/prop-types.ts`. `AdwSidebar` and `AdwViewSwitcherSidebar` need no entry, because they are widgets and `children` already reaches them through `GtkWidgetPropsBase`. The named slots are typed as a `${string}Slot` template index signature, and the behavior strips the suffix, so `sidebarSlot` fills the `AdwLayoutSlot` whose id is `sidebar`. A plain `[slot: string]: ReactNode` index signature cannot be written here: TypeScript checks members inherited from sibling bases against an inherited index signature, and `GtkWidgetProps`'s `onNotifyCanFocus` is not a `ReactNode` (TS2411). The template pattern claims only slot names and leaves excess-property checking intact for real props.

`AdwLayout` is `isLazy`, so codegen emits `AdwLayoutElementProps = Omit<AdwLayoutProps, "content"> & { children?: ReactNode }`, dropping the construct-only `content` and letting children take its place while the parent creates the GObject. The `layouts` slot builds `new Adw.Layout({ content })` from the lazy node's child widget and returns it, so the reconciler adopts the layout and applies `name` to it. `detach` removes the adopted layout and `reorder` returns it, so reinsertion does not tear down and rebuild every layout.

`layoutName` is now `deferred<Adw.MultiLayoutView, string>("layoutName", (view, name) => view.getLayoutByName(name) !== null)`, the same shape the other two use.

`packages/e2e/tests/elements/sidebar.test.tsx` and `packages/e2e/tests/elements/multi-layout-view.test.tsx` mount each family from JSX and assert the children populate: sections and items land in the sidebar and survive a shrink and a mid-list insert, and the layouts, their content, the named slot children, and the deferred `layoutName` all land on the view, including a layout switch on rerender.

---

## 8. The collection components materialize every row up front

**Severity:** high. The declarative collection components are a headline feature, and they stop being usable well below the row counts a column view exists for.

`collection-model.ts` mapped every item id to a `Gtk.StringObject` at splice time, so cost scaled with the result set rather than the viewport. Measured on this machine:

| rows | `Gtk.StringObject` creation | RSS | JS heap |
| --- | --- | --- | --- |
| 10,000 | 12 ms | +8 MB | +7 MB |
| 100,000 | 168 ms | +107 MB | +23 MB |
| 1,000,000 | 2228 ms | +891 MB | +153 MB |

That is roughly 890 bytes of RSS per object, of which only about 153 is JS heap. The rest is the GObject plus the handle-table entry and FFI wrapper. A bare `GtkStringObject` in C is 40 to 50 bytes, so the cost is per-handle bookkeeping, not GTK.

Time matters more than memory here: GTKX drives the GLib main context from a libuv prepare callback with a 4 ms dispatch budget, so 2.2 s of synchronous FFI is a 2.2 s frozen window. Even 100k rows is a visible 168 ms stall. The practical ceiling was somewhere around 10k to 50k rows.

**Fix applied:** each level's store is now `LazyLevelStore`, a `Gio.ListStore` subclass registered through `registerClass` that overrides `getItemType`, `getNItems`, and `getItem`, holds only the id array, and creates a `Gtk.StringObject` on demand, keeping a bounded resident set. Splices update the id array and emit `itemsChanged`.

Exposing `model` was considered and rejected: it would hand callers the raw GTK model the components exist to abstract over. Laziness belongs inside the abstraction, so the public API is unchanged.

Verified: `Gtk.NoSelection` over a subclass with 1,000,000 items reports 1,000,000 through the overridden vtable, and reading position 900,000 creates exactly one object with no measurable RSS change. Through the real collection path, 1M rows now sync in 277 ms with +111 MB (down from 2228 ms and +891 MB for the GObjects alone), and 400 `getItem` calls at the far end of the range take 2 ms. All 194 component tests pass unchanged.

---

## 9. Fast Refresh never applies anything

**Severity:** blocker, and the most serious entry here. Hot reload is a headline feature of `gtkx dev`, it has never worked, and it reports success every time.

**Repro:** in any project, run `gtkx dev`, then edit a component's rendered text.

**Actual:** the log prints

```
[gtkx] File changed: src/app.tsx
[gtkx] Running Fast Refresh...
[gtkx] Fast Refresh complete
```

and the running window does not change. Confirmed against the widget tree: the widget keeps its id and its old text. Reproduces in this repository's own `examples/hello-world`, so it is not project-specific.

**Cause:** `@gtkx/react` never calls `reconciler.injectIntoDevTools()`. `react-reconciler` does not register itself with `__REACT_DEVTOOLS_GLOBAL_HOOK__`; the host renderer has to do it, the way React DOM does.

`react-refresh` only records a renderer when the injected payload carries `scheduleRefresh` and `setRefreshHandler` (`react-refresh-runtime.development.js:178`). With no injection, nothing is recorded, so `performReactRefresh()` walks an empty set of roots and returns `{updatedFamilies:{}, staleFamilies:{}}` without an error. Instrumented on rc.4:

```
[probe] mounted roots: 0
[probe] hook present: true renderers: 0
[probe] performReactRefresh -> {"updatedFamilies":{},"staleFamilies":{}}
```

Everything else in the pipeline was already correct and was ruled out during the investigation: the SWC transform emits `$RefreshReg$`/`$RefreshSig$`, the per-module registration header is injected, both component families register on mount and again on re-execution, and `react-refresh/runtime` is a single shared instance.

**Fix applied:** `packages/react/src/reconciler/devtools.ts` injects the renderer once, from `openContainer`, guarded on the hook being present so a production app with no DevTools hook is unaffected. `bundleType` follows `NODE_ENV`.

After the fix the same probe reports `mounted roots: 1`, and editing a component updates the live window in place, preserving the widget and its React state:

```
Label id="2"  ->  "State preserved across refresh"
Label id="3"  ->  "Count: 1"      (incremented before the edit, survived it)
```

**Note:** `refresh-globals.ts` evaluates twice, once in the dev runner and once through Vite's SSR graph, so `injectIntoGlobalHook` runs twice. It is harmless because both evaluations share one `react-refresh/runtime` instance, but the double call is unintended.

---

## 10. `screenshot()` misdiagnosed a display that is not presenting frames

**Severity:** medium, but it lands squarely on the MCP agent workflow, which is a headline use case.

**Symptom:** `gtkx_take_screenshot` against a live session fails with

```
Timed out after 1000ms.
Widget produced no render content (realized=true mapped=true visible=true)
```

The message points at the widget, so it reads as an application bug. The widget is fine.

**Cause:** `packages/testing/src/screenshot.ts` captured through `Gtk.WidgetPaintable`, which serves the widget's last *presented* render node. When the compositor is not presenting the surface, no frame callback arrives, the frame clock never ticks, and the cached node is never regenerated. Measured against a GNOME Wayland session with nothing viewing the window:

```
[t+0.5s] frameCounter=0 fps=0.00 mapped=true
[t+8s]   frameCounter=0 fps=0.00 mapped=true
```

Eight seconds, repeated `queueDraw()` between samples, and the frame counter never leaves zero.

The first capture after the window maps succeeds, because GTK snapshots synchronously at map time. Any later invalidation, an explicit `queueDraw()` or a tree change from Fast Refresh, drops that cached node permanently:

```
[baseline]                    toNode=node
[action] queueDraw
[after-invalidate]            toNode=NULL
[action] requestPhase(PAINT)
[after-requestPhase-1400ms]   toNode=NULL
```

`GdkFrameClock.requestPhase(PAINT)` does not recover it either. Only a compositor frame can, and none is coming.

This is why screenshots work under the `@gtkx/vitest` headless compositor (sway and weston do present) and why they start failing on a live session immediately after the first hot reload.

Reproduced end to end by hiding the `GdkSurface` behind GTK's back with `window.getNative().getSurface().hide()`: the widget still reports `realized=true mapped=true visible=true`, and any later invalidation makes `Gtk.WidgetPaintable.snapshot()` yield NULL permanently, producing the exact message above.

**Fix applied:** capture no longer depends on a presented frame, and when it genuinely cannot proceed it names the display.

Capture runs in stages: the presented paintable node; failing that, the root's layout is forced with `root.allocate(width, height, -1, null)` and the paintable retried, which regenerates content without any presented frame; failing that, the target's children are snapshotted directly with `snapshotChild`, because a root's own paintable never recovers. Layout, not just paint, is what the frame clock withholds, which is why forcing the allocation is enough. The image is fresh rather than stale: changing a label's text while stalled produced a different image, and reverting the text reproduced the original bytes.

The presentation probe is `Gdk.Surface.getMapped()` and a frame counter that advanced after a requested `UPDATE` phase, judged after 250 ms. The counter alone would misfire, because an idle healthy window's counter is frozen too; requesting a phase advances it within about 120 ms on a presenting display and cannot on a stalled one. The clock is read off the widget's root, not the widget, since an unrealized child has no clock while its window presents normally.

The failures are now distinct. A stalled display throws immediately with "the display is not presenting frames to this window ... this is a display problem, not a widget problem", plus `realized`, `mapped`, `visible`, `surfaceMapped`, `frameCounter`, and the underlying capture error, instead of burning the timeout. A presenting display that painted nothing says the widget itself is empty. Anything else, such as "Widget has no size", says the capture failed for another reason. `renderToPng` renders through an explicit `Graphene.Rect` viewport, so a fallback image keeps the widget's exact dimensions and scale.

**What the fallback does not carry:** a root window's own CSS background lives on the window's own render node, which GTK regenerates only during a real render, so a window captured while the display is stalled has a transparent backdrop. Every widget's own painting is present and current.

**Coverage:** `packages/testing/tests/screenshot-frames.test.tsx` covers the hidden surface and the never-presented window and asserts each diagnosis. The live-session shape, a surface that stays mapped while the compositor withholds frame callbacks, cannot be reproduced under the headless compositor, because weston always presents. It runs the same stalled branch through the frozen-counter check, which is verified here only in the direction that a presenting display advances the counter on request and so raises no false alarm.

No change was needed in `packages/cli/src/mcp/`: `handleScreenshot` passes the widget straight to `testing.screenshot`, `toResponseError` forwards `error.message` verbatim, and `packages/mcp`'s `errorToResult` renders that message as the tool's error text with its line breaks intact. The live application imports `@gtkx/testing` directly, so the new capture path and the new diagnosis reach the agent workflow unchanged.

---

## 11. A second instance on the same application ID segfaults

**Severity:** high. The crash is indistinguishable from an application bug, and it is hit by the ordinary mistake of running a build while `gtkx dev` is up.

**Repro:**

```sh
pnpm exec gtkx dev &        # holds dev.example.App
pnpm exec gtkx build
node dist/bundle.js
echo $?
```

**Actual:** exit `139` (SIGSEGV), with no output at all, not even the GDK warnings the same binary prints on a clean run. With the dev instance stopped, the identical bundle runs correctly.

GApplication's remote-instance path is supposed to register, forward activation to the primary instance, and exit cleanly. Instead the process dies on a signal, so the user sees a crash with nothing to go on.

**Cause:** isolated to window construction, not registration. Registering and activating a remote application is fine on its own:

```
[dup] isRemote=true
[dup] activated
[dup] alive after present   <- reached only without a window
```

Adding `new Adw.ApplicationWindow({ application })` to that same remote application segfaults immediately. GTK builds its `GtkApplicationImpl` during `startup`, which never runs for a remote instance, so attaching a window dereferences it.

`runApplication` registered and then activated unconditionally, and the React tree went on to build a window regardless of which instance it was in.

**Fix applied:** `runApplication` now returns `{ isPrimary }`. A remote instance forwards activation to the primary and reports `isPrimary: false`, and the application component gates its children on that, so no window is ever attached to a remote application. The second instance exits `0` and the primary stays up and is raised.

**Related, also fixed:** `runApplication` never looked at `argv`, so every GApplication option was inert and the app activated on startup no matter how it was launched. Any D-Bus start popped a window, including starts meant only to query actions.

`runApplication` now takes the command line and hands it to `local_command_line`, GLib's own implementation, so option parsing, `--help`, `handle-local-options`, registration, remote forwarding, service mode and activation all behave as they do in a C application, and the exit status GLib determined is returned. Nothing about `--gapplication-service` is special-cased: GLib consumes it and sets `G_APPLICATION_IS_SERVICE` itself. The application component gates its children on the `activate` signal on every path, so the user interface is built when the application is activated rather than at startup. Verified over the session bus:

```
before Activate:  node /com/gtkx/hello_world { interface org.gtk.Application { ... }; };
after  Activate:  node /com/gtkx/hello_world { interface org.gtk.Application { ... }; node window { }; };
```

`g_application_run()` is not what starts the application, because it would block Node's event loop; GTKX drives the GLib main context from a libuv prepare callback instead, and calls only the `local_command_line` vfunc that `run()` delegates all of its local work to. `quitApplication` does call `run([])`, once every window is detached, because its tail is the only public path that emits `shutdown`, destroys the `GApplicationImpl` and clears `is-registered`. That holds because GTKX builds every application from a subclass whose `local_command_line` chains up the first time and short-circuits afterwards, so the second pass does not re-enter `g_application_parse_command_line`, whose `!priv->options_parsed` assertion is followed by a `NULL` `GError` dereference and `SIGSEGV`.

**Correction:** that is an invariant of one loaded copy of `@gtkx/runtime`, not of the process. Both the "already started" record and the shutdown short-circuit are module-scope state, so a process holding two copies of the module has two of each and neither knows what the other did. Entry 16 records a configuration that loaded two, and there the assertion did fire.

---

## 12. Out arrays of inline structs are read as arrays of pointers

**Severity:** blocker. Calling any of the affected methods segfaults the process.

**Repro:**

```ts
const [, keys] = Gdk.Display.getDefault().mapKeyval(Gdk.KEY_a);
console.log(keys[0].keycode);
```

**Actual:** `SIGSEGV` on the field read. `new Gtk.Label({ label: "hello" }).getLayout().getLogAttrs()` and `Gtk.Gesture.getBacklog` fail the same way; `Gtk.AccessibleText`'s `getAttributes` and `getSelection` vfuncs carry the same shape.

**Cause:** GIR writes an out array's element `c:type` with one extra `*`, which belongs to the out indirection rather than to the element. `gdk_display_map_keyval` declares `<array c:type="GdkKeymapKey**"><type name="KeymapKey" c:type="GdkKeymapKey*"/></array>`, so the element looks like a pointer even though the callee returns a packed array of 12-byte structs. Codegen's `inlineElementSize` bailed on any element `c:type` containing a `*`, so it emitted no element size, and the native array codec fell through to its pointer-array path and read 8-byte pointers out of struct storage.

The same convention holds across every GIR in the workspace: for `out` and `inout` parameters that are not `caller-allocates`, the element `c:type` always carries exactly one star more than the element's real indirection, and `caller-allocates` out arrays never do.

**Fix applied:** the descriptor renderer now discounts that star when the parameter sits behind a ref, so an out array of inline records emits its element size and the codec walks the buffer by stride. `packages/e2e/tests/native/inline-struct-out-arrays.test.ts` covers the keymap round trip and the log-attr layout.

The transfer-full container is not leaked: `RefCodec::decode_with_context` already frees length-bounded out arrays.

---

## 13. Most out parameters could not be implemented from JavaScript

**Severity:** high. Whole families of vfuncs were absent from the generated surface, so the widgets and models that need them could not be written in GTKX at all.

A vtable slot was dropped outright if any parameter was an out or inout that was not a scalar or a string array. That removed `Gtk.AccessibleText`'s `getAttributes` and `getSelection`, `Gio.MenuModel`'s `getItemAttributes` and `getItemLinks`, `Gio.MenuAttributeIter.getNext`, `Gtk.IMContext`'s preedit and surrounding-text slots, `Gio.ActionGroup.queryAction`, `Pango`'s `listFaces`, `listFamilies` and `listSizes`, `GtkSource.Indenter.indent`, and the async `loadFinish` and `setAttributesFinish` pair.

**Cause:** two gaps, both narrow.

`writeOutParams` assigned the value an implementation returned into the out cell unconverted, so the codec on the other side received a wrapper object where it wanted a handle and failed with `Expected an Object for Boxed field write type, got Object`. Scalars and strings happened to survive that, which is why exactly those had been allowed through. It now converts with `toNative` the way the primary return value always did.

`HashTableCodec` implemented only `write_return_to_ptr`, so writing a table into an out parameter hit the default `PtrWriter` and bailed. It now implements `write_value_to_ptr`, refusing a transfer-none table for the same reason the array codec does: nothing would own the container.

**Fix applied:** the slot guard is gone, and `packages/e2e/tests/runtime/vfunc-out-params.test.ts` drives each shape through the real C vtable rather than by calling the override directly, which proves nothing.

**Also fixed: a slot exposed the array length parameter a call folds away.** `listFaces()` returns `FontFace[]`, but `vfuncListFaces` had demanded `[FontFace[], number]`, and an implementation returning a count that disagreed with its array would have had GTK read that many elements out of a shorter buffer. Both paths now fold the length using the same `<array length="N">` attribute, and the runtime derives it from the array it accompanies, so the two cannot disagree.

The ownership matrix caught the hash-table hole while it was open; its `hashtable · field write` cell now expects the transfer-none refusal instead of the blanket one.

---

## 14. `gtkx dev` gave the application no command line

**Severity:** high. Every GApplication option is unreachable in development, so anything driven by one can only be tested against a build.

**Repro:**

```sh
gtkx dev -- --nope
```

**Actual:** the option never reaches the application. `gtkx build && node dist/bundle.js --nope` prints `Unknown option --nope` and exits 1, so the two paths disagreed about the same command line.

**Cause:** the supervisor forked the dev runner with a literal empty argument list, and `dev` had no way to accept application arguments in the first place. `process.argv.slice(2)` in the child was therefore always empty.

**Fix applied:** `gtkx dev [entry] -- <application arguments>` forwards everything after the separator to the app. The split happens in `cli.ts` before citty parses, because citty treats what follows `--` as ordinary positionals and would otherwise take the first one as the entry file, which resolved `--nope` to a source path and failed with `Does the file exist?`.

**Also fixed: dev outlived an application that refused its command line.** The runner stops when the application emits `shutdown`, but a refused command line never registers, so that signal never came and the dev server sat there with nothing running. It now checks registration after the entry mounts and exits with the status GLib determined, matching a build.

---

## 15. The API reference answers for whichever app happens to be running

**Severity:** medium. The reference is a development-time tool, and it is least available exactly when it is most useful.

**Repro:** leave any GTKX app registered with the MCP server, then ask for a symbol from a different project.

```
gtkx_get_api_docs { symbol: "AdwDialog", kind: "element" }
```

**Actual**, with a `gtkx dev` for `examples/hello-world` still running from an unrelated task hours earlier:

```
codegen is disabled for the project at /home/eugenio/gtkx/examples/hello-world,
so there are no generated bindings to document.
Remove `codegen: false` from gtkx.config.ts to use the API reference.
```

The lookup was for TableStar. The error names a project the caller is not working on, and its advice is to edit that project's configuration. `gtkx_list_apps` showed why: one registered app, `com.gtkx.hello-world`, pid 1681987, `projectRoot` `examples/hello-world`. Killing that process made the identical call succeed and return `AdwDialog`.

**Cause:** the server scoped its reference to a registered application's project root. That is right for the tools that drive a live app. But the reference tools are not app tools. Looking up how `AdwDialog` works is what a developer does *before* there is anything to run, so the answer ends up depending on unrelated state: a stale process from another project silently redirects every lookup, and if that project sets `codegen: false` the reference is unavailable outright.

With no app registered the reference did answer, from the server's own root, which happened to have `Adw-1` configured. That was luck rather than intent: a project whose libraries differ from the server's root would get an answer scoped to the wrong surface with nothing to indicate it.

**Fix applied:** `gtkx_list_api`, `gtkx_search_api`, and `gtkx_get_api_docs` take an optional `projectRoot`, absolute or relative, and any directory inside a project resolves to it by walking up to the enclosing `gtkx.config.*`. Without the argument the server documents the project containing its own working directory, and falls back to a connected app's root only when that directory is not inside a GTKX project. Every answer ends with the project it was scoped to and how that project was chosen, so a wrong scope is visible instead of silent, and the `codegen: false` message now offers `projectRoot` as the way out rather than telling the caller to edit someone else's configuration. Resources use the same resolution, since a URI carries no project. Documented in [the MCP guide](https://gtkx.dev/guide/mcp).

---

## 16. `gtkx dev` from source never started the application

**Severity:** high. This is the mode the repository's own guidance prescribes for running the CLI from source, so the documented contributor workflow did not start an app.

**Repro**, from `examples/gtk-demo` with nothing else holding its application ID:

```sh
../../node_modules/.bin/tsx ../../scripts/run-headless.ts \
  node --conditions=source --import tsx ../../packages/cli/bin/gtkx.js dev
```

**Actual:** the application process prints

```
gtkx: GLib-GIO-CRITICAL: g_application_parse_command_line: assertion '!application->priv->options_parsed' failed
```

and stops there. No `Connected application ID`, no `HMR enabled - watching for changes...`, and the dev server sits with nothing running until it is killed. A run of the same command under a different harness ended in `SIGSEGV`.

The identical command without the condition,

```sh
../../node_modules/.bin/tsx ../../scripts/run-headless.ts node ../../packages/cli/bin/gtkx.js dev
```

reaches `Connected application ID: org.gtkx.gtk-demo`, then `HMR enabled - watching for changes...`, and stays up. Both were run back to back on `30378fb1`.

`CLAUDE.md` prescribes exactly this mode: "running the CLI from source uses `NODE_OPTIONS=--conditions=source`".

**Cause:** the forked dev runner loaded `@gtkx/runtime` twice, from two different files. A `module.registerHooks` resolve and load hook over the failing run recorded both:

- `packages/runtime/src/index.ts`, which is what Node resolves under the process's `--conditions=source`. Imported by `packages/cli/dist/dev/runner-deps.js` and by every module of the generated `@gtkx/gi` store.
- `packages/runtime/dist/index.js`, imported by `vite/dist/node/module-runner.js`. Vite's `fetchModule` re-resolves externalized bare ids itself with `resolve.externalConditions`, which defaults to `["node", "module-sync"]` and carries no `source`.

The flags do reach the application process: the supervisor forked the runner with `child_process.fork` and no `execArgv` override, so `gtkx-dev-runner.js` carried `--conditions=source --import tsx` verbatim.

Two copies means two `registry.ts` module scopes. `@gtkx/gi` registers the `Gtk.Application` and `Gio.Application` vtable descriptors into the first copy's `vfuncRegistry`, while `createApplication` and `callParent` run in the second, whose registry is empty. With the vtable guard in place that surfaces as `callParent: DerivedApplication inherits no 'vfuncLocalCommandLine' vtable slot`; without it the same divergence produced the `g_application_parse_command_line` critical above, because the started and shutting-down records that `local_command_line` short-circuits on are per copy as well. That is the mechanism entry 11 relies on, and duplication defeats it.

The `@gtkx/gi` store itself stays a single instance, since it declares no `source` export condition and both resolvers land on the same `.js`, which is why the failure is a missing registry entry rather than a duplicate GType.

The application ID matters to the repro. The same command in `examples/hello-world` reached `HMR enabled` while a dev server from another session already held `com.gtkx.hello-world`, so a remote instance does not hit this.

**Fix applied:** `defaultForkRunner` in `packages/cli/src/dev/supervisor.ts` removes `--conditions` and `-C` from the forked runner's `execArgv` and from its `NODE_OPTIONS`, in both the `--conditions=x` and the two-argument `--conditions x` spellings, and passes every other flag through. Both channels are required: `child_process.fork` inherits `execArgv`, and `NODE_OPTIONS` is inherited through the environment, which is the spelling `CLAUDE.md` prescribes. `--inspect`, `--expose-gc`, heap sizing, and `--import` belong to the application process and are kept, since `--conditions` is the only flag that changes which file a specifier resolves to.

Both invocation forms now reach `Connected application ID` and `HMR enabled - watching for changes...` and stay up. `packages/cli/tests/dev/supervisor-fork.test.ts` forks a probe that reports which file `@gtkx/runtime` resolves to, under each spelling of the flag and through `NODE_OPTIONS`.

**Where the fix does not belong, tried and rejected.**

Not the runtime. With two copies, `registry.ts`'s class, handle, and vfunc tables, `lifecycle.ts`'s started and shut-down sets, and `registerClass`'s GType registration are all duplicated, and both copies would register the same derived GType name. Nothing inside `packages/runtime/src/` makes two copies of a GObject binding layer correct in one process.

Not the Vite configuration. Passing the host's conditions to `ssr.resolve.externalConditions` does make Vite resolve `@gtkx/runtime` to `src/index.ts`, but `canExternalizeFile` only externalizes extensionless, `.js`, `.mjs`, and `.cjs` paths, so Vite then inlines the TypeScript source into its own graph and there are still two copies. Re-running the repro with that configuration reproduced the same error, with `registry.ts` loaded once by Node. Routing the CLI's own runtime access through `server.ssrLoadModule` does not help either, because `@gtkx/gi` stays externalized and pulls `@gtkx/runtime` in through Node, which just moves the split inside the application graph. Vite can never externalize a `.ts` entry, so the only way to hold one copy is for the application process to carry no custom export conditions.

---

## 17. Typed passwords were readable through the MCP widget tree and the testing pretty-printer

**Severity:** blocker, and the only security defect in this file. Text GTK deliberately hides was handed to anything that read a widget tree, which includes an MCP agent and the output of any failing test.

**Repro:** type into a `GtkPasswordEntry`, an `AdwPasswordEntryRow`, or a `GtkEntry` with `setVisibility(false)`, then call `gtkx_get_widget_tree`, or let a query fail so Testing Library prints the tree.

**Actual:** the typed text appears verbatim as the node's `text`. Measured on each widget with `hunter2` typed in:

```
GtkPasswordEntry            getText -> "hunter2"
AdwPasswordEntryRow         getText -> "hunter2"   (beat getTitle)
GtkEntry(visibility=false)  getText -> "hunter2"
```

**Cause:** `getWidgetNodeText` in `packages/testing/src/widget-accessible-properties.ts` tried `getLabel`, `getText`, and `getTitle` in that order and returned the first non-empty result, with no regard for `GtkText:visibility` or the widget's input purpose. `getText` precedes `getTitle`, so even a row that has a title reported the password instead of its title. `packages/cli/src/mcp/serialize-widget.ts` puts that string in every node of the tree it sends an agent, and `packages/testing/src/pretty-widget.ts` prints it. `getWidgetDisplayValue` and `getWidgetSelection` leaked the same value onward through the accessible name, the text content, the matcher's `describeWidget` line, `prettyRoles`, and the DisplayValue query suggestion.

**Fix applied:** `packages/testing/src/hidden-text.ts` decides generically whether a widget's text is hidden. It walks the `GtkEditable` delegate chain from a widget and reports the text as hidden when any `GtkText` or `GtkEntry` on that chain has `visibility` false or an input purpose of `PASSWORD` or `PIN`. No class-name special cases and no Adwaita import, so the layering rule holds. Verified against real widgets that this covers `GtkPasswordEntry` (delegate `GtkText`, visibility false, purpose `PASSWORD`), `AdwPasswordEntryRow` with the same delegate shape, `GtkEntry` with `setVisibility(false)`, the inner `GtkText` node the MCP tree serializes directly, and the peek case where `GtkPasswordEntry` flips the delegate's visibility to true but leaves the purpose `PASSWORD`.

`REDACTED_TEXT`, the string `[redacted]`, is exported from `@gtkx/testing`. `getWidgetNodeText` skips the editable text getter for a hidden widget and falls back to its label or title, so an `AdwPasswordEntryRow` still reports its title and stays findable by label or role name, then to the marker when the hidden value is non-empty, then to null. Empty and filled stay distinguishable, and neither the length nor the content escapes. `getWidgetDisplayValue` and `getWidgetSelection` are guarded identically, which covers everything downstream of them.

Author-declared metadata is left alone deliberately. `accessibleLabel`, `accessibleValueText`, `placeholder`, and `tooltip` are strings the application passed as props, not text GTK hides, and suppressing the label would stop an agent from finding the password field to type into.

`packages/testing/tests/hidden-text.test.tsx` and `packages/cli/tests/mcp/hidden-text.test.ts` cover both surfaces. The `cli` Vitest project could not import `@gtkx/testing` at all, because `@gtkx/react` needs `virtual:gtkx-config`, so `packages/cli/vitest.config.ts` now loads `@gtkx/config`'s Vite plugin, `packages/cli/gtkx.config.ts` was added alongside the ones in `components`, `e2e`, and `testing`, and `knip.json` lists it as a `cli` entry.

---

## 18. `gtkx_query_widgets` `by: "name"` did not search accessible names

**Severity:** high for the agent workflow. The obvious query for finding a labeled widget returns nothing, and nothing in the answer says why.

**Repro:** render a button labeled `Save`, then

```
gtkx_query_widgets { by: "name", value: "Save" }
```

**Actual:** an empty `widgets` array and no explanation. `by: "name"` resolved to `queryAllByName`, which matches `gtk_widget_get_name`. That is the widget's own name, and GTK falls back to reporting the GType name when nothing set one, so the query that reads as "find the widget called Save" actually asked for a widget whose `gtk_widget_get_name` is `Save` and could realistically only ever have matched something like `GtkButton`. The tool's description, "Find widgets by role, text, name, or label", gives an agent no way to know that.

**Fix applied:** `runNameQuery` in `packages/cli/src/mcp/handlers.ts` searches the widget name, the accessible label, and the rendered text, deduplicated, with the lookups issued in parallel so a miss costs one timeout rather than one per lookup. Every result carries `searched`, a sentence naming exactly what was compared, and for `name` it spells out that `gtk_widget_get_name` reports the GType name such as `GtkButton` when nothing was set. An empty result additionally carries `hint`, naming the query, the value, what was compared, and what to try next. `packages/mcp/src/server.ts` JSON-stringifies the whole result verbatim, so both reach the agent.

`packages/testing/src/queries.ts` was deliberately left alone. `queryAllByName` correctly means `gtk_widget_get_name`, and widening it there would make `getByName("Save")` match both a button and its inner label and throw "multiple found" where it now resolves one widget. A list of matches is the expected shape only in the MCP handler.

**Still open:** the tool description in `packages/mcp/src/server.ts` still reads "Find widgets by role, text, name, or label", and that is what an agent reads before it calls anything. It should say that `name` is the widest match, covering the widget name, the accessible label, and the rendered text, that `text` is the narrow rendered-text match, and that `role` accepts `options.name` for the accessible name. Renaming the `by` enum instead, to `role|text|name|labelText|type` with `name` meaning the accessible name and `type` the GType match, is a wire-format change spanning `packages/mcp/src/protocol/schemas.ts`, `server.ts`, and `handlers.ts`, so it needs a single owner.

---

## 19. `gtkx_take_screenshot` did not capture popovers

**Severity:** medium. An agent that opens a menu and screenshots the window gets a picture with no menu in it and nothing saying anything is missing.

**Repro:** open a `GtkPopover` from a button, then screenshot the window.

**Actual:** the PNG was byte-identical to the one taken with the popover closed, while the popover's own `Gtk.WidgetPaintable` rendered fine at 132x55. A popover lives on its own surface, so it is not part of the window's render node.

**Fix applied:** `captureSnapshot` in `packages/testing/src/screenshot.ts` walks the target's descendants for mapped `Gtk.Popover`s and snapshots each one's paintable translated to its computed bounds origin. `gtk_widget_compute_bounds(popover, window)` does cross the native and surface boundary, returning `(334, 27, 132, 55)` and matching `gdk_popup_get_position_x/y`, so no manual surface transform is needed. Compositing is applied on both capture paths from entry 10.

Rendering moved from `renderTexture(node, null)` to an explicit viewport rectangle, so the image stays exactly the captured widget's rectangle: a popover spilling outside is clipped rather than silently growing the PNG and desynchronizing it from the reported width and height.

`packages/testing/tests/screenshot.test.tsx` asserts that an open popover changes the window image, that a spilling popover is clipped, and that the image stays stable while every popover is closed.

---

## 20. A `list()` prop the library cannot take back appended instead of replacing

**Severity:** high. The wrong value is applied silently, and the test that covered it could not have noticed.

**Repro:** render `<GtkAboutDialog creditSections={A} />`, then rerender it with `creditSections={B}`.

**Actual:** the credits page shows the contents of A and B together. GTK has no counterpart to `gtk_about_dialog_add_credit_section`, so the sections already added stay and the new list is added on top. The test that covered this, `keeps the initial sections when the prop changes`, asserted only `programName` and would have passed whatever the credits contained.

**Cause:** `list()` in `packages/react/src/reconciler/behaviors.ts` tore down the previous entries before applying the new ones, but `teardownList` returned early when the behavior supplied no `remove` hook, and the update then applied the new items regardless.

**Fix applied:** a `list()` with neither a `remove` nor a `clear` hook declares its prop permanent, and the reconciler's pre-commit guard rejects a change to it instead of letting the old value stand and the new one pile on top.

`ElementBehavior` gains `permanent?: string[]` next to `deferred`, and `list()` sets it exactly when both hooks are absent. The fact that a list cannot be torn down is the absence of those hooks, so deriving the declaration there makes the two impossible to disagree: adding a `clear` later drops the guard by itself. Declaring it in the element config would restate what the hooks already say and would not cover behaviors projects define through `defineElements`. `TypeInfo` accumulates `permanent` along the ancestry chain the way it accumulates `deferred`, and `assertConstructOnlyUnchanged` became `assertPropsCanChange` in `packages/react/src/reconciler/apply-props.ts`, checking construct-only props by identity and permanent props by deep equality, each with its own message. `teardownList`'s early return is gone: with no removal hook there is nothing to tear down and the loop simply does not run.

The comparison is `isDeepEqual`, the same one `list()` uses for its snapshot, so `creditSections={[...]}` written inline does not throw on the first re-render, where `Object.is` would have. An absent or empty previous value counts as nothing applied yet, so supplying the list for the first time after mount is allowed, while replacing or removing an applied list throws.

`GtkScale`'s `marks` is not the same shape: it passes `clear: (scale) => scale.clearMarks()`, so it stays replaceable and its existing test still passes. Of every `list()` in the workspace, only `creditSections` and the new `mainOptions` end up permanent; `items`, `widgets`, `vfl`, `actionAccels`, `markedDays`, `offsets`, and Adwaita's `responses` all have a `remove` or a `clear`.

**Also added: `GtkApplication`'s `mainOptions`.** A `list()` calling `gtk_application_add_main_option`, permanent because GLib exposes only `addMainOption` and `addMainOptionEntries`. `MainOption` takes `shortName` as a single character and defaults `flags` and `arg` to `NONE`. The timing works because the behavior's update runs in the reconciler commit and `startApplication` runs in a `useLayoutEffect` afterwards, so an option is registered before GLib parses the command line. That is what `useApplication()` cannot reach, since the application element renders children only after activate.

`packages/e2e/tests/elements/about-dialog.test.tsx` now reads the credits page and asserts each section and person appears once, that changing or removing the list throws, and that an equal array built again on the next render is accepted. `packages/e2e/tests/elements/application.test.tsx` covers `mainOptions`.

---

## 21. `GLib.Variant.newBytestring` truncates binary data at the first NUL

**Severity:** high. Any application storing bytes in a `GVariant`, which is the shape both GNOME's secret storage and GSettings take, loses data with no error.

**Repro:**

```ts
const v = GLib.Variant.newBytestring([1, 2, 0, 3, 4]);
console.log(v.getSize(), v.getDataAsBytes().getData(), v.getBytestring());
```

**Actual:**

```
3   [1, 2, 0]   [1, 2]
```

Five bytes went in, two came out plus a terminator.

**Cause:** `g_variant_new_bytestring` takes a NUL-terminated `const gchar *` and calls `strlen` on it. GIR types that parameter as an array of bytes, so the generated signature is `newBytestring(string: number[])` and the descriptor is `t.array(t.uint8, "array", "borrowed")`, which reads like a byte buffer and is not one. Nothing in the name or the type says the value stops at the first zero.

**Working route**, which round trips every byte:

```ts
const v = GLib.Variant.newFromBytes(GLib.VariantType.new("ay"), GLib.Bytes.new(buf), true);
v.getDataAsBytes().getData();   // [1, 2, 0, 3, 4]
```

**Fix applied:** codegen detects the shape from the GIR and appends a note to the binding's documentation naming the affected parameter, so the constraint shows up in an editor tooltip and in the API reference. The shape is an array whose own `c:type` is a char pointer, whose element is a byte, and which carries no length parameter and no fixed size, which is the only way the C side can be relying on the terminator. `arrayCType` is now captured on `CArrayType`; the array's own `c:type` was previously dropped, and the element `c:type` that was kept is absent on exactly these parameters. Across the configured namespaces that names `g_variant_new_bytestring` and `g_strsplit_set`, both verified in the generated store. The guide's codegen page carries the `GLib.Bytes` route.

A runtime guard was considered and not applied: refusing a buffer containing a zero means threading a flag through the descriptor into the Rust codec, and the note reaches the caller at the point of use instead.

---

## 22. GTKX cannot export a D-Bus object

**Severity:** high. Exporting an object is how an application implements a service, a search provider, or a portal backend, and there is no way to write one.

**Repro:**

```ts
const conn = Gio.busGetSync(Gio.BusType.SESSION, null);
const node = Gio.DBusNodeInfo.newForXml(
    "<node><interface name='com.example.Probe'><method name='Ping'/></interface></node>",
);
const info = node.lookupInterface("com.example.Probe");
conn.registerObject("/com/example/Probe", info, () => console.log("called"), null, null);
await conn.call(conn.getUniqueName(), "/com/example/Probe", "com.example.Probe", "Ping",
    null, null, Gio.DBusCallFlags.NONE, 2000, null);
```

**Actual:** `registerObject` returns a registration id, and the interface even appears in the path's introspection XML, so it reads as a success. The call answers

```
GDBus.Error:org.freedesktop.DBus.Error.UnknownMethod: Object does not exist at path “/com/example/Probe”
```

and the JavaScript function is never invoked. Registering with explicit `null` closures produces the identical error, so the function was silently dropped rather than rejected.

**Cause:** `Gio.DBusConnection.registerObject` and `registerObjectWithClosures2` are both generated, and each takes `GObject.Closure | null` for the method-call, get-property, and set-property handlers. GTKX cannot build a `GObject.Closure` from a JavaScript function. `Closure`'s only statics are `newObject(sizeofClosure, object)` and `newSimple(sizeofClosure, data)`, neither of which binds a callback; `new GObject.Closure()` yields an empty struct and provokes `g_closure_unref: assertion 'old_flags.flags.ref_count > 0' failed`; `CClosure` exposes only marshallers, and `g_cclosure_new` is not generated. `registerObjectWithClosures`, the first spelling, is not generated at all, and nothing in `packages/runtime/src/` handles `GClosure`.

**Fix applied:** entirely in JavaScript, with no native change and no new binding generated. `packages/runtime/src/closure.ts` builds the closure with `g_cclosure_new`, reads the libffi trampoline back out of `GCClosure.callback`, refs and sinks, then installs that trampoline through `g_closure_set_marshal`. `g_closure_set_marshal` is marked `introspectable="0"` in the GIR so codegen never emits it, but `t.bind` is a public runtime export and binds any symbol directly. Conversion stays in `packages/runtime/src/value.ts`: `fromValue` per parameter, `intoValue` for the return, both dispatching on the GValue's own runtime GType.

A second defect surfaced on the way and is fixed with it: `tryGetHandle` was `handleMap.get(instance)`, which returned `undefined` for any non-null value carrying no handle. That is what silently turned a JavaScript function into a NULL closure, and it applied to every nullable handle parameter, not just closures. It now throws.

A parameter whose GType is exactly `G_TYPE_VALUE` is handed to the handler as a live `GObject.Value` borrowing the caller's own GValue rather than the copy `fromValue` would make, because `g_object_bind_property_with_closures` and `g_settings_bind_with_mapping_closures` copy `g_value_get_boxed(&params[i])` back after the invoke and a write into a copy would vanish. The borrow is call-scoped and documented on `ClosureCallback`. No D-Bus closure parameter is a `GValue`, so those handlers still receive decoded values.

Only the parameters a callee actually invokes are widened to accept a function. The `G_SIGNAL_MATCH_CLOSURE` functions, `g_object_watch_closure` and the `g_cclosure_marshal_*` family match or marshal an existing closure, so building a fresh one for them would silently never match and leak; they keep plain handle marshalling. `packages/codegen/src/store/gi/closure-invocation.ts` holds the set, and one predicate drives both the type and the emitted argument so they cannot disagree.

*Carried forward:* the destroy pointer installed in `g_cclosure_new`'s `GClosureNotify` slot has the wrong arity; see entry 27.

---

## 23. `gtkx_fire_event` reports success for a signal that never fires

**Severity:** medium. The tool answers `Fired event` whether or not anything happened, so an agent cannot tell a real emission from a no-op.

**Repro:** take the widget id of a button inside a closed `GtkPopover`, then

```
gtkx_fire_event { widgetId: "...", signal: "activate" }
```

**Actual:** `Fired event`, and `clicked` is never emitted. The button is `realized=false mapped=false`, and `gtk_button_real_activate` bails on an unrealized widget. With the popover open the same call does emit `clicked`, but only after GTK's activate animation of roughly 250 ms, so the emission is asynchronous even when it works.

**Cause:** the handler for `widget.fireEvent` in `packages/cli/src/mcp/handlers.ts` returns `{ success: true }` unconditionally, and the tool in `packages/mcp/src/server.ts` discards the payload and returns the fixed text `Fired event`. There is no channel through which widget state could reach the caller.

**Fix applied:** the handler captures `realized`, `mapped`, and `sensitive` before it emits, and returns them with the signal name and a note that says either that a default handler needing a drawn widget will do nothing, or that an animated default handler settles asynchronously so the widget should be read again. `packages/mcp/src/server.ts` JSON-stringifies the result the way the query tool already does, instead of returning the fixed text `Fired event`.

---

## 24. An interrupted test run leaks its headless compositor

**Severity:** medium. Every interrupted run leaves a compositor behind, and they accumulate until the machine runs out of memory.

**Repro:** start a test run under `@gtkx/vitest`, or a Rust suite through `scripts/run-headless.ts`, and kill it before it finishes.

**Actual:** `weston` (or `sway`) keeps running, reparented to whatever subreaper is nearest, along with its own children: `weston-keyboard`, `weston-desktop-shell`, `swaybg`. A day of interrupted runs left several compositors resident.

**Cause:** two independent gaps. `scripts/run-headless.ts` used `spawnSync` with no parent-death handling at all, so killing the runner orphaned `wlheadless-run`'s compositor outright. `@gtkx/vitest` did wrap its spawns in `setpriv --pdeathsig SIGTERM` with a shell trap, but the trap ran `kill -9 "$child"`, which names only the direct child; a compositor's own children survived it.

**Fix applied:** one `spawnWithParentDeathSignal` in `@gtkx/utils`, used by both. The shell runs the command under `set -m`, so it lands in a process group of its own, and the trap kills that group rather than the single process. Regression tests in `packages/utils/tests/spawn-with-parent-death-signal.test.ts` assert the grandchild dies with the group; they fail against the old script.

---

## 25. A shortcut bound the documented way cannot be pressed from a test

**Severity:** blocker for any app that uses the recommended binding. GTKX documents `actionAccels` on the application as the way to bind a shortcut, and `userEvent.keyboard` cannot reliably reach one.

**Repro:** bind `<Control>f` through `<GtkApplication actionAccels={{ "win.find": ["<Control>f"] }}>`, focus a `GtkLabel` or any widget with a class shortcut on the same key, and press it with `userEvent.keyboard("{Control>}f{/Control}")`.

**Actual:** the action never runs. The focused widget's own shortcut wins.

**Cause:** `packages/testing/src/user-event/keyboard.ts` walked only the target's `GtkEditable` delegate and its ancestor chain, dispatching any `GtkShortcutController` it found. GTK does attach the accelerator table to the window as a controller named `gtk-application-shortcuts`, so an accel did fire whenever nothing nearer claimed the key first. That made the gap look intermittent rather than structural. It is neither: the app controller is `scope=GLOBAL, phase=CAPTURE` and surfaces through `gtk-shortcut-manager-capture`, while widget class shortcuts are `phase=BUBBLE`. Capture runs root-to-target before bubble runs target-to-root, so real GTK fires the accel first and the walk had the order inverted.

**Fix applied:** `didDispatchShortcuts` now tries application accelerators first, then the delegate, then ancestors. The accel path resolves the window through `getRoot()`, reads `getAccelsForAction()` for each entry in `listActionDescriptions()`, matches in keyval plus modifier space through `Gtk.acceleratorParse`, and activates through `Gio.Action.parseDetailedName`.

`getActionsForAccel` is the natural one-call lookup and is deliberately not used: it emits a GLib critical for any accel string it cannot parse, and `G_DEBUG=fatal-criticals` turns that into a dead test worker.

---

## 26. Access keys leak into every computed accessible name

**Severity:** blocker for a HIG-compliant app. GNOME requires an access key on every labelled control, and adding one breaks the app's own tests and misreports its accessibility.

**Repro:** render `<GtkButton label="_Add Connection" useUnderline />`, then query it.

**Actual:** `getByRole("button", { name: "Add Connection" })` finds nothing, `toHaveAccessibleName("Add Connection")` fails, and `gtkx_get_widget_tree` reports `_Add Connection`. GTK's own accessible name for that button is `Add Connection`, so GTKX disagreed with what a screen reader announces.

**Cause:** `stripMnemonic` already existed in `packages/testing/src/widget-accessible-properties.ts` but was reachable from one path only, `namingLabelText`, and gated on `widget instanceof Gtk.Label`. A widget's own label was read raw by three other paths: `readFirstText` (feeding `getWidgetNodeText`, the MCP widget tree and the pretty-printer), `getWidgetLabelText` (feeding `getByText`), and `collectMnemonicMatch` in `queries.ts` (feeding `getByLabelText` through a label's mnemonic widget). `getWidgetAccessibleName` returns the widget's own text before it ever reaches the stripping path, so the mnemonic won.

**Fix applied:** strip whenever a widget's own naming text is read and its `use-underline` property is set, which covers `getLabel` and `getTitle` while leaving an editable's `getText` content alone. `use-underline` is carried by six Gtk widgets and seven Adw ones, including `AdwPreferencesRow`, so `AdwActionRow` and `AdwEntryRow` titles are covered too.

The `gtk-demo` suite had assertions written against the leaked names: `_Refill`, `_OK`, `_Open`, `_Copy`, `_Foreground` and the rest, across eleven files. Those now assert the drawn name. The one assertion that legitimately reads the raw GObject `label` property keeps its underscore.

---

## 27. Every `GClosure` GTKX builds installs a one-argument destroy where GLib calls a two-argument one

**Severity:** low today, and not fixable from JavaScript. It is a function-pointer type mismatch, so it is undefined behavior rather than a wrong result, and it is invisible on the SysV ABIs this project targets. Control-flow integrity, `-fsanitize=function`, and any ABI that checks arity would trap on it.

**Repro:** any use of the closure support added for entry 22, including `Gio.DBusConnection.registerObject` with a JavaScript handler. `toClosure` in `packages/runtime/src/closure.ts` describes the marshaller with `callbackT(..., { userDataIndex: 5, hasDestroy: true, scope: "notified" })` and hands it to `g_cclosure_new`.

**Actual:** `CallbackCodec::encode` (`packages/native/src/ffi/codec/callback.rs`) puts `ClosureState::destroy as *mut c_void` in the destroy slot, and that function is declared `unsafe extern "C" fn(user_data: *mut c_void)` in `packages/native/src/ffi/closure.rs`. The slot it lands in is `g_cclosure_new`'s `GClosureNotify`, `void (*) (gpointer data, GClosure *closure)`, and GLib calls it with both arguments: `ndata->notify (ndata->data, closure)` in `closure_invoke_notifiers`, `gobject/gclosure.c` of glib 2.88.1. The second argument is passed in a register the callee never reads, so the closure state is still freed correctly.

**Cause:** the JavaScript descriptor layer chooses whether a destroy is installed, never what its signature is. `has_destroy` is a `bool`, and the pointer it selects is fixed in Rust. So the only destroy GTKX can hand to a C API is a `GDestroyNotify`.

There is no JavaScript-only way around it. Every GLib entry point that frees closure user data on finalize types that slot as `GClosureNotify`: `g_cclosure_new`, `g_cclosure_new_swap`, `g_closure_add_finalize_notifier`, and `g_closure_add_invalidate_notifier`. A correctly typed two-argument trampoline can be built from JavaScript with `callbackT([uint64T, CLOSURE_T], voidT, ...)`, but nothing can free the marshaller it would exist to free: `call` scope releases on return, `async` releases after one invocation, `notified` needs the very destroy slot that is missing, `forever` never releases, and no exported native function releases another callback's trampoline. Installing the notifier by hand does not help either, because `g_closure_add_finalize_notifier` takes its data before its function pointer while the callback codec always emits the pointer first.

**Fix applied:** native. `ClosureState::destroy_as_closure_notify` in `packages/native/src/ffi/closure.rs` is declared `extern "C" fn(*mut c_void, *mut c_void)` and forwards to `ClosureState::destroy`, so the in-flight and off-thread deferrals stay one implementation rather than a second copy of the rules. A `destroyKind` descriptor field, `destroyNotify` or `closureNotify`, selects which pointer `CallbackCodec::encode` installs. It defaults to `destroyNotify`, so a callback whose GIR carries a `destroy` annotation keeps the `GDestroyNotify` its C signature asks for. Two sites opt in, and they are the only two bound entry points that take a `GClosureNotify`: `MARSHAL_T` in `packages/runtime/src/closure.ts` for `g_cclosure_new`, and the signal descriptor codegen synthesizes in `packages/codegen/src/store/gi/signal.ts` for `g_signal_connect_data`, which `gsignal.h` declares as `GClosureNotify destroy_data`. The signal path is the higher-traffic one, since every signal connection in every application goes through it.

The arity is correct by construction, because the declaration now matches `GClosureNotify`, not because anything behaves differently: no test can tell the two apart on this ABI, since the wrong one already worked. The tests cover the selection and the release instead. `packages/native/tests/callback_codec.rs` and `descriptor_into_codec.rs` assert which entry point each kind installs and that an unset field still asks for the one-argument destroy; `packages/native/tests/closure.rs` asserts the two-argument entry point releases the callback reference and that a destroy landing mid-invocation is still deferred to the idle; `packages/e2e/tests/runtime/closure.test.ts` asserts a handler captured by a `FinalizationRegistry` is released once its `GClosure` finalizes.

---

## Verified working

Recorded so nobody re-tests them:

- `pnpm create gtkx@1.0.0-rc.4` pins `@gtkx/*` to `^1.0.0-rc.4` and resolves correctly; the `rc` dist-tag is right.
- `gtkx codegen` regenerates cleanly for `Gtk-4.0`, `Adw-1`, `GtkSource-5`, including the `@gtkx/gi` and `@gtkx/jsx` stores and the symlinks.
- `tsc --noEmit`, `gtkx build`, and `vitest run` all pass on a fresh scaffold.
- `gtkx dev` runs against a live GNOME Wayland session and Fast Refresh connects. Running the CLI from source starts the application too (entry 16), verified under the headless compositor.
- The MCP server serves several projects in one session: each reference call is scoped to the project it names or the one the server was launched in, and apps report their project root when they register (entry 15).
- `gtkx_list_apps`, `gtkx_list_api`, `gtkx_search_api`, and `gtkx_get_api_docs` all behave as documented. The reference pages carry upstream documentation, prop types with defaults, signal signatures, methods, hierarchy, and the correct import line.
- `gtkx_take_screenshot` captures the window, including any open popover (entries 10 and 19), and names the display rather than the widget when it cannot. The shape not exercised here is a live session whose compositor withholds frame callbacks from a mapped surface; see entry 10.
- `gtkx_get_widget_tree` and the testing pretty-printer no longer carry text GTK hides (entry 17).
- `gtkx_query_widgets` and `gtkx_fire_event` are not on this list: entry 18 leaves the tool's description wrong, and entry 23 is open against `gtkx_fire_event`.
