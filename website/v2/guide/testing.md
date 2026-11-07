---
title: "Testing"
description: "Test GTKX components with native widgets, accessible queries, and user interactions."
---

# Testing

`@gtkx/testing` renders GTKX components and provides queries, interactions, and assertions for native widgets. Its API follows React Testing Library conventions.

## Setup

Projects created with `npm create gtkx@beta` can include testing setup. To add it to an existing project, install the test dependencies:

```bash
npm install -D @gtkx/testing@beta vitest
```

Add a `test` script that runs `vitest run`, and create `vitest.config.ts`:

```ts
import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
    },
});
```

In a JavaScript project, name the file `vitest.config.js` and include `tests/**/*.test.{js,jsx}` instead.

The plugin gives each worker a private headless display and session bus, which need Sway and `dbus-daemon`. On Fedora 44, install these with:

```bash
sudo dnf install sway dbus-daemon
```

Then run the tests:

```bash
npm test
```

If `sway` or `dbus-daemon` is missing from `PATH`, the run stops before any test starts and names each missing tool, with an install command when GTKX recognizes the distribution. See the [plugin reference](/v2/reference/@gtkx/vitest/) for the display size and other options.

With the GTKX Vitest plugin, importing `@gtkx/testing` registers widget matchers and automatic cleanup. No additional setup file is needed.

Each test file runs in its own worker process, with a GTK runtime and display that shut down once the file's tests finish. Vitest's `isolate: false` would reuse that worker for the next file, so the run stops before any test starts when it is set.

A package that is not an application, such as a [component library](/v2/guide/configuration-and-codegen#component-libraries), runs its tests the same way without an `applicationId`, as the application `org.gtkx.Test`.

The private session bus contains GTKX's minimal notifications service. Other desktop services, such as portals and keyrings, are absent; provide any D-Bus services the component under test needs on that bus.

Tests share the user's files: `GLib.getUserDataDir()` and the other XDG directories point where the app's do. To keep test data apart, set the XDG variables in a [setup file](https://vitest.dev/config/setupfiles). GLib reads each XDG variable once, and GTK reads the data, configuration and cache directories as soon as a test file imports `@gtkx/react` or `@gtkx/testing`, so setting `process.env.XDG_DATA_HOME` in `beforeEach` or in a test has no effect.

```ts [tests/setup.ts]
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const dataHome = mkdtempSync(join(tmpdir(), "my-app-test-"));
process.env.XDG_DATA_HOME = dataHome;

afterAll(() => {
    rmSync(dataHome, { recursive: true, force: true });
});
```

List it under `test.setupFiles` in `vitest.config.ts`, and clear the app's files in `beforeEach` when tests must not see each other's data.

GSettings does not use those directories in tests: GTKX runs them with GLib's in-memory settings backend, so tests never read or change the user's settings. Each test file starts from the schema defaults, and a value one test writes stays for the following tests in the same file. Reset the keys in `beforeEach` when each test should start from the defaults:

```ts
import * as Gio from "@gtkx/gi/gio";
import { beforeEach } from "vitest";
import schema from "../data/com.example.MyApp.gschema.xml";

beforeEach(() => {
    const settings = Gio.Settings.new(schema.id);
    for (const key of Object.keys(schema.keys)) settings.reset(key);
});
```

Headless development uses the same environment, so settings changed in a headless session are gone when it stops:

```bash
gtkx dev --headless --size 1280x720
```

The default size is `1024x768`. Use Ctrl+C to stop the session and release its headless resources. Subsequent development or test runs reclaim stale sessions left by interrupted runs; use `gtkx cleanup --dry-run` to inspect them and `gtkx cleanup` to remove them.

### Sway in a restricted container

Fedora may install Sway with the `CAP_SYS_NICE` file capability. A rootless container that excludes that capability can fail to start Sway with exit status 126, before a test runs. Check the container capability policy. For a disposable test container, removing the capability with `sudo setcap -r "$(command -v sway)"` allows Sway to run without it. This is a container workaround, not a desktop setup step.

## Rendering a component

Await `render` before querying or interacting with widgets. This example tests an application's `SettingsPanel`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";
import { SettingsPanel } from "../src/settings-panel.js";

it("saves the display name", async () => {
    await render(<SettingsPanel />);

    const name = screen.getByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Display name" });
    await userEvent.type(name, "Ada");
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" }));

    expect(await screen.findByText("Settings saved")).toHaveTextContent("Settings saved");
});
```

Components render inside a test window by default. An application component that creates its own window needs `rootElement` instead:

```tsx
import { rootElement } from "@gtkx/react";

await render(<App />, { container: rootElement });
```

`rootElement` expects a tree that creates a toplevel window; omit `container` for components without their own window. An `AdwApplicationWindow` registers with its application, so render a window component on its own inside `AdwApplication`. Use the `wrapper` option for context providers. `rerender` updates the rendered component; `unmount` removes it. Animations are disabled by default, and automatic cleanup removes rendered trees between tests. Unmounting also quits the application a render started, even one that holds itself or waits out its `inactivityTimeout`, so the next render can register the same application ID. For hooks, use `renderHook` and assert on `result.current`.

### Module-level state

The GTKX plugin loads GTKX's packages through Vitest's module graph, so `vi.resetModules()` resets them along with your modules. Importing the app again afterwards would evaluate a second copy of GTKX beside the one `@gtkx/testing` uses, and GTKX throws an error naming `vi.resetModules()` instead. To give each test fresh state, create it in a function and pass it in as a prop rather than holding it at module level:

```tsx
import { rootElement } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { expect, it } from "vitest";
import { App } from "../src/app.js";
import { loadState } from "../src/store.js";

it("restores the saved feeds", async () => {
    await render(<App state={loadState()} />, { container: rootElement });

    expect(await screen.findByText("Planet GNOME")).toBeVisible();
});
```

The entry point does the same with `createRoot().render(<App state={loadState()} />)`.

## Finding widgets

Prefer `screen.getByRole` with a `Gtk.AccessibleRole` enum and an accessible name. `screen` searches open toplevel windows, including dialogs and popovers. Use `within(container)` to restrict a query to a subtree.

GTKX follows [Testing Library's query conventions](https://testing-library.com/docs/queries/about/). Other query families match label text, placeholders, display values, or the widget's `name` prop; see the [query reference](/v2/reference/@gtkx/testing/).

`findBy` and `findAllBy` queries take Testing Library's wait options as their third argument, as in `screen.findByText("Saved", undefined, { timeout: 3000 })`. They also accept them with the query options, as in `screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save", timeout: 3000 })`; when both are given, the third argument wins. Queries built with `buildQueries` take wait options with their own options only.

Queries exclude widgets that are not mapped, including content on inactive stack pages. The `hidden` option on role queries only includes widgets excluded from the accessibility tree; it does not include unmapped widgets. A role query matches an Adwaita dialog only once its content is shown, which libadwaita does a frame after the dialog opens, so a dialog found with `findByRole` can be queried right away.

A text button's child label takes precedence over its `accessibleLabel` prop. Query the visible label and use `within` when several buttons share it.

Some Adwaita rows expose their inner control under the row's title as well, as they do to assistive technologies. An `AdwEntryRow` and its text field both carry the title as their label, so `getByLabelText("Message")` finds two widgets; `getByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Message" })` finds the field. An `AdwSwitchRow` and its switch both have the `switch` role and the row's title as their name. Pass the `as` option to keep one widget class, which also types the result:

```ts
import * as Adw from "@gtkx/gi/adw";

const row = screen.getByRole(Gtk.AccessibleRole.SWITCH, { name: "Reimbursable", as: Adw.SwitchRow });
await userEvent.click(row);
expect(row).toBeChecked();
```

GTK ignores `accessibleLabel` on widgets whose accessible role takes no name, such as the `generic` role of a plain `GtkBox` or a `GtkDrawingArea`, so neither assistive technologies nor queries see it. Give such a widget a role that is named, as in `<GtkDrawingArea accessibleRole={Gtk.AccessibleRole.IMG} accessibleLabel="Usage chart" />` for a chart or `Gtk.AccessibleRole.GROUP` for a box of related controls.

## Interacting and waiting

Await every `userEvent` call. Helpers wait for the target to become actionable and flush React updates before resolving, and fail naming what blocks it, such as an open dialog over the target. Clicks and other pointer helpers also wait for a pointer to be able to reach the target, which an ancestor whose `canTarget` is off prevents. That error names the nearest ancestor a pointer would land on instead, such as the box inside an `AdwTabOverview` thumbnail that holds its title, so the test can click that widget. Use `userEvent.setup()` when a sequence needs to retain held keyboard modifiers or pointer buttons.

```ts
const user = userEvent.setup();
await user.keyboard(entry, "{Control>}a{/Control}");
await user.type(entry, "Replacement");
await user.click(saveButton);
```

`type` inserts text into an editable widget one character at a time, each as its own edit, and presses the keys named in braces, as in Testing Library's `user-event`, so `type(entry, "Ada{Enter}")` types "Ada" and then activates the entry. Handlers that react to single typed characters, such as GtkSourceView's interactive completion, see each one. Type a literal `{` as <span v-pre>`{{`</span>.

`keyboard` sends keys to the focused widget inside the given widget, or to the widget itself, which it focuses first, as a user would before typing, when it can take focus or passes it to a child as a `GtkMenuButton` does to its button, so `{Space}` on a switch toggles that switch rather than activating the window's focus widget. It sends them through GTK's key bindings and key controllers, including the ones GTK's own widgets add, so `{Space}` or `{Enter}` selects a swatch in a `GtkColorChooserWidget`. Called with only the keys, as in `await user.keyboard("{Enter}")`, it sends them to the focused widget of the active window, as Testing Library does, or to the window itself while its focus is on a widget that is not on screen, as a keyboard does. A key no widget handles reaches the window's bindings, so `{Tab}`, `{Shift>}{Tab}{/Shift}` and arrow keys move focus as they do on a keyboard.

A few key handlers need a real key event, which `keyboard` cannot create, and do not receive the keys: GtkSourceView's own key handling, such as auto-indent and bracket completion, so keys in a `GtkSourceView` behave as in a plain `GtkTextView`; the key capture of a `GtkSearchEntry` or `GtkSearchBar` with a key capture widget; a file chooser's key forwarding; the interactive search of the deprecated `GtkTreeView`; and a WebKit web view. Key controllers the app adds always receive the keys. In the same way, a click reaches GTK's own pointer handling of a widget only where `@gtkx/testing` knows its outcome, as for buttons, rows and tabs; a click on a swatch does nothing, so press `{Space}` or `{Enter}` on it instead. As in Testing Library, input that nothing handles is not an error.

`pointer` takes Testing Library's button tokens. `[MouseLeft]` clicks the widget as `click` does, and `[MouseRight]` and `[MouseMiddle]` press and release the other buttons for the click gestures on the widget and its ancestors that listen for them, so `pointer(cell, "[MouseRight]")` opens a context menu that a `GtkGestureClick` with `button={Gdk.BUTTON_SECONDARY}` shows. Add `>` to only press a button, as in `[MouseRight>]`, and a leading `/` to release it. A gesture's handlers read the pressed button with `getCurrentButton()` and the held modifiers with `getCurrentEventState()`. No real pointer event exists, so `getCurrentEvent()` returns `null`: port upstream code that reads the button from the event, such as `event.get_button()`, to `getCurrentButton()`.

`selectOptions` and `deselectOptions` take positions rather than option values or labels, because GTK drop-downs, lists and grids have no option values: `selectOptions(dropDown, 2)` selects the third item, and an array selects several positions in a multiple-selection list. A position past the last item, or an option label, rejects with the range of valid positions and leaves the selection unchanged.

Use `slide(range, value)` for a slider. `drag` drives application-defined drag gestures and cannot drive a range's native slider. The [interaction reference](/v2/reference/@gtkx/testing/) covers the available helpers.

Use `dragAndDrop(source, target)` to transfer a drag source's typed content to a `GtkDropTarget`. Use `drop(target, content)` when testing how a target handles a supplied value. Gesture helpers such as these, `drag` and `longPress` use the nearest controller from the given widget up through its ancestors, as GTK propagates pointer events, so you can pass the visible label of a cell whose container carries the controller.

`fireEvent(object, signalName, ...args)` emits a GObject signal directly. Await its promise so the resulting React updates finish before asserting. Use it when testing a signal handler or a tree without a visible window. Wrap state changes made outside these helpers in `act`.

For asynchronous assertions, use `waitFor`; for a widget leaving the tree, use `waitForElementToBeRemoved`. Their timeout defaults to one second and can be changed per call or through `configure`.

### Fake timers

Vitest's fake timers replace JavaScript timers only. GLib timeouts keep the real clock, including GTK's own, such as the `searchDelay` after which a `GtkSearchEntry` emits `search-changed`, so advancing fake time does not fire them. Under `vi.useFakeTimers()`, `waitFor` and `findBy` queries advance the fake clock by their polling interval and then wait the same interval in real time, so both kinds of timer run while they poll. Assert through them rather than right after `vi.advanceTimersByTime()`:

```ts
vi.useFakeTimers();
await user.type(screen.getByRole(Gtk.AccessibleRole.SEARCH_BOX), "mus");
await waitFor(() => expect(screen.queryByText("photos/")).toBeNull());
```

`userEvent` helpers wait between actions only when `delay` is set, so `userEvent.setup()` takes no `advanceTimers` option.

## Assertions and debugging

Use widget matchers such as `toHaveTextContent`, `toHaveAccessibleName`, `toBeChecked`, and `toHaveDisplayValue`. Accessible states and properties have their own matchers, `toHaveAccessibleState` and `toHaveAccessibleProperty`. See the [matcher reference](/v2/reference/@gtkx/testing/) for the complete set.

`screen.debug()` prints the widget tree, and `screen.logRoles()` groups widgets by accessible role. Capture the active window with `await screen.screenshot({ path: "test.png" })`, or pass a widget to `screenshot` to capture a subtree. The [MCP server](/v2/guide/mcp) provides the same inspection tools during development.

Snapshot assertions print a widget as its widget tree in the `screen.debug()` format, so `expect(container).toMatchSnapshot()` records the rendered widgets.

GLib prints criticals and warnings to the test output without failing the test, and a GLib `ERROR` aborts the worker. Set GLib's `G_DEBUG` environment variable, for example to `fatal-criticals`, to make criticals abort the worker instead. Addon panics outside a binding call fail the test as uncaught exceptions. See [Error Handling](/v2/guide/error-handling#glib-criticals-and-warnings).

A render error that an error boundary catches does not fail the test, so a test can assert the boundary's fallback; the `onCaughtError` render option receives it. An error no boundary catches rejects `render`, or the next `rerender`, `unmount` or cleanup, with that error.

## Next

The [tutorial's testing chapter](/v2/tutorial/testing) applies these tools to a complete application.
