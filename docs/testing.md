# Testing architecture

gtkx tests run a real GTK4 process headlessly and assert on the live GObject widget tree. Three packages cooperate: `@gtkx/vitest` provisions an isolated headless display per worker, `@gtkx/testing` is a Testing Library-style harness over actual widgets, and `@gtkx/e2e` is the private in-repo suite that exercises the whole framework against that harness.

This document covers how those layers fit together. It does not re-explain the reconciler, FFI marshalling, or GLib-thread mechanics that the tests exercise, nor the resolved config and codegen metadata the harness boots against — see [./architecture.md](./architecture.md).

## Boot sequence

A test run comes up in three stages, each owned by a different package:

1. **Vitest plugin** (`@gtkx/vitest`) configures the Vitest project: forces the forks pool, prepends a per-worker setup file, inlines the gtkx workspace deps, raises timeouts, and wires the gtkx config virtual module exactly as production does.
2. **Worker setup** runs once per forked worker before any test: it marks the React act environment, stands up a private XDG runtime dir, a D-Bus session bus, and a headless Wayland compositor, then exports the display/GTK environment.
3. **Harness runtime** (`@gtkx/testing`) is pulled in when a test imports it: a side-effect module rewires `@gtkx/react`'s deferred flush and application lifecycle for tests, after which `render()` and the query/event API are usable.

```
vitest.config → gtkx() plugin
  └─ pool=forks, setupFiles=[worker-setup, …], inline deps, virtual:gtkx-config
       └─ worker setup (per fork)
            ├─ IS_REACT_ACT_ENVIRONMENT = true
            ├─ private XDG_RUNTIME_DIR (0700)
            ├─ dbus-daemon on a private session bus
            └─ headless Wayland compositor + GTK/GSK env
                 └─ test imports @gtkx/testing
                      ├─ setup-runtime rewires @gtkx/react
                      └─ render / queries / userEvent
```

## The Vitest plugin

`@gtkx/vitest` exports a single zero-arg plugin used as `plugins: [gtkx()]`. It delegates to `@gtkx/config`'s `createGtkxConfigPlugin`, so the `virtual:gtkx-config` module — resolved config fused with codegen metadata — resolves identically to a production build (see [./architecture.md](./architecture.md) for what that module carries). On top of that base it injects Vitest test settings:

- `pool: "forks"` — each worker is a separate process, so each gets its own GTK-capable display and a one-shot native runtime (the native addon's init/quit is terminal, so workers cannot share or restart it).
- A prepended worker setup file, ahead of any user `setupFiles`.
- Inlined gtkx workspace packages and the `.gtkx` generated store, so they are transformed rather than treated as external.
- Raised test/hook timeouts, since booting a compositor and a real GTK frame is slower than a DOM test.
- SSR resolve conditions matching the source/module/node graph the runtime expects.

## Per-worker headless display isolation

The worker setup file is the substrate that lets a genuine GTK process run in CI with no GPU and no shared system services. Before any test:

- It sets `IS_REACT_ACT_ENVIRONMENT` so React knows it is under `act()`.
- It creates a private `XDG_RUNTIME_DIR` (mode 0700) under the temp dir; everything below lives inside it.
- It writes a D-Bus session bus config and spawns `dbus-daemon` on a private socket, exporting `DBUS_SESSION_BUS_ADDRESS`.
- It spawns a headless Wayland compositor and waits for its socket to appear before proceeding.

Every child is spawned through `setpriv --pdeathsig SIGKILL`, so the compositor and bus die with the worker rather than leaking. The worker awaits both the compositor socket file and the bus socket before any test starts.

**Compositor choice is env-driven.** The default is Weston (`--backend=headless --renderer=pixman --fake-seat`, socket `wayland-0`). Setting `GTKX_COMPOSITOR=sway` switches to Sway with a generated config that disables XWayland, removes borders, floats every window, and drives a headless wlroots output with the pixman software renderer. `GTKX_HEADLESS_SIZE` (default `1024x768`) sets the output resolution.

The exported GTK environment keeps the process CI-safe:

- `WAYLAND_DISPLAY` / `GDK_BACKEND=wayland` point GTK at the headless compositor.
- `GSK_RENDERER=cairo`, `LIBGL_ALWAYS_SOFTWARE=1`, and disabled Vulkan force pure software rendering.
- `GTK_A11Y=test` enables the test accessibility backend the queries read from.
- `GSETTINGS_BACKEND=memory` keeps settings writes off the host.

## Act-driven determinism

Every harness mutation runs inside React's `act()` so the reconciler and any deferred GTK work settle before assertions. `render`, `rerender`, `unmount`, `fireEvent`, and all `userEvent`/`fireEvent` helpers wrap their work in the harness `act` wrapper, which also flips `IS_REACT_ACT_ENVIRONMENT` on for the duration and restores it after.

The `setup-runtime` side-effect module rewires two pieces of `@gtkx/react` for tests:

- **Deferred-flush wrapper.** List bound-item rebuilds can flush outside an existing act queue. The wrapper checks whether an act queue is already installed (via React's client internals) and, if not, re-enters `act()` around the flush — so stray flushes never trigger "not wrapped in act" warnings. The `act-safety` e2e spec asserts these warnings stay empty when column structure or a cell renderer's identity changes.
- **Application lifecycle override.** `setApplicationLifecycle` replaces the production run/quit: activating an `Application` registers and activates it synchronously instead of entering a blocking GTK main loop, and `quit` is a no-op. So `render()` of an `Application` returns immediately, and the app is torn down only by `unmount`/`cleanup`.

Tests that need to drive the real (non-act) render path — exercising the production `createRoot` flow or capturing a screenshot of a presented window — flip `IS_REACT_ACT_ENVIRONMENT` off via the `@gtkx/testing/act` subpath, which exports `act`, `getIsReactActEnvironment`, and `setIsReactActEnvironment`. The e2e `real-render-environment` helper does this in `beforeEach`/`afterEach`.

## render and cleanup

`render(element, options)` is async. It:

1. Installs a single shared reconciler error handler on first call (errors captured here are rethrown by the next `act` cycle, so render-time throws surface as a rejected `render()` promise).
2. Resolves the container to one of three things — a caller-supplied `RootElement` (offscreen), a caller-supplied `Gtk.Widget`, or a freshly created harness `Gtk.Window` (with a button-less `HeaderBar`).
3. Creates a reconciler root over that container and drives React inside `act()`, optionally wrapping in a `wrapper` component and/or `StrictMode`.
4. Presents the harness window if one was created.
5. Returns a `RenderResult`: bound queries plus `container`, `baseElement`, `unmount`, `rerender`, `debug`, `logRoles`, and `screenshot`.

**Base element defaults to all toplevels.** Queries run against a separately tracked `baseElement` that defaults to the `TOPLEVELS` sentinel — every live toplevel window — not the returned container. So a test using a harness window finds widgets through whatever the app actually presented. Pass `container`/`baseElement` explicitly to scope a query to one subtree.

`cleanup()` unmounts every active render (running `act(null)` then destroying any harness window) and resets the screen and clipboard. It is **not** automatic in `@gtkx/testing`; the e2e `tests/setup.ts` registers it in `afterEach` and `afterAll`. Consumers must do the same or leaked windows persist across tests.

`renderHook(callback, options)` renders a null component into an offscreen `RootElement`, captures the hook's return into a ref, and returns `{ result, rerender, unmount }`.

`screen` is a module-level proxy that forwards to the most recent `render()` result and throws a guiding error if no render has happened.

## Queries

The query surface mirrors Testing Library. Each family has `queryBy` / `getBy` / `getAllBy` / `findBy` / `findAllBy` variants built by a shared `buildQueries` helper: `query*` returns null or throws on multiples, `get*` throws on missing or multiples, `find*` wraps `get*` in `waitFor`. Queries are bound to a `baseElement` by `bindQueries`; `within(widget)` re-binds the same family to any subtree.

Families and what they read:

| Family | Source |
| --- | --- |
| `ByRole` | `getAccessibleRole()` plus accessibility name/state/value options |
| `ByText` | label text of `LABEL`-role widgets |
| `ByLabelText` | mnemonic targets, own `accessibleLabel`, and `accessibleLabelledBy` text |
| `ByName` | `getName()` |
| `ByPlaceholderText` | placeholder of editable widgets |
| `ByDisplayValue` | current text of editable widgets |

Matchers accept a string, number, `RegExp`, or `(content, widget) => boolean`, with `MatcherOptions` (`exact`, `normalizer`, `trim`, `collapseWhitespace`). `byRole` additionally filters on accessibility state: `name`, `checked`, `pressed`, `expanded`, `selected`, `busy`, `level`, `description`, and a `value` object (`now`/`min`/`max`/`text`), plus `hidden` to include accessibility-hidden widgets (a widget is hidden if it or any ancestor is invisible or marked `accessibleHidden`).

### Accessibility-first extraction

`widget-text.ts` is the single place that reads GTK accessibility state off GObjects. Most values come from `getAccessibleMetadata` in `@gtkx/react` (`accessibleLabel`, `accessibleLabelledBy`, `accessibleDescription`, `accessibleValueNow/Min/Max/Text`, `accessibleLevel`, `accessibleBusy`, `accessibleHidden`), keeping the harness aligned with the same accessibility model the reconciler maintains. Some states are read directly from typed widgets where GTK exposes them — `CheckButton`/`Switch` active state for checked, `ToggleButton` for pressed, `Expander`/`TreeExpander` for expanded, `ListBoxRow`/row state flags for selected. Accessible name falls back from `accessibleLabel` to default text getters (`getLabel`/`getText`/`getTitle`) to concatenated child-label text, with a special case for stack tab panels resolving their page title.

## Real-input simulation

Interactions emit real GTK signals or drive real controllers rather than synthesizing a DOM event, so behavior matches GTK.

`userEvent` is both a default singleton and a `userEvent.setup()` factory. Stateless helpers (`click`, `tab`, gestures, selection, clipboard) are shared; `keyboard` and `pointer` carry per-instance state — the modifier mask and mouse-down flag — created by `setup()`. The `type` helper is also rebound per instance, but only to close over the instance's `skipClick` option; it holds no modifier or mouse state. The default singleton has its own state object, so mixing it with a `setup()` instance does not share modifier state.

How each kind of input is driven:

- **Click / pointer** — adopts or creates a `GestureClick` on the widget and emits `pressed`/`released`. For a `Button`, `click` emits the press/release sequence directly; otherwise (and for non-label widgets) it first tries `widget.activate()`, then falls back to clicking the nearest clickable ancestor — the closest enclosing `Button` or widget that already carries a `GestureClick`. Pointer tokens use `[MouseLeft]` / `[MouseLeft>]` / `[/MouseLeft]` (or `click`/`down`/`up`).
- **Keyboard** — adopts an `EventControllerKey` and emits `key-pressed`/`key-released` with the running modifier mask. Input uses brace-token syntax (`{Enter}`, `{Shift>}`, `{/Shift}`); plain characters press and release. On press it also walks the widget (and its editable delegate) dispatching matching `ShortcutController` shortcuts, and activates editables on Return.
- **Typing** — operates the `Editable` delegate: `Text`/`TextView` get an `insert-at-cursor` signal, other editables go through `insertText`/`setPosition`. Honors optional initial selection and a leading focus grab. Only `TEXT_BOX`, `SEARCH_BOX`, and `SPIN_BUTTON` roles are accepted; others throw.
- **Gestures** — find the relevant controller (`GestureRotate`, `GestureZoom`, `GestureSwipe`, `GestureLongPress`, `GestureDrag`, `EventControllerMotion`) and emit its signals; drag temporarily patches the gesture's start-point/offset getters so handlers observe a consistent drag. Drop emits a `DropTarget` `drop` with a marshalled `GValue`.
- **Selection** — operates the real selection model: `DropDown`/`ComboBox` setters, `ListBox` row select/unselect, or `SelectionModel` bitset selection for `ListView`/`GridView`/`ColumnView`.

`fireEvent(object, signalName, ...args)` is the low-level escape hatch: it emits a raw GObject signal inside `act()`.

## Async utilities

`waitFor(callback, options)` polls `callback` until it stops throwing or the timeout elapses (default timeout 1000ms from config, default interval 50ms). It runs the callback with the act environment temporarily off and drains microtasks between attempts, so polling does not fight the act machinery. `waitForElementToBeRemoved` waits until a widget (or all widgets in an array) report no root. `find*` queries and `screenshot` are built on `waitFor`. Timeouts are tunable via `configure({ asyncUtilTimeout })`.

## Screenshots

`screenshot(widget, options)` renders the widget through a `WidgetPaintable` into a `Gsk.Snapshot`, rasterizes the resulting render node with a `Gsk.CairoRenderer`, and returns the PNG base64-encoded with its dimensions. It retries via `waitFor` until the widget has a non-zero realized size, so it tolerates a not-yet-laid-out widget. `captureAndSaveScreenshot(selector, options)` resolves a toplevel window by index, title substring, or `RegExp` (default: first toplevel), captures it, writes the PNG to a temp dir, and logs the path. The `RenderResult.screenshot` method is this saving variant.

## Diagnostics

Query failures produce Testing Library-style errors. `notFoundError`/`multipleFoundError` describe the query in prose, append a pretty-printed widget tree, and — for failing `byRole` queries when `showSuggestions` is on — list the accessible roles present in the container. `getSuggestedQuery` proposes the best query for a widget in priority order (Role, then label/placeholder/text/display-value/name). `prettyWidget`/`logWidget` render the tree, and `getRoles`/`logRoles`/`prettyRoles` enumerate roles. `configure`/`getConfig` expose `showSuggestions`, `getElementError`, and `asyncUtilTimeout`.

## The e2e suite

`@gtkx/e2e` is a private workspace that runs the whole stack against the harness. Its `tests/` directory is grouped by concern:

- **`nodes/`** — per-widget behavior, grouped by widget kind: lists, columns, notebooks, menus, constraint layout, dialogs, editables, and so on.
- **`hooks/`** — React hook behavior (`useProperty`, `useSignal`, `useSetting`, `useTickCallback`).
- **`bench/`** — Vitest benchmarks (reconcile, mount, update, list, and call-overhead benchmarks) run under the CodSpeed plugin.
- **`helpers/`** — shared render fixtures and the real-render-environment switch.
- **`fixtures/`** — GSettings schema XML plus its compiled form.

`tests/setup.ts` compiles the GSettings schema fixtures with `glib-compile-schemas`, prepends the fixtures dir to `GSETTINGS_SCHEMA_DIR`, forces the memory GSettings backend, and registers `cleanup()` in `afterEach`/`afterAll`. Two Vitest configs wire the plugin: `vitest.config.ts` for the behavior suite and `vitest.bench.config.ts` adding the CodSpeed plugin and a benchmark glob. Both reference the same setup file.

The MCP server's dev-runner client fulfils widget-inspection requests through this same `@gtkx/testing` query/interaction surface.
