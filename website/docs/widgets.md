# Declarative Widgets

GTKX provides declarative child components for various GTK widgets, allowing you to configure widget internals using JSX instead of imperative APIs.

## Scale with Marks

Add marks to a `GtkScale` slider using `x.ScaleMark`, and configure the adjustment with `x.Adjustment`:

```tsx
import { x, GtkScale } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const VolumeSlider = () => {
  const [volume, setVolume] = useState(50);

  return (
    <GtkScale hexpand>
      <x.Adjustment
        value={volume}
        lower={0}
        upper={100}
        stepIncrement={1}
        pageIncrement={10}
        onValueChanged={setVolume}
      />
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

| Prop       | Type               | Description                               |
| ---------- | ------------------ | ----------------------------------------- |
| `value`    | number             | Position on the scale                     |
| `label`    | string             | Optional text label                       |
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

| Prop  | Type   | Description                     |
| ----- | ------ | ------------------------------- |
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

| Prop    | Type   | Description                      |
| ------- | ------ | -------------------------------- |
| `id`    | string | Unique identifier for the offset |
| `value` | number | Threshold value                  |

## ToggleGroup with Toggles

Create toggle button groups using `AdwToggleGroup` with `x.Toggle` children:

```tsx
import { x, AdwToggleGroup } from "@gtkx/react";
import { useState } from "react";

const ViewModeSelector = () => {
  const [viewMode, setViewMode] = useState("list");

  return (
    <AdwToggleGroup
      activeName={viewMode}
      onNotify={(group, prop) => {
        if (prop === "active-name") {
          setViewMode(group.getActiveName() ?? "list");
        }
      }}
    >
      <x.Toggle id="list" iconName="view-list-symbolic" tooltip="List View" />
      <x.Toggle id="grid" iconName="view-grid-symbolic" tooltip="Grid View" />
      <x.Toggle
        id="flow"
        iconName="view-continuous-symbolic"
        tooltip="Flow View"
      />
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

| Prop       | Type    | Description                   |
| ---------- | ------- | ----------------------------- |
| `id`       | string  | Unique identifier             |
| `label`    | string  | Text label                    |
| `iconName` | string  | Icon name                     |
| `tooltip`  | string  | Tooltip text                  |
| `enabled`  | boolean | Whether the toggle is enabled |

## ExpanderRow Children

Use `x.ExpanderRowRow` and `x.ExpanderRowAction` for declarative expander row content:

```tsx
import {
  x,
  AdwExpanderRow,
  AdwActionRow,
  GtkListBox,
  GtkButton,
} from "@gtkx/react";

const SettingsExpander = () => (
  <GtkListBox cssClasses={["boxed-list"]}>
    <AdwExpanderRow
      title="Advanced Settings"
      subtitle="Additional configuration options"
    >
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

| Prop         | Type   | Description               |
| ------------ | ------ | ------------------------- |
| `column`     | number | Column position (0-based) |
| `row`        | number | Row position (0-based)    |
| `columnSpan` | number | Number of columns to span |
| `rowSpan`    | number | Number of rows to span    |

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

| Prop | Type   | Description            |
| ---- | ------ | ---------------------- |
| `x`  | number | X coordinate in pixels |
| `y`  | number | Y coordinate in pixels |

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

| Prop        | Type    | Description                                   |
| ----------- | ------- | --------------------------------------------- |
| `label`     | string  | Tab label text                                |
| `tabExpand` | boolean | Whether the tab should expand to fill space   |
| `tabFill`   | boolean | Whether the tab should fill its allocated space |

### x.NotebookPageTab

Custom widget to use as the tab label instead of text.

## Drag and Drop

All widgets support drag-and-drop through props. Use `onDragPrepare`, `onDragBegin`, and `onDragEnd` to make a widget draggable, and `dropTypes`, `onDrop`, `onDropEnter`, and `onDropLeave` to accept drops.

```tsx
import * as Gdk from "@gtkx/ffi/gdk";
import { Type, Value } from "@gtkx/ffi/gobject";
import { GtkButton, GtkBox, GtkLabel } from "@gtkx/react";
import { useState } from "react";

const DraggableButton = ({ label }: { label: string }) => {
  return (
    <GtkButton
      label={label}
      onDragPrepare={() =>
        Gdk.ContentProvider.newForValue(Value.newFromString(label))
      }
    />
  );
};

const DropZone = () => {
  const [dropped, setDropped] = useState<string | null>(null);

  return (
    <GtkBox
      dropTypes={[Type.STRING]}
      onDrop={(value: Value) => {
        setDropped(value.getString());
        return true;
      }}
    >
      <GtkLabel label={dropped ?? "Drop here"} />
    </GtkBox>
  );
};
```

For a complete example with visual feedback, see the drag-and-drop demo in `examples/gtk-demo/src/demos/gestures/dnd.tsx`.

### GValue Factories

Create typed values for drag-and-drop content and signal emission:

| Factory                        | Description                        |
| ------------------------------ | ---------------------------------- |
| `Value.newFromString(str)`     | String values                      |
| `Value.newFromDouble(num)`     | 64-bit floating point              |
| `Value.newFromInt(num)`        | 32-bit signed integer              |
| `Value.newFromUint(num)`       | 32-bit unsigned integer            |
| `Value.newFromBoolean(bool)`   | Boolean values                     |
| `Value.newFromObject(obj)`     | GObject instances                  |
| `Value.newFromBoxed(boxed)`    | Boxed types (Gdk.RGBA, etc.)       |
| `Value.newFromEnum(gtype, n)`  | Enum values (requires GType)       |
| `Value.newFromFlags(gtype, n)` | Flags values (requires GType)      |

Type constants for `dropTypes`:

```tsx
import { Type } from "@gtkx/ffi/gobject";

<GtkBox
  dropTypes={[Type.STRING]}
  onDrop={(value) => {
    console.log(value.getString());
    return true;
  }}
/>
```

## Custom Drawing

Render custom graphics using `GtkDrawingArea` with the `onDraw` callback. The callback receives a Cairo context for 2D drawing:

```tsx
import { GtkDrawingArea } from "@gtkx/react";
import type { Context } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";

const CustomCanvas = () => {
    const handleDraw = (
        self: Gtk.DrawingArea,
        cr: Context,
        width: number,
        height: number,
    ) => {
        cr.setSourceRgb(0.2, 0.4, 0.8);
        cr.rectangle(10, 10, width - 20, height - 20);
        cr.fill();

        cr.setSourceRgb(1, 1, 1);
        cr.moveTo(width / 2, 20);
        cr.lineTo(width - 20, height - 20);
        cr.lineTo(20, height - 20);
        cr.closePath();
        cr.fill();
    };

    return (
        <GtkDrawingArea
            contentWidth={400}
            contentHeight={300}
            onDraw={handleDraw}
        />
    );
};
```

### Interactive Drawing

Combine `onDraw` with gesture callbacks for interactive applications like paint programs:

```tsx
import { GtkDrawingArea } from "@gtkx/react";
import type { Context } from "@gtkx/ffi/cairo";
import * as Gtk from "@gtkx/ffi/gtk";
import { useRef, useState } from "react";

interface Point {
    x: number;
    y: number;
}

const PaintCanvas = () => {
    const ref = useRef<Gtk.DrawingArea | null>(null);
    const [points, setPoints] = useState<Point[]>([]);
    const startRef = useRef<Point | null>(null);

    const handleDraw = (
        self: Gtk.DrawingArea,
        cr: Context,
        width: number,
        height: number,
    ) => {
        cr.setSourceRgb(1, 1, 1);
        cr.rectangle(0, 0, width, height);
        cr.fill();

        if (points.length > 1) {
            cr.setSourceRgb(0, 0, 0);
            cr.setLineWidth(2);
            cr.moveTo(points[0].x, points[0].y);
            for (const point of points.slice(1)) {
                cr.lineTo(point.x, point.y);
            }
            cr.stroke();
        }
    };

    return (
        <GtkDrawingArea
            ref={ref}
            contentWidth={400}
            contentHeight={300}
            onDraw={handleDraw}
            onGestureDragBegin={(startX, startY) => {
                startRef.current = { x: startX, y: startY };
                setPoints([{ x: startX, y: startY }]);
            }}
            onGestureDragUpdate={(offsetX, offsetY) => {
                if (startRef.current) {
                    const x = startRef.current.x + offsetX;
                    const y = startRef.current.y + offsetY;
                    setPoints((prev) => [...prev, { x, y }]);
                    ref.current?.queueDraw();
                }
            }}
            onGestureDragEnd={() => {
                startRef.current = null;
            }}
        />
    );
};
```

Call `widget.queueDraw()` to request a redraw when state changes outside of React's render cycle.

For a complete painting application with colors and brush sizes, see `examples/gtk-demo/src/demos/drawing/paint.tsx`.

## Adjustment

Configure adjustable widgets declaratively using `x.Adjustment`. This works with `GtkScale`, `GtkScrollbar`, `GtkScaleButton`, `GtkSpinButton`, and `GtkListBox`.

```tsx
import { x, GtkScale, GtkBox, GtkLabel } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const VolumeControl = () => {
  const [volume, setVolume] = useState(50);

  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
      <GtkScale drawValue hexpand>
        <x.Adjustment
          value={volume}
          lower={0}
          upper={100}
          stepIncrement={1}
          pageIncrement={10}
          onValueChanged={setVolume}
        />
      </GtkScale>
      <GtkLabel label={`Volume: ${Math.round(volume)}%`} />
    </GtkBox>
  );
};
```

### x.Adjustment Props

| Prop            | Type                    | Description                              |
| --------------- | ----------------------- | ---------------------------------------- |
| `value`         | number                  | Current value                            |
| `lower`         | number                  | Minimum value (default: 0)               |
| `upper`         | number                  | Maximum value (default: 100)             |
| `stepIncrement` | number                  | Increment for arrow keys (default: 1)    |
| `pageIncrement` | number                  | Increment for page up/down (default: 10) |
| `pageSize`      | number                  | Page size, usually 0 for scales          |
| `onValueChanged` | (value: number) => void | Callback when value changes              |

## TextBuffer

Configure a `GtkTextView` buffer declaratively using `x.TextBuffer`. Text content is provided as children, with optional `x.TextTag` elements for rich text formatting.

### Basic Usage

```tsx
import { x, GtkTextView, GtkScrolledWindow } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const TextEditor = () => {
  return (
    <GtkScrolledWindow minContentHeight={200}>
      <GtkTextView wrapMode={Gtk.WrapMode.WORD_CHAR}>
        <x.TextBuffer enableUndo onTextChanged={(text) => console.log(text)}>
          Hello, World!
        </x.TextBuffer>
      </GtkTextView>
    </GtkScrolledWindow>
  );
};
```

When `enableUndo` is true, the built-in keyboard shortcuts `Ctrl+Z` (undo) and `Ctrl+Shift+Z` (redo) are automatically available.

### Rich Text with TextTag

Use `x.TextTag` to apply formatting to portions of text. Tags can be nested for combined styling:

```tsx
import { x, GtkTextView, GtkScrolledWindow } from "@gtkx/react";
import * as Pango from "@gtkx/ffi/pango";
import * as Gtk from "@gtkx/ffi/gtk";

const RichTextEditor = () => {
  return (
    <GtkScrolledWindow minContentHeight={200}>
      <GtkTextView wrapMode={Gtk.WrapMode.WORD_CHAR}>
        <x.TextBuffer>
          Normal text,{" "}
          <x.TextTag id="bold" weight={Pango.Weight.BOLD}>
            bold text
          </x.TextTag>
          ,{" "}
          <x.TextTag id="italic" style={Pango.Style.ITALIC}>
            italic text
          </x.TextTag>
          , and{" "}
          <x.TextTag id="colored" foreground="red">
            <x.TextTag id="underlined" underline={Pango.Underline.SINGLE}>
              nested red underlined
            </x.TextTag>
          </x.TextTag>{" "}
          text.
        </x.TextBuffer>
      </GtkTextView>
    </GtkScrolledWindow>
  );
};
```

### Embedded Widgets with TextAnchor

Use `x.TextAnchor` to embed widgets inline with text content:

```tsx
import { x, GtkTextView, GtkScrolledWindow, GtkButton } from "@gtkx/react";

const TextWithWidgets = () => {
  return (
    <GtkScrolledWindow minContentHeight={200}>
      <GtkTextView>
        <x.TextBuffer>
          Click here:{" "}
          <x.TextAnchor>
            <GtkButton label="Click me" onClicked={() => console.log("Clicked!")} />
          </x.TextAnchor>{" "}
          to continue.
        </x.TextBuffer>
      </GtkTextView>
    </GtkScrolledWindow>
  );
};
```

### x.TextBuffer Props

| Prop               | Type                       | Description                             |
| ------------------ | -------------------------- | --------------------------------------- |
| `enableUndo`       | boolean                    | Enable undo/redo functionality          |
| `onTextChanged`    | (text: string) => void     | Callback when text changes              |
| `onCanUndoChanged` | (canUndo: boolean) => void | Callback when undo availability changes |
| `onCanRedoChanged` | (canRedo: boolean) => void | Callback when redo availability changes |
| `children`         | ReactNode                  | Text content, TextTag, and TextAnchor elements |

### x.TextTag Props

| Prop                  | Type                 | Description                                    |
| --------------------- | -------------------- | ---------------------------------------------- |
| `id`                  | string               | Unique identifier for the tag (required)       |
| `priority`            | number               | Tag priority (higher wins for same property)   |
| `foreground`          | string               | Text color (e.g., "red", "#ff0000")            |
| `background`          | string               | Background color                               |
| `weight`              | Pango.Weight         | Font weight (e.g., `Pango.Weight.BOLD`)        |
| `style`               | Pango.Style          | Font style (e.g., `Pango.Style.ITALIC`)        |
| `underline`           | Pango.Underline      | Underline style                                |
| `strikethrough`       | boolean              | Whether to strike through text                 |
| `family`              | string               | Font family (e.g., "Monospace")                |
| `size`                | number               | Font size in Pango units                       |
| `sizePoints`          | number               | Font size in points                            |
| `scale`               | number               | Font scale factor                              |
| `rise`                | number               | Baseline offset in Pango units                 |
| `letterSpacing`       | number               | Extra character spacing in Pango units         |
| `justification`       | Gtk.Justification    | Text justification                             |
| `leftMargin`          | number               | Left margin in pixels                          |
| `rightMargin`         | number               | Right margin in pixels                         |
| `indent`              | number               | Paragraph indent in pixels                     |
| `pixelsAboveLines`    | number               | Spacing above paragraphs                       |
| `pixelsBelowLines`    | number               | Spacing below paragraphs                       |
| `editable`            | boolean              | Whether text can be modified                   |
| `invisible`           | boolean              | Whether text is hidden                         |

### x.TextAnchor Props

| Prop       | Type      | Description                              |
| ---------- | --------- | ---------------------------------------- |
| `children` | ReactNode | Widget to embed at the anchor position   |

## SourceBuffer

Configure a `GtkSourceView` buffer declaratively using `x.SourceBuffer`. This extends TextBuffer with syntax highlighting, bracket matching, and language-specific features for source code editing.

```tsx
import {
  x,
  GtkSourceView,
  GtkScrolledWindow,
} from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const CodeEditor = () => {
  const [code, setCode] = useState('console.log("Hello, World!");');

  return (
    <GtkScrolledWindow minContentHeight={300}>
      <GtkSourceView
        showLineNumbers
        highlightCurrentLine
        tabWidth={4}
        indentWidth={4}
        autoIndent
      >
        <x.SourceBuffer
          text={code}
          language="typescript"
          styleScheme="Adwaita-dark"
          highlightSyntax
          highlightMatchingBrackets
          enableUndo
          onTextChanged={setCode}
        />
      </GtkSourceView>
    </GtkScrolledWindow>
  );
};
```

### x.SourceBuffer Props

| Prop                       | Type                                   | Description                                        |
| -------------------------- | -------------------------------------- | -------------------------------------------------- |
| `text`                     | string                                 | Text content                                       |
| `language`                 | string \| GtkSource.Language           | Language ID (e.g., "typescript", "python", "rust") |
| `styleScheme`              | string \| GtkSource.StyleScheme        | Color scheme ID (e.g., "Adwaita-dark", "classic")  |
| `highlightSyntax`          | boolean                                | Enable syntax highlighting (default: true if language set) |
| `highlightMatchingBrackets`| boolean                                | Highlight matching brackets (default: true)        |
| `enableUndo`               | boolean                                | Enable undo/redo functionality                     |
| `implicitTrailingNewline`  | boolean                                | Handle trailing newlines automatically             |
| `onTextChanged`            | (text: string) => void                 | Callback when text changes                         |
| `onCanUndoChanged`         | (canUndo: boolean) => void             | Callback when undo availability changes            |
| `onCanRedoChanged`         | (canRedo: boolean) => void             | Callback when redo availability changes            |
| `onCursorMoved`            | () => void                             | Callback when cursor position changes              |
| `onHighlightUpdated`       | (start, end: Gtk.TextIter) => void     | Callback when highlighting is updated              |

## Keyboard Shortcuts

Attach keyboard shortcuts to widgets using `x.ShortcutController` with `x.Shortcut` children:

```tsx
import { x, GtkBox, GtkLabel } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const App = () => {
  const [count, setCount] = useState(0);
  const [searchMode, setSearchMode] = useState(false);

  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} focusable>
      <x.ShortcutController scope={Gtk.ShortcutScope.LOCAL}>
        <x.Shortcut
          trigger="<Control>equal"
          onActivate={() => setCount((c) => c + 1)}
        />
        <x.Shortcut
          trigger="<Control>minus"
          onActivate={() => setCount((c) => c - 1)}
        />
        <x.Shortcut
          trigger="<Control>f"
          onActivate={() => setSearchMode((s) => !s)}
        />
      </x.ShortcutController>
      <GtkLabel label={`Count: ${count}`} />
      <GtkLabel label={searchMode ? "Search mode ON" : "Search mode OFF"} />
    </GtkBox>
  );
};
```

### Controller Scopes

| Scope     | Description                                     |
| --------- | ----------------------------------------------- |
| `LOCAL`   | Shortcuts active only when the widget has focus |
| `MANAGED` | Shortcuts managed by a parent controller        |
| `GLOBAL`  | Shortcuts active anywhere in the window         |

### Trigger Syntax

Shortcuts use GTK accelerator string format:

| Example             | Description                          |
| ------------------- | ------------------------------------ |
| `<Control>s`        | Ctrl+S                               |
| `<Control><Shift>s` | Ctrl+Shift+S                         |
| `<Alt>F4`           | Alt+F4                               |
| `<Primary>q`        | Platform primary key (Ctrl on Linux) |
| `_m`                | Mnemonic trigger (Alt+M)             |
| `F5`                | F5 key                               |

### Multiple Triggers

Pass an array to `trigger` for alternative key combinations:

```tsx
<x.Shortcut trigger={["F5", "<Control>r"]} onActivate={refresh} />
```

### Disabling Shortcuts

Use the `disabled` prop to temporarily disable a shortcut without removing it:

```tsx
<x.Shortcut trigger="<Control>s" onActivate={save} disabled={!hasChanges} />
```

### x.ShortcutController Props

| Prop    | Type                | Description               |
| ------- | ------------------- | ------------------------- |
| `scope` | `Gtk.ShortcutScope` | Shortcut activation scope |

### x.Shortcut Props

| Prop         | Type                  | Description                                         |
| ------------ | --------------------- | --------------------------------------------------- |
| `trigger`    | string \| string[]    | Key combination(s) to trigger the shortcut          |
| `onActivate` | () => boolean \| void | Callback when triggered (return false to propagate) |
| `disabled`   | boolean               | Whether the shortcut is disabled                    |
