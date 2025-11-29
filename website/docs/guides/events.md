---
sidebar_position: 2
---

# Event Handling

This guide covers how to handle user interactions and events in GTKX applications.

## Signal-Based Events

GTK uses signals for event handling. In GTKX, signals become React props with the `on` prefix and camelCase naming:

| GTK Signal | React Prop |
|------------|------------|
| `clicked` | `onClicked` |
| `toggled` | `onToggled` |
| `changed` | `onChanged` |
| `close-request` | `onCloseRequest` |
| `state-set` | `onStateSet` |

## Basic Event Handlers

Event handlers work like React event handlers. All signal handlers receive `self` (the widget that emitted the signal) as the first argument:

```tsx
<Button
  label="Click me"
  onClicked={(self) => {
    console.log("Button clicked!");
    console.log("Widget name:", self.getName());
  }}
/>
```

The `self` parameter gives you direct access to the widget's methods without needing to create a ref:

```tsx
<SearchEntry
  placeholderText="Search..."
  onSearchChanged={(self) => {
    const query = self.getText();
    performSearch(query);
  }}
/>

<SpinButton
  adjustment={adjustment}
  onValueChanged={(self) => {
    const value = self.getValue();
    updateValue(value);
  }}
/>
```

## Controlled Components

GTKX follows React's controlled component pattern. Set the value via props and update state in handlers:

```tsx
const [active, setActive] = useState(false);

<ToggleButton.Root
  label={active ? "ON" : "OFF"}
  active={active}
  onToggled={() => setActive(a => !a)}
/>
```

## Handler Return Values

Some GTK signals expect a return value to control default behavior:

| Signal | Return Value |
|--------|--------------|
| `onCloseRequest` | `false` to allow closing, `true` to prevent |
| `onStateSet` | `true` to indicate the signal was handled |

### Example: Preventing Window Close

```tsx
<ApplicationWindow
  onCloseRequest={() => {
    if (hasUnsavedChanges) {
      return true; // Prevent closing
    }
    quit();
    return false; // Allow closing
  }}
/>
```

### Example: Switch State Handling

The Switch widget requires returning `true` from `onStateSet` to indicate the signal was handled:

```tsx
const [active, setActive] = useState(false);

// Must return true to indicate handling
// The handler receives (self, state) where state is the new state value
<Switch
  active={active}
  onStateSet={(_self, state) => {
    setActive(state);
    return true;
  }}
/>
```

### Example: AboutDialog Close Handling

AboutDialog's `onCloseRequest` must return `false` to allow the dialog to close:

```tsx
<AboutDialog
  programName="My App"
  version="1.0.0"
  onCloseRequest={() => {
    setShowAbout(false);
    return false; // Allow closing
  }}
/>
```

## Selection Events

For selection-based widgets:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";

<ListBox
  selectionMode={Gtk.SelectionMode.SINGLE}
  onRowSelected={() => {
    console.log("Row selected");
  }}
>
  {/* ListBoxRow children */}
</ListBox>
```

## Application Lifecycle

### Closing the Application

Use the `quit` function to cleanly shut down:

```tsx
import { quit } from "@gtkx/react";

<ApplicationWindow onCloseRequest={quit}>
  {/* Content */}
</ApplicationWindow>
```

The `quit` function:
1. Unmounts the React tree
2. Stops the GTK main loop
3. Returns `false` (useful as a direct handler)

### Lifecycle Events

For global lifecycle hooks, use the `events` EventEmitter from `@gtkx/ffi`:

```tsx
import { events } from "@gtkx/ffi";

// Set up listeners before render()
events.on("start", () => {
  console.log("GTK initialized");
  // Initialize global resources, logging, etc.
});

events.on("stop", () => {
  console.log("GTK shutting down");
  // Clean up resources, save state, etc.
});
```

| Event | When Emitted |
|-------|--------------|
| `start` | After GTK is initialized and the app is running |
| `stop` | Before GTK shuts down (after `quit()` is called) |

## Best Practices

### Use React State

Always manage UI state with React's `useState`:

```tsx
const [count, setCount] = useState(0);

<Button
  label={`Count: ${count}`}
  onClicked={() => setCount(c => c + 1)}
/>
```

### Cleanup with useEffect

For side effects and cleanup:

```tsx
useEffect(() => {
  const interval = setInterval(() => {
    setProgress(p => (p >= 1 ? 0 : p + 0.01));
  }, 100);

  return () => clearInterval(interval);
}, []);
```

### Use Functional Updates

When updating state based on previous state, use functional updates to avoid stale closures:

```tsx
// Correct - uses functional update
<Button onClicked={() => setCount(c => c + 1)} />

// Avoid - may use stale value
<Button onClicked={() => setCount(count + 1)} />
```
