---
description: "Model a task and render a hardcoded array as an Adwaita boxed list."
---

# Showing a List of Tasks

Replace the empty state from [Your First Window](/v2/tutorial/your-first-window) with an Adwaita boxed list of tasks. Start with sample data; the next chapter adds editing.

## The task model

The following chapters share this task model.

Create `src/types.ts`:

```ts
export type Task = {
    id: string;
    listId: string;
    title: string;
    notes: string;
    done: boolean;
    important: boolean;
    deleted: boolean;
    due: string | null;
    position: number;
    createdAt: string;
    completedAt: string | null;
};
```

`title` is the line you see in the list, `notes` the longer body you see when you open a task, and `position` is where the task sits in manual order.

Dates use ISO strings so tasks can be saved as JSON in [Saving Tasks Between Runs](/v2/tutorial/saving-to-disk).

## A hardcoded array

Use three sample tasks to build the list.

Create `src/components/task-list.tsx`:

```tsx
import type { Task } from "../types.js";

const createdAt = new Date().toISOString();

const TASKS: Task[] = [
    {
        id: "t1",
        listId: "personal",
        title: "Welcome to Tasks",
        notes: "This is your first task. Tick the checkbox to complete it, or open it to add notes and a due date.",
        done: false,
        important: false,
        deleted: false,
        due: null,
        position: 0,
        createdAt,
        completedAt: null,
    },
    {
        id: "t2",
        listId: "personal",
        title: "Water the plants",
        notes: "",
        done: false,
        important: true,
        deleted: false,
        due: null,
        position: 1,
        createdAt,
        completedAt: null,
    },
    {
        id: "t3",
        listId: "work",
        title: "Prepare the weekly report",
        notes: "",
        done: false,
        important: false,
        deleted: false,
        due: null,
        position: 2,
        createdAt,
        completedAt: null,
    },
];
```

The next chapter moves this data into a store as the initial tasks for a fresh install.

## The list frame

Use `GtkScrolledWindow` to scroll long lists and `AdwClamp` to keep rows readable in a wide window. Inside them, a `GtkListBox` with the `boxed-list` CSS class groups the tasks into a rounded card.

Add the frame to `src/components/task-list.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwClamp } from "@gtkx/jsx/adw";
import { GtkListBox, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { Task } from "../types.js";

// ...

export const TaskList = () => (
    <GtkScrolledWindow vexpand>
        <AdwClamp maximumSize={640} marginTop={12} marginBottom={12} marginStart={12} marginEnd={12}>
            <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                {/* ... */}
            </GtkListBox>
        </AdwClamp>
    </GtkScrolledWindow>
);
```

`cssClasses` applies native style classes to the widget. [CSS](/v2/guide/css) covers using Adwaita classes and your own stylesheets.

`selectionMode={Gtk.SelectionMode.NONE}` disables row selection because task rows will have their own controls. Import enums such as `Gtk.SelectionMode` from `@gtkx/gi/gtk`, and JSX elements from `@gtkx/jsx/gtk`.

## One row per task

Use `AdwActionRow` to show each task's title and notes.

Fill in the list box in `src/components/task-list.tsx`:

```tsx
<GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
    {TASKS.map((task) => (
        <AdwActionRow key={task.id} title={task.title} subtitle={task.notes} />
    ))}
</GtkListBox>
```

Update the import to bring in the row alongside the clamp:

```ts
import { AdwActionRow, AdwClamp } from "@gtkx/jsx/adw";
```

Use `task.id` as the key so each native row keeps its identity when tasks are reordered. React's [list rendering guide](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key) explains stable keys.

## Run it

Point the window body at the list. In `src/app.tsx`, swap the status page for the component:

```diff
-                    <AdwStatusPage
-                        iconName="checkbox-checked-symbolic"
-                        title="No Tasks Yet"
-                        description="Your tasks will show up here."
-                    />
+                    <TaskList />
```

and import it:

```diff
+import { TaskList } from "./components/task-list.js";
```

`AdwStatusPage` is no longer used in this file, so drop it from the `@gtkx/jsx/adw` import.

Save and watch the window you already have open. The status page is gone, replaced by a rounded card holding the task titles, centered under the header bar with a margin. "Welcome to Tasks" shows its notes as a second line under the title; the others show a title alone, because their notes are empty.

Drag the window wider and past a certain width the card stops growing and stays centered: that is the clamp. Drag it short until the rows do not fit and the list scrolls instead of clipping.

Then add another entry to `TASKS`, copying an existing one and changing its `id` and `title`. Save, and the new row appears in the card.

## Next

This list is read-only. [Adding Tasks with a Store](/v2/tutorial/the-task-store) moves the tasks into a store and lets you type a new one.
