---
editLink: false
---

# Changelog

## v0.21.0 — 2026-03-26

#### Changelog

> **Note:** This is most likely the last minor release with major breaking changes. The API will be mostly stable from now on as the v1 milestone approaches.

##### New Features

###### `useProperty` Hook

New hook that subscribes to a GObject property and returns its value as React state. Connects to the `notify::property-name` signal and re-renders on changes. Supports nullable objects.

```tsx
import { useProperty, useApplication } from "@gtkx/react";

const app = useApplication();
const activeWindow = useProperty(app, "activeWindow");
const title = useProperty(activeWindow, "title");
```

###### `useSetting` Hook

New hook for reading and writing GSettings values with automatic React state synchronization. Returns a `[value, setValue]` tuple similar to `useState`.

```tsx
import { useSetting } from "@gtkx/react";

const [colorScheme, setColorScheme] = useSetting(
  "org.gnome.desktop.interface", "color-scheme", "string"
);
```

Supported types: `boolean`, `int`, `double`, `string`, `strv`.

###### ESM Getter/Setter for GObject Properties

GObject properties on generated FFI classes now use native ES6 `get`/`set` accessors in addition to explicit getter/setter methods. This provides a more idiomatic JavaScript API for reading and writing GObject properties.

```tsx
// Before
const title = window.getTitle();
window.setTitle("Hello");

// After
const title = window.title;
window.title = "Hello";
```

###### GSettings Vite Plugin

New built-in Vite plugin that compiles `.gschema.xml` files when imported. The default export is the schema ID, ready for use with `useSetting`. Schemas are compiled automatically in both dev and build modes, with HMR support during development.

```tsx
import schemaId from "./com.example.myapp.gschema.xml";
const [value, setValue] = useSetting(schemaId, "my-key", "string");
```

##### Improvements

###### `gtkx create` Initializes a Git Repository

`gtkx create` now automatically initializes a git repository and creates an initial commit in the new project directory.

---

##### Breaking Changes

###### `x` Namespace Removed — Compound Components Instead

The `x` namespace object (`x.Slot`, `x.StackPage`, `x.GridChild`, `x.MenuItem`, etc.) has been completely removed. All virtual child elements are now accessed as compound components on their parent widget, with the main advantage being easier discoverability with autocomplete and better typing:

```tsx
// Before
import { x, GtkStack, GtkGrid, GtkMenuButton, AdwHeaderBar, AdwToolbarView } from "@gtkx/react";

<GtkStack page="page1">
  <x.StackPage id="page1" title="First">
    <GtkLabel label="Content" />
  </x.StackPage>
</GtkStack>

<GtkGrid>
  <x.GridChild column={0} row={0}>
    <GtkLabel label="Cell" />
  </x.GridChild>
</GtkGrid>

<AdwToolbarView>
  <x.ContainerSlot for={AdwToolbarView} id="addTopBar">
    <AdwHeaderBar />
  </x.ContainerSlot>
</AdwToolbarView>

<GtkMenuButton>
  <x.MenuItem id="open" label="Open" onActivate={handleOpen} />
</GtkMenuButton>

<AdwHeaderBar>
  <x.Slot for={AdwHeaderBar} id="titleWidget">
    <GtkLabel label="Title" />
  </x.Slot>
</AdwHeaderBar>
```

```tsx
// After
import { GtkStack, GtkGrid, GtkMenuButton, AdwHeaderBar, AdwToolbarView } from "@gtkx/react";

<GtkStack page="page1">
  <GtkStack.Page id="page1" title="First">
    <GtkLabel label="Content" />
  </GtkStack.Page>
</GtkStack>

<GtkGrid>
  <GtkGrid.Child column={0} row={0}>
    <GtkLabel label="Cell" />
  </GtkGrid.Child>
</GtkGrid>

<AdwToolbarView>
  <AdwToolbarView.AddTopBar>
    <AdwHeaderBar />
  </AdwToolbarView.AddTopBar>
</AdwToolbarView>

<GtkMenuButton>
  <GtkMenuButton.MenuItem id="open" label="Open" onActivate={handleOpen} />
</GtkMenuButton>

<AdwHeaderBar titleWidget={<GtkLabel label="Title" />} />
```

###### Animation API Redesigned — Separate Timed and Spring Elements

The unified `x.Animation` element with a `transition` prop has been replaced by two distinct JSX intrinsic elements: `<AdwTimedAnimation>` and `<AdwSpringAnimation>`. The `transition` prop and its `mode` discriminant are gone — animation parameters are now top-level props.

```tsx
// Before
<x.Animation
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ mode: "spring", damping: 0.8, stiffness: 200 }}
  animateOnMount
>
  <GtkButton label="Hello" />
</x.Animation>
```

```tsx
// After
<AdwSpringAnimation
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  damping={0.8}
  stiffness={200}
  animateOnMount
>
  <GtkButton label="Hello" />
</AdwSpringAnimation>
```

###### `GtkDrawingArea` `onDraw` Renamed to `render`

The `onDraw` callback prop on `GtkDrawingArea` has been renamed to `render`. Changing the `render` function reference now automatically queues a redraw, removing the need to manually trigger redraws when the draw function changes.

```tsx
// Before
<GtkDrawingArea onDraw={(cr, width, height) => { ... }} />

// After
<GtkDrawingArea render={(cr, width, height) => { ... }} />
```

###### `AdwToggleGroup` — `toggles` Prop Replaces `x.Toggle` Children

Toggle definitions are now passed as a data array via the `toggles` prop instead of `x.Toggle` child elements. The `Toggle` intrinsic element has been removed from JSX.

```tsx
// Before
<AdwToggleGroup>
  <x.Toggle id="list" iconName="view-list-symbolic" />
  <x.Toggle id="grid" iconName="view-grid-symbolic" />
</AdwToggleGroup>

// After
<AdwToggleGroup toggles={[
  { id: "list", iconName: "view-list-symbolic" },
  { id: "grid", iconName: "view-grid-symbolic" },
]} />
```

###### `AdwAlertDialog` — `responses` Prop Replaces `x.AlertDialogResponse` Children

Response buttons are now passed as a data array via the `responses` prop instead of `x.AlertDialogResponse` child elements. The `AlertDialogResponse` intrinsic element has been removed from JSX.

```tsx
// Before
<AdwAlertDialog heading="Delete?" defaultResponse="cancel" closeResponse="cancel">
  <x.AlertDialogResponse id="cancel" label="Cancel" />
  <x.AlertDialogResponse id="delete" label="Delete" appearance={Adw.ResponseAppearance.DESTRUCTIVE} />
</AdwAlertDialog>

// After
<AdwAlertDialog heading="Delete?" defaultResponse="cancel" closeResponse="cancel" responses={[
  { id: "cancel", label: "Cancel" },
  { id: "delete", label: "Delete", appearance: Adw.ResponseAppearance.DESTRUCTIVE },
]} />
```

###### Testing: `*ByTestId` Queries Renamed to `*ByName`

All `ByTestId` query variants have been renamed to `ByName` across `@gtkx/testing`:

| Before | After |
|--------|-------|
| `queryByTestId` | `queryByName` |
| `queryAllByTestId` | `queryAllByName` |
| `findByTestId` | `findByName` |
| `findAllByTestId` | `findAllByName` |

The `prettyWidget` debug output now shows `name="..."` instead of `data-testid="..."`.

---

##### Bug Fixes

- Fixed `GtkDrawingArea` draw function not being set when the widget hadn't been allocated yet. The new `render` prop uses a stable closure that always reflects the latest function reference, avoiding timing issues with deferred setup.
- Fixed `AdwToggleGroup` `activeName` / `active` props being set during construction before toggles existed. These props are now deferred until after toggle sync.
- Fixed `AdwAlertDialog` not cleaning up managed responses on disposal.
- Fixed marshalling correctness for enums, arrays, floating refs, and container ownership semantics to match PyGObject behavior.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.21.0)

## v0.20.0 — 2026-02-20

#### Changelog

##### Breaking Changes

###### Data-Driven List API

`GtkListView`, `GtkGridView`, `GtkColumnView`, `GtkDropDown`, and `AdwComboRow` now use a data-driven `items` prop instead of `x.ListItem` and `x.ListSection` children. Both `x.ListItem` and `x.ListSection` have been removed.
This enables extremely fast re-rendering of just the currently bound items, avoiding the creation of React fibers for items that aren't in the currently visible viewport. This brought down the rendering performance of big lists (400k+ items) from 10s~ to <1s.

Items, sections, and tree hierarchies are now expressed as plain data arrays via the `items` prop. The mode (flat, tree, or sectioned) is detected automatically from the data shape:

```tsx
// Before (flat list)
<GtkListView renderItem={(item: Contact | null) => (
  <GtkLabel label={item?.name ?? ""} />
)}>
  {contacts.map((c) => (
    <x.ListItem key={c.id} id={c.id} value={c} />
  ))}
</GtkListView>

// After (flat list)
<GtkListView
  items={contacts.map((c) => ({ id: c.id, value: c }))}
  renderItem={(contact) => <GtkLabel label={contact.name} />}
/>
```

```tsx
// Before (tree)
<GtkListView renderItem={(item, row) => ...} autoexpand>
  <x.ListItem id="parent" value={parent}>
    <x.ListItem id="child" value={child} hideExpander />
  </x.ListItem>
</GtkListView>

// After (tree — nested children arrays)
<GtkListView
  items={[{ id: "parent", value: parent, children: [
    { id: "child", value: child, hideExpander: true }
  ]}]}
  renderItem={(item, row) => ...}
  autoexpand
/>
```

```tsx
// Before (sections)
<GtkGridView
  renderItem={(item) => ...}
  renderHeader={(header) => ...}
>
  <x.ListSection id="s1" value={{ title: "Section 1" }}>
    <x.ListItem id="a" value={itemA} />
  </x.ListSection>
</GtkGridView>

// After (sections — section: true discriminant)
<GtkGridView
  items={[{
    id: "s1", value: { title: "Section 1" }, section: true,
    children: [{ id: "a", value: itemA }]
  }]}
  renderItem={(item) => ...}
  renderHeader={(header) => ...}
/>
```

###### `renderItem` / `renderCell` / `renderHeader` No Longer Receive `null`

All render callbacks now receive `T` instead of `T | null`. Null guards are no longer needed:

| Before | After |
|--------|-------|
| `renderItem={(item: T \| null) => item?.name ?? ""}` | `renderItem={(item: T) => item.name}` |
| `renderCell={(emp: Employee \| null) => emp?.name ?? ""}` | `renderCell={(emp: Employee) => emp.name}` |
| `renderHeader={(item: S \| null) => ...}` | `renderHeader={(item: S) => ...}` |

###### `Pango.attrShapeNewWithData` Removed

The manual `attrShapeNewWithData` FFI binding and the `AttrShape.getData()` extension have been removed. Use the generated `Pango.AttrShape.new()` binding instead.

###### Widget Instantiation Changed to `g_object_new_with_properties`

All widgets and event controllers are now instantiated via `g_object_new_with_properties` instead of calling specific constructors. This is transparent for most usage but means all writable GObject properties present in JSX props are now set during construction, not just construct-only ones. Construct-only properties continue to be silently skipped during prop updates.

---

##### Improvements

###### Dispatch Priority Elevated Above Redraws

The native GTK dispatch scheduler now uses `HIGH_IDLE` priority (100) instead of default idle priority, ensuring React commit phase tasks execute before `GDK_PRIORITY_REDRAW` (120). This prevents visual tearing where GTK would paint intermediate states between individual React mutations.

###### `estimatedItemWidth` Prop for Grid Views

`GtkGridView` and `GtkListView` now accept an `estimatedItemWidth` prop analogous to the `estimatedItemHeight` prop.

---

##### Bug Fixes

- Fixed SIGSEGV when encoding `GList` and `GSList` parameters via FFI. String and object arrays passed to GLib functions expecting linked lists were previously encoded as flat pointer arrays, causing a segmentation fault. They are now properly constructed using `g_list_append` / `g_slist_prepend`.
- Fixed windows briefly flickering on screen when removed from the tree. Windows are now hidden in `removeChild` (before the widget is detached) instead of in `detachDeletedInstance` (after).
- Fixed generated member names that are reserved words (e.g., `new`, `default`) being incorrectly escaped. Member names (object property access) no longer get the `_` suffix that was only intended for standalone identifiers.
- Fixed notebook tab bar remaining visible when removing the last page from a `GtkNotebook`.
- Fixed list factory `bind`/`unbind`/`teardown` callbacks running after disposal, which could cause model mutations on torn-down widgets.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.20.0)

## v0.19.0 — 2026-02-17

#### Changelog

##### New Features

###### List Sections with Headers

`x.ListSection` groups `x.ListItem` children into sections with headers. Supported in `GtkListView`, `GtkGridView`, `GtkColumnView`, and `GtkDropDown` via the new `renderHeader` prop:

```tsx
import { x, GtkListView, GtkLabel } from "@gtkx/react";

<GtkListView
  renderItem={(item) => <GtkLabel label={item.name} />}
  renderHeader={(header) => <GtkLabel label={header.title} />}
>
  <x.ListSection id="fruits" value={{ title: "Fruits" }}>
    <x.ListItem id="apple" value={{ name: "Apple" }} />
    <x.ListItem id="banana" value={{ name: "Banana" }} />
  </x.ListSection>
  <x.ListSection id="vegetables" value={{ title: "Vegetables" }}>
    <x.ListItem id="carrot" value={{ name: "Carrot" }} />
  </x.ListSection>
</GtkListView>
```

###### Custom Item Rendering for DropDown and ComboRow

`GtkDropDown` and `AdwComboRow` now support `renderItem` and `renderListItem` props for custom item rendering via signal-list-item factories:

```tsx
import { GtkDropDown, GtkBox, GtkImage, GtkLabel, x } from "@gtkx/react";

<GtkDropDown
  selectedId={selected}
  onSelectionChanged={setSelected}
  renderItem={(item) => <GtkLabel label={item.name} />}
  renderListItem={(item) => (
    <GtkBox>
      <GtkImage iconName={item.icon} />
      <GtkLabel label={item.name} />
    </GtkBox>
  )}
>
  <x.ListItem id="a" value={{ name: "Option A", icon: "dialog-information" }} />
  <x.ListItem id="b" value={{ name: "Option B", icon: "dialog-warning" }} />
</GtkDropDown>
```

`renderItem` sets the factory for both the button and popup list. `renderListItem` overrides `renderItem` for the popup list only.

###### Accessible Properties

All widgets now support comprehensive accessible properties, states, and relations via `AccessibleProps`:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkCheckButton } from "@gtkx/react";

<GtkButton
  label="Delete"
  accessibleLabel="Delete selected items"
  accessibleDescription="Permanently removes all selected items"
  accessibleKeyShortcuts="Delete"
/>

<GtkCheckButton
  accessibleChecked={Gtk.AccessibleTristate.TRUE}
  accessibleLabel="Accept terms"
/>
```

Available props include properties (`accessibleLabel`, `accessibleDescription`, `accessiblePlaceholder`, `accessibleValueNow`, `accessibleHelpText`, ...), states (`accessibleBusy`, `accessibleChecked`, `accessibleDisabled`, `accessibleExpanded`, `accessibleHidden`, `accessiblePressed`, `accessibleSelected`, ...), and relations (`accessibleActiveDescendant`, `accessibleControls`, `accessibleDescribedBy`, `accessibleFlowTo`, `accessibleLabelledBy`, `accessibleOwns`, ...).

###### Construct-Only Properties

Widgets with construct-only properties that aren't part of the designated constructor are now automatically constructed via `g_object_new_with_properties`, allowing construct-only GObject properties to be set as JSX props. Construct-only props are applied at widget creation time and silently skipped during prop updates.

###### Commit Phase Freezing

New `freeze` and `unfreeze` functions batch GTK thread operations during React's commit phase. The reconciler wraps the entire commit in a freeze/unfreeze pair, preventing intermediate repaints between individual mutations. This enables proper `useLayoutEffect` behavior — layout effects run within the frozen batch, so measurements and mutations happen atomically before the next frame.

###### Plain CSS File Imports

The Vite plugin now supports plain CSS file imports, automatically injected into the GTK CSS provider at runtime via `injectGlobal` from `@gtkx/css`:

```tsx
import "./style.css";
```

CSS URL imports continue to resolve as file paths:

```tsx
import path from "./style.css?url";
```

###### Environment Type Declarations

A new `@gtkx/cli/env` export provides TypeScript ambient declarations for Vite client types, CSS URL imports (`*.css?url → string`), and data file imports (`*.data → string`):

```ts
/// <reference types="@gtkx/cli/env" />
```

###### Column Visibility

`x.ColumnViewColumn` now supports a `visible` prop for showing and hiding individual columns.

###### Text Anchor Replacement Character

`x.TextAnchor` now supports a `replacementChar` prop for specifying the character displayed when the embedded widget is not visible (e.g. in serialized text). When set, the anchor is created via `Gtk.TextChildAnchor.newWithReplacement`.

###### Font Dialog Filtering

`GtkFontDialogButton` now supports `filter` and `fontMap` props for restricting which fonts are shown in the dialog and providing a custom font map.

###### Testing: Accessible Name and Property Text Queries

New `getWidgetAccessibleName` function computes the accessible name of a widget by combining its own text properties with descendant label text. New `getWidgetPropertyText` function extracts widget property text for display and debugging purposes.

---

##### Breaking Changes

###### `x.ShortcutController` Removed

Use the standard `<GtkShortcutController>` intrinsic element instead:

| Before | After |
|--------|-------|
| `<x.ShortcutController scope={Gtk.ShortcutScope.GLOBAL}>` | `<GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>` |

###### Cairo API Rewritten

The Cairo API has been completely rewritten with proper constructors and void return types.

**Constructor changes:**

| Before | After |
|--------|-------|
| `FontOptions.create()` | `new FontOptions()` |
| `surface.createContext()` | `new Context(surface)` |

Methods on `Context`, `Surface`, `Pattern`, and `FontOptions` no longer return `this` for chaining — they return `void` instead:

```tsx
// Before
cr.setSourceRgb(0.2, 0.4, 0.8)
  .rectangle(10, 10, width - 20, height - 20)
  .fill();

// After
cr.setSourceRgb(0.2, 0.4, 0.8);
cr.rectangle(10, 10, width - 20, height - 20);
cr.fill();
```

###### Testing: `getWidgetText` Semantics Changed

`getWidgetText` now returns only direct child label text content (analogous to DOM `textContent`), not widget property text. Use the new `getWidgetAccessibleName` for role-based name queries. `findAllByText` and `queryAllByText` now skip widgets with the `LABEL` accessible role (internal labels), which may change which widgets are matched.

###### Environment Declaration Renamed

| Before | After |
|--------|-------|
| `vite-env.d.ts` | `gtkx-env.d.ts` |
| `/// <reference types="vite/client" />` | `/// <reference types="@gtkx/cli/env" />` |

---

##### Bug Fixes

- Fixed sized and fixed-size array decoding for GObject, boxed, struct, string, and fundamental item types.
- Callback closures with ref parameters now properly write back modified values after the JavaScript callback returns, enabling correct out-parameter behavior in signal handlers.
- Fixed `Value.newFromBoxed` to use proper FFI call for `g_value_set_boxed`.
- `findAllByText` and `queryAllByText` now correctly skip internal label widgets, preventing duplicate matches from implementation-detail labels inside composite widgets.
- Empty strings returned by `getLabel()`, `getText()`, and `getTitle()` are now treated as `null` instead of empty string matches.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.19.0)

## v0.18.9 — 2026-02-11

#### Changelog

- `GtkLabel` is now treated as a text node in `@gtkx/testing`, aligning `getByText` with React Testing Library's `getNodeText` behavior.
- List items now re-render bound items when `renderItem`/`renderCell` changes.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.18.9)

## v0.18.8 — 2026-02-09

#### Changelog

- Added header menu support for `ColumnViewColumn`.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.18.8)

## v0.18.7 — 2026-02-08

#### Changelog

- Use fundamental type (copy/free functions) instead of boxed type for records that define `copy-function` and `free-function`, fixing lifetime management for records without a GLib type.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.18.7)

## v0.18.6 — 2026-02-07

#### Changelog

- Moved `self` parameter to last position in `onDraw` callback, consistent with signal handler convention.
- Added GdkWayland and Gtk4SessionLock GIR files and generated FFI bindings.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.18.6)

## v0.18.5 — 2026-02-07

#### Changelog

- Fixed `isValidChild` rejecting `EventControllerNode`, `SlotNode`, and `ContainerSlotNode` on widget nodes with restrictive child validation (Window, PopoverMenu, NavigationView, TextView, ColumnView, ListView, GridView, DropDown, Notebook, DrawingArea, Calendar).

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.18.5)

## v0.18.4 — 2026-02-06

#### Changelog

- Removed `sideEffects` field from `@gtkx/ffi` package to fix tree-shaking issues.
- Excluded `child` property from generated widget slots in codegen.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.18.4)

## v0.18.3 — 2026-02-04

#### Changelog

- Fixed tree-shaking of GValue static factories and Cairo bindings that broke after the last release.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.18.3)

## v0.18.2 — 2026-02-04

#### Changelog

##### Improvements

- Added `sideEffects` field to all published packages, enabling tree-shaking for downstream bundlers
- Enabled `declarationMap` in TypeScript config, allowing "Go to Definition" to navigate to original source files
- Enabled `sourceMap` in TypeScript config for improved debugging experience
- Included source files in published packages to support declaration map resolution

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.18.2)

## v0.18.1 — 2026-02-04

#### Changelog

##### Build

- **Self-contained production bundles**: The native `.node` binary is now embedded directly in the build output as `gtkx.node`, eliminating the `node_modules` dependency at runtime.
- **Asset base path**: Added `assetBase` option to `build()` and `--asset-base` CLI flag for FHS-compliant packaging where assets live in a separate directory (e.g., `../share/my-app`) rather than next to the binary.
- **Vite asset pipeline**: Asset imports now go through Vite's `renderBuiltUrl` pipeline, supporting both co-located assets (via `import.meta.url`) and relocatable layouts (via `assetBase`).

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.18.1)

## v0.18.0 — 2026-02-03

#### Changelog

##### New Features

###### `gtkx build` command for production bundling

A new CLI command produces a single minified ESM bundle via Vite SSR mode.

```sh
gtkx build [entry]  # defaults to src/index.tsx
```

Output is written to `dist/bundle.js` with all dependencies bundled except the native module. A programmatic API is also available:

```ts
import { build } from "@gtkx/cli/builder";
await build({ entry: "./src/index.tsx", vite: { root: process.cwd() } });
```

Static assets (images, SVGs, etc.) should now be handled via Vite imports rather than `path.resolve` / `import.meta.dirname`. `vite` is a required `devDependency` for applications using the build command.

###### `x.ContainerSlot` -- unified container slot component

A new generic, type-safe component replaces all specialized method-child nodes for attaching children to parent widgets via named methods:

```tsx
<x.ContainerSlot for={AdwToolbarView} id="addTopBar">
  <AdwHeaderBar />
</x.ContainerSlot>
```

---

##### Breaking Changes

###### `x.ListView` and `x.GridView` removed

Use the `GtkListView` and `GtkGridView` intrinsics directly.

| Before | After |
|--------|-------|
| `<x.ListView renderItem={...}>` | `<GtkListView renderItem={...}>` |
| `<x.GridView renderItem={...}>` | `<GtkGridView renderItem={...}>` |

Removed exports: `ListViewProps`, `GridViewProps` from the `x` namespace.

###### `x.TreeListView` and `x.TreeListItem` removed

Tree behavior is now automatic when `x.ListItem` children are nested.

| Before | After |
|--------|-------|
| `<x.TreeListView renderItem={...}>` | `<GtkListView renderItem={...} autoexpand>` |
| `<x.TreeListItem id="..." value={...}>` | `<x.ListItem id="..." value={...}>` |

Removed types: `TreeListViewProps`, `TreeListItemProps`, `TreeRenderItemFn`.

###### `x.SimpleListItem` removed

Use `x.ListItem` instead. `ListItemProps` now includes tree-specific props (`indentForDepth`, `indentForIcon`, `hideExpander`) that only apply in tree context.

###### Specialized method-child nodes removed

All replaced by `x.ContainerSlot`:

| Before | After |
|--------|-------|
| `<x.PackStart>` | `<x.ContainerSlot for={GtkHeaderBar} id="packStart">` |
| `<x.PackEnd>` | `<x.ContainerSlot for={GtkHeaderBar} id="packEnd">` |
| `<x.ToolbarTop>` | `<x.ContainerSlot for={AdwToolbarView} id="addTopBar">` |
| `<x.ToolbarBottom>` | `<x.ContainerSlot for={AdwToolbarView} id="addBottomBar">` |
| `<x.ActionRowPrefix>` | `<x.ContainerSlot for={AdwActionRow} id="addPrefix">` |
| `<x.ActionRowSuffix>` | `<x.ContainerSlot for={AdwActionRow} id="addSuffix">` |
| `<x.ExpanderRowRow>` | `<x.ContainerSlot for={AdwExpanderRow} id="addRow">` |
| `<x.ExpanderRowAction>` | `<x.ContainerSlot for={AdwExpanderRow} id="addAction">` |

###### Animation `mode` prop moved into `transition`

| Before | After |
|--------|-------|
| `<x.Animation mode="spring" transition={{ damping: 0.8 }}>`{v-pre} | `<x.Animation transition={{ mode: "spring", damping: 0.8 }}>`{v-pre} |
| `<x.Animation mode="timed" transition={{ duration: 300 }}>`{v-pre} | `<x.Animation transition={{ mode: "timed", duration: 300 }}>`{v-pre} |

`transition` is now a discriminated union (`AnimationTransition = TimedTransition | SpringTransition`) with `mode` as the discriminant. Removed type: `AnimationMode`. New type: `AnimationTransition`.

###### Testing package API changes

- `RenderResult.container` type changed from `Gtk.Application` to `Gtk.Widget` (the direct container wrapping rendered content).
- New `RenderResult.baseElement` property replaces what `container` previously represented.
- `RenderOptions` now accepts `baseElement?: Container` to scope queries.
- `RenderOptions.wrapper` type changed to `boolean | WrapperComponent` (where `WrapperComponent` requires a `ref` prop).
- `userEvent.click` now uses `widget.activate()` instead of manually toggling state or emitting signals.
- `queryByLabelText` semantics changed to mnemonic-widget lookup (see New Features above).

---

##### Bug Fixes

- **Null callback FFI argument count mismatch:** Passing `null` for a callback-typed FFI argument now generates the correct number of FFI argument slots, including the `destroy_notify` pointer for callbacks that require it.

---

##### Performance Improvements

- **Condvar signaling in native dispatch:** Cross-thread communication between JavaScript and GTK now uses condition variable signaling instead of polling at 100-microsecond intervals, eliminating busy-waiting CPU overhead and reducing FFI call latency.
- **Batch-insert list model items:** List model stores now use `splice()` to batch-insert items during initial mount instead of appending one-by-one, reducing GLib model change notifications.
- **CSS StyleSheet update batching:** `@gtkx/css` now batches `insert()` calls within the same microtask, scheduling a single provider update via `queueMicrotask` instead of updating on every rule insertion.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.18.0)

## v0.17.3 — 2026-01-28

#### Changelog

##### Breaking Changes

- **`quit` function**: The `quit` function from `@gtkx/react` no longer returns a boolean.

##### Website

- Migrated to https://gtkx.dev

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.17.3)

## v0.17.0 — 2026-01-26

#### Changelog

##### New Features

###### Testing: `renderHook` Utility

The `@gtkx/testing` package now exports `renderHook` for testing custom React hooks in isolation:

```tsx
import { renderHook } from "@gtkx/testing";

const { result, rerender } = renderHook(() => useMyHook(initialValue));
expect(result.current).toBe(expectedValue);
```

###### Synthetic Property Getters (Codegen)

The code generator now produces synthetic getter functions for GObject properties that lack explicit getter methods. This provides consistent programmatic access to widget properties.

##### Breaking Changes

###### Changes to Declarative Animation API (`x.Animation`)

`<x.Animation>` has been refactored with a cleaner API and implementation, and now supports all underlying Adwaita's animation properties, plus has support for exit/mount animations.

**Spring animation**:

```tsx
<x.Animation
  mode="spring"
  initial={{ opacity: 0, translateY: -20, scale: 0.8 }}
  animate={{ opacity: 1, translateY: 0, scale: 1 }}
  exit={{ opacity: 0, translateY: 20 }}
  transition={{
    damping: 0.8,
    stiffness: 200,
    mass: 1,
    initialVelocity: 0,
    clamp: false,
  }}
  animateOnMount
  onAnimationComplete={() => console.log("Animation done")}
>
  <GtkLabel label="Spring animated content" />
</x.Animation>
```

**Timed animation**:

```tsx
import * as Adw from "@gtkx/ffi/adw";

<x.Animation
  mode="timed"
  initial={{ opacity: 0, rotate: -45, scaleX: 0.5 }}
  animate={{ opacity: 1, rotate: 0, scaleX: 1 }}
  exit={{ opacity: 0, rotate: 45 }}
  transition={{
    duration: 400,
    easing: Adw.Easing.EASE_OUT_CUBIC,
    delay: 100,
    repeat: 0,
    alternate: false,
  }}
  animateOnMount
>
  <GtkButton label="Timed animated button" />
</x.Animation>
```

**Animatable properties:**
- `opacity` - Widget transparency (0 to 1)
- `translateX`, `translateY` - Position offset in pixels
- `scale`, `scaleX`, `scaleY` - Size scaling factors
- `rotate` - Rotation in degrees
- `skewX`, `skewY` - Skew transformations

**Animation modes:**
- `timed` - Duration-based with easing curves, repeat, delay, and alternate options
- `spring` - Physics-based with damping, stiffness, mass, and velocity control

##### Improvements

- **Significant performance improvements in List Model implementations** - Tree List Views and List Views now only update the items that changed based on reconciler operations instead of splicing the whole list for every change.
- **Documentation improvements**: Added links to upstream GTK documentation and removed redundant information

##### Bug Fixes

- **Fixed infinite loop in selection model** - Resolved an issue where certain selection model operations could cause infinite loops in list views
- **Fixed double-free in fundamental types** - Corrected memory management for GLib fundamental types with copy semantics, preventing crashes
- **Fixed closure memory management** - Improved closure lifecycle handling in the native module to prevent memory leaks and use-after-free errors
- **Fixed NativeObject comparisons** - Object equality checks now consistently use `isObjectEqual` for correct reference comparison across FFI boundaries
- **Fixed record field size for fixed-size arrays** - Codegen now correctly calculates struct field sizes for fixed-length array types
- **Fixed method body writer for array and interface types** - Improved type handling in generated method implementations

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.17.0)

## v0.16.0 — 2026-01-23

#### Changelog

##### New Features

###### Declarative Animations (`x.Animation`)

A new Framer Motion-like animation API using libadwaita's native animation primitives:

```tsx
import { x, GtkLabel } from "@gtkx/react";

<x.Animation
  initial={{ opacity: 0, y: -20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
  onAnimationComplete={() => console.log("Done!")}
>
  <GtkLabel label="Animated content" />
</x.Animation>
```

Supports spring and timed transitions with properties: `opacity`, `x`, `y`, `scale`, `scaleX`, `scaleY`, `rotate`.

###### Event Controllers as JSX Children

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

###### Declarative Text Styling (`x.TextTag`, `x.TextAnchor`, `x.TextPaintable`)

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

###### Color and Font Dialog Buttons

Dialog buttons now support controlled mode by passing `onRgbaChanged` and `onFontDescChanged`:

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

###### Alert Dialog Responses

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

###### SearchBar with Controlled State

`GtkSearchBar` now supports `onSearchModeChanged` for controlled search mode:

```tsx
<GtkSearchBar
  searchModeEnabled={isSearching}
  onSearchModeChanged={setIsSearching}
>
  <GtkSearchEntry />
</GtkSearchBar>
```

###### Multiple Children in `x.OverlayChild`

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

###### TextView Buffer Callbacks

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

###### ToggleGroup API improvement

`AdwToggleGroup` now supports `onActiveChanged` instead of requiring `onNotify`:

```tsx
// Before
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

##### Breaking Changes

###### Signal Argument Order Changed

Signal callbacks now receive `self` (the widget instance) as the **last** argument instead of first. This enables direct use of React state setters and cleaner callback signatures:

```tsx
// Before
<GtkSpinButton
  onValueChanged={(spinButton) => setValue(spinButton.getValue())}
/>

<GtkScale
  onValueChanged={(scale) => setVolume(scale.getValue())}
/>

// After
<GtkSpinButton
  onValueChanged={setValue}
/>

<GtkScale
  onValueChanged={setVolume}
/>
```

###### Gesture Props Removed

Widget gesture props (`onEnter`, `onLeave`, `onMotion`, `onPressed`, `onKeyPressed`, etc.) have been removed. Use event controller child elements instead:

```tsx
// Before
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

###### Batching API Removed

The FFI batching API has been removed. The following exports from `@gtkx/ffi` no longer exist:

- `beginBatch()`
- `endBatch()`
- `batch()`
- `isBatching()`
- `discardAllBatches()`

Code using batching should be updated to remove batch calls.

###### Virtual Children Replaced with Props

Several virtual child components have been replaced with simpler prop-based APIs:

**Scale marks:**
```tsx
// Before
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
// Before
<GtkCalendar>
  <x.CalendarMark day={15} />
  <x.CalendarMark day={20} />
</GtkCalendar>

// After
<GtkCalendar markedDays={[15, 20]} />
```

**LevelBar offsets:**
```tsx
// Before
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

###### TextBuffer/SourceBuffer Removed

`x.TextBuffer` and `x.SourceBuffer` have been removed. Text content is now placed directly inside `GtkTextView` or `GtkSourceView`:

```tsx
// Before
<GtkTextView>
  <x.TextBuffer text={content} onChanged={setContent} />
</GtkTextView>

// After
<GtkTextView onBufferChanged={handleChange}>
  {content}
  <x.TextTag id="bold" weight={Pango.Weight.BOLD}>formatted</x.TextTag>
</GtkTextView>
```

##### Improvements

- **Structs are now immutable** - Plain C structs are now immutable after creation
- **CSS nested rules parser** - Fixed parsing of nested CSS selectors
- **Testing utilities** - `userEvent.dblClick()` and `userEvent.tripleClick()` now emit proper press/release sequences with correct `nPress` values
- **Class introspection** - Added support for runtime class introspection via GObject type system

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.16.0)

## v0.15.0 — 2026-01-15

### Changelog

#### Breaking Changes

##### Callback Props Renamed

Signal callbacks that notify about value or state changes have been renamed to use a consistent `Changed` suffix, for consistency with GTK naming conventions. The following props have been affected:

| Widget                                | Old Prop                  | New Prop                                |
| ------------------------------------- | ------------------------- | --------------------------------------- |
| GtkScale, GtkScrollbar, GtkSpinButton | `onValueChange`           | `onValueChanged`                        |
| GtkTextView, GtkSourceView            | `onTextChange`            | `onTextChanged`                         |
| Various                               | `onCanUndo` / `onCanRedo` | `onCanUndoChanged` / `onCanRedoChanged` |

**Migration:** Update your callback prop names to the new `Changed` suffix.

##### Adjustment and Buffer Props Hidden from Generated Props

The `adjustment` and `buffer` props are no longer exposed on generated widget prop types. Use the new declarative virtual elements instead:

```tsx
// Before (v0.14.0)
<GtkScale adjustment={new Gtk.Adjustment(50, 0, 100, 1, 10, 0)} />

// After
<GtkScale>
    <x.Adjustment value={50} lower={0} upper={100} onValueChanged={setValue} />
</GtkScale>
```

---

#### New Features

##### Declarative Virtual Elements

###### `x.Adjustment` - Scale, Scrollbar, and SpinButton Configuration

Declaratively configure adjustments for adjustable widgets without manual GtkAdjustment instantiation:

```tsx
import { x, GtkScale } from "@gtkx/react";

<GtkScale hexpand>
  <x.Adjustment
    value={volume}
    lower={0}
    upper={100}
    stepIncrement={1}
    pageIncrement={10}
    onValueChanged={setVolume}
  />
</GtkScale>;
```

Supported widgets: `GtkScale`, `GtkScrollbar`, `GtkScaleButton`, `GtkSpinButton`, `GtkListBox`.

###### `x.TextBuffer` - GtkTextView Buffer Configuration

Manage GtkTextView content declaratively with undo support:

```tsx
import { x, GtkTextView } from "@gtkx/react";

<GtkTextView>
  <x.TextBuffer
    text={content}
    enableUndo
    onTextChanged={setContent}
    onCanUndoChanged={setCanUndo}
    onCanRedoChanged={setCanRedo}
  />
</GtkTextView>;
```

###### `x.SourceBuffer` - GtkSourceView with Syntax Highlighting

Full syntax highlighting support for GtkSourceView:

```tsx
import { x, GtkSourceView } from "@gtkx/react";

<GtkSourceView>
  <x.SourceBuffer
    text={code}
    language="typescript"
    styleScheme="Adwaita-dark"
    highlightMatchingBrackets
    onTextChanged={setCode}
  />
</GtkSourceView>;
```

###### `x.ShortcutController` and `x.Shortcut` - Declarative Keyboard Shortcuts

Add keyboard shortcuts to any widget with a clean declarative API:

```tsx
import * as Gtk from "@gtkx/ffi/gtk";
import { x, GtkBox } from "@gtkx/react";

<GtkBox>
  <x.ShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
    <x.Shortcut
      trigger="<Control>f"
      onActivate={() => setSearchMode((s) => !s)}
    />
    <x.Shortcut trigger="<Control>q" onActivate={quit} />
    <x.Shortcut trigger={["F5", "<Control>r"]} onActivate={refresh} />
    <x.Shortcut trigger="Escape" onActivate={cancel} disabled={!canCancel} />
  </x.ShortcutController>
</GtkBox>;
```

##### Custom Drawing with `onDraw`

GtkDrawingArea now supports an `onDraw` prop for custom Cairo rendering:

```tsx
import { GtkDrawingArea } from "@gtkx/react";
import type { Context } from "@gtkx/ffi/cairo";
import type * as Gtk from "@gtkx/ffi/gtk";

const handleDraw = (
  self: Gtk.DrawingArea,
  cr: Context,
  width: number,
  height: number
) => {
  cr.setSourceRgb(0.2, 0.4, 0.8);
  cr.rectangle(10, 10, width - 20, height - 20);
  cr.fill();
};

<GtkDrawingArea contentWidth={400} contentHeight={300} onDraw={handleDraw} />;
```

Combine with gesture callbacks (`onGestureDragBegin`, `onGestureDragUpdate`, `onGestureDragEnd`) for interactive drawing applications.

##### GValue Factories and Type Constants

New factory methods simplify creating typed GValues for drag-and-drop and signal emission:

```tsx
import { Type, Value } from "@gtkx/ffi/gobject";

// Create typed values
const stringValue = Value.newFromString("Hello");
const doubleValue = Value.newFromDouble(3.14);
const intValue = Value.newFromInt(42);
const boolValue = Value.newFromBoolean(true);
const objectValue = Value.newFromObject(myWidget);
const boxedValue = Value.newFromBoxed(rgba);
const enumValue = Value.newFromEnum(myEnumGType, 0);
const flagsValue = Value.newFromFlags(myFlagsGType, FLAG_A | FLAG_B);

// Use type constants for drop targets
<GtkBox
  dropTypes={[Type.STRING]}
  onDrop={(value) => {
    console.log(value.getString());
    return true;
  }}
/>;
```

**Available factories:**

- `Value.newFromString(str)`
- `Value.newFromDouble(num)`
- `Value.newFromFloat(num)`
- `Value.newFromInt(num)` / `Value.newFromUint(num)`
- `Value.newFromInt64(num)` / `Value.newFromUint64(num)`
- `Value.newFromLong(num)` / `Value.newFromUlong(num)`
- `Value.newFromBoolean(bool)`
- `Value.newFromObject(obj)`
- `Value.newFromBoxed(boxed)`
- `Value.newFromEnum(gtype, value)`
- `Value.newFromFlags(gtype, value)`

**Type constants:** `Type.STRING`, `Type.INT`, `Type.UINT`, `Type.DOUBLE`, `Type.FLOAT`, `Type.BOOLEAN`, `Type.OBJECT`, `Type.BOXED`, `Type.ENUM`, `Type.FLAGS`, and more.

##### Animation Callbacks

New trampoline implementations enable animation callbacks:

- **`Adw.AnimationTargetFunc`**: For `AdwCallbackAnimationTarget` custom animations
- **`Gtk.TickCallback`**: For frame-synchronized animations via `add_tick_callback`

---

#### Bug Fixes

- **Fixed signal leak in list item renderers**: Signal handlers are now properly disconnected when list items are recycled
- **Fixed shortcuts dialog using stale window ref**: The shortcuts dialog now correctly references the current window
- **Fixed paint demo stroke ending and redraw**: Stroke termination and canvas redraw now work correctly
- **Fixed child unmount in expander row**: Children of AdwExpanderRow are now properly unmounted
- **Fixed filterProps null handling in list nodes**: Null props are now handled correctly in list-based nodes
- **Fixed prop update condition checks in nodes**: Property update comparisons now work correctly for all value types

---

#### Performance Improvements

- **Batched FFI calls in node child changes**: Multiple FFI calls during child add/remove operations are now batched, reducing overhead
- **Simplified node child handling via delegation**: Internal refactoring improves child management efficiency
- **Element size support for array types**: Arrays with known element sizes are now handled more efficiently in FFI

---

#### Documentation

- **Expanded widget documentation**: New sections covering custom drawing, keyboard shortcuts, and GValue usage
- **Added JSDoc to core types**: `PointerInput`, `ShortcutController`, `Type`, and `Value` now have comprehensive JSDoc documentation
- **Updated all demos**: Example applications updated to use new declarative APIs

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.15.0)

## v0.14.0 — 2026-01-14

#### Changelog

##### Features

###### Optional Props with Default Values

Widget props now leverage default values from GTK's introspection data. Common properties no longer need to be explicitly specified when using their default values.

**Before:**
```tsx
<GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={0}>
  <GtkLabel label="Hello" />
</GtkBox>
```

**After:**
```tsx
<GtkBox>
  <GtkLabel label="Hello" />
</GtkBox>
```

This applies across all widgets where GTK defines sensible defaults, reducing boilerplate significantly.

###### Drag and Drop Support

Full reconciler support for native GTK drag and drop via new typed props on all widgets:

```tsx
import * as Gdk from "@gtkx/ffi/gdk";
import * as GObject from "@gtkx/ffi/gobject";
import { typeFromName } from "@gtkx/ffi/gobject";

function createStringValue(str: string): GObject.Value {
  const stringType = typeFromName("gchararray");
  const value = new GObject.Value();
  value.init(stringType);
  value.setString(str);
  return value;
}

function DraggableItem() {
  return (
    <GtkLabel
      label="Drag me"
      dragActions={Gdk.DragAction.COPY | Gdk.DragAction.MOVE}
      onDragPrepare={() => Gdk.ContentProvider.newForValue(createStringValue("Hello!"))}
      onDragBegin={() => console.log("Drag started")}
      onDragEnd={() => console.log("Drag ended")}
    />
  );
}

function DropZone() {
  const stringType = typeFromName("gchararray");
  
  return (
    <GtkBox
      dropTypes={[stringType]}
      dropActions={Gdk.DragAction.COPY}
      onDrop={(value: GObject.Value) => {
        console.log("Dropped:", value.getString());
        return true;
      }}
      onDropEnter={() => Gdk.DragAction.COPY}
      onDropLeave={() => console.log("Left drop zone")}
    >
      <GtkLabel label="Drop here" />
    </GtkBox>
  );
}
```

New props available on all widgets:
- `onDragPrepare`, `onDragBegin`, `onDragEnd`, `onDragCancel`, `dragActions` for drag sources
- `onDrop`, `onDropEnter`, `onDropLeave`, `onDropMotion`, `dropTypes`, `dropActions` for drop targets

###### Synthetic Setters for Read-Only Properties

Writeable properties that lacked explicit setters in GTK now have auto-generated setters. This enables reactive updates for properties that previously required workarounds.

###### EventController Support in Testing

The `fireEvent` function now accepts both widgets and event controllers:

```tsx
import { fireEvent } from "@gtkx/testing";

// Fire event on widget
await fireEvent(button, "clicked");

// Fire event on gesture controller
const gesture = widget.observeControllers().getObject(0) as Gtk.GestureDrag;
await fireEvent(gesture, "drag-begin",
  { type: { type: "float", size: 64 }, value: 100 },
  { type: { type: "float", size: 64 }, value: 100 }
);
```

##### Bug Fixes

###### Selection Model Change Propagation

`ListView` and `TreeListView` now properly propagate selection model changes. When the underlying selection model updates, components re-render automatically.

###### Fixed Closure Memory Safety Issue

Resolved a critical issue where closures could be freed while still executing, causing crashes in callback-heavy scenarios like scroll handlers and animations. This fix improves stability for applications with frequent event callbacks.

##### Documentation

- Updated all documentation and examples to use the new optional props syntax
- Added comprehensive drag and drop examples in the GTK Demo
- Improved testing documentation with EventController examples

##### Examples

- **New Browser Demo**: Standalone browser example at `examples/browser/`
- **GTK Demo Improvements**:
  - Closer visual alignment with the official GTK demo application
  - New demos: Paint, AspectFrame, Scrolling benchmark, Themes benchmark
  - Updated all demos to use optional props syntax

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.14.0)

## v0.13.3 — 2026-01-13

#### Changelog

##### New Features

###### AdwNavigationSplitView Support

`x.NavigationPage` now works with `AdwNavigationSplitView` for sidebar/content split layouts. Use `id="sidebar"` and `id="content"` to assign pages to each pane.

```tsx
<AdwNavigationSplitView sidebarWidthFraction={0.33} minSidebarWidth={200} maxSidebarWidth={300}>
    <x.NavigationPage id="sidebar" title="Mail">
        <AdwToolbarView>
            <x.ToolbarTop><AdwHeaderBar /></x.ToolbarTop>
            <GtkListBox onRowSelected={(_, row) => { /* handle selection */ }}>
                {items.map((item) => <AdwActionRow key={item.id} title={item.title} />)}
            </GtkListBox>
        </AdwToolbarView>
    </x.NavigationPage>

    <x.NavigationPage id="content" title={selectedItem.title}>
        <AdwToolbarView>
            <x.ToolbarTop><AdwHeaderBar /></x.ToolbarTop>
            <GtkLabel label={selectedItem.title} />
        </AdwToolbarView>
    </x.NavigationPage>
</AdwNavigationSplitView>
```

###### Documentation Updates

- Added `AdwNavigationSplitView` example to x-showcase navigation demo
- Updated Adwaita documentation with split view usage guide
- Updated Claude skill templates

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.13.3)

## v0.13.2 — 2026-01-12

#### Changelog

##### Documentation

  - Added new x-showcase example to `README.md` — demonstrates all `x.*` virtual components
  - Fixed documentation URLs in `llms.txt` — added missing `/docs/` path segment to all documentation links

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.13.2)

## v0.13.1 — 2026-01-12

#### Changelog

##### New Features

- **Fixed**: Property accessor resolution now correctly maps C identifiers to method names (e.g., `gtk_image_set_from_file` → `set_from_file`), enabling usage of `<GtkImage file="/some/file/path.png" />`

##### Documentation

- Updated Claude template examples with `AdwNavigationView` and `TreeListView` patterns

##### Deploying Example

- Added asset loading utility (`getAssetPath`) for packaged app environments
- Added AppStream metainfo.xml for Flatpak
- Updated build scripts to bundle assets into package share directories

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.13.1)

## v0.13.0 — 2026-01-11

#### Changelog

##### New Features

###### GtkScale with declarative marks

Add marks to a GtkScale slider declaratively:

```tsx
<GtkScale>
  <x.ScaleMark value={0} label="Min" />
  <x.ScaleMark value={50} />
  <x.ScaleMark value={100} label="Max" />
</GtkScale>
```

###### GtkCalendar with declarative day marks

Mark specific days on a GtkCalendar declaratively:

```tsx
<GtkCalendar>
  <x.CalendarMark day={15} />
  <x.CalendarMark day={20} />
  <x.CalendarMark day={25} />
</GtkCalendar>
```

###### GtkLevelBar with declarative offsets

Add custom offset thresholds to a GtkLevelBar:

```tsx
<GtkLevelBar>
  <x.LevelBarOffset id="low" value={0.25} />
  <x.LevelBarOffset id="high" value={0.75} />
  <x.LevelBarOffset id="full" value={1.0} />
</GtkLevelBar>
```

###### AdwToggleGroup with declarative toggles

Build toggle groups declaratively:

```tsx
<AdwToggleGroup>
  <x.Toggle id="list" iconName="view-list-symbolic" />
  <x.Toggle id="grid" iconName="view-grid-symbolic" />
  <x.Toggle id="flow" label="Flow" />
</AdwToggleGroup>
```

###### AdwExpanderRow with row and action slots

Add nested rows and action widgets to AdwExpanderRow:

```tsx
<AdwExpanderRow title="Settings">
  <x.ActionRowPrefix><GtkImage iconName="emblem-system-symbolic" /></x.ActionRowPrefix>
  <x.ExpanderRowRow>
    <AdwActionRow title="Option 1" />
    <AdwActionRow title="Option 2" />
  </x.ExpanderRowRow>
  <x.ExpanderRowAction>
    <GtkButton iconName="list-add-symbolic" />
  </x.ExpanderRowAction>
</AdwExpanderRow>
```

###### AdwNavigationView with declarative navigation

Build navigation stacks with declarative pages and controlled history:

```tsx
const [history, setHistory] = useState(["home"]);

<AdwNavigationView history={history} onHistoryChanged={setHistory}>
  <x.NavigationPage id="home" title="Home">
    <GtkButton label="Go to Details" onClicked={() => setHistory([...history, "details"])} />
  </x.NavigationPage>
  <x.NavigationPage id="details" title="Details" canPop>
    <GtkLabel label="Details content" />
  </x.NavigationPage>
</AdwNavigationView>
```

###### Estimated item height for virtualized lists

Improve initial render and scroll behavior by providing an estimated item height:

```tsx
<x.ListView estimatedItemHeight={48} renderItem={(item) => <Row item={item} />}>
  {items.map((item) => <x.ListItem key={item.id} id={item.id} value={item} />)}
</x.ListView>

<x.TreeListView estimatedItemHeight={32} renderItem={(item, row) => <TreeRow item={item} row={row} />}>
  {/* tree items */}
</x.TreeListView>

<GtkColumnView estimatedRowHeight={56}>
  <x.ColumnViewColumn id="name" title="Name" renderCell={(item) => <GtkLabel label={item.name} />} />
  {/* list items */}
</GtkColumnView>
```

##### Breaking Changes

###### New `x` namespace for GTKX-specific elements

All GTKX-specific virtual elements and components are now consolidated under an `x` namespace for better organization and clarity. Update your imports and JSX accordingly:

```tsx
// Before
import { ActionRow, Pack, Menu, Toolbar, Notebook, StackPage, GridChild, FixedChild, ListView, GridView, TreeListView, ColumnViewColumn, ListItem, TreeListItem, SimpleListItem, OverlayChild, Slot } from "@gtkx/react";

<AdwActionRow>
  <ActionRow.Prefix><GtkCheckButton /></ActionRow.Prefix>
  <ActionRow.Suffix><GtkButton /></ActionRow.Suffix>
</AdwActionRow>

<GtkHeaderBar>
  <Pack.Start><GtkButton /></Pack.Start>
  <Pack.End><GtkMenuButton /></Pack.End>
</GtkHeaderBar>

<GtkMenuButton>
  <Menu.Section>
    <Menu.Item id="open" label="Open" onActivate={handleOpen} />
  </Menu.Section>
</GtkMenuButton>

<GtkStack visibleChildName="page1">
  <StackPage name="page1" title="First">...</StackPage>
</GtkStack>

// After
import { x } from "@gtkx/react";

<AdwActionRow>
  <x.ActionRowPrefix><GtkCheckButton /></x.ActionRowPrefix>
  <x.ActionRowSuffix><GtkButton /></x.ActionRowSuffix>
</AdwActionRow>

<GtkHeaderBar>
  <x.PackStart><GtkButton /></x.PackStart>
  <x.PackEnd><GtkMenuButton /></x.PackEnd>
</GtkHeaderBar>

<GtkMenuButton>
  <x.MenuSection>
    <x.MenuItem id="open" label="Open" onActivate={handleOpen} />
  </x.MenuSection>
</GtkMenuButton>

<GtkStack page="page1">
  <x.StackPage id="page1" title="First">...</x.StackPage>
</GtkStack>
```

###### Window close handler renamed

The `onCloseRequest` prop on window widgets has been renamed to `onClose` and simplified. The handler no longer needs to return a boolean:

```tsx
// Before
<GtkApplicationWindow onCloseRequest={() => { cleanup(); return true; }}>

// After
<GtkApplicationWindow onClose={() => { cleanup(); }}>
```

###### GtkStack and AdwViewStack API changes

The `GtkStack` and `AdwViewStack` props have been renamed for clarity:

```tsx
// Before
<GtkStack visibleChildName="page1">
  <StackPage name="page1" title="First Page">...</StackPage>
</GtkStack>

// After
<GtkStack page="page1">
  <x.StackPage id="page1" title="First Page">...</x.StackPage>
</GtkStack>
```

##### Bug Fixes

- Fixed segfault during native module cleanup when using libraries with TLS destructors (e.g., WebKit)
- Fixed test cleanup not handling SIGTERM/SIGINT properly in the testing package
- Fixed Enter key not triggering `activate` event on editable widgets in `@gtkx/testing` user events

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.13.0)

## v0.12.1 — 2026-01-05

#### Changelog

##### Added

- **Multi-architecture support**: Native binaries are now published as separate platform-specific packages (`@gtkx/native-linux-x64`, `@gtkx/native-linux-arm64`).
- **Gtk4LayerShell bindings**: Added GIR definitions for Gtk4LayerShell, enabling Wayland layer shell functionality for panels, docks, and overlays.
- **Browser demo**: New WebKit-based browser example demonstrating `WebKitWebView` with navigation controls.

##### Fixed

- **WebKit TLS segfault**: Dynamically loaded libraries (like WebKit) that spawn threads with TLS destructors are now wrapped in `ManuallyDrop` to prevent segfaults when the GTK thread exits. Libraries are reclaimed at process exit instead of being explicitly unloaded.
- **Dev server logging noise**: File change notifications are now only logged for files tracked in the Vite module graph, reducing console spam from unrelated file changes.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.12.1)

## v0.12.0 — 2026-01-04

#### Changelog

##### Breaking Changes

- **`@gtkx/native`**: Renamed `getObjectId()` function to `getNativeId()`
- **`@gtkx/testing`**: Removed `logWidget()` function (use `screen.debug()` instead)

##### New Features

- **`@gtkx/testing`**: Added `queryBy*` and `queryAllBy*` queries that return `null`/empty array instead of throwing
- **`@gtkx/testing`**: Added `screen.logRoles()` to debug screen content
- **`@gtkx/mcp`**: Added `waitForApps` option to `gtkx_list_apps` tool for waiting until an app connects

##### Improvements

- **`@gtkx/testing`**: Enhanced query error messages with widget tree context and role suggestions
- **`@gtkx/testing`**: Better error formatting

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.12.0)

## v0.11.2 — 2026-01-04

#### Changelog

##### New Features

- **MCP package**: New `@gtkx/mcp` package for agentic app interaction
- **MCP client**: Added MCP client in `@gtkx/cli` for testing GTKX applications via the MCP server
- **Screenshot utility**: New `screenshot()` function in `@gtkx/testing` for capturing widget screenshots
- **Pretty widget**: New `prettyWidget()` utility for human-readable widget tree visualization in tests
 
##### Bug Fixes

- **Fundamental types support**: Added comprehensive support for GLib fundamental types with proper reference counting (`refFunc`/`unrefFunc`)
- Fixed array handling in Rust native module for sized and fixed-length arrays

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.11.2)

## v0.11.1 — 2026-01-03

#### Changelog

##### Documentation

- Refined CLI template documentation (EXAMPLES.md, SKILL.md, WIDGETS.md)
- Updated website docs for Adwaita, async operations, error handling, lists, portals, slots, and styling
- Enhanced llms.txt for better LLM context

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.11.1)

## v0.11.0 — 2026-01-03

#### Changelog

##### New Features

- **HashTable support**: Methods using `GHashTable` now work with `Map<K, V>`
- **`waitFor` supports async callbacks**: Testing utility now accepts `async` functions
- **`isStarted()` export**: Check if GTK application is running
- **`ObjectId` type export**: Branded type for native object pointers

##### Improvements

- **Automatic exit handlers**: Apps now clean up on SIGINT, SIGTERM, uncaught exceptions, and unhandled rejections
- **Strongly typed `onNotify`**: Each widget's `onNotify` prop only accepts valid property names for that widget
- **Improved inheritance**: Props/signals from parent classes now resolve correctly through the prototype chain
- **Interface method support**: Methods from implemented GObject interfaces are now available on classes without needing explicit casting
- **Improved `getNativeObject` types**: Conditional return types for better type inference
- **`waitForElementToBeRemoved`**: Now detects if element is already removed at call time

##### Breaking Changes

- **`NativeObject.equals()` removed**: Use `isObjectEqual()` function instead
- **Cairo `FontOptions`**: Use `FontOptions.create()` instead of `new FontOptions()`
- **AsyncReadyCallback**: Generated callbacks no longer strip the `Async` suffix (e.g. `fileDialog.open` → `fileDialog.openAsync`)

- **GL module**: Removed `GL_` and `gl` prefixes from all exports
  - Constants: `GL_COLOR_BUFFER_BIT` → `COLOR_BUFFER_BIT`
  - Functions: `glClear()` → `clear()`
  - Import as namespace: `import * as gl from "@gtkx/ffi/gl"`

##### Vitest Plugin

- Simplified configuration (no `GtkxOptions` needed)
- Automatic parallelism based on system capabilities
- Improved Xvfb display management

##### CLI

- `gtkx create`: Default app ID format changed from `org.gtkx.{name}` to `com.{name}.app`

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.11.0)

## v0.10.5 — 2025-12-30

- Added `@gtkx/vitest` package - a Vitest plugin that automatically manages Xvfb displays for headless GTK testing. Each test worker gets its own isolated display.
- Enabled React concurrent mode for better rendering performance and Suspense support.
- Removed Bun package manager support from project scaffolding (`gtkx create`).
- Simplified testing setup in `gtkx create` - now only offers Vitest (with the new plugin) or no testing. Removed Jest and Node test runner options.
- Simplified test commands in generated projects - no longer need manual `xvfb-run` or environment variables.

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.10.5)

## v0.10.4 — 2025-12-30

#### Breaking Changes

- Removed declarative `<Toast>` component in favor of the programmatic `Adw.Toast` API (consistent with how dialogs work)

#### Bug Fixes

- Fixed dev server triggering full reloads for file changes outside the module graph (#38)

#### Improvements

- Added proper support for flags (bitfields) in type registration, treating them as unsigned integers instead of signed enums

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.10.4)

## v0.10.3 — 2025-12-29

#### Changelog

- Refactored signal handling to use a shared global store instead of per-node signal stores, using GTK's native signal blocking during React commits
- Fixed editable text fields (Entry, etc.) to preserve user input when the component's `text` prop differs from the current widget value, preventing unwanted overwrites during re-renders
- Updated and improved documentation for Adwaita, async operations, CLI, deployment, and error handling

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.10.3)

## v0.10.2 — 2025-12-29

#### Changelog

##### Breaking Changes

- **Removed NavigationPage virtual slot pattern** - `AdwApplicationWindow` no longer requires the `<Slot for={AdwApplicationWindow} id="content">` wrapper. Children can now be placed directly inside the window component.

  Before:
  ```tsx
  <AdwApplicationWindow onCloseRequest={quit}>
      <Slot for={AdwApplicationWindow} id="content">
          <AdwToolbarView>...</AdwToolbarView>
      </Slot>
  </AdwApplicationWindow>
  ```

  After:
  ```tsx
  <AdwApplicationWindow onCloseRequest={quit}>
      <AdwToolbarView>...</AdwToolbarView>
  </AdwApplicationWindow>
  ```

##### Removed

- `NavigationPageNode` - Custom node handler for NavigationPage
- `NavigationViewNode` - Custom node handler for NavigationView
- `ToolbarNode` - Custom node handler for Toolbar
- E2E tests for navigation-page, navigation-view, and toolbar (functionality now handled by generic widget handling)

##### Added

- `hasSingleContent` predicate for widgets with `setContent()` method
- Improved namespace handling in `isWidgetSubclass` for cross-namespace type resolution

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.10.2)

## v0.10.1 — 2025-12-29

#### Changelog

##### Added

- **GParam type support**: Added support for GParam types in the native layer, enabling property introspection and configuration

##### Fixed

- **Safe widget removal**: Ensure widgets are safely removed from their parents before being re-parented or destroyed

##### Changed

- Updated signal store implementation for improved reliability
- Improved callback wrapper handling in codegen

##### Documentation

- Added `CONTRIBUTING.md` with development guidelines

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.10.1)

## v0.10.0 — 2025-12-29

#### New Features

##### New Components

- **TreeListView**: Support for hierarchical tree lists with expand/collapse functionality
- **NavigationPage**: Adwaita navigation page component (`AdwNavigationPage`)
- **ActionRow**: Support for `AdwActionRow` with proper child handling
- **Fixed**: `GtkFixed` container for absolute positioning
- **Toast**: `AdwToast` notification support with `AdwToastOverlay`
- **NotebookPageTab**: Custom tab widgets in `GtkNotebook`

##### Developer Experience

- **Component-local HMR**: Hot module replacement now works at the component level instead of full app reload
- **ApplicationContext**: New React context providing access to the GTK Application instance
- **useApplication hook**: Access the GTK application instance from any component
- **Addable widgets**: Widgets that support GTK's `add()` method now work seamlessly

#### Performance Improvements

- **Optimized list store performance**: Faster updates for `ListView`, `GridView`, and `ColumnView`
- **Preserve cursor position**: Text inputs now preserve cursor position when updating content programmatically

##### Cairo Support

- **Cairo GObject methods**: Full support for Cairo drawing operations via the FFI layer
- **Caller-allocated strings**: Add support for strings that require caller allocation (that are needed for OpenGL)

#### Bug Fixes

- Properly set stack page titles via props
- Proper cleanup of slots when components unmount
- Proper cleanup of effects in gtk-demo examples
- Fixed GVariant handling in native layer
- Fixed Drawing Area example implementation

---

#### Breaking Changes

##### 1. GTK Widgets Now Use `Gtk` Prefix

All GTK widgets are now exported with the `Gtk` prefix to be consistent with other namespaces like `Adw`.

**Before:**

```tsx
import { Box, Button, Label } from "@gtkx/react";

<Box>
  <Button label="Click me" />
  <Label label="Hello" />
</Box>;
```

**After:**

```tsx
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/react";

<GtkBox>
  <GtkButton label="Click me" />
  <GtkLabel label="Hello" />
</GtkBox>;
```

This makes it clear which library a component comes from and aligns with the existing `Adw` prefix for Libadwaita components.

##### 3. Stricter Children Props

Components that don't support children no longer accept the `children` prop in TypeScript. This may cause type errors if you were passing children to widgets that ignore them.

##### 4. Stack and Notebook Children

Stack and Notebook pages now use dedicated wrapper components:

- Use `<StackPage>` for `GtkStack` children
- Use `<NotebookPage>` for `GtkNotebook` children

**Before:**

```tsx
<GtkStack>
  <GtkBox name="page1" title="Page 1">
    ...
  </GtkBox>
</GtkStack>
```

**After:**

```tsx
<GtkStack>
  <StackPage name="page1" title="Page 1">
    <GtkBox>...</GtkBox>
  </StackPage>
</GtkStack>
```

---

#### Documentation

- Updated deployment guide for Flatpak and Snap packaging
- Rewritten TypeScript documentation (TSDocs)
- Website refresh with updated examples

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.10.0)

## v0.9.4 — 2025-12-19

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.9.3...v0.9.4

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.9.4)

## v0.9.3 — 2025-12-19

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.9.2...v0.9.3

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.9.3)

## v0.9.2 — 2025-12-19

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.9.1...v0.9.2

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.9.2)

## v0.9.1 — 2025-12-19

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.9.0...v0.9.1

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.9.1)

## v0.9.0 — 2025-12-18

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.8.0...v0.9.0

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.9.0)

## v0.8.0 — 2025-12-18

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.7.0...v0.8.0

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.8.0)

## v0.7.0 — 2025-12-16

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.6.1...v0.7.0

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.7.0)

## v0.6.1 — 2025-12-15

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.5.2...v0.6.1

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.6.1)

## v0.6.0 — 2025-12-15

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.5.2...v0.6.0

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.6.0)

## v0.5.2 — 2025-12-14

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.5.0...v0.5.2

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.5.2)

## v0.5.1 — 2025-12-13

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.5.0...v0.5.1

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.5.1)

## v0.5.0 — 2025-12-12

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.4.3...v0.5.0

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.5.0)

## v0.4.3 — 2025-12-11

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.4.1...v0.4.3

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.4.3)

## v0.4.1 — 2025-12-11

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.3.5...v0.4.1

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.4.1)

## v0.4.0 — 2025-12-11

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.3.5...v0.4.0

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.4.0)

## v0.3.5 — 2025-12-11

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.3.4...v0.3.5

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.3.5)

## v0.3.4 — 2025-12-10

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.3.1...v0.3.4

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.3.4)

## v0.3.3 — 2025-12-10

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.3.1...v0.3.3

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.3.3)

## v0.3.2 — 2025-12-10

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.3.1...v0.3.2

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.3.2)

## v0.3.1 — 2025-12-10

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.3.0...v0.3.1

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.3.1)

## v0.3.0 — 2025-12-10

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.2.7...v0.3.0

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.3.0)

## v0.2.7 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.2.6...v0.2.7

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.2.7)

## v0.2.6 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.2.5...v0.2.6

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.2.6)

## v0.2.5 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.2.4...v0.2.5

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.2.5)

## v0.2.4 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.2.3...v0.2.4

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.2.4)

## v0.2.3 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.2.1...v0.2.3

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.2.3)

## v0.2.2 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.2.1...v0.2.2

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.2.2)

## v0.2.1 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.2.0...v0.2.1

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.2.1)

## v0.2.0 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.54...v0.2.0

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.2.0)

## v0.1.54 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.53...v0.1.54

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.54)

## v0.1.53 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.52...v0.1.53

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.53)

## v0.1.52 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.51...v0.1.52

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.52)

## v0.1.51 — 2025-12-09

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.50...v0.1.51

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.51)

## v0.1.50 — 2025-12-08

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.49...v0.1.50

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.50)

## v0.1.49 — 2025-12-08

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.48...v0.1.49

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.49)

## v0.1.48 — 2025-12-08

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.47...v0.1.48

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.48)

## v0.1.47 — 2025-12-07

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.46...v0.1.47

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.47)

## v0.1.46 — 2025-12-07

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.45...v0.1.46

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.46)

## v0.1.45 — 2025-12-07

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.44...v0.1.45

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.45)

## v0.1.44 — 2025-12-07

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.43...v0.1.44

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.44)

## v0.1.43 — 2025-12-07

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.42...v0.1.43

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.43)

## v0.1.42 — 2025-12-07

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.41...v0.1.42

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.42)

## v0.1.41 — 2025-12-07

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.40...v0.1.41

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.41)

## v0.1.40 — 2025-12-06

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.38...v0.1.40

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.40)

## v0.1.38 — 2025-12-06

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.37...v0.1.38

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.38)

## v0.1.37 — 2025-12-06

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.36...v0.1.37

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.37)

## v0.1.36 — 2025-12-06

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.35...v0.1.36

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.36)

## v0.1.35 — 2025-12-05

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.34...v0.1.35

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.35)

## v0.1.34 — 2025-12-05

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.33...v0.1.34

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.34)

## v0.1.33 — 2025-12-05

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.32...v0.1.33

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.33)

## v0.1.32 — 2025-12-04

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.31...v0.1.32

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.32)

## v0.1.31 — 2025-12-04

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.30...v0.1.31

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.31)

## v0.1.30 — 2025-12-04

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.29...v0.1.30

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.30)

## v0.1.29 — 2025-12-04

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.28...v0.1.29

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.29)

## v0.1.28 — 2025-12-03

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.27...v0.1.28

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.28)

## v0.1.27 — 2025-12-03

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.26...v0.1.27

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.27)

## v0.1.26 — 2025-12-03

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.25...v0.1.26

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.26)

## v0.1.25 — 2025-12-03

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.23...v0.1.25

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.25)

## v0.1.24 — 2025-12-03

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.23...v0.1.24

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.24)

## v0.1.23 — 2025-12-03

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.22...v0.1.23

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.23)

## v0.1.22 — 2025-12-03

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.21...v0.1.22

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.22)

## v0.1.21 — 2025-12-02

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.20...v0.1.21

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.21)

## v0.1.20 — 2025-12-02

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.19...v0.1.20

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.20)

## v0.1.19 — 2025-12-02

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.18...v0.1.19

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.19)

## v0.1.18 — 2025-11-30

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.17...v0.1.18

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.18)

## v0.1.17 — 2025-11-30

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.16...v0.1.17

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.17)

## v0.1.16 — 2025-11-30

**Full Changelog**: https://github.com/eugeniodepalo/gtkx/compare/v0.1.13...v0.1.16

[Release notes on GitHub](https://github.com/gtkx-org/gtkx/releases/tag/v0.1.16)
