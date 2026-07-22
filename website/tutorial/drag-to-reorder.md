---
description: "Reorder rows by dragging, and only where a manual order means something."
---

# Dragging Tasks Into Order

The sort order you added in [Preferences and the System Theme](/tutorial/preferences-and-theming) includes Manual, which so far means the order tasks were created in. Make it mean the order you put them in.

## The reorder action

Every task carries a `position`, and the manual comparator sorts on it, but nothing changes it yet. Moving one task in front of another is easier to express on an array than on the raw numbers: pull the dragged task out, splice it back in at the target's index, then rewrite every position to its new array index. Positions stay dense (0, 1, 2, and so on) with no gaps and no fractional values, and the comparator stays a plain subtraction.

Add the action to the tasks slice, in `src/store/tasks.ts`:

```ts
export type TasksSlice = {
    // ...
    deleteForever: (id: string) => void;
    reorder: (draggedId: string, targetId: string) => void;
};

export const createTasksSlice: StateCreator<Store, Mutators, [], TasksSlice> = (set) => ({
    // ...
    reorder: (draggedId, targetId) =>
        set((state) => {
            const tasks = [...state.tasks];
            const from = tasks.findIndex((task) => task.id === draggedId);
            const to = tasks.findIndex((task) => task.id === targetId);
            if (from < 0 || to < 0 || from === to) return {};
            const [moved] = tasks.splice(from, 1);
            if (moved === undefined) return {};
            tasks.splice(to, 0, moved);
            return { tasks: tasks.map((task, index) => ({ ...task, position: index })) };
        }),
});
```

Returning an empty object from `set` is a no-op, which is what you want when an id is missing or a row is dropped on itself. Because `reorder` lives in the persisted slice, the new order reaches disk through the same middleware as everything else, described in [Saving Tasks Between Runs](/tutorial/saving-to-disk).

## Event controllers

In GTK4, input handling lives in separate objects called event controllers that you attach to a widget. Pointer, keyboard, gesture, and drag handling all work this way; the widget itself only draws. GTKX exposes them through a `controllers` slot, the same shape as the shortcut controller you mounted on the window in [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts). Anything in that slot is attached to the widget rather than packed inside it.

A reorder needs `GtkDragSource`, which makes a widget something you can pick up, and `GtkDropTarget`, which makes a widget something you can drop onto. Every row gets both, because any row can be dragged and any row can receive a drop.

## Making a row draggable

In `src/components/task-row.tsx`, add the drag source:

```tsx
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkCheckButton, GtkDragSource, GtkToggleButton } from "@gtkx/jsx/gtk";
// ...

export const TaskRow = ({ task }: { task: Task }) => {
    // ...
    const reorder = useStore((state) => state.reorder);

    return (
        <AdwActionRow
            // ...
            controllers={
                <GtkDragSource
                    actions={Gdk.DragAction.MOVE}
                    onPrepare={(x, y, self) => {
                        const row = self.getWidget();
                        if (row) self.setIcon(Gtk.WidgetPaintable.new(row), Math.round(x), Math.round(y));
                        return Gdk.ContentProvider.newForValue(
                            GObject.buildValue(GObject.TYPE_STRING, (value) => value.setString(task.id)),
                        );
                    }}
                />
            }
        />
    );
};
```

`actions={Gdk.DragAction.MOVE}` says this drag moves its payload rather than copying or linking it, which is what the cursor shape and the drop target both check.

`onPrepare` runs once, when GTK4 decides the pointer has traveled far enough to count as a drag rather than a click. It returns the payload. A drag payload is a `Gdk.ContentProvider` wrapping a `GValue`, GObject's boxed-value type, and `GObject.buildValue` builds one from the type and a callback that fills it. Here the payload is the task's id, which is all the drop side needs to look the task up.

The same handler gives the drag a picture. `self.getWidget()` returns the widget the controller is attached to, this row, and `Gtk.WidgetPaintable.new(row)` turns it into something drawable, so the ghost following your pointer is a live rendering of the row. The `x` and `y` are the point inside the row where the drag started. Passing them as the hotspot pins the ghost to the cursor at the spot you grabbed, instead of snapping the row's corner under the pointer.

`getWidget()` is nullable, hence the `if` around the icon. Returning the content provider is unconditional, since a drag with no payload is one nothing can accept.

## Accepting a drop

A source with no target produces a ghost that follows the pointer and then springs back. Add the other half, still in `src/components/task-row.tsx`:

```tsx
import { GtkButton, GtkCheckButton, GtkDragSource, GtkDropTarget, GtkToggleButton } from "@gtkx/jsx/gtk";
// ...

            controllers={
                <>
                    <GtkDragSource
                        // ...
                    />
                    <GtkDropTarget
                        actions={Gdk.DragAction.MOVE}
                        types={[GObject.TYPE_STRING]}
                        onDrop={(value) => {
                            const draggedId = value.getString();
                            if (draggedId) reorder(draggedId, task.id);
                            return true;
                        }}
                    />
                </>
            }
```

`types` declares what this target accepts. A drag carrying anything other than a string never highlights this row and never reaches `onDrop`. Inside the handler, `value` is the `GValue` the source built, so `getString()` returns the dragged task's id, and the target's own `task.id` is the destination. Returning `true` reports the drop as handled. Returning `false` tells GTK4 the drop failed, and the drag animates back to where it started.

Rows have been keyed by task id since [Showing a List of Tasks](/tutorial/a-list-of-tasks). When the sorted array comes back in a different order, the reconciler recognizes the same keys and repositions the existing `AdwActionRow` widgets rather than destroying and rebuilding them. A drop moves rows instead of rebuilding the list.

## When dragging makes sense

Dragging a row to a new position only matters when position is what the list is sorted by. Under Title or Due Date, the drop rewrites positions no one can see. In Trash, arranging discarded tasks serves no purpose. Search has the same problem: the list on screen is a subset, so dropping between two visible rows says nothing about where the task belongs among the ones filtered out.

That is one boolean, and it belongs with the other reading logic. Add it to `src/store/selectors.ts`:

```ts
export const isReorderable = (selection: Selection, query: string, sortOrder: SortOrder): boolean =>
    sortOrder === "manual" && query === "" && !(selection.kind === "smart" && selection.view === "trash");
```

Now gate the whole slot, in `src/components/task-row.tsx`:

```tsx
import { useSortOrder } from "../hooks/use-sort-order.js";
import { isReorderable } from "../store/selectors.js";
// ...

    const selection = useStore((state) => state.selection);
    const searchQuery = useStore((state) => state.searchQuery);
    const [sortOrder] = useSortOrder();
    const reorderable = isReorderable(selection, searchQuery, sortOrder);

    // ...
            controllers={
                reorderable ? (
                    <>
                        {/* ... */}
                    </>
                ) : undefined
            }
```

A non-reorderable row has no drag source and no drop target attached, rather than controllers that accept a drag and then decline it. Switching the sort order in Preferences changes `sortOrder`, so the rows re-render and the controllers come off every row.

The finished row, `src/components/task-row.tsx`:

```tsx
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkButton, GtkCheckButton, GtkDragSource, GtkDropTarget, GtkToggleButton } from "@gtkx/jsx/gtk";
import { escapeMarkup, formatDue } from "../format.js";
import { useSortOrder } from "../hooks/use-sort-order.js";
import { useStore } from "../store/index.js";
import { isReorderable } from "../store/selectors.js";
import type { Task } from "../types.js";
import { useRequestDeleteTask } from "./dialogs.js";

export const TaskRow = ({ task }: { task: Task }) => {
    const requestDeleteTask = useRequestDeleteTask();
    const setDone = useStore((state) => state.setDone);
    const setImportant = useStore((state) => state.setImportant);
    const openTask = useStore((state) => state.openTask);
    const reorder = useStore((state) => state.reorder);
    const selection = useStore((state) => state.selection);
    const searchQuery = useStore((state) => state.searchQuery);
    const [sortOrder] = useSortOrder();
    const reorderable = isReorderable(selection, searchQuery, sortOrder);
    const title = task.done ? `<s>${escapeMarkup(task.title)}</s>` : escapeMarkup(task.title);

    return (
        <AdwActionRow
            title={title}
            useMarkup
            subtitle={formatDue(task.due) ?? undefined}
            activatable
            onActivated={() => openTask(task.id)}
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
                        onClicked={() => requestDeleteTask(task)}
                    />
                </>
            }
            controllers={
                reorderable ? (
                    <>
                        <GtkDragSource
                            actions={Gdk.DragAction.MOVE}
                            onPrepare={(x, y, self) => {
                                const row = self.getWidget();
                                if (row) self.setIcon(Gtk.WidgetPaintable.new(row), Math.round(x), Math.round(y));
                                return Gdk.ContentProvider.newForValue(
                                    GObject.buildValue(GObject.TYPE_STRING, (value) => value.setString(task.id)),
                                );
                            }}
                        />
                        <GtkDropTarget
                            actions={Gdk.DragAction.MOVE}
                            types={[GObject.TYPE_STRING]}
                            onDrop={(value) => {
                                const draggedId = value.getString();
                                if (draggedId) reorder(draggedId, task.id);
                                return true;
                            }}
                        />
                    </>
                ) : undefined
            }
        />
    );
};
```

## Run it

Save the file and go back to the window.

Open All Tasks with the sort order on Manual, press on a row, and drag it upward. A translucent copy of the row follows your pointer, held at the point where you grabbed it. Release it over another row, and the dragged row lands at that row's position while the rest shift down.

Check that the rewritten positions reached disk:

```bash
jq '[.state.tasks[] | {title, position}]' ~/.local/share/com.gtkx.tutorial/tasks.json
```

Every task carries a dense position matching the order on screen, not the order they were created in.

Now the negative check. Open Preferences with <kbd>Ctrl</kbd><kbd>,</kbd>, set the sort order to Title, and close the dialog. The list reorders alphabetically, and pressing and dragging a row does nothing: no ghost, no highlight, no movement. Switch back to Manual and the drag works again. Press <kbd>Ctrl</kbd><kbd>F</kbd> and type into the search box for the same result, because a partial list is not something you can meaningfully arrange.

## Next

[Reminders That Reach the Desktop](/tutorial/reminders) sends a notification before a task is due, with buttons that still work once the app has closed.
