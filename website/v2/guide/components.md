---
title: "Components"
description: "Render lists, tables, dropdowns, tabs, menu widgets, and toast notifications from React state."
---

# Components

`@gtkx/components` renders native collections from data and render functions, managing their GTK models and factories. It also provides managed tabs and toast helpers.

`@gtkx/components` is a separate install:

```bash
npm install @gtkx/components@beta
```

See the [component reference](/v2/reference/@gtkx/components/) for props. Hooks that connect GObject state to React come from [`@gtkx/react`](/v2/reference/@gtkx/react/).

## List components

### ListView

`ListView<T, S>` wraps `Gtk.ListView`. Pass `items` as `{ id, value }` pairs plus a `renderItem`. Selection is controlled: update `selectedIds` from `onSelectionChanged` to retain the selection. Like a React input's `onChange`, `onSelectionChanged` reports what the user or the widget changes, not the `selectedIds` you pass in. It also reports the remaining selection when an item named by `selectedIds` is not in the list.

```tsx
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";

<ListView<Task>
    items={tasks.map((task) => ({ id: task.id, value: task }))}
    selectionMode={Gtk.SelectionMode.MULTIPLE}
    selectedIds={selectedIds}
    onSelectionChanged={setSelectedIds}
    estimatedItemHeight={56}
    renderItem={({ item }) => <GtkLabel halign={Gtk.Align.START}>{item.title}</GtkLabel>}
/>
```

Nesting `ListItem.children` turns the same component into an acyclic tree, with `expandedIds` and `onExpandedChange` driving expansion the same way. Keep item IDs stable and unique across the collection, including nested items, since selection and expansion name rows by ID. Section IDs must be unique among sections.

IDs also give rows their identity. When items are inserted, removed or reordered, GTK keeps every row whose ID stays among the same siblings bound, so its component state survives, and only new rows mount. A row that moves keeps its state in a flat list, grid, table or section; a tree row that moves among its siblings remounts, because GTK rebuilds its tree node. A reorder that moves more than about a thousand rows at once updates rows in place instead, and the rows that move there remount. An ID repeated among siblings pairs rows by their order.

When every item is known to be a leaf, pass `isFlat` to `ListView` or `ColumnView`. This skips tree discovery when synchronizing large collections; do not use it when any item has children.

To group rows under headers, pass `sections` in place of `items`: each `ListSection` carries its own `data` array of items, and `renderHeader` draws the header above each group. `ColumnView` and `DropDown` accept the same pair.

### GridView

`GridView<T>` renders a grid with the same `items`, `renderItem`, controlled selection, and size estimates as `ListView`. Use `minColumns` and `maxColumns` to size the grid, and `singleClickActivate` and `onActivate` for activation.

### ColumnView

`ColumnView<T, S>` renders a multi-column table. Columns come from the `columns` prop, each one requiring `id`, `title`, and `renderCell`. Sorting is controlled: `onSortChanged` reports the header click, and the caller sorts `items` before passing them in.

```tsx
import { ColumnView, type ColumnViewColumn } from "@gtkx/components";
import { GtkLabel } from "@gtkx/jsx/gtk";

const columns: ColumnViewColumn<Employee>[] = [
    { id: "name", title: "Name", isSortable: true, renderCell: ({ item }) => <GtkLabel>{item.name}</GtkLabel> },
];

<ColumnView
    sortColumn={sortColumn}
    sortOrder={sortOrder}
    onSortChanged={handleSortChange}
    items={sortedEmployees.map((emp) => ({ id: emp.id, value: emp }))}
    columns={columns}
/>
```

`ColumnView` also supports trees through `ListItem.children`, `expandedIds`, and `onExpandedChange`. The first visible column draws the expander and indentation; the other columns stay aligned at each depth. Hiding that column with `visible: false` moves the expander to the next visible column.

### DropDown

`DropDown<T, S>` takes `items`, or `sections` plus `renderHeader`, with single controlled selection through `selectedId` and `onSelectionChanged`. Primitive values display as labels by default; `null` and `undefined` leave the display empty. Objects and other structured values require `renderItem`, which draws both the selected value and the popup rows. Use `renderListItem` to override only the popup rows.

```tsx
import { DropDown } from "@gtkx/components";

<DropDown
    items={SOURCE_TYPES.map((type) => ({ id: type, value: type }))}
    selectedId={sourceType}
    onSelectionChanged={(id) => {
        if (id !== null) setSourceType(id);
    }}
/>
```

The callback receives `null` when the model becomes empty.

`ComboRow<T, S>` from `@gtkx/components` takes the same collection props and renders an `Adw.ComboRow` inside a preferences group. See the tutorial's [preferences chapter](/v2/tutorial/preferences-and-theming) for an example.

### GtkListBox

`GtkListBox` takes JSX rows directly, making it suitable for short lists such as a sidebar or settings group. Its `selectedIndex` prop controls the selected row:

```tsx
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GtkListBox } from "@gtkx/jsx/gtk";

<GtkListBox
    cssClasses={["navigation-sidebar"]}
    selectedIndex={views.findIndex((view) => view.id === activeId)}
    onRowSelected={(row) => {
        if (!row) return;
        const view = views[row.getIndex()];
        if (view) setActiveId(view.id);
    }}
>
    {views.map((view) => (
        <AdwActionRow key={view.id} title={view.title} />
    ))}
</GtkListBox>
```

Leave `selectedIndex` out for native selection, or set it to keep selection under application control. Use `-1` or `null` to clear it. If the desired row has not mounted yet, GTKX keeps the current selection and applies the index once that row exists.

GTKX suppresses `onRowSelected` while applying its own selection updates. Other native selection changes still reach the handler, including changes made through native methods. Update the controlled value in that handler to keep the new selection; otherwise GTKX restores the requested row.

The tutorial's [sidebar](/v2/tutorial/lists-and-the-sidebar#keeping-gtk4-and-the-route-in-agreement) controls selection from the current route.

## Tabs across windows

Ordinary `AdwTabView` children work for tabs that share their parent's React lifetime. For tabs the user opens, closes, reorders and drags between windows, use the [tab view navigator](/v2/guide/navigation#tab-view-navigator) from `@gtkx/navigation`, which keeps the open tabs in navigation state and follows native transfers.

### Native tab configuration

`AdwTabPage` accepts `pinned` in ordinary JSX. Updating it pins or unpins the page through its current native view. Reordering keyed JSX pages preserves the requested relative order within each pin group. Pinning a page follows libadwaita’s insertion order.

Both `AdwTabBar` and `AdwTabOverview` accept `extraDropTarget`, so supported drag actions and data types can follow React state:

```tsx
import * as Gdk from "@gtkx/gi/gdk";
import * as GObject from "@gtkx/gi/gobject";
import { AdwTabBar } from "@gtkx/jsx/adw";

<AdwTabBar
    view={view}
    extraDropTarget={{ actions: Gdk.DragAction.COPY, types: [GObject.typeFromName("gchararray")] }}
    onExtraDragDrop={(page, value) => {
        const title = value.getString();
        if (title === null) return false;
        renameTab(page, title);
        return true;
    }}
/>
```

Here `renameTab` updates the state the page's `title` prop comes from. Removing `extraDropTarget` disables the additional drop target. Types can be GType values or generated classes. Use explicit `null` when clearing nullable object props such as a tab's `icon`.

## Widgets in menus

A popover menu can show a widget in place of a menu item, as GNOME Text Editor does with its style selector. Give the item a `custom` ID and pass the widget under that ID in `customChildren` on the `GtkMenuButton`, `GtkPopoverMenu` or `GtkPopoverMenuBar` showing the menu, as GtkBuilder's `<child type="ID">` does:

```tsx
import { GMenu } from "@gtkx/jsx/gio";
import { GtkMenuButton } from "@gtkx/jsx/gtk";

<GtkMenuButton
    iconName="open-menu-symbolic"
    menuModel={
        <GMenu
            items={[
                { section: [{ custom: "theme" }] },
                { section: [{ label: "Preferences", action: "win.preferences", accel: "<Control>comma" }] },
            ]}
        />
    }
    customChildren={{ theme: <ThemeSelector /> }}
/>
```

The widget stays in its item when the model or its items change. An ID with no matching item leaves its widget out of the menu. Menu items also take GTK's other [menu attributes](https://docs.gtk.org/gtk4/class.PopoverMenu.html#menu-models) in camelCase, such as `hiddenWhen` and `accel`.

## Toasts

Wrap the window's content in `AdwToastOverlay`, then share its ref through `ToastProvider`. Descendants can call `useToast()` to show a notification:

```tsx
import { ToastProvider, useToast } from "@gtkx/components";
import type * as Adw from "@gtkx/gi/adw";
import { AdwToastOverlay } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useRef } from "react";

const NotifyButton = () => {
    const toast = useToast();

    return (
        <GtkButton
            label="Show notification"
            onClicked={() => toast.show({ title: "Task saved", useMarkup: false })}
        />
    );
};

export const Notifications = () => {
    const overlayRef = useRef<Adw.ToastOverlay | null>(null);

    return (
        <ToastProvider overlayRef={overlayRef}>
            <AdwToastOverlay ref={overlayRef}>
                <NotifyButton />
            </AdwToastOverlay>
        </ToastProvider>
    );
};
```

Render `Notifications` inside an application window. Clicking the button shows a toast over the content. Use `useMarkup: false` for titles that should display literally, including user text.

`show()` returns the native toast. Pass `buttonLabel` and `onButtonClicked` to add an action, and `onDismissed` when cleanup depends on its dismissal. Call `toast.dismiss()` on the returned toast to close it, or `useToast().dismissAll()` to clear the overlay.

`useToast()` requires a provider. Show toasts from events or effects after the overlay mounts; calling `show()` while its ref is empty creates a toast without displaying it. The [Trash and Toasts tutorial](/v2/tutorial/trash-and-toasts) adds an Undo action to a delete operation.

## Next

Continue with [Modals and Portals](/v2/guide/modals-and-portals) for the mounting model behind these components: `createPortal`, the `rootElement` container, and extra windows. The tutorial demonstrates dialogs in its [Menus, Accelerators, and Shortcuts](/v2/tutorial/actions-menus-shortcuts#mounting-dialogs) chapter.
