---
description: "Connect an Adwaita entry row to a Zustand store to add tasks."
---

# Adding Tasks with a Store

Connect the list from [Showing a List of Tasks](/tutorial/a-list-of-tasks) to a store, then add an entry row that creates tasks when you press Enter.

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

```ts
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

```ts
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

`addTask` ignores blank titles and returns the new task's ID. The editor will use that ID in [Opening a Task](/tutorial/the-task-editor).

## Reading from the store

Remove the module-level `TASKS` and `createdAt` constants from `task-list.tsx`, along with the `Task` type import. Add the store import:

`src/components/task-list.tsx`:

```ts
import { useStore } from "../store/index.js";
```

Inside `TaskList`, select `state.tasks` and `state.addTask`, then change `TASKS.map` to `tasks.map`, as shown below. Select the stored array directly; Zustand's [selector guide](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow) covers computed values. The tutorial adds filtering in [Smart Views, Filters, and Search](/tutorial/smart-views-and-search).

## The add row

An Adwaita boxed list can hold an entry that looks like a row. Put an `AdwEntryRow` first inside the list box, ahead of the tasks.

`src/components/task-list.tsx`:

```tsx
export const TaskList = () => {
    const tasks = useStore((state) => state.tasks);
    const addTask = useStore((state) => state.addTask);

    return (
        // ...
        <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
            <AdwEntryRow
                title="Add a task…"
                onEntryActivated={(self) => {
                    addTask("personal", self.text);
                    self.text = "";
                }}
            />
            {tasks.map((task) => (
                <AdwActionRow key={task.id} title={task.title} />
            ))}
        </GtkListBox>
        // ...
    );
};
```

Add `AdwEntryRow` to the import from `@gtkx/jsx/adw`.

`onEntryActivated` handles the native `entry-activated` signal. GTKX passes the emitting widget as the last argument; this signal has no other arguments, so the handler receives only `self`. See [the JSX prop model](/guide/configuration-and-codegen#the-jsx-prop-model) for signal conventions.

The entry keeps its text in GTK until submission. The handler reads `self.text`, adds the task, and clears the entry. The next chapter connects controls whose values stay synchronized with the store.

The `"personal"` passed as the list id is a placeholder while every task lives in one place. [Lists and a Sidebar](/tutorial/lists-and-the-sidebar) replaces it with the list you are currently viewing.

## Run it

Save `task-list.tsx` and watch the window. An empty row titled "Add a task…" appears at the top of the card, above the seeded tasks. Type `Buy oat milk` into it and press Enter. The task appears at the bottom of the list and the entry clears, ready for the next one. Press Enter on the empty entry and nothing happens, because `addTask` trims the title to nothing and returns early.

Restart the app. The seeded tasks return and newly added tasks are gone because the store is still in memory. [Saving Tasks Between Runs](/tutorial/saving-to-disk) adds persistence.

## Next

[Completing, Starring, and Deleting](/tutorial/completing-and-deleting) gives every row a checkbox, a star, and a delete button, each wired to a store action.
