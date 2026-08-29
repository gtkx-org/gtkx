---
title: "Components"
description: "Choose and use GTKX collection components without building GTK factories by hand."
---

# Components

`@gtkx/components` turns arrays into GTK4 collection widgets. It owns the model and factories; your component supplies stable IDs, values, and React renderers.

```bash
npm install @gtkx/components
```

## Choose the collection

| Component | Use it for |
| --- | --- |
| `ListView` | Rows, optional sections, and trees |
| `GridView` | Tile or icon collections |
| `ColumnView` | Multi-column data and controlled sorting |
| `DropDown` | A compact single choice |
| `ComboRow` | The same choice inside an Adwaita preferences group |

Use a plain `<GtkListBox>` when the rows are already JSX children and the collection does not need a model. Complete component props and renderer types live in the [API reference](/reference/@gtkx/components/).

## Build a controlled list

Map domain objects to `{ id, value }` entries. IDs preserve selection and expansion when values are replaced or reordered:

```tsx
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";

const TaskList = ({ tasks, selectedIds, onSelectionChanged }: TaskListProps) => (
    <ListView<Task>
        items={tasks.map((task) => ({ id: task.id, value: task }))}
        selectionMode={Gtk.SelectionMode.MULTIPLE}
        selectedIds={selectedIds}
        onSelectionChanged={onSelectionChanged}
        estimatedItemHeight={56}
        renderItem={({ item }) => <GtkLabel halign={Gtk.Align.START}>{item.title}</GtkLabel>}
    />
);
```

Selection is controlled: feed the IDs reported by `onSelectionChanged` back through `selectedIds`. The same model applies to grids and columns.

Use `sections` with `renderHeader` for grouped data. Give a `ListView` or `ColumnView` nested `children` entries for a tree, then control it through `expandedIds` and `onExpandedChange`. For a table, define `columns` and sort the source array when `onSortChanged` fires.

## Choose between DropDown and ComboRow

Both store the selected item ID rather than its position, so reordering or relabeling choices does not change the saved value. `DropDown` works in ordinary layouts; import `ComboRow` from `@gtkx/components/adw` for a preferences page. Add `renderItem` only when the default text rendering is insufficient.

## Next

[Forms](/guide/forms) connects `ComboRow` and native Adwaita rows to React Hook Form. The [collection tutorial](/tutorial/a-list-of-tasks) builds a list from application state.
