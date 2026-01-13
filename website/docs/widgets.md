# Declarative Widgets

GTKX provides declarative child components for various GTK widgets, allowing you to configure widget internals using JSX instead of imperative APIs.

## Scale with Marks

Add marks to a `GtkScale` slider using `x.ScaleMark`:

```tsx
import { x, GtkScale } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const VolumeSlider = () => {
 const [volume, setVolume] = useState(50);

 return (
 <GtkScale
 hexpand
 adjustment={new Gtk.Adjustment(volume, 0, 100, 1, 10, 0)}
 onValueChanged={(scale) => setVolume(Math.round(scale.getValue()))}
>
 <x.ScaleMark value={0} label="0" position={Gtk.PositionType.BOTTOM} />
 <x.ScaleMark value={25} position={Gtk.PositionType.BOTTOM} />
 <x.ScaleMark value={50} label="50" position={Gtk.PositionType.BOTTOM} />
 <x.ScaleMark value={75} position={Gtk.PositionType.BOTTOM} />
 <x.ScaleMark value={100} label="100" position={Gtk.PositionType.BOTTOM} />
 </GtkScale>
 );
};
```

### x.ScaleMark Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | number | Position on the scale |
| `label` | string | Optional text label |
| `position` | `Gtk.PositionType` | Label position (TOP, BOTTOM, LEFT, RIGHT) |

## Calendar with Marks

Mark specific days on a `GtkCalendar` using `x.CalendarMark`:

```tsx
import { x, GtkCalendar } from "@gtkx/react";

const EventCalendar = () => {
 const today = new Date();
 const eventDays = [5, 10, 15, 20, 25];

 return (
 <GtkCalendar
 year={today.getFullYear()}
 month={today.getMonth()}
 day={today.getDate()}
>
 {eventDays.map((day) => (
 <x.CalendarMark key={day} day={day} />
 ))}
 </GtkCalendar>
 );
};
```

### x.CalendarMark Props

| Prop | Type | Description |
|------|------|-------------|
| `day` | number | Day of the month to mark (1-31) |

## LevelBar with Offsets

Define color thresholds on a `GtkLevelBar` using `x.LevelBarOffset`:

```tsx
import { x, GtkLevelBar } from "@gtkx/react";
import { useState } from "react";

const BatteryIndicator = () => {
 const [level, setLevel] = useState(0.6);

 return (
 <GtkLevelBar value={level} minValue={0} maxValue={1}>
 <x.LevelBarOffset id="low" value={0.25} />
 <x.LevelBarOffset id="high" value={0.75} />
 <x.LevelBarOffset id="full" value={1.0} />
 </GtkLevelBar>
 );
};
```

The level bar changes color at each offset threshold:
- Below 25%: Critical (red)
- 25-75%: Normal
- Above 75%: High (green)

### x.LevelBarOffset Props

| Prop | Type | Description |
|------|------|-------------|
| `id` | string | Unique identifier for the offset |
| `value` | number | Threshold value |

## ToggleGroup with Toggles

Create toggle button groups using `AdwToggleGroup` with `x.Toggle` children:

```tsx
import { x, AdwToggleGroup } from "@gtkx/react";
import { useState } from "react";

const ViewModeSelector = () => {
 const [viewMode, setViewMode] = useState("list");

 return (
 <AdwToggleGroup
 active={viewMode === "list" ? 0 : viewMode === "grid" ? 1 : 2}
 onNotify={(group, prop) => {
 if (prop === "active") {
 const toggle = group.getToggle(group.getActive());
 if (toggle) setViewMode(toggle.getName() ?? "list");
 }
 }}
>
 <x.Toggle id="list" iconName="view-list-symbolic" tooltip="List View" />
 <x.Toggle id="grid" iconName="view-grid-symbolic" tooltip="Grid View" />
 <x.Toggle id="flow" iconName="view-continuous-symbolic" tooltip="Flow View" />
 </AdwToggleGroup>
 );
};
```

### Text Labels

```tsx
<AdwToggleGroup>
 <x.Toggle id="day" label="Day" />
 <x.Toggle id="week" label="Week" />
 <x.Toggle id="month" label="Month" />
</AdwToggleGroup>
```

### x.Toggle Props

| Prop | Type | Description |
|------|------|-------------|
| `id` | string | Unique identifier |
| `label` | string | Text label |
| `iconName` | string | Icon name |
| `tooltip` | string | Tooltip text |
| `enabled` | boolean | Whether the toggle is enabled |

## ExpanderRow Children

Use `x.ExpanderRowRow` and `x.ExpanderRowAction` for declarative expander row content:

```tsx
import { x, AdwExpanderRow, AdwActionRow, GtkListBox, GtkButton } from "@gtkx/react";

const SettingsExpander = () => (
 <GtkListBox cssClasses={["boxed-list"]}>
 <AdwExpanderRow title="Advanced Settings" subtitle="Additional configuration options">
 <x.ExpanderRowAction>
 <GtkButton iconName="emblem-system-symbolic" cssClasses={["flat"]} />
 </x.ExpanderRowAction>
 <x.ExpanderRowRow>
 <AdwActionRow title="Option 1" />
 <AdwActionRow title="Option 2" />
 <AdwActionRow title="Option 3" />
 </x.ExpanderRowRow>
 </AdwExpanderRow>
 </GtkListBox>
);
```

### x.ExpanderRowAction

Places a widget in the expander row header (next to the expand arrow).

### x.ExpanderRowRow

Contains the rows that appear when the expander is expanded.

## Grid Layout

Position children in a `GtkGrid` using `x.GridChild`:

```tsx
import { x, GtkGrid, GtkLabel, GtkEntry, GtkButton } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const FormGrid = () => (
 <GtkGrid rowSpacing={8} columnSpacing={12}>
 <x.GridChild column={0} row={0}>
 <GtkLabel label="Name:" halign={Gtk.Align.END} />
 </x.GridChild>
 <x.GridChild column={1} row={0}>
 <GtkEntry hexpand />
 </x.GridChild>
 <x.GridChild column={0} row={1}>
 <GtkLabel label="Email:" halign={Gtk.Align.END} />
 </x.GridChild>
 <x.GridChild column={1} row={1}>
 <GtkEntry hexpand />
 </x.GridChild>
 <x.GridChild column={0} row={2} columnSpan={2}>
 <GtkButton label="Submit" halign={Gtk.Align.END} />
 </x.GridChild>
 </GtkGrid>
);
```

### x.GridChild Props

| Prop | Type | Description |
|------|------|-------------|
| `column` | number | Column position (0-based) |
| `row` | number | Row position (0-based) |
| `columnSpan` | number | Number of columns to span |
| `rowSpan` | number | Number of rows to span |

## Fixed Positioning

Position children absolutely in a `GtkFixed` using `x.FixedChild`:

```tsx
import { x, GtkFixed, GtkLabel } from "@gtkx/react";

const AbsoluteLayout = () => (
 <GtkFixed>
 <x.FixedChild x={20} y={30}>
 <GtkLabel label="Top Left" />
 </x.FixedChild>
 <x.FixedChild x={200} y={100}>
 <GtkLabel label="Middle" />
 </x.FixedChild>
 </GtkFixed>
);
```

### x.FixedChild Props

| Prop | Type | Description |
|------|------|-------------|
| `x` | number | X coordinate in pixels |
| `y` | number | Y coordinate in pixels |

## Overlay Children

Layer widgets on top of each other using `x.OverlayChild`:

```tsx
import { x, GtkOverlay, GtkImage, GtkLabel } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const BadgedImage = () => (
 <GtkOverlay>
 <GtkImage iconName="folder-symbolic" pixelSize={48} />
 <x.OverlayChild>
 <GtkLabel
 label="3"
 cssClasses={["badge"]}
 halign={Gtk.Align.END}
 valign={Gtk.Align.START}
 />
 </x.OverlayChild>
 </GtkOverlay>
);
```

## Notebook Pages

Create tabbed interfaces with `x.NotebookPage` and optional custom tab widgets:

```tsx
import { x, GtkNotebook, GtkBox, GtkImage, GtkLabel } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const TabbedView = () => (
 <GtkNotebook>
 <x.NotebookPage label="Documents">
 <GtkLabel label="Documents content" vexpand />
 </x.NotebookPage>
 <x.NotebookPage>
 <x.NotebookPageTab>
 <GtkBox spacing={4}>
 <GtkImage iconName="folder-symbolic" />
 <GtkLabel label="Files" />
 </GtkBox>
 </x.NotebookPageTab>
 <GtkLabel label="Files content" vexpand />
 </x.NotebookPage>
 </GtkNotebook>
);
```

### x.NotebookPage Props

| Prop | Type | Description |
|------|------|-------------|
| `label` | string | Tab label text |

### x.NotebookPageTab

Custom widget to use as the tab label instead of text.
