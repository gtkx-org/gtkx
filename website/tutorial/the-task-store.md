---
description: "Connect an Adwaita entry row to a Zustand store to add tasks."
---

# Add Tasks

Connect the list from [Display Tasks](/tutorial/a-list-of-tasks) to a store, then add an entry row that creates tasks when you press Enter.

## Shared task state

Tasks will share state between the list, sidebar, editor, and keyboard actions. This tutorial uses [Zustand](https://zustand.docs.pmnd.rs/learn/getting-started/introduction), whose React hooks work with GTKX without an adapter. Its documentation covers store creation and subscriptions; this chapter connects that store to native widgets.

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

```ts [src/store/seed.ts]
import type { Task } from "../types.js";

const isoInDays = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(18, 0, 0, 0);
    return date.toISOString();
};

const startOfToday = (): string => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
};

const createdAt = new Date().toISOString();

const task = (fields: Partial<Task> & Pick<Task, "id" | "listId" | "title" | "position">): Task => ({
    notes: "",
    done: false,
    important: false,
    deleted: false,
    due: null,
    createdAt,
    completedAt: null,
    ...fields,
});

export const seedTasks: Task[] = [
    task({
        id: "t1",
        listId: "personal",
        title: "Welcome to Tasks",
        position: 0,
        notes: "This is your first task. Tick the checkbox to complete it, or open it to add notes and a due date.",
    }),
    task({
        id: "t2",
        listId: "personal",
        title: "Water the plants",
        position: 1,
        due: startOfToday(),
        important: true,
    }),
    task({ id: "t3", listId: "work", title: "Prepare the weekly report", position: 2, due: isoInDays(1) }),
];
```

Relative due dates give the later Today view sample content whenever you run the app.

## The store

`src/store/index.ts`:

```ts [src/store/index.ts]
import { create } from "zustand";
import type { Task } from "../types.js";
import { seedTasks } from "./seed.js";

export type Store = {
    tasks: Task[];
    addTask: (listId: string, title: string) => string | null;
};

export const useStore = create<Store>()((set) => ({
    tasks: seedTasks,
    addTask: (listId, title) => {
        const trimmed = title.trim();
        if (trimmed === "") return null;
        const id = crypto.randomUUID();
        set((state) => ({
            tasks: [
                ...state.tasks,
                {
                    id,
                    listId,
                    title: trimmed,
                    notes: "",
                    done: false,
                    important: false,
                    deleted: false,
                    due: null,
                    position: state.tasks.length,
                    createdAt: new Date().toISOString(),
                    completedAt: null,
                },
            ],
        }));
        return id;
    },
}));
```

`addTask` ignores blank titles and returns the new task's ID. The editor will use that ID in [Edit Tasks](/tutorial/the-task-editor).

## Connect the entry row

Replace `src/components/task-list.tsx` with this component. The store supplies `tasks` and `addTask`, replacing the file's sample array.

```tsx [src/components/task-list.tsx]
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwClamp, AdwEntryRow } from "@gtkx/jsx/adw";
import { GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";

export const TaskList = () => {
    const tasks = useStore((state) => state.tasks);
    const addTask = useStore((state) => state.addTask);

    return (
        <GtkScrolledWindow vexpand>
            <AdwClamp maximumSize={640} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
                <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                    <AdwEntryRow
                        title="Add a task…"
                        onEntryActivated={(self) => {
                            addTask("personal", self.text);
                            self.text = "";
                        }}
                    />
                    {tasks.map((task) => (
                        <AdwActionRow key={task.id} title={task.title} useMarkup={false} />
                    ))}
                </GtkListBox>
            </AdwClamp>
        </GtkScrolledWindow>
    );
};
```

`onEntryActivated` receives the emitting widget as its last argument. This signal has no other arguments, so the handler receives only `self`. It reads the entry's text, adds a task, and clears the entry.

The `"personal"` list ID is temporary. [Add Lists and a Sidebar](/tutorial/lists-and-the-sidebar) replaces it with the selected list. Select `state.tasks` directly here; the tutorial introduces derived selectors in [Filter and Search Tasks](/tutorial/smart-views-and-search).

## Run it

Save `task-list.tsx` and watch the window. An empty row titled "Add a task…" appears at the top of the card, above the seeded tasks. Type `Buy oat milk` into it and press Enter. The task appears at the bottom of the list and the entry clears, ready for the next one. Press Enter on the empty entry and nothing happens, because `addTask` trims the title to nothing and returns early.

Restart the app. The seeded tasks return and newly added tasks are gone because the store is still in memory. [Save Tasks](/tutorial/saving-to-disk) adds persistence.

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

These tests type into real native widgets. They cover adding a task, trimming and displaying literal text, and rejecting a blank title. `beforeEach` restores the sample tasks; GTKX unmounts rendered trees between tests. `App` renders an application, so pass `rootElement` as its container.

```bash
npm test
```

Keep these tests as you continue. [Save Tasks](/tutorial/saving-to-disk#isolate-test-data) isolates the persistence directory before tests begin writing files, and [Test the App](/tutorial/testing) extends the suite.

## Next

[Complete, Star, and Delete Tasks](/tutorial/completing-and-deleting) gives every row a checkbox, a star, and a delete button, each wired to a store action.
