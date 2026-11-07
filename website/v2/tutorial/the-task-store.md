---
description: "Connect an Adwaita entry row to a Zustand store to add tasks."
---

# Add Tasks

Connect the list from [Display Tasks](/v2/tutorial/a-list-of-tasks) to a store, then add an entry row that creates tasks when you press Enter.

## Shared task state

Tasks will share state between the list, sidebar, editor, and keyboard actions. This tutorial uses [Zustand](https://zustand.docs.pmnd.rs/learn/getting-started/introduction), whose React hooks work with GTKX. Its documentation covers store creation and subscriptions; this chapter connects that store to native widgets.

## Install Zustand

From `tasks/`:

::: code-group

```bash [npm]
npm install zustand
```

```bash [pnpm]
pnpm add zustand
```

:::

## The seed data

Move the initial tasks into a seed module.

`src/store/seed.ts`:

<<< @/figures/tutorial/the-task-store/src/store/seed.ts [src/store/seed.ts]

Relative due dates give the Today view sample content on a fresh start. Once persistence is enabled, saved dates remain unchanged.

## The store

`src/store/index.ts`:

<<< @/figures/tutorial/the-task-store/src/store/index.ts [src/store/index.ts]

`addTask` ignores blank titles and returns the new task's ID. The editor will use that ID in [Edit Tasks](/v2/tutorial/the-task-editor).

## Connect the entry row

Replace `src/components/task-list.tsx` with this component. The store supplies `tasks` and `addTask`, replacing the file's sample array. The rows now show titles only: notes move to the task editor in [Edit Tasks](/v2/tutorial/the-task-editor), and the row's second line will show the due date.

<<< @/figures/tutorial/the-task-store/src/components/task-list.tsx [src/components/task-list.tsx]

`onEntryActivated` receives the emitting widget as its last argument. This signal has no other arguments, so the handler receives only `self`. It reads the entry's text, adds a task, and clears the entry.

The `"personal"` list ID is temporary. [Add Lists and a Sidebar](/v2/tutorial/lists-and-the-sidebar) replaces it with the selected list. Select `state.tasks` directly here; the tutorial introduces derived selectors in [Filter and Search Tasks](/v2/tutorial/smart-views-and-search).

## Run it

Save `task-list.tsx`. The **Add a task…** entry appears above the sample tasks.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-the-task-store-light.png" width="360" height="294" loading="lazy" alt="The Tasks window: an Add a task… entry row at the top of a boxed list, above three tasks titled Welcome to Tasks, Water the plants, and Prepare the weekly report." />
    <img class="result-dark" src="/figures/tutorial-the-task-store-dark.png" width="360" height="294" loading="lazy" alt="The Tasks window: an Add a task… entry row at the top of a boxed list, above three tasks titled Welcome to Tasks, Water the plants, and Prepare the weekly report." />
    <figcaption>Captured from <a href="#connect-the-entry-row"><code>src/components/task-list.tsx</code></a> above.</figcaption>
</figure>

Type `Buy oat milk` and press Enter: the task appears at the bottom of the list and the entry clears. Press Enter again to confirm that an empty title creates no task.

Restart the app. The seeded tasks return and newly added tasks are gone because the store is still in memory. [Save Tasks](/v2/tutorial/saving-to-disk) adds persistence.

## Test the entry row

The scaffold includes the GTKX Vitest plugin and `@gtkx/testing`. Create `tests/tasks.test.tsx`:

```tsx [tests/tasks.test.tsx]
import * as Gtk from "@gtkx/gi/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen, userEvent } from "@gtkx/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app.js";
import { useStore } from "../src/store/index.js";
import { seedTasks } from "../src/store/seed.js";

beforeEach(() => {
    useStore.setState({ tasks: seedTasks });
});

describe("adding tasks", () => {
    it.each(["Buy oat milk", "  Milk & <b>tea</b>  "])("adds the literal title %s", async (title) => {
        await render(<App />, { container: rootElement });
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);

        await userEvent.type(entry, title);
        await userEvent.keyboard(entry, "{Enter}");

        expect(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: title.trim() })).toBeDefined();
        expect(entry).toHaveValue("");
    });

    it("leaves the list unchanged for a blank title", async () => {
        await render(<App />, { container: rootElement });
        const entry = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX);
        const rowCount = screen.getAllByRole(Gtk.AccessibleRole.LIST_ITEM).length;

        await userEvent.type(entry, "   ");
        await userEvent.keyboard(entry, "{Enter}");

        expect(screen.getAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(rowCount);
        expect(entry).toHaveValue("");
    });
});
```

These tests type into the app's widgets. They cover adding a task, trimming and displaying literal text, and rejecting a blank title. `beforeEach` restores the sample tasks; GTKX unmounts rendered trees between tests. `App` renders an application, so pass `rootElement` as its container.

```bash
npm test
```

Keep these tests as you continue. [Save Tasks](/v2/tutorial/saving-to-disk#isolate-test-data) isolates the persistence directory before tests begin writing files, and [Test the App](/v2/tutorial/testing) extends the suite.

## Next

[Complete, Star, and Delete Tasks](/v2/tutorial/completing-and-deleting) gives every row a checkbox, a star, and a delete button, each wired to a store action.
