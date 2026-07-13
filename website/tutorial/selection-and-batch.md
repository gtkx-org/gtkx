---
description: "Implement GNOME's selection mode pattern, with a transformed header bar, a bottom action bar, and batch actions driven by one boolean of React state."
---

# Selection Mode

Some actions only make sense in bulk: complete ten tasks at once, move a handful to another list, sweep several into the Trash. GNOME's Human Interface Guidelines have a dedicated pattern for this, and it is worth learning because it is not a React idiom. You enter a distinct *selection mode* from a "Select" control, the header bar transforms into a selection header (a Cancel button plus a heading that counts what you have picked), and the batch actions live in an action bar pinned to the bottom of the window. The HIG reserves this pattern for cases with at least three batch actions, which is why Tasks ships Complete, Move, and Delete rather than just Complete/Delete.

The elegant part is that nothing gets torn down and rebuilt. The `AdwToolbarView` that already frames the task list simply swaps its top bar and reveals a bottom bar, both driven by a single `selecting` boolean in React state. Let's follow that state from the action that flips it through to the recycled list it renders.

## Entering via the `win.select` action

Selection mode is toggled on by a `GSimpleAction`. In `app.tsx` the window's actions are declared in a small component, and each one is just a named action with an `onActivate` handler:

```tsx
const WindowActions = ({ onNew, onSelect, /* ... */ }: { /* ... */ }) => (
    <>
        <GSimpleAction name="new" onActivate={onNew} />
        <GSimpleAction name="select" onActivate={onSelect} />
        {/* ... */}
    </>
);
```

Because these are mounted in the `AdwApplicationWindow`'s `actions` slot, the action's fully qualified name is `win.select`. Activating it (from the main menu) runs whatever `onSelect` points at. Two pieces of state back the whole feature:

```tsx
const [selecting, setSelecting] = useState(false);
const [selectedIds, setSelectedIds] = useState<string[]>([]);
```

`onSelect` is wired to `enterSelection`, and there is a matching `cancelSelection`:

```tsx
const enterSelection = (): void => {
    setSelectedTaskId(null);
    setSelectedIds([]);
    setSelecting(true);
};
const cancelSelection = (): void => {
    setSelecting(false);
    setSelectedIds([]);
};
```

Entering clears any open task editor (`selectedTaskId`) so the content pane is free to show the selectable list, and starts from an empty selection. The Escape key also cancels: the app's global `GtkShortcutController` enables its `Escape` shortcut whenever `selectedTask !== null || selecting`, and its handler calls `cancelSelection()` when `selecting` is true.

## Swapping the header bar

The content pane picks its top bar from three candidates in priority order. A task editor wins if one is open; otherwise selection mode wins; otherwise the normal list header shows:

```tsx
const topBar = detailHeader ?? (selecting ? selectionHeader : listHeader);
```

The `selectionHeader` is a plain `AdwHeaderBar`, but configured to stop looking like the normal chrome:

```tsx
const selectionHeader = (
    <AdwHeaderBar
        showStartTitleButtons={false}
        showEndTitleButtons={false}
        titleWidget={<AdwWindowTitle title={`${selectedIds.length} selected`} />}
        start={<GtkButton label="Cancel" onClicked={cancelSelection} />}
        end={<GtkButton label="Select All" onClicked={() => setSelectedIds(visible.map((task) => task.id))} />}
    />
);
```

Three things to notice, all GTK/Adwaita specifics rather than React:

- `showStartTitleButtons={false}` and `showEndTitleButtons={false}` hide the window's own controls (close, minimize) so the header reads as a modal selection surface, not the normal titlebar. Cancel is the only way out.
- `titleWidget` takes a full widget instead of a plain string. An `AdwWindowTitle` renders the HIG-mandated count, `"3 selected"`, and re-renders automatically because `selectedIds.length` is React state.
- `Select All` writes every currently visible id into `selectedIds`. It uses `visible`, the same filtered/searched/sorted array the list is showing, so "select all" respects the active filter rather than grabbing every task in the store.

## The bottom action bar (`revealBottomBars`)

The batch actions live in a `GtkActionBar`. This is a GTK widget (there is no `AdwActionBar`) with `start` and `end` slots and a `revealed` prop that animates it in and out:

```tsx
const selectionActionBar = (
    <GtkActionBar
        revealed={selecting}
        start={
            <GtkButton
                label="Complete"
                cssClasses={["suggested-action"]}
                sensitive={selectedIds.length > 0}
                onClicked={completeSelected}
            />
        }
        end={
            <>
                <GtkMenuButton
                    label="Move"
                    sensitive={selectedIds.length > 0}
                    popover={
                        <GtkPopover>
                            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                                {lists.map((list) => (
                                    <GtkButton
                                        key={list.id}
                                        label={list.name}
                                        cssClasses={["flat"]}
                                        onClicked={() => moveSelected(list.id)}
                                    />
                                ))}
                            </GtkBox>
                        </GtkPopover>
                    }
                />
                <GtkButton
                    label="Delete"
                    cssClasses={["destructive-action"]}
                    sensitive={selectedIds.length > 0}
                    onClicked={deleteSelected}
                />
            </>
        }
    />
);
```

The two style classes are the standard GTK accent roles: `suggested-action` paints Complete in the accent color (the primary batch action), and `destructive-action` paints Delete red. Every button is gated with `sensitive={selectedIds.length > 0}`, so with nothing selected the bar is visible but inert. Move is a `GtkMenuButton`: its `popover` prop takes a `GtkPopover` whose body is a vertical `GtkBox` of one flat `GtkButton` per user list, each calling `moveSelected(list.id)`.

That bar is mounted into the toolbar view's `bottomBar` slot, and `revealBottomBars` drives the reveal animation:

```tsx
<AdwToolbarView
    topBar={topBar}
    bottomBar={selecting ? selectionActionBar : undefined}
    revealBottomBars={selecting}
>
    {contentBody}
</AdwToolbarView>
```

::: tip
The bar's own `revealed={selecting}` and the toolbar view's `revealBottomBars={selecting}` are both driven by the same flag. `revealBottomBars` is the toolbar view coordinating its bottom bars as a group; the `GtkActionBar`'s `revealed` is the widget's own slide transition. Setting both keeps the animation clean when the bar mounts and unmounts.
:::

## The selectable list: a recycled `ListView`

When `selecting` is true (and no task editor is open), the content body renders the `SelectionView`:

```tsx
const contentBody = selectedTask ? (
    <TaskDetail /* ... */ />
) : selecting ? (
    <SelectionView tasks={visible} selectedIds={selectedIds} onSelectionChanged={setSelectedIds} />
) : (
    <TaskList /* ... */ />
);
```

`SelectionView` (in `components/selection-view.tsx`) is where gtkx's high-level `ListView` from `@gtkx/components` earns its keep:

```tsx
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkImage, GtkLabel, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { formatDue } from "../format.js";
import type { Task } from "../types.js";

export const SelectionView = ({
    tasks,
    selectedIds,
    onSelectionChanged,
}: {
    tasks: Task[];
    selectedIds: string[];
    onSelectionChanged: (ids: string[]) => void;
}) => (
    <GtkScrolledWindow vexpand>
        <ListView<Task>
            items={tasks.map((task) => ({ id: task.id, value: task }))}
            selectionMode={Gtk.SelectionMode.MULTIPLE}
            selectedIds={selectedIds}
            onSelectionChanged={onSelectionChanged}
            estimatedItemHeight={56}
            renderItem={({ item }) => (
                <GtkBox
                    orientation={Gtk.Orientation.HORIZONTAL}
                    spacing={12}
                    marginTop={10}
                    marginBottom={10}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} hexpand halign={Gtk.Align.START}>
                        <GtkLabel label={item.title} halign={Gtk.Align.START} />
                        {item.due ? (
                            <GtkLabel
                                label={formatDue(item.due) ?? ""}
                                halign={Gtk.Align.START}
                                cssClasses={["dimmed", "caption"]}
                            />
                        ) : null}
                    </GtkBox>
                    {item.important ? <GtkImage iconName="starred-symbolic" valign={Gtk.Align.CENTER} /> : null}
                </GtkBox>
            )}
        />
    </GtkScrolledWindow>
);
```

How the pieces map:

- `items` is your data lifted into `{ id, value }` nodes. The `id` is the stable identity gtkx uses to track a row across updates and to key the selection; `value` is the `Task` object handed back to `renderItem` as `item`.
- `selectionMode={Gtk.SelectionMode.MULTIPLE}` tells gtkx to back the list with a `Gtk.MultiSelection` model (the default is `SINGLE`, a `Gtk.SingleSelection`). This is what lets the user tick more than one row.
- Selection is **controlled**, exactly like a controlled input in React. `selectedIds` is the source of truth passed down, and `onSelectionChanged` reports the new array back up. Tasks routes `onSelectionChanged` straight into `setSelectedIds`, so a click on a row and a click on "Select All" both flow into the same state, which then drives the header count, the action bar's `sensitive` gating, and the batch handlers.
- `renderItem` is a normal React render function returning gtkx JSX. Here it builds a horizontal box: title stacked over a dimmed due-date caption, with a star icon on the trailing edge for important tasks.
- `estimatedItemHeight={56}` is a hint gtkx uses to size the virtualized viewport before rows are measured.

## Recycled versus boxed: why a second kind of list

Tasks deliberately renders its tasks two different ways, and selection mode is the reason to see them side by side. The normal `TaskList` view uses a `GtkListBox` styled as a boxed list, where every task is a fully realized `AdwActionRow`:

```tsx
// components/task-list.tsx
<GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
    <AdwEntryRow /* the inline "Add a task…" row */ />
    {tasks.map((task) => (
        <TaskRow key={task.id} task={task} reorderable={reorderable} {...row} />
    ))}
    {/* ... */}
</GtkListBox>
```

A boxed list materializes one widget per item. That is perfect for a small, static, richly-styled list (checkboxes, star toggles, delete buttons, drag-to-reorder, the inline add row), and it is the idiomatic GNOME default for exactly that case. But it does not scale: a thousand tasks means a thousand live rows.

`SelectionView` swaps in `ListView`, which recycles a small pool of row widgets and reuses them as you scroll, so the widget count stays roughly constant no matter how many tasks exist. That is the trade the two lists make concrete: the boxed `GtkListBox` for the everyday small list, the recycled `ListView` for the potentially large batch-selection list. It also happens to be where multi-selection lives naturally, since `ListView` exposes `selectionMode`/`selectedIds` as first-class props while a boxed list is `Gtk.SelectionMode.NONE`.

Both are fed the identical `visible` array, so switching into selection mode shows the same tasks, just rendered through a scalable model-view stack.

## Batch actions and the shared undo flow

Each action bar button maps to one handler. Complete and Move are direct calls into the tasks API followed by exiting selection mode:

```tsx
const completeSelected = (): void => {
    api.completeMany(selectedIds);
    cancelSelection();
};
const moveSelected = (listId: string): void => {
    api.moveToList(selectedIds, listId);
    cancelSelection();
};
```

Delete is the interesting one, because it reuses the exact undo-toast flow that single-task deletion uses. Rather than confirm an irreversible action, it soft-deletes and offers Undo:

```tsx
const deleteSelected = (): void => {
    const ids = [...selectedIds];
    api.trashMany(ids);
    const toast = Adw.Toast.new(`${ids.length} task${ids.length === 1 ? "" : "s"} moved to Trash`);
    toast.buttonLabel = "Undo";
    toast.once("button-clicked", () => {
        for (const id of ids) api.restore(id);
    });
    toastOverlayRef.current?.addToast(toast);
    cancelSelection();
};
```

It snapshots the ids into a local `const ids = [...selectedIds]` first, because `cancelSelection()` clears `selectedIds` moments later and the toast's Undo callback fires long after that. The toast message pluralizes inline (`task` vs `tasks`), the `button-clicked` handler restores each id, and the toast is pushed onto the same `AdwToastOverlay` (`toastOverlayRef`) that the single-item delete uses. Batch delete and swipe-to-delete therefore share one recovery path.

::: info
`api.completeMany`, `api.moveToList`, and `api.trashMany` are thin array operations in `hooks/use-tasks.ts`: each maps over the task list and updates only the tasks whose id is in the passed array. `restore` simply flips a task's `deleted` flag back to `false`. Nothing about batching touches a widget imperatively; it is all state in, re-render out.
:::

## Next

Continue to **Preferences and Theming** to see how `useSetting` binds the app's GSettings schema to two-way-bound rows.
