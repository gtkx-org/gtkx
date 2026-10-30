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

The private session bus contains GTKX's minimal notifications service. Other desktop services, such as portals and keyrings, are absent; provide any D-Bus services the component under test needs on that bus.

Headless development uses the same environment:

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

`rootElement` expects a tree that creates a toplevel window; omit `container` for components without their own window. An `AdwApplicationWindow` registers with its application, so render a window component on its own inside `AdwApplication`. Use the `wrapper` option for context providers. `rerender` updates the rendered component; `unmount` removes it. Animations are disabled by default, and automatic cleanup removes rendered trees between tests. For hooks, use `renderHook` and assert on `result.current`.

## Finding widgets

Prefer `screen.getByRole` with a `Gtk.AccessibleRole` enum and an accessible name. `screen` searches open toplevel windows, including dialogs and popovers. Use `within(container)` to restrict a query to a subtree.

GTKX follows [Testing Library's query conventions](https://testing-library.com/docs/queries/about/). Other query families match label text, placeholders, display values, or the widget's `name` prop; see the [query reference](/v2/reference/@gtkx/testing/).

Queries exclude widgets that are not mapped, including content on inactive stack pages. The `hidden` option on role queries only includes widgets excluded from the accessibility tree; it does not include unmapped widgets. A role query matches an Adwaita dialog only once its content is shown, which libadwaita does a frame after the dialog opens, so a dialog found with `findByRole` can be queried right away.

A text button's child label takes precedence over its `accessibleLabel` prop. Query the visible label and use `within` when several buttons share it.

## Interacting and waiting

Await every `userEvent` call. Helpers wait for the target to become actionable and flush React updates before resolving. Use `userEvent.setup()` when a sequence needs to retain held keyboard modifiers or pointer buttons.

```ts
const user = userEvent.setup();
await user.keyboard(entry, "{Control>}a{/Control}");
await user.type(entry, "Replacement");
await user.click(saveButton);
```

Use `slide(range, value)` for a slider. `drag` drives application-defined drag gestures and cannot drive a range's native slider. The [interaction reference](/v2/reference/@gtkx/testing/) covers the available helpers.

Use `dragAndDrop(source, target)` to transfer a drag source's typed content to a `GtkDropTarget`. Use `drop(target, content)` when testing how a target handles a supplied value. Gesture helpers such as these, `drag` and `longPress` use the nearest controller from the given widget up through its ancestors, as GTK propagates pointer events, so you can pass the visible label of a cell whose container carries the controller.

`fireEvent(object, signalName, ...args)` emits a GObject signal directly. Await its promise so the resulting React updates finish before asserting. Use it when testing a signal handler or a tree without a visible window. Wrap state changes made outside these helpers in `act`.

For asynchronous assertions, use `waitFor`; for a widget leaving the tree, use `waitForElementToBeRemoved`. Their timeout defaults to one second and can be changed per call or through `configure`.

## Assertions and debugging

Use widget matchers such as `toHaveTextContent`, `toHaveAccessibleName`, `toBeChecked`, and `toHaveDisplayValue`. Accessible states and properties have their own matchers, `toHaveAccessibleState` and `toHaveAccessibleProperty`. See the [matcher reference](/v2/reference/@gtkx/testing/) for the complete set.

`screen.debug()` prints the widget tree, and `screen.logRoles()` groups widgets by accessible role. Capture the active window with `await screen.screenshot({ path: "test.png" })`, or pass a widget to `screenshot` to capture a subtree. The [MCP server](/v2/guide/mcp) provides the same inspection tools during development.

Snapshot assertions print a widget as its widget tree in the `screen.debug()` format, so `expect(container).toMatchSnapshot()` records the rendered widgets.

GLib prints criticals and warnings to the test output without failing the test, and a GLib `ERROR` aborts the worker. Set GLib's `G_DEBUG` environment variable, for example to `fatal-criticals`, to make criticals abort the worker instead. Addon panics outside a binding call fail the test as uncaught exceptions. See [Error Handling](/v2/guide/error-handling#glib-criticals-and-warnings).

A render error that an error boundary catches does not fail the test, so a test can assert the boundary's fallback; the `onCaughtError` render option receives it. An error no boundary catches rejects `render`, or the next `rerender`, `unmount` or cleanup, with that error.

## Next

The [tutorial's testing chapter](/v2/tutorial/testing) applies these tools to a complete application.
