# Event Controllers

GTKX handles user input through GTK event controllers added as JSX children to widgets. Controllers are auto-generated from GTK's introspection data and support all GTK properties and signals.

## Basic Usage

Add event controllers as children to any widget:

```tsx
import {
  GtkBox,
  GtkLabel,
  GtkEventControllerMotion,
  GtkEventControllerKey,
} from "@gtkx/react";
import { useState } from "react";

const InteractiveBox = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  return (
    <GtkBox focusable>
      <GtkEventControllerMotion
        onEnter={(x, y) => console.log("Entered at", x, y)}
        onMotion={(x, y) => setPosition({ x, y })}
        onLeave={() => console.log("Left")}
      />
      <GtkEventControllerKey
        onKeyPressed={(keyval) => {
          console.log("Key:", keyval);
          return false;
        }}
      />
      <GtkLabel label={`Position: ${Math.round(position.x)}, ${Math.round(position.y)}`} />
    </GtkBox>
  );
};
```

Controllers are automatically attached to their parent widget and cleaned up on unmount.

## Available Controllers

### Input Controllers

| Controller | Description |
| ---------- | ----------- |
| `GtkEventControllerMotion` | Pointer enter/leave/motion events |
| `GtkEventControllerKey` | Keyboard input events |
| `GtkEventControllerScroll` | Scroll wheel events (requires `flags` prop) |
| `GtkEventControllerFocus` | Focus enter/leave events |

### Gesture Controllers

| Controller | Description |
| ---------- | ----------- |
| `GtkGestureClick` | Click/tap gestures with button detection |
| `GtkGestureDrag` | Drag gestures with start position tracking |
| `GtkGestureLongPress` | Long press detection |
| `GtkGestureZoom` | Pinch-to-zoom gestures |
| `GtkGestureRotate` | Two-finger rotation gestures |
| `GtkGestureSwipe` | Swipe gestures with velocity |
| `GtkGestureStylus` | Stylus/pen input with pressure and tilt |
| `GtkGesturePan` | Panning gestures (requires `orientation` prop) |

### Drag-and-Drop Controllers

| Controller | Description |
| ---------- | ----------- |
| `GtkDragSource` | Initiates drag operations from a widget |
| `GtkDropTarget` | Accepts drops on a widget (requires `actions` prop) |
| `GtkDropControllerMotion` | Motion events during drag-over operations |

## Props and Signals

Controllers support GTK properties as props and signals with the `on<SignalName>` convention:

```tsx
<GtkGestureClick
  button={1}
  onPressed={(nPress, x, y) => console.log("Clicked", nPress, "times")}
  onReleased={(nPress, x, y) => console.log("Released")}
/>
```

See the [GTK4 documentation](https://docs.gtk.org/gtk4/) for the full list of properties and signals for each controller.

## Multiple Controllers

You can add multiple controllers of the same or different types to a single widget:

```tsx
<GtkBox>
  <GtkEventControllerMotion onMotion={handleMotion} />
  <GtkEventControllerMotion onMotion={handleMotion2} />
  <GtkGestureClick onPressed={handleClick} />
  <GtkLabel label="Content" />
</GtkBox>
```

## Controller Refs

Access the underlying GTK controller instance via refs:

```tsx
import { GtkBox, GtkGestureClick } from "@gtkx/react";
import * as Gtk from "@gtkx/ffi/gtk";
import { useRef } from "react";

const Example = () => {
  const gestureRef = useRef<Gtk.GestureClick | null>(null);

  return (
    <GtkBox>
      <GtkGestureClick
        ref={gestureRef}
        onPressed={() => {
          const button = gestureRef.current?.getCurrentButton();
          console.log("Button:", button);
        }}
      />
    </GtkBox>
  );
};
```
