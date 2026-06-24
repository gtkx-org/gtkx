# Testing architecture

gtkx tests run a real GTK4 process headlessly and assert on the live GObject widget tree. Three packages cooperate: `@gtkx/vitest` provisions an isolated headless display per worker, `@gtkx/testing` is a Testing Library-style harness over actual widgets, and `@gtkx/e2e` is the private in-repo suite that exercises the whole framework against that harness.

This document covers how those layers fit together. It does not re-explain the reconciler, FFI marshalling, or GLib-thread mechanics that the tests exercise, nor the resolved config and codegen metadata the harness boots against — see [./architecture.md](./architecture.md).

## Boot sequence

A test run comes up in three stages, each owned by a different package:

1. **Vitest plugin** (`@gtkx/vitest`) configures the Vitest project so each worker is a separate process, prepends a per-worker setup file, inlines the gtkx workspace packages, raises timeouts, and wires the gtkx config virtual module exactly as production does.
2. **Worker setup** runs once per forked worker before any test: it marks the React act environment and stands up an isolated headless display the GTK process can render into.
3. **Harness runtime** (`@gtkx/testing`) is pulled in when a test imports it: importing it rewires `@gtkx/react`'s deferred flush and application lifecycle for tests, after which `render()` and the query/event API are usable.

## The Vitest plugin

`@gtkx/vitest` exports a single zero-arg plugin. It reuses `@gtkx/config`'s Vite plugin, so the gtkx config virtual module — resolved config fused with codegen metadata — resolves identically to a production build (see [./architecture.md](./architecture.md) for what that module carries). On top of that base it injects Vitest test settings:

- A forked-process pool, so each worker gets its own GTK-capable display and its own one-shot native runtime. The native addon's init and quit are terminal, so workers cannot share or restart it.
- A prepended worker setup file, ahead of any user setup files.
- Inlined gtkx workspace packages and the generated binding store, so they are transformed rather than treated as external.
- Raised test and hook timeouts, since booting a compositor and a real GTK frame is slower than a DOM test.
- Resolve conditions matching the module graph the runtime expects.

## Per-worker headless display isolation

The worker setup is the substrate that lets a genuine GTK process run in CI with no GPU and no shared system services. Before any test it marks the React act environment, then provisions a private, self-contained display: an isolated runtime directory, a private message bus, and a headless Wayland compositor, with software rendering forced and settings writes kept off the host. Every child process is parented to the worker so the compositor and bus die with it rather than leaking, and the worker waits for the display to be ready before any test starts. The compositor and output resolution are selectable through environment variables.

The harness reads widget accessibility through a test accessibility backend enabled in this same environment, so the query API sees the accessibility tree GTK exposes.

## Act-driven determinism

Every harness mutation runs inside React's `act()` so the reconciler and any deferred GTK work settle before assertions. `render`, `rerender`, `unmount`, `fireEvent`, and the `userEvent`/`fireEvent` helpers wrap their work in act and ensure the act environment is active for the duration.

Importing `@gtkx/testing` rewires two pieces of `@gtkx/react` for tests:

- **Deferred-flush wrapper.** Some deferred work (such as list item rebuilds) can flush outside an existing act queue. The wrapper detects when no act queue is installed and re-enters `act()` around the flush, so stray flushes never trigger "not wrapped in act" warnings.
- **Application lifecycle override.** Activating an `Application` registers and activates it synchronously instead of entering a blocking GTK main loop, and quitting is a no-op. So rendering an `Application` returns immediately, and the app is torn down only by `unmount`/`cleanup`.

Tests that need the real, non-act render path — exercising the production root flow or screenshotting a presented window — turn the act environment off through the `@gtkx/testing/act` subpath, which exports the act helpers and the environment toggle.

## render and cleanup

`render(element, options)` is async. It installs a shared reconciler error handler (so render-time throws surface as a rejected promise), resolves a container (a caller-supplied offscreen root, a caller-supplied widget, or a freshly created harness window), drives React into that container inside `act()` — optionally wrapped in a `wrapper` component and/or `StrictMode` — presents the harness window if one was created, and returns a `RenderResult`: the bound queries plus `container`, `baseElement`, `unmount`, `rerender`, `debug`, `logRoles`, and `screenshot`.

**Base element defaults to all toplevels.** Queries run against a tracked `baseElement` that defaults to every live toplevel window, not the returned container, so a test finds widgets through whatever the app actually presented. Pass `container`/`baseElement` explicitly to scope a query to one subtree.

`cleanup()` unmounts every active render and destroys any harness window, then resets the screen and clipboard. It is **not** automatic; suites must register it (the e2e setup runs it after each test and after all tests), or leaked windows persist across tests.

`renderHook(callback, options)` renders a null component offscreen, captures the hook's return into a ref, and returns `{ result, rerender, unmount }`.

`screen` is a module-level proxy that forwards to the most recent `render()` result and throws a guiding error if no render has happened.

## Queries

The query surface mirrors Testing Library. Each family has `queryBy` / `getBy` / `getAllBy` / `findBy` / `findAllBy` variants: `query*` returns null or throws on multiples, `get*` throws on missing or multiples, `find*` retries `get*` until it succeeds or times out. Queries are bound to a `baseElement`; `within(widget)` re-binds the same family to any subtree.

Families and what they read:

| Family | Source |
| --- | --- |
| `ByRole` | accessible role plus accessibility name/state/value options |
| `ByText` | label text of label widgets |
| `ByLabelText` | mnemonic targets and accessible-label text |
| `ByName` | the widget name |
| `ByPlaceholderText` | placeholder of editable widgets |
| `ByDisplayValue` | current text of editable widgets |

Matchers accept a string, number, `RegExp`, or `(content, widget) => boolean`, with the usual matcher options (`exact`, `normalizer`, `trim`, `collapseWhitespace`). `byRole` additionally filters on accessibility state (checked, pressed, expanded, selected, busy, level, description, and a value object), plus `hidden` to include accessibility-hidden widgets.

The harness reads accessibility state from one place that stays aligned with the accessibility model the reconciler maintains, reading directly from typed widgets only where GTK exposes a state the reconciler does not track. Accessible name falls back from the accessible label, to widget text getters, to concatenated child-label text.

## Real-input simulation

Interactions emit real GTK signals or drive real controllers rather than synthesizing a DOM event, so behavior matches GTK.

`userEvent` is both a default singleton and a `userEvent.setup()` factory. Stateless helpers (click, gestures, selection, clipboard) are shared; keyboard and pointer carry per-instance state — the modifier mask and mouse-down flag — so a `setup()` instance does not share state with the default singleton.

How each kind of input is driven:

- **Click / pointer** — adopts or creates a click gesture on the widget and emits its press/release sequence; for non-button widgets it tries to activate the widget, then falls back to the nearest clickable ancestor. Pointer input uses Testing Library pointer-token syntax.
- **Keyboard** — adopts a key controller and emits key press/release with the running modifier mask, using brace-token syntax (`{Enter}`, `{Shift>}`, `{/Shift}`); plain characters press and release. On press it also dispatches matching shortcuts and activates editables on Return.
- **Typing** — operates the widget's editable delegate, honoring an optional initial selection and a leading focus grab; only editable-text roles are accepted.
- **Gestures** — find the relevant gesture or motion controller and emit its signals; drag makes handlers observe a consistent offset, and drop emits a drop with a marshalled value.
- **Selection** — operates the real selection model behind dropdowns, list boxes, and list/grid/column views.

`fireEvent(object, signalName, ...args)` is the low-level escape hatch: it emits a raw GObject signal inside `act()`.

## Async utilities

`waitFor(callback, options)` polls `callback` until it stops throwing or the timeout elapses. It runs the callback with the act environment temporarily off and drains microtasks between attempts, so polling does not fight the act machinery. `waitForElementToBeRemoved` waits until a widget (or every widget in an array) is no longer rooted. `find*` queries and `screenshot` build on `waitFor`, and its timeout is configurable.

## Screenshots

`screenshot(widget, options)` paints the widget through GTK's snapshot and rasterization path and returns the PNG base64-encoded with its dimensions, retrying until the widget has a realized non-zero size so it tolerates a not-yet-laid-out widget. A saving variant resolves a toplevel window (by index, title substring, or `RegExp`), captures it, writes the PNG to a temp dir, and logs the path; `RenderResult.screenshot` is that variant.

## Diagnostics

Query failures produce Testing Library-style errors that describe the query in prose, append a pretty-printed widget tree, and — for failing role queries — list the accessible roles present in the container. The harness can suggest the best query for a widget in priority order (role first, then label/placeholder/text/display-value/name), render the widget tree, and enumerate roles. A `configure`/`getConfig` pair exposes the suggestion toggle, a custom error factory, and the async timeout.

## The e2e suite

`@gtkx/e2e` is a private workspace that runs the whole stack against the harness. Its tests are grouped by concern:

- **nodes** — per-widget behavior, grouped by widget kind: lists, columns, notebooks, menus, constraint layout, dialogs, editables, and so on.
- **hooks** — React hook behavior.
- **bench** — Vitest benchmarks (reconcile, mount, update, list, and call-overhead) run under the CodSpeed plugin.
- **helpers** — shared render fixtures and the real-render-environment switch.
- **fixtures** — GSettings schema definitions plus their compiled form.

The shared setup compiles the GSettings schema fixtures, points GTK at them, forces the memory GSettings backend, and registers `cleanup()` after each test and after all tests. Two Vitest configs wire the plugin — one for the behavior suite and one adding the CodSpeed plugin and a benchmark glob — both referencing that setup.

The MCP server's dev-runner client fulfils widget-inspection requests through this same `@gtkx/testing` query/interaction surface.
