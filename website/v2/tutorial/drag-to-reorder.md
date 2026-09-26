---
description: "Change the persisted manual order with drag and drop or keyboard shortcuts."
---

# Reorder Tasks

[Add Preferences](/v2/tutorial/preferences-and-theming) added Manual sorting. This chapter lets the user change that order with drag and drop or <kbd>Alt</kbd>+<kbd>Up</kbd>/<kbd>Alt</kbd>+<kbd>Down</kbd>.

## Add the reorder action

Each task already has a `position`. Add one action to `src/store/tasks.ts` that moves a task to another task's index and rewrites those positions:

```diff [src/store/tasks.ts]
@@ -14,0 +15 @@
+    reorder: (draggedId: string, targetId: string) => void;
```

```diff [src/store/tasks.ts]
@@ -55,0 +56,8 @@
+    reorder: (draggedId, targetId) =>
+        set((state) => {
+            const tasks = [...state.tasks];
+            const from = tasks.findIndex((task) => task.id === draggedId);
+            const to = tasks.findIndex((task) => task.id === targetId);
+            tasks.splice(to, 0, ...tasks.splice(from, 1));
+            return { tasks: tasks.map((task, index) => ({ ...task, position: index })) };
+        }),
```

The drop handler validates incoming IDs; keyboard handlers use IDs from the displayed tasks. Reordering moves the backing array and rewrites its positions together, preserving the append rule added in the previous chapter. Existing persistence saves the order.

## Enable reordering in manual views

Reordering changes the global manual order, including when you move tasks within a list, Today, or Important. Disable it for derived sorts, search results, Open/Done filters, and Trash so those views keep their displayed order.

Add the shared decision to `src/store/selectors.ts`:

```diff [src/store/selectors.ts]
@@ -118,0 +119,11 @@
+
+export const isReorderable = (
+    selection: Selection,
+    query: string,
+    filter: Filter,
+    sortOrder: SortOrder,
+): boolean =>
+    sortOrder === "manual" &&
+    query === "" &&
+    filter === "all" &&
+    !(selection.kind === "smart" && selection.view === "trash");
```

Add `isReorderable` to the selector import in `src/components/task-list.tsx`. Compute it once, then give each row its visible neighbors:

```diff [src/components/task-list.tsx]
@@ -8 +8 @@
-import { addListId, emptyState, visibleTasks } from "../store/selectors.js";
+import { addListId, emptyState, isReorderable, visibleTasks } from "../store/selectors.js";
@@ -21,0 +22 @@
+    const canReorder = isReorderable(selection, searchQuery, filter, sortOrder);
@@ -49,2 +50,8 @@
-                            {visible.map((task) => (
-                                <TaskRow key={task.id} task={task} />
+                            {visible.map((task, index) => (
+                                <TaskRow
+                                    key={task.id}
+                                    task={task}
+                                    canReorder={canReorder}
+                                    previousId={visible[index - 1]?.id}
+                                    nextId={visible[index + 1]?.id}
+                                />
```

The neighboring IDs give the keyboard command the same destinations a pointer drop receives.

## Add the row controllers

GTKX attaches generated controller elements through a widget's `controllers` prop. The pointer path uses GTK4's drag source and drop target; the keyboard path uses a key controller. The [GTK4 drag-and-drop overview](https://docs.gtk.org/gtk4/drag-and-drop.html) covers the native interaction model.

Update the imports and props in `src/components/task-row.tsx`:

```tsx [src/components/task-row.tsx]
import type * as Adw from "@gtkx/gi/adw";
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
    GtkWidgetPaintable,
} from "@gtkx/jsx/gtk";
import { useNavigation } from "@gtkx/navigation";
import { createPortal, rootElement } from "@gtkx/react";
import { useRef, useState } from "react";
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
    const [row, setRow] = useState<Adw.ActionRow | null>(null);
    const paintableRef = useRef<Gtk.WidgetPaintable | null>(null);
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
        <>
            {canReorder &&
                createPortal(
                    <GtkWidgetPaintable ref={paintableRef} widget={row as Gtk.Widget | null} />,
                    rootElement,
                )}
            <AdwActionRow
                ref={setRow}
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
                                    self.setIcon(paintableRef.current, Math.round(x), Math.round(y));
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
        </>
    );
};
```

`GtkWidgetPaintable` observes the row through a callback ref and a root portal. It stays mounted while reordering is enabled, so repeated drags reuse the same paintable. `onPrepare` sets its pointer offset and returns the task ID in a content provider; that synchronous native return is created inside the signal handler. A `TYPE_STRING` payload arrives through GTK's external input boundary as a [GObject.Value](https://docs.gtk.org/gobject/struct.Value.html), so the drop handler verifies that its string names a task before sending both IDs to the store. The key controller sends the current row and its previous or next neighbor to the same action.

When reordering is unavailable, the row has none of these controllers and exposes no keyboard-shortcut metadata.

## Run it

Choose Manual sorting and the All filter, clear the search box, and focus a task. Press <kbd>Alt</kbd>+<kbd>Up</kbd> or <kbd>Alt</kbd>+<kbd>Down</kbd>; the row moves one position. Dragging it onto another row changes the same persisted order.

Switch to Title, search for a task, select Open or Done, or open Trash. Pointer dragging and the reorder keys are disabled in each of those views. Return to Manual with All selected and an empty search to reorder again.

## Next

[Send Reminders](/v2/tutorial/reminders) sends a notification when a task reaches its reminder window.
