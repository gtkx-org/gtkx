---
title: "Testing"
description: "Test GTKX workflows headlessly through accessible queries and user interactions."
---

# Testing

`@gtkx/testing` adapts the Testing Library model to GTK4. Tests render the same widgets users reach, find them through accessibility, drive native input, and assert visible results.

## Set up Vitest

Projects scaffolded with testing already contain this setup. Otherwise install the packages:

```bash
npm install -D @gtkx/testing vitest
```

```ts
import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: { include: ["tests/**/*.test.{ts,tsx}"], bail: 1 },
});
```

Importing `@gtkx/testing` installs cleanup and matchers. Each worker receives its own headless display and GTK event loop; no setup file is needed. Host requirements and plugin options are in the [Vitest API reference](/reference/@gtkx/vitest/).

## Test a user workflow

Render the feature, locate controls by accessible role and name, perform the interaction, and assert the outcome:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { useState } from "react";
import { expect, it } from "vitest";

const Counter = () => {
    const [count, setCount] = useState(0);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <GtkLabel>{`Count: ${count}`}</GtkLabel>
            <GtkButton label="Increment" onClicked={() => setCount((value) => value + 1)} />
        </GtkBox>
    );
};

it("increments the counter", async () => {
    await render(<Counter />);

    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));

    expect(await screen.findByText("Count: 1")).toHaveTextContent("Count: 1");
});
```

Prefer `ByRole` with a name because it follows the same accessibility contract as a user. Use label, placeholder, display-value, or text queries when they describe the interaction more directly. The [testing API reference](/reference/@gtkx/testing/) lists every query, matcher, and `userEvent` helper.

Use query families by intent:

| Query | When to use it |
| --- | --- |
| `getBy*` | The widget must exist now |
| `queryBy*` | Absence is the expected result |
| `findBy*` | A render, dialog, or other async update must finish first |

## Work with GTK behavior

Every `userEvent` call is async and flushes React updates. It waits for the target to become actionable, so a click on an insensitive or hidden widget fails instead of bypassing the UI contract.

Use `fireEvent` only when the behavior under test is a raw GObject signal with no user-level action. Use `act` for state changes initiated outside `userEvent` or `fireEvent`, and `waitFor` for an observable result that has no direct query to await.

`render` presents widgets in a harness window and disables animations by default. To render an application rather than a widget, use `rootElement`:

```tsx
import { rootElement } from "@gtkx/react";

await render(<App />, { container: rootElement });
```

Queries cover every open toplevel, including dialogs and popovers. Scope them with `within` when two regions intentionally contain the same control.

## Debug a failure

Start with `screen.debug()` for the accessible widget tree and `screen.logRoles()` to see the roles GTK reports. Capture the active window with `screen.screenshot({ path: "failure.png" })` when layout matters.

GTK `CRITICAL` messages and native panics fail the active test automatically. Treat them as contract violations even when the final assertion would otherwise pass.

## Next

The [testing tutorial](/tutorial/testing) applies this workflow to the Tasks app. [MCP](/guide/mcp) exposes the same inspection and interaction model against a running development app.
