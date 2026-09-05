---
title: "Components"
description: "GTK4 collection views, dropdowns, an Adwaita combo row, and toast helpers for GNOME apps."
---

# Components

GTKX applications establish their top-level structure with libadwaita, then use GTK4 widgets for lower-level controls such as model-backed collections. The components in `@gtkx/components` drop those collections' `model`, `factory`, and `headerFactory` props and take data plus renderers instead; the package also exposes an Adwaita `ComboRow` and toast helpers.

`@gtkx/components` is a separate install:

```bash
npm install @gtkx/components
```

Full prop lists are in the [@gtkx/components reference](/reference/@gtkx/components/), and the hooks that bridge GObject state into React ship with `@gtkx/react`, whose signatures are in the [@gtkx/react reference](/reference/@gtkx/react/).

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

Nesting `ListItem.children` turns the same component into a tree, with `expandedIds` and `onExpandedChange` driving expansion.

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

`DropDown<T, S>` takes `items`, or `sections` plus `renderHeader`, with single controlled selection through `selectedId` and `onSelectionChanged`. `renderItem` is optional and draws both the button face and the popup rows, `renderListItem` overrides the popup rows on their own, and with neither given each value is shown as a label.

```tsx
import { DropDown } from "@gtkx/components";

<DropDown
    items={SOURCE_TYPES.map((type) => ({ id: type, value: type }))}
    selectedId={sourceType}
    onSelectionChanged={(id) => setSourceType(id)}
/>
```

`ComboRow<T, S>` from `@gtkx/components/adw` takes the same collection props and renders an `Adw.ComboRow`, presenting the choice as a row inside a preferences group, as the tutorial's [preferences chapter](/tutorial/preferences-and-theming) does.

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

The prop is optional: leave it off and the box keeps whatever the user selects, untouched. Pass it and it holds these guarantees.

- The row at that index is selected. `-1`, which is what `findIndex` answers for a value that is not in the list, and `null` both mean no row.
- An index whose row is not mounted yet is remembered rather than dropped: the box holds the selection it has, and the write lands as soon as that row is added.
- gtkx performs the write itself and suppresses the `row-selected` its own write causes, so `onRowSelected` reports a selection the user made and nothing else. Handlers need no guard against their own echo.
- The prop is drift-correcting, not a one-shot write per render. If the box's selection moves away from the index you passed, which is what happens when the user clicks a row and your handler declines to act on it, gtkx puts it back on the next microtask, without waiting for a re-render.
- An index that is not a whole number throws.

The tutorial's [sidebar](/tutorial/lists-and-the-sidebar#keeping-gtk4-and-the-route-in-agreement) drives one from the current route.

## Next

Continue with [Modals and Portals](/guide/modals-and-portals) for the mounting model behind these components: `createPortal`, the `rootElement` container, and extra windows. The worked dialog walkthrough lives in the tutorial's [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts#mounting-dialogs) chapter.
