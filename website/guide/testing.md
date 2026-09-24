---
title: "Testing"
description: "Test GTKX components with native widgets, accessible queries, and user interactions."
---

# Testing

`@gtkx/testing` renders real GTKX components and provides queries, interactions, and assertions for their native widgets. Its API follows React Testing Library conventions.

## Setup

Projects created with `npm create gtkx` can include testing setup. To add it to an existing project, install the test dependencies:

```bash
npm install -D @gtkx/testing vitest
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

The plugin gives each worker a private headless display and session bus. It needs the compositor binary, `dbus-daemon`, and `setpriv` installed on the system. See the [plugin reference](/reference/@gtkx/vitest/) for configuration.

Importing `@gtkx/testing` registers widget matchers and automatic cleanup. No additional setup file is needed.

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

Ordinary components render inside a harness window. An application component that creates its own window needs `rootElement` instead:

```tsx
import { rootElement } from "@gtkx/react";

await render(<App />, { container: rootElement });
```

Use the `wrapper` option for context providers. `rerender` updates the rendered component; `unmount` removes it. Animations are disabled by default, and automatic cleanup removes rendered trees between tests. For hooks, use `renderHook` and assert on `result.current`.

## Finding widgets

Prefer `screen.getByRole` with a `Gtk.AccessibleRole` enum and an accessible name. `screen` searches open toplevel windows, including dialogs and popovers. Use `within(container)` to restrict a query to a subtree.

GTKX follows [Testing Library's query conventions](https://testing-library.com/docs/queries/about/). Other query families match label text, placeholders, display values, or the widget's `name` prop; see the [query reference](/reference/@gtkx/testing/).

Queries exclude widgets that are not mapped, including content on inactive stack pages. The `hidden` option on role queries only includes widgets excluded from the accessibility tree; it does not include unmapped widgets.

A text button's child label takes precedence over its `accessibleLabel` prop. Query the visible label and use `within` when several buttons share it.

## Interacting and waiting

Await every `userEvent` call. Helpers wait for the target to become actionable and flush React updates before resolving. Use `userEvent.setup()` when a sequence needs to retain held keyboard modifiers or pointer buttons.

```ts
const user = userEvent.setup();
await user.keyboard(entry, "{Control>}a{/Control}");
await user.type(entry, "Replacement");
await user.click(saveButton);
```

Use `slide(range, value)` for a slider. `drag` drives authored drag gestures and cannot drive a range's native slider. The [interaction reference](/reference/@gtkx/testing/) covers the available helpers.

`fireEvent(object, signalName, ...args)` emits a GObject signal directly. It returns a promise, so await it. Use it when testing a signal handler or a tree without a visible window. Wrap state changes made outside these helpers in `act`.

For asynchronous assertions, use `waitFor`; for a widget leaving the tree, use `waitForElementToBeRemoved`. Their timeout defaults to one second and can be changed per call or through `configure`.

## Assertions and debugging

Use widget matchers such as `toHaveTextContent`, `toHaveAccessibleName`, `toBeChecked`, and `toHaveDisplayValue`. Accessible states and properties have their own matchers, `toHaveAccessibleState` and `toHaveAccessibleProperty`. See the [matcher reference](/reference/@gtkx/testing/) for the complete set.

`screen.debug()` prints the widget tree, and `screen.logRoles()` groups widgets by accessible role. Capture the active window with `await screen.screenshot({ path: "test.png" })`, or pass a widget to `screenshot` to capture a subtree. The [MCP server](/guide/mcp) provides the same inspection tools during development.

GLib criticals and addon panics fail the running test as uncaught exceptions. Warnings alone do not fail tests. See [Error Handling](/guide/error-handling#fatal-errors) for the failure channels.

## Next

The [tutorial's testing chapter](/tutorial/testing) applies these tools to a complete application.
