# Changelog

## [Unreleased] - Changes since v0.15.0

### New Features

#### Declarative Animations (`x.Animation`)

A new Framer Motion-like animation API using libadwaita's native animation primitives:

```tsx
import { x, GtkLabel } from "@gtkx/react";

<x.Animation
  initial={{ opacity: 0, translateY: -20 }}
  animate={{ opacity: 1, translateY: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
  onAnimationComplete={() => console.log("Done!")}
>
  <GtkLabel label="Animated content" />
</x.Animation>
```

Supports spring and timed transitions with properties: `opacity`, `scaleX`, `scaleY`, `translateX`, `translateY`, `rotate`.

#### Event Controllers as JSX Children

Event controllers are now auto-generated and can be added as children to any widget:

```tsx
import { GtkBox, GtkEventControllerMotion, GtkGestureClick } from "@gtkx/react";

<GtkBox>
  <GtkEventControllerMotion
    onEnter={(x, y) => console.log("Entered")}
    onMotion={(x, y) => console.log(x, y)}
    onLeave={() => console.log("Left")}
  />
  <GtkGestureClick
    onPressed={(nPress, x, y) => console.log("Clicked", nPress)}
  />
</GtkBox>
```

Available controllers include: `GtkEventControllerMotion`, `GtkEventControllerKey`, `GtkEventControllerScroll`, `GtkEventControllerFocus`, `GtkGestureClick`, `GtkGestureDrag`, `GtkGestureLongPress`, `GtkGestureZoom`, `GtkGestureRotate`, `GtkGestureSwipe`, `GtkGestureStylus`, and more.

#### Declarative Text Styling (`x.TextTag`, `x.TextAnchor`, `x.TextPaintable`)

New virtual elements for declarative text formatting within TextView and SourceView:

```tsx
import { GtkTextView, x } from "@gtkx/react";
import * as Pango from "@gtkx/ffi/pango";

<GtkTextView>
  Hello <x.TextTag id="bold" weight={Pango.Weight.BOLD}>bold</x.TextTag> world!
  <x.TextAnchor>
    <GtkButton label="Click me" />
  </x.TextAnchor>
</GtkTextView>
```

- `x.TextTag` - Apply text formatting (font, color, size, etc.)
- `x.TextAnchor` - Embed widgets within text
- `x.TextPaintable` - Embed paintables/images within text

#### Color and Font Dialog Buttons

New nodes for color and font selection dialogs:

```tsx
import { GtkColorDialogButton, GtkFontDialogButton } from "@gtkx/react";

<GtkColorDialogButton
  rgba={color}
  onRgbaChanged={setColor}
  title="Select Color"
  modal
  withAlpha
/>

<GtkFontDialogButton
  fontDesc={font}
  onFontDescChanged={setFont}
  title="Select Font"
  useFont
  useSize
/>
```

#### Alert Dialog Responses

Declarative alert dialog responses with `x.AlertDialogResponse`:

```tsx
import { x, AdwAlertDialog } from "@gtkx/react";
import * as Adw from "@gtkx/ffi/adw";

<AdwAlertDialog
  heading="Confirm Action"
  body="Are you sure?"
  onResponse={(id) => handleResponse(id)}
>
  <x.AlertDialogResponse id="cancel" label="Cancel" />
  <x.AlertDialogResponse
    id="confirm"
    label="Confirm"
    appearance={Adw.ResponseAppearance.SUGGESTED}
  />
</AdwAlertDialog>
```

#### SearchBar with Controlled State

`GtkSearchBar` now supports `onSearchModeChanged` for controlled search mode:

```tsx
<GtkSearchBar
  searchModeEnabled={isSearching}
  onSearchModeChanged={setIsSearching}
>
  <GtkSearchEntry />
</GtkSearchBar>
```

#### Multiple Children in `x.OverlayChild`

`x.OverlayChild` now supports multiple children:

```tsx
<GtkOverlay>
  <GtkPicture />
  <x.OverlayChild measure clipOverlay>
    <GtkLabel label="First overlay" />
    <GtkLabel label="Second overlay" />
  </x.OverlayChild>
</GtkOverlay>
```

#### AdwDialog Support

`AdwDialog` is now properly supported with automatic presentation and cleanup:

```tsx
{showDialog && (
  <AdwDialog title="My Dialog">
    <GtkBox>Dialog content</GtkBox>
  </AdwDialog>
)}
```

#### Cairo API Additions

Extended Cairo API with Surface support:

```tsx
import { Context, Surface, PdfSurface } from "@gtkx/ffi/cairo";

// PDF export
const pdf = new PdfSurface("output.pdf", 595, 842);
const ctx = pdf.createContext();
ctx.moveTo(0, 0).lineTo(100, 100).stroke();
ctx.showPage();
pdf.finish();

// New Context methods
ctx.relMoveTo(dx, dy);
ctx.relLineTo(dx, dy);
ctx.relCurveTo(dx1, dy1, dx2, dy2, dx3, dy3);
ctx.getCurrentPoint();
ctx.getTarget();
ctx.setSourceSurface(surface, x, y);
surface.createSimilar("COLOR_ALPHA", width, height);
```

#### TextView Buffer Callbacks

New granular buffer callbacks for `GtkTextView` and `GtkSourceView`:

```tsx
<GtkTextView
  enableUndo
  onBufferChanged={(buffer) => console.log("Changed")}
  onTextInserted={(buffer, offset, text) => console.log("Inserted:", text)}
  onTextDeleted={(buffer, start, end) => console.log("Deleted")}
  onCanUndoChanged={(canUndo) => setCanUndo(canUndo)}
  onCanRedoChanged={(canRedo) => setCanRedo(canRedo)}
/>
```

### Breaking Changes

#### Gesture Props Removed

Widget gesture props (`onEnter`, `onLeave`, `onMotion`, `onPressed`, `onKeyPressed`, etc.) have been removed. Use event controller child elements instead:

```tsx
// Before (v0.15.0)
<GtkBox
  onEnter={() => console.log("Entered")}
  onLeave={() => console.log("Left")}
>

// After
<GtkBox>
  <GtkEventControllerMotion
    onEnter={() => console.log("Entered")}
    onLeave={() => console.log("Left")}
  />
</GtkBox>
```

All GTK event controllers are now available as JSX elements: `GtkEventControllerMotion`, `GtkEventControllerKey`, `GtkEventControllerFocus`, `GtkGestureClick`, `GtkGestureDrag`, `GtkDragSource`, `GtkDropTarget`, and more.

#### Batching API Removed

The FFI batching API has been removed. The following exports from `@gtkx/ffi` no longer exist:

- `beginBatch()`
- `endBatch()`
- `batch()`
- `isBatching()`
- `discardAllBatches()`

Code using batching should be updated to remove batch calls - the framework now handles optimization internally.

#### Virtual Children Replaced with Props

Several virtual child components have been replaced with simpler prop-based APIs:

**Scale marks:**
```tsx
// Before (v0.15.0)
<GtkScale>
  <x.Adjustment value={50} lower={0} upper={100} onValueChanged={setValue} />
  <x.ScaleMark value={0} label="0" position={Gtk.PositionType.BOTTOM} />
  <x.ScaleMark value={100} label="100" position={Gtk.PositionType.BOTTOM} />
</GtkScale>

// After
<GtkScale
  value={50}
  lower={0}
  upper={100}
  onValueChanged={setValue}
  marks={[
    { value: 0, label: "0", position: Gtk.PositionType.BOTTOM },
    { value: 100, label: "100", position: Gtk.PositionType.BOTTOM },
  ]}
/>
```

**Calendar marks:**
```tsx
// Before (v0.15.0)
<GtkCalendar>
  <x.CalendarMark day={15} />
  <x.CalendarMark day={20} />
</GtkCalendar>

// After
<GtkCalendar markedDays={[15, 20]} />
```

**LevelBar offsets:**
```tsx
// Before (v0.15.0)
<GtkLevelBar value={0.5}>
  <x.LevelBarOffset id="low" value={0.25} />
  <x.LevelBarOffset id="high" value={0.75} />
</GtkLevelBar>

// After
<GtkLevelBar
  value={0.5}
  offsets={[
    { id: "low", value: 0.25 },
    { id: "high", value: 0.75 },
  ]}
/>
```

**Removed virtual elements:**
- `x.ScaleMark` - use `marks` prop on `GtkScale`
- `x.CalendarMark` - use `markedDays` prop on `GtkCalendar`
- `x.LevelBarOffset` - use `offsets` prop on `GtkLevelBar`
- `x.Adjustment` - use adjustment props directly on widgets

#### TextBuffer/SourceBuffer Removed

`x.TextBuffer` and `x.SourceBuffer` have been removed. Text content is now placed directly inside `GtkTextView` or `GtkSourceView`:

```tsx
// Before (v0.15.0)
<GtkTextView>
  <x.TextBuffer text={content} onChanged={setContent} />
</GtkTextView>

// After
<GtkTextView onBufferChanged={handleChange}>
  {content}
  <x.TextTag id="bold" weight={Pango.Weight.BOLD}>formatted</x.TextTag>
</GtkTextView>
```

#### ToggleGroup API Changed

`AdwToggleGroup` now uses `onActiveChanged` instead of `onNotify`:

```tsx
// Before (v0.15.0)
<AdwToggleGroup
  activeName={mode}
  onNotify={(group, prop) => {
    if (prop === "active-name") {
      setMode(group.getActiveName() ?? "list");
    }
  }}
>

// After
<AdwToggleGroup
  activeName={mode}
  onActiveChanged={(_index, name) => setMode(name ?? "list")}
>
```

### Improvements

- **Signals blocked during render phase** - Prevents signal handlers from firing during React reconciliation, improving reliability
- **Structs are now immutable** - Plain GLib/GTK structs are now immutable after creation for better predictability
- **Simplified prop setting** - Internal batching removed in favor of direct FFI calls
- **CSS nested rules parser** - Fixed parsing of nested CSS selectors
- **Testing utilities** - `userEvent.dblClick()` and `userEvent.tripleClick()` now emit proper press/release sequences with correct `nPress` values
- **Class introspection** - Added support for runtime class introspection via GObject type system

### Internal Changes

These changes don't affect the public API but improve the codebase:

- Refactored React nodes with shared base classes for reduced duplication
- Unified FFI types between native and codegen packages
- Centralized widget config into core/config module
- Improved naming consistency in native module
- Added comprehensive codegen test coverage
