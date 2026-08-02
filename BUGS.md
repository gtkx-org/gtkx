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

**Cause:** `packages/create-gtkx/src/templates/package.json.ejs:18` writes

```json
"allowScripts": {
    "esbuild": true,
    "@swc/core": true
}
```

`allowScripts` is an npm field. pnpm does not read it. pnpm takes `allowBuilds` in `pnpm-workspace.yaml`, or `pnpm.onlyBuiltDependencies` in `package.json`. So `@swc/core`'s postinstall is gated, pnpm exits non-zero, and the scaffolder aborts its install step.

This repository already knows the right answer: `pnpm-workspace.yaml:33` uses `allowBuilds`. The template just does not emit the pnpm form.

**Knock-on effects:**

- The scaffolder aborts before `git init`, so a pnpm-scaffolded project is left without the repository the npm path creates. The two package managers produce different project states.
- The suggested recovery (`cd demo && pnpm install`) does not fix it either. pnpm rewrites `pnpm-workspace.yaml` with a placeholder, `'@swc/core': set this to true or false`, that the user has to resolve by hand before any install succeeds.
- `esbuild` is listed in `allowScripts` but is not in the generated `pnpm-workspace.yaml` placeholder, so the pnpm form needs both entries written explicitly.

**Fix:** emit the package-manager-appropriate build-script allowance. For pnpm, write `allowBuilds` into the generated `pnpm-workspace.yaml`; keep `allowScripts` for npm. The scaffolder already branches on the selected package manager, so this belongs next to that branch rather than in the shared template.

---

## 2. Scaffolded projects never typecheck their tests

**Severity:** high. A type error in a test file passes `typecheck` and CI silently.

**Repro:**

```sh
pnpm create gtkx@1.0.0-rc.4 demo --typescript --vitest --yes
cd demo && pnpm exec tsc --noEmit --listFiles | grep -E '/(src|tests)/'
```

**Actual:** only `src/app.tsx`, `src/gtkx-env.d.ts`, and `src/index.tsx` are checked. `tests/app.test.tsx`, which the same scaffolder just generated, is not.

**Cause:** the generated `tsconfig.json` sets `"include": ["src/**/*"]` with `"rootDir": "src"`, while `--vitest` generates `tests/` and a `test` script. Nothing ever type-checks that directory.

**Fix:** when `--vitest` is passed, include `tests` in the program. `rootDir` has to widen or move for that to work, so this is a small restructure of the emitted `tsconfig.json` rather than a one-line include change.

---

## 3. `out-tsc` is not gitignored

**Severity:** low.

The generated `tsconfig.json` sets `"outDir": "out-tsc"`, and the generated `.gitignore` lists only `node_modules/`, `dist/`, and `*.log`. Any `tsc` invocation without `--noEmit` leaves an untracked build directory in the user's repository. Add `out-tsc/` to the template `.gitignore`.

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

**Fix:** add an `## Optional` section, which is what the llms.txt spec reserves for secondary material, linking a `/reference/` index page, and add the blog. Full expansion of every symbol page into `llms-full.txt` is not necessary; a reachable index is.

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

**Cause:** `packages/cli/src/vite-plugins/built-url.ts:13` and `:17` hardcode `require("path")` into the `renderBuiltUrl` runtime string. Scaffolded projects are `"type": "module"` and the bundle is ESM. Rolldown's automatic `createRequire` shim only covers `require()` it sees while analyzing module source; `renderBuiltUrl` injects its string at render time, after that analysis, so the bare `require` survives into the output.

**Trigger:** an emitted asset, not a third-party dependency. A project with no assets builds and runs cleanly with `--asset-base`, which is why this does not show up on a bare scaffold.

**Fix:** emit an ESM-safe expression. `process.execPath` is available without `require`, so the join can use `import.meta.dirname`, or the plugin can emit a `node:path` import and reference it.

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

`new Worker(new URL(..., import.meta.url))` is the canonical form Vite and Rolldown detect to emit a worker chunk. GTKX's build produces no chunk for it and issues no warning, so the first sign of trouble is a runtime failure in a packaged app.

**Why it matters here:** GTKX drives the GLib main context from a libuv prepare callback on the Node main thread, so synchronous JS blocks GTK for its full duration. Workers are the sanctioned answer, and the build cannot ship one.

**Fix:** either emit worker chunks, or fail the build with a clear error when a worker URL is detected and unsupported. Silently emitting a dangling reference is the worst of the three.

---

## 7. The `AdwSidebar` and `AdwMultiLayoutView` families render nothing

**Severity:** high. They type-check, they compile, they mount, and they silently do nothing.

`AdwSidebar`, `AdwSidebarSection`, `AdwSidebarItem`, `AdwMultiLayoutView`, `AdwLayout`, and `AdwLayoutSlot` are all generated as mountable JSX elements (`isMountable: true` in the generated `elements.json`). None of them appears anywhere in `packages/react/src`, so none has a registered element behavior.

Their child APIs are methods, not properties: `adw_sidebar_append`, `adw_multi_layout_view_add_layout`. With no behavior to claim the children, the reconciler falls through to setting a named property that does not exist, so children are dropped without an error.

`AdwViewSwitcherSidebar` is unaffected because it takes no children and derives its items from a `stack` prop.

**Fix:** register behaviors for these types, or exclude them from element generation until they have one. Generating a mountable element with no way to populate it is worse than not generating it.

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

## 10. `screenshot()` misdiagnoses a display that is not presenting frames

**Severity:** medium, but it lands squarely on the MCP agent workflow, which is a headline use case.

**Symptom:** `gtkx_take_screenshot` against a live session fails with

```
Timed out after 1000ms.
Widget produced no render content (realized=true mapped=true visible=true)
```

The message points at the widget, so it reads as an application bug. The widget is fine.

**Cause:** `packages/testing/src/screenshot.ts` captures through `Gtk.WidgetPaintable`, which serves the widget's last *presented* render node. When the compositor is not presenting the surface, no frame callback arrives, the frame clock never ticks, and the cached node is never regenerated. Measured against a GNOME Wayland session with nothing viewing the window:

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

**Fix:** the retry loop cannot help here, so it should stop pretending. Check `widget.getFrameClock()?.getFrameCounter()`; when it has not advanced, fail immediately with the real reason, that the display is not presenting frames to this window, rather than burning the timeout and blaming the widget. Capturing without depending on a presented frame would be better still, but the accurate diagnosis is the part that matters.

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

**Still open:** `runApplication` never passes `argv`, so GApplication's own command-line options, including `--gapplication-service`, are inert. That matters for D-Bus activation, where the service file's `Exec` conventionally carries that flag.

---

## Verified working

Recorded so nobody re-tests them:

- `pnpm create gtkx@1.0.0-rc.4` pins `@gtkx/*` to `^1.0.0-rc.4` and resolves correctly; the `rc` dist-tag is right.
- `gtkx codegen` regenerates cleanly for `Gtk-4.0`, `Adw-1`, `GtkSource-5`, including the `@gtkx/gi` and `@gtkx/jsx` stores and the symlinks.
- `tsc --noEmit`, `gtkx build`, and `vitest run` all pass on a fresh scaffold.
- `gtkx dev` runs against a live GNOME Wayland session and Fast Refresh connects.
- The MCP server picks up the running app's project root and rescopes its API reference to that project's configured libraries automatically, so one server correctly serves several projects in a session.
- `gtkx_list_apps`, `gtkx_take_screenshot`, `gtkx_list_api`, `gtkx_search_api`, and `gtkx_get_api_docs` all behave as documented. The reference pages carry upstream documentation, prop types with defaults, signal signatures, methods, hierarchy, and the correct import line.
