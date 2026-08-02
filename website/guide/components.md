---
title: "Components"
description: "A map of the high-level components in @gtkx/components."
---

# Components

Most of what GTKX offers reaches you through the intrinsic elements codegen generates. Some widgets carry an imperative API that does not map onto props alone: a model plus factories, an attach call with coordinates, a size group you join from elsewhere in the tree. `@gtkx/components` is a hand-written layer that gives those a declarative shape, and `@gtkx/react` ships the hooks that bridge GObject state into React.

`@gtkx/components` is a separate install:

```bash
npm install @gtkx/components@rc
```

Those hooks come from `@gtkx/react`, which every GTKX project already has, and their signatures are in the [@gtkx/react reference](/reference/@gtkx/react/).

## List components

### ListView

`ListView<T, S>` wraps `Gtk.ListView` and removes its `model`, `factory`, and `headerFactory` props: you pass data and a renderer instead. Selection is controlled, so `selectedIds` and `onSelectionChanged` keep it in React state:

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

Give your `ListItem`s `children` and the same component renders a tree with expander arrows. Add `expandedIds`/`onExpandedChange` on top of that to drive expansion from React state. Cell recycling still happens natively; your `renderItem` output is rendered into the factory-created containers through portals, so React state inside a cell behaves normally.

To group rows under headers, pass `sections` in place of `items`. Each `ListSection` holds its own `data` array of `ListItem`s, and `renderHeader` draws the header shown above each group. `ColumnView` and `DropDown` accept the same pair.

### GridView

`GridView<T>` applies the same treatment to `Gtk.GridView`, the icon-grid counterpart: `items`, `renderItem`, controlled selection, and size estimates, with intrinsic props like `minColumns`, `maxColumns`, and `singleClickActivate` passing straight through. The minesweeper demo in `examples/gtk-demo` renders its board this way:

```tsx
import { GridView } from "@gtkx/components";
import { GtkLabel } from "@gtkx/jsx/gtk";

<GridView
    estimatedItemHeight={32}
    minColumns={GRID_SIZE}
    maxColumns={GRID_SIZE}
    singleClickActivate
    onActivate={(position) => handleCellClick(position)}
    items={board.map((cell) => ({ id: cell.id, value: cell }))}
    renderItem={({ item }) => <GtkLabel>{getCellDisplay(item)}</GtkLabel>}
/>
```

### ColumnView

`ColumnView<T, S>` wraps `Gtk.ColumnView`, the multi-column table. Columns are declared through the `columns` prop, an array of `ColumnViewColumn` objects, each with a required `id` and `title`, its own `renderCell`, and optional presentation props like `isSortable` and `expand`. Sorting is controlled: clicking a sortable header calls `onSortChanged(column, order)`, and you sort `items` yourself before passing them in, so the view always matches your data:

```tsx
import { ColumnView, type ColumnViewColumn } from "@gtkx/components";
import { GtkLabel } from "@gtkx/jsx/gtk";

const columns: ColumnViewColumn<Employee>[] = [
    {
        id: "name",
        title: "Name",
        expand: true,
        isSortable: true,
        renderCell: ({ item }) => <GtkLabel>{item.name}</GtkLabel>,
    },
];

<ColumnView
    sortColumn={sortColumn}
    sortOrder={sortOrder}
    onSortChanged={handleSortChange}
    items={sortedEmployees.map((emp) => ({ id: emp.id, value: emp }))}
    columns={columns}
/>
```

Typing the array as `ColumnViewColumn<Employee>[]` binds every `renderCell` callback to the view's item type, so the `item` argument is inferred as `Employee` without annotating each callback.

### DropDown

`DropDown<T, S>` wraps `Gtk.DropDown`, which in raw GTK4 requires a model plus separate factories (the button face, the popup rows, and popup section headers). Here it is `items` plus controlled single selection, or `sections` plus `renderHeader` when the popup rows should be grouped. `renderItem` draws both the button and the popup rows, `renderListItem` overrides the popup rows separately, and with no renderer at all each value is shown as a label, verbatim when it is a string and as JSON otherwise:

```tsx
import { DropDown } from "@gtkx/components";

<DropDown
    items={SOURCE_TYPES.map((type) => ({ id: type, value: type }))}
    selectedId={sourceType}
    onSelectionChanged={(id) => setSourceType(id)}
/>
```

`ComboRow<T, S>` from `@gtkx/components/adw` takes the same collection props and renders an `Adw.ComboRow`, presenting the choice as a row inside a preferences group, as the tutorial's [preferences chapter](/tutorial/preferences-and-theming) does:

```tsx
import { ComboRow } from "@gtkx/components/adw";

<ComboRow
    title="Theme"
    items={THEMES.map((theme) => ({ id: theme, value: theme }))}
    selectedId={theme}
    onSelectionChanged={(id) => setTheme(id)}
/>
```

## Next

Continue with [Modals and Portals](/guide/modals-and-portals) for the mounting model behind these components: `createPortal`, the `rootElement` container, and extra windows. The worked dialog walkthrough lives in the tutorial's [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts#mounting-dialogs) chapter.
