---
description: "Give every row a checkbox, a star, and a delete button wired straight to store actions."
---

# Completing, Starring, and Deleting

In [Adding Tasks with a Store](/v2/tutorial/the-task-store) you moved the task array into a zustand store, so typing a title into the top row appends a task. The rows themselves don't respond to clicks yet.

Now each row gains a checkbox, a star, and a delete button, and becomes its own component that reads the store directly.

## More actions on the store

`addTask` can only append. Ticking a box changes the `done` field of an existing task, so the store needs actions that patch a task in place. Each one finds the task by id and replaces it with a copy carrying new fields. Write that as a helper and the actions stay one line each.

In `src/store/index.ts`, add the helper and the actions:

```ts
// ...

export type Store = {
    tasks: Task[];
    addTask: (listId: string, title: string) => string | null;
    setDone: (id: string, done: boolean) => void;
    setImportant: (id: string, important: boolean) => void;
    moveToTrash: (id: string) => void;
};

const patch = (tasks: Task[], id: string, fields: Partial<Task>): Task[] =>
    tasks.map((task) => (task.id === id ? { ...task, ...fields } : task));

export const useStore = create<Store>()((set) => ({
    // ...
    setDone: (id, done) =>
        set((state) => ({
            tasks: patch(state.tasks, id, { done, completedAt: done ? new Date().toISOString() : null }),
        })),
    setImportant: (id, important) => set((state) => ({ tasks: patch(state.tasks, id, { important }) })),
    moveToTrash: (id) => set((state) => ({ tasks: patch(state.tasks, id, { deleted: true }) })),
}));
```

`patch` rebuilds only the matching task, so untouched tasks keep their identity. That matters for rendering: a row whose task object is unchanged has nothing to re-render.

`setDone` stamps `completedAt` when it sets `done` to true, and clears it again when you untick the box.

`moveToTrash` sets a flag instead of removing the task from the array. That keeps the data available for the Trash view in [Smart Views, Filters, and Search](/v2/tutorial/smart-views-and-search) and for undo in [Deleting Without Fear](/v2/tutorial/trash-and-toasts). For now the list just has to stop showing deleted tasks.

In `src/components/task-list.tsx`, filter the deleted tasks out before rendering:

```diff
-                            {tasks.map((task) => (
+                            {tasks.filter((task) => !task.deleted).map((task) => (
```

## A component per row

A checkbox, a toggle, a button, and a title that changes shape is too much to keep inline in the list, so give the row its own file.

Create `src/components/task-row.tsx`:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkButton, GtkCheckButton, GtkToggleButton } from "@gtkx/jsx/gtk";
import { escapeMarkup } from "../format.js";
import { useStore } from "../store/index.js";
import type { Task } from "../types.js";

export const TaskRow = ({ task }: { task: Task }) => {
    const setDone = useStore((state) => state.setDone);
    const setImportant = useStore((state) => state.setImportant);
    const moveToTrash = useStore((state) => state.moveToTrash);
    const title = task.done ? `<s>${escapeMarkup(task.title)}</s>` : escapeMarkup(task.title);

    return (
        <AdwActionRow
            title={title}
            useMarkup
            prefix={
                <GtkCheckButton
                    valign={Gtk.Align.CENTER}
                    active={task.done}
                    accessibleLabel="Mark complete"
                    onToggled={(self) => setDone(task.id, self.active)}
                />
            }
            suffix={
                <>
                    <GtkToggleButton
                        valign={Gtk.Align.CENTER}
                        iconName={task.important ? "starred-symbolic" : "non-starred-symbolic"}
                        active={task.important}
                        accessibleLabel="Toggle important"
                        cssClasses={["flat"]}
                        onToggled={(self) => setImportant(task.id, self.active)}
                    />
                    <GtkButton
                        valign={Gtk.Align.CENTER}
                        iconName="user-trash-symbolic"
                        accessibleLabel="Delete task"
                        cssClasses={["flat"]}
                        onClicked={() => moveToTrash(task.id)}
                    />
                </>
            }
        />
    );
};
```

Then use it from the list. In `src/components/task-list.tsx`:

```tsx
// ...
import { TaskRow } from "./task-row.js";

export const TaskList = () => {
    // ...
    return (
        // ...
        {tasks.filter((task) => !task.deleted).map((task) => (
            <TaskRow key={task.id} task={task} />
        ))}
        // ...
    );
};
```

`TaskRow` takes one prop: data. It has no `onToggle` or `onDelete` handlers. The row reaches the store itself, so adding a control to a row changes only this file, and the list never learns that the row grew a star.

The `useStore` calls are separate rather than one selector returning an object, so each comparison is a plain `Object.is` against the previous value. An action's identity never changes for the life of the store, so those subscriptions never fire a re-render.

## The checkbox

`AdwActionRow` puts its title and subtitle in the middle and takes widgets on either side through `prefix` and `suffix`, container slots backed by Adwaita's `add_prefix` and `add_suffix`.

```tsx
prefix={
    <GtkCheckButton
        valign={Gtk.Align.CENTER}
        active={task.done}
        accessibleLabel="Mark complete"
        onToggled={(self) => setDone(task.id, self.active)}
    />
}
```

`active` comes from the task. `onToggled` reads the widget's state off the emitter and writes it to the store, which produces a new task, which flows back into `active`. A value prop plus the signal reporting the widget's own change is what makes a widget controlled in GTKX, and every editable widget in this app uses that shape.

`valign` centers the box in a taller row. Without it the checkbox stretches to the full row height and its hit area swallows the row.

## Striking through a completed title

`AdwActionRow` renders its title as [Pango markup](https://docs.gtk.org/Pango/pango_markup.html) when you set `useMarkup`, so wrapping the title in `<s>` gives you a strikethrough without any CSS:

```tsx
const title = task.done ? `<s>${escapeMarkup(task.title)}</s>` : escapeMarkup(task.title);
```

With `useMarkup` on, the title is parsed as markup rather than shown literally. A task titled `Buy milk & eggs` is invalid markup, and one titled `<b>` injects a tag. Escape any text a user typed before wrapping it in tags you control.

Create `src/format.ts`:

```ts
export const escapeMarkup = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
```

## The star and the trash button

The `suffix` slot takes a fragment, so both trailing controls live there. The star is a `GtkToggleButton`, because important is a state the button displays rather than a one-shot command, and it swaps its icon on that state. Deleting is a command, so it uses a plain `GtkButton`.

```tsx
suffix={
    <>
        <GtkToggleButton
            valign={Gtk.Align.CENTER}
            iconName={task.important ? "starred-symbolic" : "non-starred-symbolic"}
            active={task.important}
            accessibleLabel="Toggle important"
            cssClasses={["flat"]}
            onToggled={(self) => setImportant(task.id, self.active)}
        />
        <GtkButton
            valign={Gtk.Align.CENTER}
            iconName="user-trash-symbolic"
            accessibleLabel="Delete task"
            cssClasses={["flat"]}
            onClicked={() => moveToTrash(task.id)}
        />
    </>
}
```

The `flat` style class drops the button frame, which keeps the row from looking like a toolbar.

An icon-only button has no accessible name, so give icon-only controls an `accessibleLabel`. A screen reader announces it, and the tests in [Appendix A](/v2/tutorial/testing) query by it, so a button without one is one no test can click.

## Run it

Save the files. The rows in the open window now carry a checkbox on the left and a star on the right.

Tick the checkbox on **Welcome to Tasks**. Its title gets a strikethrough, and the box stays ticked.

Click the star on any row. The outline icon fills in and stays filled. Click it again and it empties.

Click the trash button on a row. The row leaves the list. The task is still in the store, only flagged, and the list is filtering it out.

Now quit and start the app again. The strikethrough is gone, the star is empty, and the deleted row is back. Nothing you did survived, because the store still lives only in memory.

## Next

[Saving Tasks Between Runs](/v2/tutorial/saving-to-disk) puts the store on disk, so everything you ticked, starred, and typed is still there the next time you launch.
