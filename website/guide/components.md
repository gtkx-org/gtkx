---
title: "Components"
description: "Render native GTK collections from application data."
---

# Components

`@gtkx/components` owns GTK models and factories while your component supplies stable IDs and React renderers.

```bash
npm install @gtkx/components
```

Use `ListView` for rows and trees, `GridView` for tiles, `ColumnView` for tables, `DropDown` for a compact choice, and `ComboRow` for an Adwaita preferences group. A plain `<GtkListBox>` is simpler when a small, static collection is already expressed as JSX children.

## Render a controlled list

```tsx
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";

const Tasks = ({ tasks, selectedIds, onSelectionChanged }: TaskListProps) => (
    <ListView<Task>
        items={tasks.map((task) => ({ id: task.id, value: task }))}
        selectionMode={Gtk.SelectionMode.MULTIPLE}
        selectedIds={selectedIds}
        onSelectionChanged={onSelectionChanged}
        renderItem={({ item }) => <GtkLabel label={item.title} />}
    />
);
```

Feed IDs from `onSelectionChanged` back into `selectedIds`. Stable IDs preserve selection and expansion across replacement and reordering. The same model applies to grids, columns, and choices.

The [components reference](/reference/@gtkx/components/) covers sections, trees, columns, sorting, and custom renderers. Continue with [Forms](/guide/forms) or the [state tutorial](/tutorial/the-task-store).
