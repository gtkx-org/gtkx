---
description: "Give every row a checkbox, a star, and a delete button wired straight to store actions."
---

# Completing, Starring, and Deleting

In [Adding Tasks with a Store](/tutorial/the-task-store) you moved the task array into a Zustand store. This chapter adds a checkbox, a star, and a delete button to each row.

## More actions on the store

Add store actions for completion, importance, and deletion. They share a helper that updates a task by id.

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

`setDone` stamps `completedAt` when it sets `done` to true, and clears it again when you untick the box.

`moveToTrash` sets a flag instead of removing the task from the array. That keeps the data available for the Trash view in [Smart Views, Filters, and Search](/tutorial/smart-views-and-search) and for undo in [Deleting Without Fear](/tutorial/trash-and-toasts). For now the list just has to stop showing deleted tasks.

In `src/components/task-list.tsx`, filter the deleted tasks out before rendering:

```diff
-                            {tasks.map((task) => (
+                            {tasks.filter((task) => !task.deleted).map((task) => (
```

## A component per row

Keep the row's controls together in a `TaskRow` component.

Create `src/components/task-row.tsx`:

```tsx
import { markupEscapeText } from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkButton, GtkCheckButton, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";
import type { Task } from "../types.js";

export const TaskRow = ({ task }: { task: Task }) => {
    const setDone = useStore((state) => state.setDone);
    const setImportant = useStore((state) => state.setImportant);
    const moveToTrash = useStore((state) => state.moveToTrash);
    const escapedTitle = markupEscapeText(task.title, -1);
    const title = task.done ? `<s>${escapedTitle}</s>` : escapedTitle;

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

`TaskRow` receives the task as a prop and selects the store actions it needs.

## The checkbox

`AdwActionRow` takes leading and trailing widgets through its `prefix` and `suffix` slots. Put the checkbox in `prefix`.

`active` comes from the task. `onToggled` receives the checkbox and writes its new state to the store. This pairs the native property with its change signal to keep the widget and application state in sync.

`valign={Gtk.Align.CENTER}` keeps the checkbox centered vertically in the row.

## Striking through a completed title

`AdwActionRow` renders its title as [Pango markup](https://docs.gtk.org/Pango/pango_markup.html) when you set `useMarkup`, so wrapping the title in `<s>` gives you a strikethrough without any CSS:

```tsx
const escapedTitle = markupEscapeText(task.title, -1);
const title = task.done ? `<s>${escapedTitle}</s>` : escapedTitle;
```

With `useMarkup` on, the title is parsed as markup rather than shown literally. Escape user text before wrapping it in tags you control. GTKX exposes GLib's [`markupEscapeText`](https://docs.gtk.org/glib/func.markup_escape_text.html), so the app does not need its own escaping routine.

## The star and the trash button

The `suffix` slot takes a fragment containing both trailing controls. The star is a `GtkToggleButton` whose icon and `active` property follow `task.important`. Deleting uses a `GtkButton` with an `onClicked` handler.

The `flat` style class drops the button frame, which keeps the row from looking like a toolbar.

Give these icon-only controls an `accessibleLabel` so screen readers can announce their purpose. The tests in [Appendix A](/tutorial/testing) also use those names to find the controls.

## Run it

Save the files. The rows in the open window now carry a checkbox on the left and a star on the right.

Tick the checkbox on **Welcome to Tasks**. Its title gets a strikethrough, and the box stays ticked.

Click an unfilled star. Its icon fills in and stays filled. Click it again and it empties.

Click the trash button on a row. The row leaves the list. The task is still in the store, only flagged, and the list is filtering it out.

Now quit and start the app again. The seeded tasks return with their original values: this chapter's changes still live only in memory.

## Next

[Saving Tasks Between Runs](/tutorial/saving-to-disk) puts the store on disk, so everything you ticked, starred, and typed is still there the next time you launch.
