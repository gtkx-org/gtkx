# Declarative Widgets

GTKX provides declarative child components for various GTK widgets, allowing you to configure widget internals using JSX instead of imperative APIs.

## Scale with Marks

Add marks to a `GtkScale` slider using the `marks` prop, and configure the adjustment with direct props:

```tsx
import { GtkScale } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const VolumeSlider = () => {
  const [volume, setVolume] = useState(50);

  return (
    <GtkScale
      hexpand
      value={volume}
      lower={0}
      upper={100}
      stepIncrement={1}
      pageIncrement={10}
      onValueChanged={setVolume}
      marks={[
        { value: 0, label: "0", position: Gtk.PositionType.BOTTOM },
        { value: 25, position: Gtk.PositionType.BOTTOM },
        { value: 50, label: "50", position: Gtk.PositionType.BOTTOM },
        { value: 75, position: Gtk.PositionType.BOTTOM },
        { value: 100, label: "100", position: Gtk.PositionType.BOTTOM },
      ]}
    />
  );
};
```

## Calendar with Marks

Mark specific days on a `GtkCalendar` using the `markedDays` prop:

```tsx
import { GtkCalendar } from "@gtkx/react";

const EventCalendar = () => {
  const today = new Date();
  const eventDays = [5, 10, 15, 20, 25];

  return (
    <GtkCalendar
      year={today.getFullYear()}
      month={today.getMonth()}
      day={today.getDate()}
      markedDays={eventDays}
    />
  );
};
```

## LevelBar with Offsets

Define color thresholds on a `GtkLevelBar` using the `offsets` prop:

```tsx
import { GtkLevelBar } from "@gtkx/react";
import { useState } from "react";

const BatteryIndicator = () => {
  const [level, setLevel] = useState(0.6);

  return (
    <GtkLevelBar
      value={level}
      minValue={0}
      maxValue={1}
      offsets={[
        { id: "low", value: 0.25 },
        { id: "high", value: 0.75 },
        { id: "full", value: 1.0 },
      ]}
    />
  );
};
```

The level bar changes color at each offset threshold: below 25% shows critical (red), 25-75% is normal, and above 75% shows high (green).

## ToggleGroup with Toggles

Create toggle button groups using `AdwToggleGroup` with `x.Toggle` children:

```tsx
import { x, AdwToggleGroup } from "@gtkx/react";

<AdwToggleGroup activeName="list">
  <x.Toggle id="list" iconName="view-list-symbolic" tooltip="List View" />
  <x.Toggle id="grid" iconName="view-grid-symbolic" tooltip="Grid View" />
  <x.Toggle id="flow" iconName="view-continuous-symbolic" tooltip="Flow View" />
</AdwToggleGroup>
```

Use `onActiveChanged` to respond to selection changes:

```tsx
import { x, AdwToggleGroup } from "@gtkx/react";
import { useState } from "react";

const ViewModeSelector = () => {
  const [mode, setMode] = useState("list");

  return (
    <AdwToggleGroup
      activeName={mode}
      onActiveChanged={(_index, name) => setMode(name ?? "list")}
    >
      <x.Toggle id="list" iconName="view-list-symbolic" />
      <x.Toggle id="grid" iconName="view-grid-symbolic" />
    </AdwToggleGroup>
  );
};
```

Text labels work too:

```tsx
<AdwToggleGroup>
  <x.Toggle id="day" label="Day" />
  <x.Toggle id="week" label="Week" />
  <x.Toggle id="month" label="Month" />
</AdwToggleGroup>
```

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

`x.ExpanderRowAction` places a widget in the expander row header (next to the expand arrow), while `x.ExpanderRowRow` contains the rows that appear when expanded.

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

## Overlay Children

Layer widgets on top of each other using `x.OverlayChild`. You can include multiple children in a single overlay:

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
      <GtkLabel
        label="New"
        cssClasses={["badge"]}
        halign={Gtk.Align.START}
        valign={Gtk.Align.END}
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
    <x.NotebookPage tabExpand tabFill>
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

Use `x.NotebookPageTab` for a custom widget as the tab label instead of text.

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
      dragIcon={Gdk.Texture.newFromFilename("/path/to/icon.png")}
      dragIconHotX={16}
      dragIconHotY={16}
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

Combine `onDraw` with a `GtkGestureDrag` controller for interactive applications like paint programs:

```tsx
import { GtkDrawingArea, GtkGestureDrag } from "@gtkx/react";
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
    >
      <GtkGestureDrag
        onDragBegin={(startX, startY) => {
          startRef.current = { x: startX, y: startY };
          setPoints([{ x: startX, y: startY }]);
        }}
        onDragUpdate={(offsetX, offsetY) => {
          if (startRef.current) {
            const x = startRef.current.x + offsetX;
            const y = startRef.current.y + offsetY;
            setPoints((prev) => [...prev, { x, y }]);
            ref.current?.queueDraw();
          }
        }}
        onDragEnd={() => {
          startRef.current = null;
        }}
      />
    </GtkDrawingArea>
  );
};
```

Call `widget.queueDraw()` to request a redraw when state changes outside of React's render cycle.

For a complete painting application with colors and brush sizes, see `examples/gtk-demo/src/demos/drawing/paint.tsx`.

## TextView with Rich Text

Configure a `GtkTextView` with rich text content using `x.TextTag` children for formatting and `x.TextAnchor` for embedded widgets.

### Basic Usage

```tsx
import { x, GtkTextView, GtkScrolledWindow } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const TextEditor = () => {
  return (
    <GtkScrolledWindow minContentHeight={200}>
      <GtkTextView
        wrapMode={Gtk.WrapMode.WORD_CHAR}
        enableUndo
        onBufferChanged={(text) => console.log(text)}
      >
        Hello, World!
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
        Click here:{" "}
        <x.TextAnchor>
          <GtkButton
            label="Click me"
            onClicked={() => console.log("Clicked!")}
          />
        </x.TextAnchor>{" "}
        to continue.
      </GtkTextView>
    </GtkScrolledWindow>
  );
};
```

### Inline Images with TextPaintable

Use `x.TextPaintable` to embed inline images or icons in text:

```tsx
import { x, GtkTextView, GtkScrolledWindow } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";

const TextWithIcons = () => {
  const iconTheme = Gtk.IconTheme.getForDisplay(Gdk.Display.getDefault()!);
  const icon = iconTheme.lookupIcon("starred-symbolic", null, 16, 1, Gtk.TextDirection.LTR, Gtk.IconLookupFlags.NONE);

  return (
    <GtkScrolledWindow minContentHeight={200}>
      <GtkTextView>
        This is a <x.TextPaintable paintable={icon} /> star icon inline with text.
      </GtkTextView>
    </GtkScrolledWindow>
  );
};
```

## SourceView for Code Editing

Configure a `GtkSourceView` for syntax-highlighted code editing:

```tsx
import { GtkSourceView, GtkScrolledWindow } from "@gtkx/react";
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
        language="typescript"
        styleScheme="Adwaita-dark"
        highlightSyntax
        highlightMatchingBrackets
        enableUndo
        onBufferChanged={setCode}
      >
        {code}
      </GtkSourceView>
    </GtkScrolledWindow>
  );
};
```

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

The `scope` prop controls when shortcuts are active: `LOCAL` (only when focused), `MANAGED` (managed by parent), or `GLOBAL` (anywhere in window).

The `trigger` prop accepts GTK accelerator strings (e.g., `"<Control>s"`, `"<Alt>F4"`). Pass an array for multiple triggers:

```tsx
<x.Shortcut trigger={["F5", "<Control>r"]} onActivate={refresh} />
```

Use `disabled` to temporarily disable a shortcut:

```tsx
<x.Shortcut trigger="<Control>s" onActivate={save} disabled={!hasChanges} />
```

## SearchBar

`GtkSearchBar` provides a search interface with controlled search mode state:

```tsx
import { GtkSearchBar, GtkSearchEntry, GtkBox, GtkToggleButton } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useState } from "react";

const SearchExample = () => {
  const [searchActive, setSearchActive] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
      <GtkToggleButton
        label="Search"
        active={searchActive}
        onToggled={() => setSearchActive(!searchActive)}
      />
      <GtkSearchBar
        searchModeEnabled={searchActive}
        onSearchModeChanged={setSearchActive}
      >
        <GtkSearchEntry
          text={query}
          onSearchChanged={(entry) => setQuery(entry.getText())}
        />
      </GtkSearchBar>
    </GtkBox>
  );
};
```

The `onSearchModeChanged` callback is called when the search mode changes, whether from keyboard shortcuts (Escape to close) or programmatically.

## Alert Dialog Responses

Create alert dialogs with `AdwAlertDialog` and `x.AlertDialogResponse` children:

```tsx
import { x, AdwAlertDialog, GtkButton } from "@gtkx/react";
import { useState } from "react";
import * as Adw from "@gtkx/ffi/adw";

const DeleteConfirmation = () => {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <GtkButton label="Delete" onClicked={() => setShowDialog(true)} />
      {showDialog && (
        <AdwAlertDialog
          heading="Delete File?"
          body="This action cannot be undone."
          onResponse={(id) => {
            if (id === "delete") {
              console.log("Deleting...");
            }
            setShowDialog(false);
          }}
        >
          <x.AlertDialogResponse id="cancel" label="Cancel" />
          <x.AlertDialogResponse
            id="delete"
            label="Delete"
            appearance={Adw.ResponseAppearance.DESTRUCTIVE}
          />
        </AdwAlertDialog>
      )}
    </>
  );
};
```

## Color and Font Dialog Buttons

### Color Dialog Button

```tsx
import { GtkColorDialogButton } from "@gtkx/react";
import * as Gdk from "@gtkx/ffi/gdk";
import { useState } from "react";

const ColorPicker = () => {
  const [color, setColor] = useState(new Gdk.RGBA({ red: 1, green: 0, blue: 0, alpha: 1 }));

  return (
    <GtkColorDialogButton
      rgba={color}
      onRgbaChanged={setColor}
      title="Select Color"
      modal
      withAlpha
    />
  );
};
```

### Font Dialog Button

```tsx
import { GtkFontDialogButton } from "@gtkx/react";
import * as Pango from "@gtkx/ffi/pango";
import { useState } from "react";

const FontPicker = () => {
  const [font, setFont] = useState(Pango.FontDescription.fromString("Sans 12"));

  return (
    <GtkFontDialogButton
      fontDesc={font}
      onFontDescChanged={setFont}
      title="Select Font"
      modal
      useFont
      useSize
    />
  );
};
```
