---
description: "Each task is an AdwActionRow with checkbox, star, and delete controls, plus drag-and-drop reordering built from GTK event controllers."
---

# Task Rows and Drag-to-Reorder

Each task in the list is one `AdwActionRow`. In libadwaita an action row is a preferences-style row with a title, an optional subtitle, and slots on either end for small controls: a leading `prefix` and a trailing `suffix`. Dropped into a `GtkListBox` styled with the `boxed-list` CSS class, a stack of these rows becomes the rounded, separated card that every GNOME app uses for short editable lists. `TaskRow` fills that row with a done checkbox, a strikethrough title, a star, a delete button, and (when ordering is manual) the two event controllers that make it draggable.

The whole component is one JSX tree with no imperative widget code. Here is the shell, from `components/task-row.tsx`:

```tsx
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkButton, GtkCheckButton, GtkDragSource, GtkDropTarget, GtkToggleButton } from "@gtkx/jsx/gtk";
import { escapeMarkup, formatDue } from "../format.js";

export const TaskRow = ({ task, reorderable, onToggleDone, onToggleImportant, onDelete, onOpen, onReorder }: TaskRowProps) => {
    const title = task.done ? `<s>${escapeMarkup(task.title)}</s>` : escapeMarkup(task.title);

    return (
        <AdwActionRow
            title={title}
            useMarkup
            subtitle={formatDue(task.due) ?? undefined}
            activatable
            onActivated={() => onOpen(task.id)}
            // prefix / suffix / controllers below
        />
    );
};
```

`activatable` makes the whole row body clickable, and `onActivated` (the `activated` signal, which GTK emits on click or Enter) opens the task in the editor. The controls in the prefix and suffix sit *on top of* that activatable body: clicking the checkbox toggles done without opening the editor, because GTK routes the click to the inner widget first.

`subtitle` shows a humanized due date. `formatDue` returns `string | null`: a formatted date when the task has a due date, or `null` when it does not. The `?? undefined` normalizes that empty case to `undefined`, so a task with no due date simply has no subtitle line.

## The strikethrough title uses Pango markup, not CSS

There is no `text-decoration` in GTK CSS. To strike out a completed task's title you wrap it in Pango markup, GTK's inline text-formatting syntax (`<s>` for strikethrough, `<b>`, `<i>`, `<span foreground="...">`, and so on), then tell the label to parse it:

```tsx
const title = task.done ? `<s>${escapeMarkup(task.title)}</s>` : escapeMarkup(task.title);
// ...
<AdwActionRow title={title} useMarkup /* ... */ />
```

`useMarkup` (the `use-markup` property) switches the row's title from plain text to a Pango-markup string. That switch is exactly why `escapeMarkup` is not optional. Once markup is on, a task literally titled `<b>` or `Q&A` would be parsed as broken markup and either render wrong or fail. `escapeMarkup` neutralizes the three markup-significant characters before they reach Pango:

```ts
export const escapeMarkup = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
```

So the pattern is: escape the untrusted title first, then wrap the escaped result in your own trusted `<s>` tags. Never the other way around.

## The done checkbox: controlled, and idempotent by reading the widget

The prefix slot holds a `GtkCheckButton`. It is a controlled widget: its `active` state is driven from `task.done`, so React state is always the source of truth for whether the box is checked.

```tsx
prefix={
    <GtkCheckButton
        valign={Gtk.Align.CENTER}
        active={task.done}
        accessibleLabel="Mark complete"
        onToggled={(self) => onToggleDone(task.id, self.active)}
    />
}
```

Two GTK details worth calling out.

`valign={Gtk.Align.CENTER}` keeps the checkbox vertically centered against a row that may grow to two lines when it has a subtitle. Alignment enums like `Gtk.Align` come from `@gtkx/gi/gtk`, the raw GI import you reach for whenever a prop wants an enum value or you need a live widget class.

The `onToggled` handler reads `self.active` rather than computing `!task.done`. Every gtkx signal handler receives the live GI widget instance as its last argument (here named `self`), so `self.active` is the checkbox's actual state *after* the toggle. Reading it back keeps the write idempotent: whatever GTK now shows is exactly what gets persisted, with no chance of the handler and the widget disagreeing. The handler forwards to `api.setDone(id, done)`, which sets `done` and stamps `completedAt`.

## The star and delete controls live in the suffix

The suffix takes more than one widget, so it is a fragment. GTK packs each child into the trailing end of the row via `add_suffix`, in order.

```tsx
suffix={
    <>
        <GtkToggleButton
            valign={Gtk.Align.CENTER}
            iconName={task.important ? "starred-symbolic" : "non-starred-symbolic"}
            active={task.important}
            accessibleLabel="Toggle important"
            cssClasses={["flat"]}
            onToggled={(self) => onToggleImportant(task.id, self.active)}
        />
        <GtkButton
            valign={Gtk.Align.CENTER}
            iconName="user-trash-symbolic"
            accessibleLabel="Delete task"
            cssClasses={["flat"]}
            onClicked={() => onDelete(task)}
        />
    </>
}
```

The star is a `GtkToggleButton` (a button that stays pressed), so like the checkbox it is controlled by `active={task.important}` and reads `self.active` back on toggle. Its icon swaps between the named system icons `starred-symbolic` and `non-starred-symbolic`. `cssClasses={["flat"]}` applies libadwaita's `flat` button style, which drops the button's background so it reads as an inline row control rather than a raised button.

Delete is a plain `GtkButton` whose `onClicked` hands the whole `task` object to `onDelete`, which in the app raises an undo toast rather than deleting immediately.

Because icon-only buttons have no visible text, each control gets an `accessibleLabel`. That sets the widget's accessible name so screen readers announce "Mark complete", "Toggle important", "Delete task" instead of an unlabeled button.

## Drag-to-reorder mounts two controllers

Reordering is a drag-and-drop gesture, and in GTK4 drag and drop is implemented by two event controllers: a `GtkDragSource` on the widget you can pick up, and a `GtkDropTarget` on the widget you can drop onto. Every row is both, so the whole boxed list is one uniform drag surface.

Controllers are not children of a widget; they attach to it through the universal `controllers` slot that every `GtkWidget` exposes. `TaskRow` renders that slot conditionally, so a row that is not currently reorderable gets no drag machinery at all:

```tsx
controllers={
    reorderable ? (
        <>
            <GtkDragSource
                actions={Gdk.DragAction.MOVE}
                onPrepare={() =>
                    Gdk.ContentProvider.newForValue(
                        GObject.buildValue(GObject.TYPE_STRING, (value) => value.setString(task.id)),
                    )
                }
            />
            <GtkDropTarget
                actions={Gdk.DragAction.MOVE}
                types={[GObject.TYPE_STRING]}
                onDrop={(value) => {
                    const draggedId = value.getString();
                    if (draggedId) onReorder(draggedId, task.id);
                    return true;
                }}
            />
        </>
    ) : undefined
}
```

`actions={Gdk.DragAction.MOVE}` on both sides declares this a move (not a copy or link), which is what drives the move-cursor and the drop feedback.

The payload is a GObject value, not a JavaScript object. GTK drag-and-drop transfers typed `GObject.Value` boxes so the same mechanism can carry data between processes and apps. `onPrepare` (the drag source's `prepare` signal) runs when the drag begins and must return a `Gdk.ContentProvider` describing what is being dragged:

- `GObject.buildValue(GObject.TYPE_STRING, (value) => value.setString(task.id))` boxes the task's id into a string-typed `GObject.Value`. The callback receives a fresh value already initialized to the given type; you fill it with the matching setter (`setString`).
- `Gdk.ContentProvider.newForValue(...)` wraps that value into a content provider the drag can carry.

On the receiving side, `GtkDropTarget.types` declares which `GObject.Type`s this target accepts (`[GObject.TYPE_STRING]`), which is what lets GTK light the row up as a valid drop only for matching drags. `onDrop` (the `drop` signal) receives the marshaled `GObject.Value`; `value.getString()` reads the dragged task's id back out, and the handler calls `onReorder(draggedId, task.id)`, moving the dragged task to this row's position. Returning `true` reports the drop as handled.

## Closing the loop stays in React state

`onReorder` does not touch any widget. It forwards to `reorder` in the `use-tasks` hook, which is pure array work:

```ts
const reorder = (draggedId: string, targetId: string): void =>
    mutate((tasks) => {
        const from = tasks.findIndex((task) => task.id === draggedId);
        const to = tasks.findIndex((task) => task.id === targetId);
        if (from === -1 || to === -1 || from === to) return tasks;
        const next = [...tasks];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return reindex(next);
    });
```

It finds both tasks, splices the dragged one out and back in at the target index, then `reindex` rewrites every task's `position` field to match its new array slot:

```ts
const reindex = (tasks: Task[]): Task[] => tasks.map((task, index) => ({ ...task, position: index }));
```

That single state update is all it takes, because the rows are keyed children of the same container. In `task-list.tsx` the rows render inside a `boxed-list` `GtkListBox`, each with `key={task.id}`:

```tsx
<GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
    {/* add-task entry row */}
    {tasks.map((task) => (
        <TaskRow key={task.id} task={task} reorderable={reorderable} {...row} />
    ))}
    {/* trailing "Add Task" row */}
</GtkListBox>
```

When `reorder` returns a new array with the same keys in a new order, React diffs by key and sees every row as the *same* existing element that merely changed position. The reconciler therefore issues a single in-place move within the parent container instead of unmounting and rebuilding rows. The real `GtkWidget` (and its focus, state, and any in-flight animation) survives the reorder untouched.

::: info Container move primitives
How the reconciler performs that move depends on the container. A `GtkBox` exposes a dedicated `reorderChildAfter(child, sibling)` for exactly this, so a box moves the widget with one call. The `boxed-list` here is a `GtkListBox`, which auto-wraps each child in a `GtkListBoxRow` and moves it via an indexed `insert`. Either way the widget is repositioned, never recreated.
:::

The full round trip: **drag the row -> `prepare` boxes the id -> `drop` reads it and calls `onReorder` -> `reorder` re-splices the array and re-derives `position` -> keyed reconcile moves the real widget in place.** State stays the single source of truth from end to end.

## Drag is enabled only when ordering is manual

The `reorderable` prop is not always on. Reordering by hand only makes sense when the list is in manual order and shows a stable set of rows, so `app.tsx` computes it from three conditions:

```tsx
const reorderable =
    sortOrder === "manual" && !searchQuery && !(selection.kind === "smart" && selection.view === "trash");
```

Dragging is off when a sort order is imposed (the array position would be meaningless), while a search filter hides rows (you would be reordering an incomplete view), and in Trash (deleted tasks have no order to keep). When `reorderable` is `false`, `TaskRow` renders `undefined` into the `controllers` slot, so the drag source and drop target are never mounted and the rows are inert to drag.

## Next

Continue to **The Task Editor**.
