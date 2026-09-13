---
title: "Testing"
description: "Test GTKX components with native widgets, accessible queries, and user interactions."
---

# Testing

`@gtkx/testing` renders real GTKX components and provides queries, interactions, and assertions for their native widgets. Its API follows React Testing Library conventions.

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

The plugin gives each worker a private headless display and session bus. It needs the compositor binary, `dbus-daemon`, and `setpriv` installed on the system. See the [plugin reference](/v2/reference/@gtkx/vitest/) for configuration.

Importing `@gtkx/testing` registers widget matchers and automatic cleanup. No additional setup file is needed.

The private session bus contains GTKX's minimal notifications service. Other desktop services, such as portals and keyrings, are absent; provide any D-Bus services the component under test needs on that bus.

Headless development uses the same environment:

```bash
gtkx dev --headless --size 1280x720
```

The default size is `1024x768`. Keep the launching terminal or supervisor running for the session. GTKX removes its temporary runtime on shutdown; use `gtkx cleanup --dry-run` to inspect stale runtimes and `gtkx cleanup` to remove them.

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

`rootElement` expects a tree that creates a toplevel window; omit `container` for loose widgets or fragments. Use the `wrapper` option for context providers. `rerender` updates the rendered component; `unmount` removes it. Animations are disabled by default, and automatic cleanup removes rendered trees between tests. For hooks, use `renderHook` and assert on `result.current`.

## Finding widgets

Prefer `screen.getByRole` with a `Gtk.AccessibleRole` enum and an accessible name. `screen` searches open toplevel windows, including dialogs and popovers. Use `within(container)` to restrict a query to a subtree.

`getBy*` requires one match, `queryBy*` returns `null` when none exists, and `findBy*` waits for a match. Use `findBy*` when an asynchronous operation changes the UI. The `*AllBy*` variants return multiple matches. Other query families match label text, placeholders, display values, or the widget's `name` prop; see the [query reference](/v2/reference/@gtkx/testing/).

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

Use `slide(range, value)` for a slider. `drag` drives authored drag gestures and cannot drive a range's native slider. The [interaction reference](/v2/reference/@gtkx/testing/) covers the available helpers.

`fireEvent(object, signalName, ...args)` emits a GObject signal directly. Use it when testing a signal handler or a tree without a visible window. Wrap state changes made outside these helpers in `act`.

For asynchronous assertions, use `waitFor`; for a widget leaving the tree, use `waitForElementToBeRemoved`. Their timeout defaults to one second and can be changed per call or through `configure`.

## Assertions and debugging

Use widget matchers such as `toHaveTextContent`, `toHaveAccessibleName`, `toBeChecked`, and `toHaveDisplayValue`. Accessible states and properties have their own matchers, `toHaveAccessibleState` and `toHaveAccessibleProperty`. See the [matcher reference](/v2/reference/@gtkx/testing/) for the complete set.

`screen.debug()` prints the widget tree, and `screen.logRoles()` groups widgets by accessible role. Capture the active window with `await screen.screenshot({ path: "test.png" })`, or pass a widget to `screenshot` to capture a subtree. The [MCP server](/v2/guide/mcp) provides the same inspection tools during development.

A critical raised during a generated binding call throws or rejects, so an error-path test can catch it. Criticals outside a binding call and addon panics fail the test as uncaught exceptions; a GLib `ERROR` aborts the worker. See [Error Handling](/v2/guide/error-handling#failures-nothing-can-throw).

Warnings do not fail tests automatically. To make them failures, subscribe through `onLog` from `@gtkx/native`, collect warning records, and check them during teardown. Delivery is asynchronous: yield with `setImmediate` from `node:timers/promises` before checking or unsubscribing. Unsubscribing stops new records but does not cancel records already queued. The [native reference](/v2/reference/@gtkx/native/) describes the subscription API.

## Next

The [tutorial's testing chapter](/v2/tutorial/testing) applies these tools to a complete application.
