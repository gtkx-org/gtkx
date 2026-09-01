---
title: "Test User Workflows"
description: "Exercise the task manager through accessible queries and native interactions."
---

# Test User Workflows

Test the behavior a user reaches: render the application, find accessible widgets, interact, and assert the visible result. Do not test store helpers or intermediate component state separately.

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen, userEvent } from "@gtkx/testing";
import { expect, it } from "vitest";

it("adds a task", async () => {
    await render(<App />, { container: rootElement });

    const entry = screen.getByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Add a task" });
    await userEvent.type(entry, "Water the plants");
    await userEvent.keyboard(entry, "{Enter}");

    expect(await screen.findByText("Water the plants")).toBeVisible();
});
```

The example suite in [`examples/tutorial/tests`](https://github.com/gtkx-org/gtkx/tree/main/examples/tutorial/tests) covers three boundaries:

- Happy path: add, edit, navigate, and complete work.
- Edge cases: empty views, adaptive navigation, reorder boundaries, and restored state.
- Error path: reject invalid persisted data or an unavailable operation by asserting only that it throws.

Prefer `getByRole` with an accessible name. Use `findBy*` for a result that appears after rendering or native work, `queryBy*` for absence, and `within` only when repeated controls are intentional.

Every `userEvent` helper is asynchronous and flushes React updates. `render` disables animations by default. Reach for `fireEvent` only when the subject is a raw signal with no user-facing action.

Use `screen.debug()` and `screen.logRoles()` to inspect the accessible tree. Take a screenshot only when visual layout is the behavior under test.

```bash
npm test
```

Once the workflow suite passes, [build installable packages](/tutorial/packaging).
