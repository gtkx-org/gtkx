---
description: "Reorder tasks by pointer or keyboard where the complete manual list is visible."
---

# Dragging Tasks Into Order

[Preferences and the System Theme](/tutorial/preferences-and-theming) added Manual sorting. This chapter lets the user change that order with drag and drop or <kbd>Alt</kbd>+<kbd>Up</kbd>/<kbd>Alt</kbd>+<kbd>Down</kbd>.

## Add the reorder action

Each task already has a `position`. Add one action to `src/store/tasks.ts` that moves a task to another task's index and rewrites those positions:

```diff
     deleteForever: (id: string) => void;
+    reorder: (draggedId: string, targetId: string) => void;
```

```ts
reorder: (draggedId, targetId) =>
    set((state) => {
        const tasks = [...state.tasks];
        const from = tasks.findIndex((task) => task.id === draggedId);
        const to = tasks.findIndex((task) => task.id === targetId);
        tasks.splice(to, 0, ...tasks.splice(from, 1));
        return { tasks: tasks.map((task, index) => ({ ...task, position: index })) };
    }),
```

Callers validate the IDs at their input boundary, so the action can use them directly. The store's existing persistence writes the new positions to disk.

## Limit reordering to the complete manual list

A displayed order can be edited only when the screen contains the complete ordered set. Title and date sorts derive their order, while search, Open/Done filtering, and Trash show subsets that do not have an unambiguous insertion point.

Add the shared decision to `src/store/selectors.ts`:

```ts
export const isReorderable = (
    selection: Selection,
    query: string,
    filter: Filter,
    sortOrder: SortOrder,
): boolean =>
    sortOrder === "manual" &&
    query === "" &&
    filter === "all" &&
    !(selection.kind === "smart" && selection.view === "trash");
```

Compute it once in `src/components/task-list.tsx`, then give each row its neighbors:

```tsx
const canReorder = isReorderable(selection, searchQuery, filter, sortOrder);

{visible.map((task, index) => (
    <TaskRow
        key={task.id}
        task={task}
        canReorder={canReorder}
        previousId={visible[index - 1]?.id}
        nextId={visible[index + 1]?.id}
    />
))}
```

The neighboring IDs give the keyboard command the same destinations a pointer drop receives.

## Add the row controllers

GTKX attaches generated controller elements through a widget's `controllers` prop. The pointer path uses GTK4's drag source and drop target; the keyboard path uses a key controller. The [GTK4 drag-and-drop overview](https://docs.gtk.org/gtk4/drag-and-drop.html) covers the native interaction model.

Update the imports and props in `src/components/task-row.tsx`:

```tsx
import * as Gdk from "@gtkx/gi/gdk";
import { markupEscapeText } from "@gtkx/gi/glib";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import {
    GtkButton,
    GtkCheckButton,
    GtkDragSource,
    GtkDropTarget,
    GtkEventControllerKey,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { useNavigation } from "@gtkx/navigation";
import { formatDue } from "../format.js";
import { useStore } from "../store/index.js";
import type { Task } from "../types.js";
import { useRequestDeleteTask } from "./dialogs.js";

type TaskRowProps = {
    task: Task;
    canReorder: boolean;
    previousId?: string;
    nextId?: string;
};

export const TaskRow = ({ task, canReorder, previousId, nextId }: TaskRowProps) => {
    const requestDeleteTask = useRequestDeleteTask();
    const navigation = useNavigation();
    const setDone = useStore((state) => state.setDone);
    const setImportant = useStore((state) => state.setImportant);
    const reorder = useStore((state) => state.reorder);
    const escapedTitle = markupEscapeText(task.title, -1);
    const title = task.done ? `<s>${escapedTitle}</s>` : escapedTitle;

    const handleReorderKey = (keyval: number, state: Gdk.ModifierType): boolean => {
        if ((state & Gdk.ModifierType.ALT_MASK) === 0) return Gdk.EVENT_PROPAGATE;
        if (keyval !== Gdk.KEY_Up && keyval !== Gdk.KEY_Down) return Gdk.EVENT_PROPAGATE;
        const targetId = keyval === Gdk.KEY_Up ? previousId : nextId;
        if (targetId === undefined) return Gdk.EVENT_PROPAGATE;
        reorder(task.id, targetId);
        return Gdk.EVENT_STOP;
    };

    return (
        <AdwActionRow
            title={title}
            useMarkup
            subtitle={formatDue(task.due) ?? undefined}
            activatable
            accessibleKeyShortcuts={canReorder ? "Alt+Up Alt+Down" : null}
            onActivated={() => navigation.navigate("Task", { id: task.id })}
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
                canReorder ? (
                    <>
                        <GtkDragSource
                            actions={Gdk.DragAction.MOVE}
                            onPrepare={(x, y, self) => {
                                const row = self.getWidget() as Gtk.Widget;
                                self.setIcon(Gtk.WidgetPaintable.new(row), Math.round(x), Math.round(y));
                                return Gdk.ContentProvider.newForValue(task.id);
                            }}
                        />
                        <GtkDropTarget
                            actions={Gdk.DragAction.MOVE}
                            types={[GObject.TYPE_STRING]}
                            onDrop={(value) => {
                                const draggedId = value.getString();
                                if (
                                    draggedId === null ||
                                    !useStore.getState().tasks.some((candidate) => candidate.id === draggedId)
                                )
                                    return false;
                                reorder(draggedId, task.id);
                                return true;
                            }}
                        />
                        <GtkEventControllerKey
                            onKeyPressed={(keyval, _keycode, state) => handleReorderKey(keyval, state)}
                        />
                    </>
                ) : undefined
            }
        />
    );
};
```

`onPrepare` carries the task ID and uses the row as the drag icon. A `TYPE_STRING` payload arrives through GTK's external input boundary as a [GObject.Value](https://docs.gtk.org/gobject/struct.Value.html), so the drop handler verifies that its string names a task before sending both IDs to the store. The key controller sends the current row and its previous or next neighbor to the same action.

When reordering is unavailable, the row has none of these controllers and exposes no keyboard-shortcut metadata.

## Run it

Choose Manual sorting and the All filter, clear the search box, and focus a task. Press <kbd>Alt</kbd>+<kbd>Up</kbd> or <kbd>Alt</kbd>+<kbd>Down</kbd>; the row moves one position. Dragging it onto another row changes the same persisted order.

Switch to Title, search for a task, select Open or Done, or open Trash. Pointer dragging and the reorder keys are disabled in each partial or derived view. Return to Manual with All selected and an empty search to reorder again.

## Next

[Reminders That Reach the Desktop](/tutorial/reminders) sends a notification when a task reaches its reminder window.
