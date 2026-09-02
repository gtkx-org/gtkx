---
description: "Move tasks into a zustand store and add one by typing in the list."
---

# Adding Tasks with a Store

In [Showing a List of Tasks](/tutorial/a-list-of-tasks) you rendered a hardcoded array as an Adwaita boxed list, and the only way to change what was on screen was to edit the source. Now you make the list writable. A store holds the tasks, and a row at the top of the card creates one.

## The problem with a constant

The array in `task-list.tsx` is a `const` read by one component. Soon a checkbox flips `done`, a sidebar counts what is open per list, an editor rewrites a title, and a keyboard shortcut creates a task from a handler outside the list.

Lift the array into `app.tsx` with `useState` and every component that touches a task needs data and a callback threaded down to it, so the components in between grow props they never use. Put it in a context and the threading goes away, but every consumer re-renders whenever any part of the value changes, and a provider has to sit above everything that reads it.

An external store removes the middle. A component reads the fields it needs and calls the action it needs, with nothing in between.

## Install zustand

From `tasks/`:

::: code-group

```bash [npm]
npm install zustand
```

```bash [pnpm]
pnpm add zustand
```

:::

It belongs in `dependencies`, not `devDependencies`: the store runs in the shipped application.

## The seed data

The tasks a fresh install starts with are data, not view code, so give them their own module.

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

The `task` helper fills in every required field, so each entry sets only the values that make it distinct rather than repeating the defaults. Due dates are computed relative to the day you run the app, so the Today view always has something in it.

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

`create` takes a function that receives `set` and returns the initial state. Actions live in that same object beside the state they change, so there is no reducer file, no action type, and no dispatch. `addTask` is a plain function reachable from anywhere.

`set` takes an updater that returns the fields to merge, so returning `{ tasks: [...] }` replaces `tasks` and leaves every other field alone. The array is always new, never mutated in place, because a component re-renders only when the value it selected stops being identical to the previous one.

`addTask` trims the title and returns `null` when nothing is left, so pressing Enter on an empty entry creates nothing. It also returns the new id, which lets a caller open a task as soon as it exists in [Opening a Task](/tutorial/the-task-editor).

## Reading from the store

Point the list at the store instead of the constant.

`src/components/task-list.tsx`:

```tsx
import { useStore } from "../store/index.js"; // [!code ++]

export const TaskList = () => {
    const TASKS: Task[] = [/* ... */]; // [!code --]
    const tasks = useStore((state) => state.tasks); // [!code ++]
    // ...
};
```

`useStore` takes a selector, subscribes the component to whatever that selector returns, and re-renders when the value changes by `Object.is`. Delete the `TASKS` constant and the `Task` import with it, since the rest of the component already maps over `tasks`.

The rest of this tutorial follows one rule for reading: **select the smallest stable thing, and derive the rest during render.** `state.tasks` returns the same array reference until a task changes, so the component stays put. A selector that builds a fresh value on every call, such as `state.tasks.filter(...)`, produces an unstable snapshot. With zustand 5, that can trigger an infinite render loop because React sees a different value even when the store has not changed. Filtering and counting belong in ordinary functions called during render, which [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) builds.

Actions follow the rule automatically. Their identity is fixed for the life of the store, so selecting one never triggers a re-render and never needs a dependency array:

```tsx
const addTask = useStore((state) => state.addTask);
```

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

`onEntryActivated` shows the rules that govern every signal in GTKX. **A signal prop is `on` followed by the signal name in PascalCase**, so `entry-activated` becomes `onEntryActivated`, and any signal in the GTK4 or Adwaita documentation translates the same way. **The widget that emitted the signal arrives as the last argument**, the `self` above. This signal carries nothing else, so `self` is the only parameter. When a signal does carry arguments, they come first and the emitter follows them.

`self` is what lets the handler clear the entry. Nothing binds this entry's text to a prop, so GTK4 owns it. Read the typed value with `self.text`, and clear it by assigning to the same property. This uncontrolled approach fits whenever a widget's value only matters at the moment it is submitted. Widgets whose value must stay in sync with the store are wired the other way, with a value prop and its change signal, and the next chapter builds one.

The `"personal"` passed as the list id is a placeholder while every task lives in one place. [Lists and a Sidebar](/tutorial/lists-and-the-sidebar) replaces it with the list you are currently viewing.

## Run it

Save `task-list.tsx` and watch the window. An empty row titled "Add a task…" appears at the top of the card, above the seeded tasks. Type `Buy oat milk` into it and press Enter. The task appears at the bottom of the list and the entry clears, ready for the next one. Press Enter on the empty entry and nothing happens, because `addTask` trims the title to nothing and returns early.

Now close the window, which ends the dev session, and run `npm run dev` again. Every task you typed is gone and the seeded tasks are back, because the store lives in memory and starts from `seedTasks` on each launch. That is the next chapter's job.

## Next

[Completing, Starring, and Deleting](/tutorial/completing-and-deleting) gives every row a checkbox, a star, and a delete button, each wired to a store action.
