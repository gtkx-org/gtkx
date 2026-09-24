---
title: "Components"
description: "GTK4 collection views, dropdowns, an Adwaita combo row, and toast helpers for GNOME apps."
---

# Components

GTKX applications establish their top-level structure with libadwaita, then use GTK4 widgets for lower-level controls such as model-backed collections. The components in `@gtkx/components` drop those collections' `model`, `factory`, and `headerFactory` props and take data plus renderers instead; the package also exposes an Adwaita `ComboRow` and toast helpers.

`@gtkx/components` is a separate install:

```bash
npm install @gtkx/components@beta
```

Full prop lists are in the [@gtkx/components reference](/v2/reference/@gtkx/components/), and the hooks that bridge GObject state into React ship with `@gtkx/react`, whose signatures are in the [@gtkx/react reference](/v2/reference/@gtkx/react/).

## List components

### ListView

`ListView<T, S>` wraps `Gtk.ListView`. Pass `items` as `{ id, value }` pairs plus a `renderItem`. Selection is controlled: nothing stays selected unless `selectedIds` is fed back from `onSelectionChanged`.

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

Nesting `ListItem.children` turns the same component into an acyclic tree, with `expandedIds` and `onExpandedChange` driving expansion. Keep item IDs stable and unique across the collection, including nested items. Section IDs must be unique among sections.

When every item is known to be a leaf, pass `isFlat` to `ListView` or `ColumnView`. This skips tree discovery when synchronizing large collections; do not use it when any item has children.

To group rows under headers, pass `sections` in place of `items`: each `ListSection` carries its own `data` array of items, and `renderHeader` draws the header above each group. `ColumnView` and `DropDown` accept the same pair.

### GridView

`GridView<T>` gives `Gtk.GridView`, the icon-grid counterpart, the same `items`, `renderItem`, controlled selection, and size estimates, and adds `minColumns`, `maxColumns`, `singleClickActivate`, and `onActivate`.

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

Nesting `ListItem.children` turns a `ColumnView` into a tree as well, driven by the same `expandedIds` and `onExpandedChange`. The first column draws the expander and the depth indentation, leaving the columns after it aligned at every depth; hiding it with `visible: false` hands the expander to the next column along.

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

`ComboRow<T, S>` from `@gtkx/components` takes the same collection props and renders an `Adw.ComboRow`, presenting the choice as a row inside a preferences group, as the tutorial's [preferences chapter](/v2/tutorial/preferences-and-theming) does.

### GtkListBox

Not every list wants a model. `Gtk.ListBox` takes its rows as children, so it needs no component wrapper: `<GtkListBox>` from `@gtkx/jsx/gtk` is a plain JSX element, and a sidebar or a settings list is data mapped to `<AdwActionRow>` children. What it does add is `selectedIndex`, which makes the box's own selection a controlled prop:

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

The tutorial's [sidebar](/v2/tutorial/lists-and-the-sidebar#keeping-gtk4-and-the-route-in-agreement) drives one from the current route.

## Next

Continue with [Modals and Portals](/v2/guide/modals-and-portals) for the mounting model behind these components: `createPortal`, the `rootElement` container, and extra windows. The worked dialog walkthrough lives in the tutorial's [Menus, Accelerators, and Shortcuts](/v2/tutorial/actions-menus-shortcuts#mounting-dialogs) chapter.
