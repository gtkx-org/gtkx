---
sidebar_position: 3
sidebar_label: Grid Layout
---

# Grid Layout

The `Grid` component provides a two-dimensional layout system where you can position children at specific rows and columns with optional spanning.

## Basic Usage

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGrid, GtkLabel, GtkEntry, GtkButton } from "@gtkx/react";

const LoginForm = () => (
  <GtkGrid.Root columnSpacing={12} rowSpacing={8}>
    <GtkGrid.Child row={0} column={0}>
      <GtkLabel label="Username:" halign={Gtk.Align.END} />
    </GtkGrid.Child>
    <GtkGrid.Child row={0} column={1}>
      <GtkEntry hexpand />
    </GtkGrid.Child>

    <GtkGrid.Child row={1} column={0}>
      <GtkLabel label="Password:" halign={Gtk.Align.END} />
    </GtkGrid.Child>
    <GtkGrid.Child row={1} column={1}>
      <GtkEntry visibility={false} hexpand />
    </GtkGrid.Child>

    <GtkGrid.Child row={2} column={0} columnSpan={2}>
      <GtkButton label="Login" cssClasses={["suggested-action"]} />
    </GtkGrid.Child>
  </GtkGrid.Root>
);
```

## GtkGrid.Root Props

| Prop                | Type      | Description                           |
| ------------------- | --------- | ------------------------------------- |
| `columnSpacing`     | `number`  | Gap between columns in pixels         |
| `rowSpacing`        | `number`  | Gap between rows in pixels            |
| `columnHomogeneous` | `boolean` | If true, all columns have equal width |
| `rowHomogeneous`    | `boolean` | If true, all rows have equal height   |

## GtkGrid.Child Props

| Prop         | Type     | Default | Description                 |
| ------------ | -------- | ------- | --------------------------- |
| `row`        | `number` | `0`     | Row position (0-indexed)    |
| `column`     | `number` | `0`     | Column position (0-indexed) |
| `rowSpan`    | `number` | `1`     | Number of rows to span      |
| `columnSpan` | `number` | `1`     | Number of columns to span   |

## How It Works

`GtkGrid.Child` is a virtual node that:

1. Stores the row, column, and span metadata
2. Calls `grid.attach(widget, column, row, columnSpan, rowSpan)` when mounted
3. Calls `grid.remove(widget)` when unmounted
4. Re-attaches with new position if props change

## Spanning Cells

Use `rowSpan` and `columnSpan` to create cells that span multiple rows or columns:

```tsx
<GtkGrid.Root columnSpacing={8} rowSpacing={8}>
  {/* Header spanning all 3 columns */}
  <GtkGrid.Child row={0} column={0} columnSpan={3}>
    <GtkLabel label="Settings" cssClasses={["title-2"]} />
  </GtkGrid.Child>

  {/* Sidebar spanning 2 rows */}
  <GtkGrid.Child row={1} column={0} rowSpan={2}>
    <GtkBox
      orientation={Orientation.VERTICAL}
      spacing={8}
      cssClasses={["card"]}
      vexpand
    >
      Navigation
    </GtkBox>
  </GtkGrid.Child>

  {/* Content areas */}
  <GtkGrid.Child row={1} column={1} columnSpan={2}>
    Main content
  </GtkGrid.Child>
  <GtkGrid.Child row={2} column={1} columnSpan={2}>
    Secondary content
  </GtkGrid.Child>
</GtkGrid.Root>
```

## Dynamic Grid Content

Grid children can be rendered conditionally or from arrays:

```tsx
import { GtkGrid, GtkLabel } from "@gtkx/react";

interface Cell {
  id: string;
  row: number;
  column: number;
  content: string;
}

const DynamicGrid = ({ cells }: { cells: Cell[] }) => (
  <GtkGrid.Root columnSpacing={8} rowSpacing={8}>
    {cells.map((cell) => (
      <GtkGrid.Child key={cell.id} row={cell.row} column={cell.column}>
        <GtkLabel label={cell.content} />
      </GtkGrid.Child>
    ))}
  </GtkGrid.Root>
);
```

## Form Layouts

Grids are ideal for form layouts with aligned labels and inputs:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkGrid, GtkLabel, GtkEntry, GtkSwitch, GtkButton, GtkBox } from "@gtkx/react";

const SettingsForm = () => (
  <GtkGrid.Root columnSpacing={16} rowSpacing={12}>
    <GtkGrid.Child row={0} column={0}>
      <GtkLabel label="Display Name" halign={Gtk.Align.END} />
    </GtkGrid.Child>
    <GtkGrid.Child row={0} column={1}>
      <GtkEntry hexpand placeholderText="Enter your name" />
    </GtkGrid.Child>

    <GtkGrid.Child row={1} column={0}>
      <GtkLabel label="Email" halign={Gtk.Align.END} />
    </GtkGrid.Child>
    <GtkGrid.Child row={1} column={1}>
      <GtkEntry hexpand placeholderText="you@example.com" />
    </GtkGrid.Child>

    <GtkGrid.Child row={2} column={0}>
      <GtkLabel label="Notifications" halign={Gtk.Align.END} />
    </GtkGrid.Child>
    <GtkGrid.Child row={2} column={1}>
      <GtkSwitch halign={Gtk.Align.START} />
    </GtkGrid.Child>

    <GtkGrid.Child row={3} column={1}>
      <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8} halign={Gtk.Align.END}>
        <GtkButton label="Cancel" />
        <GtkButton label="Save" cssClasses={["suggested-action"]} />
      </GtkBox>
    </GtkGrid.Child>
  </GtkGrid.Root>
);
```

## GtkGrid vs GtkBox

| Feature     | GtkGrid                     | GtkBox                      |
| ----------- | --------------------------- | --------------------------- |
| Dimensions  | 2D (rows and columns)       | 1D (horizontal or vertical) |
| Positioning | Explicit row/column         | Sequential order            |
| Spanning    | Supports rowSpan/columnSpan | Not applicable              |
| Use case    | Forms, complex layouts      | Simple lists, toolbars      |

Use `GtkBox` for simple sequential layouts and `GtkGrid` when you need precise 2D positioning.
