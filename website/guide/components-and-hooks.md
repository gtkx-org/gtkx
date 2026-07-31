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

Give your `ListItem`s `children` and the same component renders a tree with expander arrows. Add `expandedIds`/`onExpandedChange` on top of that to drive expansion from React state. Cell recycling still happens natively; your `renderItem` output is rendered into the factory-created containers through portals, so React state inside a cell behaves normally.

To group rows under headers, pass `sections` in place of `items`. Each `ListSection` holds its own `data` array of `ListItem`s, and `renderHeader` draws the header shown above each group. `ColumnView` and `DropDown` accept the same pair.

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

`ColumnView<T, S>` wraps `Gtk.ColumnView`, the multi-column table. Columns are declared through the `columns` prop, an array of `ColumnViewColumn` objects, each with a required `id` and `title`, its own `renderCell`, and optional presentation props like `sortable` and `expand`. Sorting is controlled: clicking a sortable header calls `onSortChanged(column, order)`, and you sort `items` yourself before passing them in, so the view always matches your data:

```tsx
import { ColumnView, type ColumnViewColumn } from "@gtkx/components";
import { GtkLabel } from "@gtkx/jsx/gtk";

const columns: ColumnViewColumn<Employee>[] = [
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

Typing the array as `ColumnViewColumn<Employee>[]` binds every `renderCell` callback to the view's item type, so the `item` argument is inferred as `Employee` without annotating each callback.

### DropDown

`DropDown<T, S>` wraps `Gtk.DropDown`, which in raw GTK4 requires a model plus separate factories (the button face, the popup rows, and popup section headers). Here it is `items` plus controlled single selection, or `sections` plus `renderHeader` when the popup rows should be grouped. `renderItem` draws both the button and the popup rows, `renderListItem` overrides the popup rows separately, and with no renderer at all each value is shown as a label, verbatim when it is a string and as JSON otherwise:

```tsx
import { DropDown } from "@gtkx/components";

<DropDown
    items={SOURCE_TYPES.map((type) => ({ id: type, value: type }))}
    selectedId={sourceType}
    onSelectionChanged={(id) => setSourceType(id)}
/>
```

`ComboRow<T, S>` from `@gtkx/components/adw` takes the same collection props and renders an `Adw.ComboRow`, presenting the choice as a row inside a preferences group, as the tutorial's [preferences chapter](/tutorial/preferences-and-theming) does:

```tsx
import { ComboRow } from "@gtkx/components/adw";

<ComboRow
    title="Theme"
    items={THEMES.map((theme) => ({ id: theme, value: theme }))}
    selectedId={theme}
    onSelectionChanged={(id) => setTheme(id)}
/>
```

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

### GtkSizeGroup

`Gtk.SizeGroup` keeps widgets scattered across the tree at a common width, height, or both (`mode: Gtk.SizeGroupMode`). It contributes no widget of its own, so it can sit anywhere in the tree; its `widgets` prop holds the members, which join and leave the group as the array changes:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkSizeGroup } from "@gtkx/jsx/gtk";
import { useState } from "react";

function Grouped() {
    const [short, setShort] = useState<Gtk.Button | null>(null);
    const [long, setLong] = useState<Gtk.Button | null>(null);

    return (
        <GtkBox>
            <GtkSizeGroup mode={Gtk.SizeGroupMode.HORIZONTAL} widgets={short && long && [short, long]} />
            <GtkButton ref={setShort} label="Short" />
            <GtkButton ref={setLong} label="A much longer label" />
        </GtkBox>
    );
}
```

Members are compared by identity, so a fresh array on every render costs nothing as long as the widgets themselves are stable. Members do not have to be siblings: any widget you hold a reference to can join, whichever container it lives in.

### GtkConstraintLayout

`Gtk.ConstraintLayout` solves a system of linear relations to place its children. It goes on a container's `layoutManager` prop and takes three props of its own: `constraints` holds `GtkConstraint` elements, `guides` holds `GtkConstraintGuide` elements, and `vfl` takes Visual Format Language blocks.

A `GtkConstraint` names two participants: `target` and `source`, each a `Gtk.ConstraintTarget`, which is any widget or guide. Leaving `source` out (or passing `null`) means the widget that owns the layout, and leaving both `source` and `sourceAttribute` out makes the relation a constant. `relation` defaults to equality, `multiplier` to 1, `constant` to 0, and `strength` to required.

Targets are objects rather than names, so capture them in state and render the constraints once they resolve. Below, a constraint pins the button's start edge 8 pixels from the container's:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkConstraint, GtkConstraintLayout } from "@gtkx/jsx/gtk";
import { useState } from "react";

function Constrained() {
    const [button, setButton] = useState<Gtk.Button | null>(null);

    return (
        <GtkBox
            layoutManager={
                <GtkConstraintLayout
                    constraints={button && (
                        <GtkConstraint
                            target={button}
                            targetAttribute={Gtk.ConstraintAttribute.START}
                            sourceAttribute={Gtk.ConstraintAttribute.START}
                            constant={8}
                        />
                    )}
                />
            }
        >
            <GtkButton ref={setButton} label="Constrained" />
        </GtkBox>
    );
}
```

Every `GtkConstraint` property is construct-only in GTK4, so a constraint cannot be edited in place. Give the element a `key` that changes with whatever varies and React builds a new one; changing a construct-only prop without changing the key throws instead of silently doing nothing.

`GtkConstraintGuide` is an invisible spacer with `minWidth`/`minHeight`, `natWidth`/`natHeight`, `maxWidth`/`maxHeight`, and a `strength` for its natural size. Its properties are ordinary, so it updates in place, and its object works as the `target` or `source` of a constraint.

A `vfl` block is `{ lines, hspacing, vspacing, views }`, where `views` maps the names used in the description to targets. The block is compared field by field and `views` by identity, so memoize the map, otherwise every render tears the parsed constraints down and rebuilds them:

```tsx
const views = useMemo(
    () => (a === null || b === null ? null : new Map<string, Gtk.ConstraintTarget>([["a", a], ["b", b]])),
    [a, b],
);

<GtkBox
    layoutManager={
        <GtkConstraintLayout vfl={views && [{ lines: ["H:|-[a(==b)]-12-[b]-|"], hspacing: 8, vspacing: 8, views }]} />
    }
>
```

`examples/gtk-demo` has three worked demos under `src/demos/constraints`: a static layout with a guide, an interactive one whose divider follows a drag gesture, and a VFL version of the same arrangement.

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

On React 19.2, keeping the latest handler does not work inside a component wrapped in `memo` or `forwardRef`: every emission runs the handler captured on the first render, so props and state the handler closes over stay frozen at their mount values. React refreshes the handler only for plain function components on that line, and fixes the other two on the 19.3 line. Until then, either leave the component that calls `useSignal` unwrapped, or read what the handler needs off the GObject rather than from the enclosing closure:

```ts
useSignal(adjustment, "value-changed", () => {
    setPosition(adjustment.value);
});
```

## Next

Continue with [Modals and Portals](/guide/modals-and-portals) for the mounting model behind these components: `createPortal`, the `rootElement` container, and extra windows. The worked dialog walkthrough lives in the tutorial's [Menus, Accelerators, and Shortcuts](/tutorial/actions-menus-shortcuts#mounting-dialogs) chapter.
