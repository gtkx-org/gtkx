---
description: "Model a task and render a hardcoded array as an Adwaita boxed list."
---

# Showing a List of Tasks

In [Your First Window](/v2/tutorial/your-first-window) you put an Adwaita window with a header bar on screen. Its body is still a status page saying there are no tasks yet. This page replaces that with real rows from real data, before adding any state management.

## The data model, first

Every component you add from here reads this shape, so define it first.

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

The dates are ISO strings, not `Date` objects. In [Saving Tasks Between Runs](/v2/tutorial/saving-to-disk) this object passes through `JSON.stringify` into a file on disk, where a `Date` would serialize to a string anyway. Build a `Date` from the string when you compare or format it.

## A hardcoded array

Skip the store for now. A hardcoded array is enough to get the widgets working.

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

The component stops reading this array in [Adding Tasks with a Store](/v2/tutorial/the-task-store). The data moves into a seed module and becomes what a fresh install starts with.

## The list frame

A task list can grow past the height of the window, so the outermost widget is `GtkScrolledWindow`. `vexpand` makes it claim all the vertical space the toolbar view gives it, so it scrolls instead of being squashed.

Rows stretched across a wide monitor are hard to read, so `AdwClamp` caps the content width at `maximumSize` pixels and centers it. The margins keep the card off the window edges.

Rows go in a `GtkListBox`. Add the `boxed-list` style class and Adwaita draws it as a rounded card with separators between rows, the standard look for a settings-style list.

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

Style classes are plain strings, the same names in the Adwaita style class documentation, and `cssClasses` takes an array because a widget can carry several at once. They are not GTKX-specific, so anything Adwaita ships (`flat`, `pill`, `destructive-action`, `dim-label`) works by name. Your own stylesheets work the same way, covered in [CSS](/v2/guide/css).

`selectionMode={Gtk.SelectionMode.NONE}` turns off the list box's own selection highlight. A task row carries its own controls, so clicking a row should open the task rather than select the row. Enumerations like `Gtk.SelectionMode` come from `@gtkx/gi/gtk`, the generated binding for the GTK4 namespace, while the components come from `@gtkx/jsx/gtk`.

## One row per task

`AdwActionRow` is the standard row: a title, an optional subtitle under it, and slots on either side for controls.

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

Every list in this app relies on `key`. The reconciler compares the elements you return this render against the ones from last render. Without a key it matches them by position, so inserting a task at the top makes every row below look changed and rewrites its properties. With a stable key, the reconciler recognizes the same task in a new place and moves the existing `AdwActionRow` instead of rebuilding it. That is why dragging a row in [Dragging Tasks Into Order](/v2/tutorial/drag-to-reorder) costs a reparent rather than a rebuild of the whole card.

Use the task's `id`, never the array index. An index key says the row in slot zero is still the row in slot zero, which stops being true when the order changes.

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
