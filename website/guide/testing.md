---
title: "Testing"
description: "Test GTKX workflows through accessible queries and native interactions."
---

# Testing

`@gtkx/testing` follows Testing Library's user-centered model for GTK4. Scaffolded projects include the setup; otherwise install `@gtkx/testing` and Vitest and add the GTKX plugin:

```ts
import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
    test: { include: ["tests/**/*.test.{ts,tsx}"], bail: 1 },
});
```

Importing `@gtkx/testing` installs cleanup and matchers. Each worker gets a headless display and GTK event loop.

## Test one workflow

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";

it("creates a task", async () => {
    await render(<TaskEditor />);

    await userEvent.type(screen.getByRole(Gtk.AccessibleRole.TEXT_BOX), "Buy milk");
    await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" }));

    expect(await screen.findByText("Buy milk")).toBeVisible();
});
```

Prefer role and accessible-name queries. Use `getBy*` for an immediate requirement, `queryBy*` for absence, and `findBy*` for an async result. Every `userEvent` call is async, flushes React updates, and waits for an actionable widget.

Use `fireEvent` only for a raw signal with no user action, `act` for outside state changes, and `waitFor` for an observable result without a query to await. Render an application with `{ container: rootElement }`. Queries include open dialogs and popovers; use `within` to scope duplicates.

`render` disables animations by default. For failures, inspect `screen.debug()`, `screen.logRoles()`, or a screenshot. GTK criticals and native panics fail the test.

The [testing reference](/reference/@gtkx/testing/) lists queries, matchers, and events. The [testing tutorial](/tutorial/testing) applies them to Tasks.
