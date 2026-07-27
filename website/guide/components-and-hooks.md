---
title: "Components and Hooks"
description: "A map of the high-level components in @gtkx/components and the hooks exported by @gtkx/react."
---

# Components and Hooks

Most of what GTKX offers reaches you through the intrinsic elements codegen generates. Some widgets carry an imperative API that does not map onto props alone: a model plus factories, an attach call with coordinates, a size group you join from elsewhere in the tree. `@gtkx/components` is a hand-written layer that gives those a declarative shape, and `@gtkx/react` ships the hooks that bridge GObject state into React.

`@gtkx/components` is a separate install:

```bash
npm install @gtkx/components@rc
```

The hooks in [Hooks](#hooks) below come from `@gtkx/react`, which every GTKX project already has.

## List components

### ListView

`ListView<T, S>` wraps `Gtk.ListView` and removes its `model`, `factory`, and `headerFactory` props: you pass data and a renderer instead. Selection is controlled, so `selectedIds` and `onSelectionChanged` keep it in React state:

```tsx
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";

<ListView<Task>
    items={tasks.map((task) => ({ id: task.id, value: task }))}
    selectionMode={Gtk.SelectionMode.MULTIPLE}
    selectedIds={selectedIds}
    onSelectionChanged={setSelectedIds}
    estimatedItemHeight={56}
    renderItem={({ item }) => <GtkLabel halign={Gtk.Align.START}>{item.title}</GtkLabel>}
/>
```

Give your `Item`s `children` and the same component renders a tree with expander arrows. Add `expandedIds`/`onExpandedChange` on top of that to drive expansion from React state. Cell recycling still happens natively; your `renderItem` output is rendered into the factory-created containers through portals, so React state inside a cell behaves normally.

To group rows under headers, pass `sections` in place of `items`. Each `Section` holds its own `data` array of `Item`s, and `renderHeader` draws the header shown above each group. `ColumnView` and `DropDown` accept the same pair.

### GridView

`GridView<T>` applies the same treatment to `Gtk.GridView`, the icon-grid counterpart: `items`, `renderItem`, controlled selection, and size estimates, with intrinsic props like `minColumns`, `maxColumns`, and `singleClickActivate` passing straight through. The minesweeper demo in `examples/gtk-demo` renders its board this way:

```tsx
import { GridView } from "@gtkx/components";
import { GtkLabel } from "@gtkx/jsx/gtk";

<GridView
    estimatedItemHeight={32}
    minColumns={GRID_SIZE}
    maxColumns={GRID_SIZE}
    singleClickActivate
    onActivate={(position) => handleCellClick(position)}
    items={board.map((cell) => ({ id: cell.id, value: cell }))}
    renderItem={({ item }) => <GtkLabel>{getCellDisplay(item)}</GtkLabel>}
/>
```

### ColumnView

`ColumnView<T, S>` wraps `Gtk.ColumnView`, the multi-column table. Columns are declared through the `columns` prop, an array of `Column` objects, each with a required `id` and `title`, its own `renderCell`, and optional presentation props like `sortable` and `expand`. Sorting is controlled: clicking a sortable header calls `onSortChanged(column, order)`, and you sort `items` yourself before passing them in, so the view always matches your data:

```tsx
import { ColumnView, type Column } from "@gtkx/components";
import { GtkLabel } from "@gtkx/jsx/gtk";

const columns: Column<Employee>[] = [
    {
        id: "name",
        title: "Name",
        expand: true,
        sortable: true,
        renderCell: ({ item }) => <GtkLabel>{item.name}</GtkLabel>,
    },
];

<ColumnView
    sortColumn={sortColumn}
    sortOrder={sortOrder}
    onSortChanged={handleSortChange}
    items={sortedEmployees.map((emp) => ({ id: emp.id, value: emp }))}
    columns={columns}
/>
```

Typing the array as `Column<Employee>[]` binds every `renderCell` callback to the view's item type, so the `item` argument is inferred as `Employee` without annotating each callback.

### DropDown

`DropDown<T, S>` wraps `Gtk.DropDown`, which in raw GTK4 requires a model plus separate factories (the button face, the popup rows, and popup section headers). Here it is `items` plus controlled single selection, or `sections` plus `renderHeader` when the popup rows should be grouped. `renderItem` draws both the button and the popup rows, `renderListItem` overrides the popup rows separately, and with no renderer at all each value is shown as a label via `String(value)`:

```tsx
import { DropDown } from "@gtkx/components";

<DropDown
    items={SOURCE_TYPES.map((type) => ({ id: type, value: type }))}
    selectedId={sourceType}
    onSelectionChanged={(id) => setSourceType(id)}
/>
```

The backing widget comes from the `component` prop. Leave it out for a plain `Gtk.DropDown`, or pass `AdwComboRow` to present the same choice as a row inside a preferences group, as the tutorial's [preferences chapter](/tutorial/preferences-and-theming) does.

## Layout components

### Grid and GtkGridLayoutChild

`Gtk.Grid` positions each child through the `Gtk.GridLayoutChild` its layout manager creates. `GtkGridLayoutChild` wraps one child and carries that placement: `column`, `row`, `columnSpan`, and `rowSpan`. Changing a cell moves the widget in place, without reparenting it:

```tsx
import { GtkGrid, GtkGridLayoutChild, GtkLabel } from "@gtkx/jsx/gtk";

<GtkGrid columnSpacing={10} rowSpacing={10}>
    <GtkGridLayoutChild column={0} row={3}>
        <GtkLabel xalign={0}>Foreground</GtkLabel>
    </GtkGridLayoutChild>
</GtkGrid>
```

A child placed without a wrapper lands at column 0, row 0. The same shape recurs for `GtkOverlay` and `GtkFixed` below: the wrapper carries the placement, its single child is the widget.

### Overlay and GtkOverlayLayoutChild

`Gtk.Overlay` has two child slots. Regular children form the main content, and the `overlays` prop stacks widgets on top of it. `measure` opts an overlay into the size negotiation and `clipOverlay` clips it to the main child's allocation:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkEntry, GtkGrid, GtkOverlay, GtkOverlayLayoutChild } from "@gtkx/jsx/gtk";

<GtkOverlay
    overlays={
        <GtkOverlayLayoutChild measure>
            <GtkEntry halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER} />
        </GtkOverlayLayoutChild>
    }
>
    <GtkGrid>{buttons}</GtkGrid>
</GtkOverlay>
```

### Fixed and GtkFixedLayoutChild

`Gtk.Fixed` is the manual-positioning container: every child's position is a `Gsk.Transform` on its `Gtk.FixedLayoutChild`, so a plain translation places a widget at a point and a richer transform rotates, scales, or projects it:

```tsx
import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";
import { GtkFixed, GtkFixedLayoutChild, GtkLabel } from "@gtkx/jsx/gtk";

<GtkFixed>
    <GtkFixedLayoutChild transform={Gsk.Transform.new().translate(Graphene.Point.create(20, 40))}>
        <GtkLabel>Placed at a point</GtkLabel>
    </GtkFixedLayoutChild>
    <GtkFixedLayoutChild transform={Gsk.Transform.new().rotate(45)}>
        <GtkLabel>Rotated</GtkLabel>
    </GtkFixedLayoutChild>
</GtkFixed>
```

In `examples/gtk-demo`, `fixed.tsx` assembles a 3D cube from six perspective-transformed faces, and `fixed2.tsx` animates a rotating label per frame from the widget's frame clock.

### SizeGroup and SizeGroup.Child

`SizeGroup` manages a `Gtk.SizeGroup`, which keeps widgets scattered across the tree at a common width, height, or both (`mode: Gtk.SizeGroupMode`). Each `SizeGroup.Child` names the widget to add to the group; membership follows the React tree, so a `SizeGroup.Child` nested anywhere under the `SizeGroup` joins it:

```tsx
import { SizeGroup } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton } from "@gtkx/jsx/gtk";

<SizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL}>
    <SizeGroup.Child component={GtkButton} label="Short" />
    <SizeGroup.Child component={GtkButton} label="A much longer label" />
</SizeGroup>
```

`SizeGroup.Child` forwards its `ref`, so a member can still be captured when you also need the widget instance for something else (a `mnemonicWidget` target, for example). The `component` prop accepts high-level components such as `DropDown` as well as intrinsic elements.

### ConstraintLayout

`ConstraintLayout` builds a `Gtk.ConstraintLayout` for a container's `layoutManager` prop, replacing manual `Gtk.Constraint` and `Gtk.ConstraintGuide` construction. Widgets are referenced by their `name` prop, with `"super"` (or an omitted `target`/`source`) meaning the container itself. Referencing an unknown name throws with a message telling you which `name` to set.

- `ConstraintLayout.Constraint` declares one relation.
- `ConstraintLayout.Guide` declares an invisible spacer with min, natural, and max sizes.
- `ConstraintLayout.Vfl` applies Visual Format Language `lines`.

Below, a constraint pins the button's start edge 8 pixels from the container's, leaving `source` omitted so it resolves to the container:

```tsx
import { ConstraintLayout } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";

<GtkBox
    layoutManager={
        <ConstraintLayout>
            <ConstraintLayout.Constraint
                target="button1"
                targetAttribute={Gtk.ConstraintAttribute.START}
                sourceAttribute={Gtk.ConstraintAttribute.START}
                constant={8}
            />
        </ConstraintLayout>
    }
>
    <GtkButton name="button1" label="Constrained" />
</GtkBox>
```

## Hooks

**`useApplication(): Gtk.Application`** returns the running application object from the nearest application element, and throws when called outside one. Use it for application-level imperative calls such as `sendNotification` or `addAction`.

**`useParentWindow(): Gtk.Window | null`** returns the nearest ancestor window, or `null` when there is none. See [Finding the parent window](/guide/modals-and-portals#finding-the-parent-window).

**`useProperty(object, propertyName)`** subscribes to a GObject property and returns its current value, re-rendering on change and returning `undefined` while the object is unresolved. The name is the camelCase property name, completed and typed from the bindings, and the notify detail it listens on is derived from it. It bridges GObject property state into React state: `const formats = useProperty(clipboard, "formats")` re-renders whenever the clipboard's available formats change.

**`useSetting(schema, key): [value, setValue]`** reads and writes one key of a GSettings schema, re-rendering when the stored value changes from anywhere (including another window or `dconf`). The `schema` is the typed `SettingsSchema` you get by importing a `.gschema.xml` file, so the value type and the setter are inferred per key:

```ts
import { useSetting } from "@gtkx/react";
import schema from "#data/com.gtkx.tutorial.gschema.xml";

const [sortOrder, setSortOrder] = useSetting(schema, "sort-order");
```

**`useBindSetting({ schema, key, object, property, flags? })`** goes one step further and binds a setting directly to a GObject property with `Gio.Settings.bind`, using `Gio.SettingsBindFlags.DEFAULT` unless you pass flags. No renders are involved: GLib keeps the two in sync natively while the object is mounted. The Tasks app persists its window geometry this way:

```ts
useBindSetting({ schema, key: "window-width", object: windowRef, property: "defaultWidth" });
useBindSetting({ schema, key: "window-height", object: windowRef, property: "defaultHeight" });
```

**`useSignal(object, signal, handler, options?)`** connects a handler to any GObject signal for the component's lifetime, reconnecting if the object changes and keeping the latest handler without re-subscribing. Signal names are typed from the bindings, including detailed forms like `"notify::label"`. The handler receives the signal's own arguments and nothing else: unlike a JSX `on*` prop, it is not passed the emitting object, which you already hold. Options are `after` (run after the default handler) and `immediate` (invoke once right after connecting, useful for syncing initial state):

```ts
import { useSignal } from "@gtkx/react";

useSignal(windowRef, "notify::fullscreened", () => setFullscreened(windowRef.current?.isFullscreen() ?? false), {
    immediate: true,
});
```

## Next

Continue with [Modals and Portals](/guide/modals-and-portals) for the mounting model behind these components: `createPortal`, the `rootElement` container, and extra windows. The worked dialog walkthrough lives in the tutorial's [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts#mounting-dialogs) chapter.
