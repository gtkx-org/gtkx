---
description: "An AdwPreferencesDialog bound two-way to GSettings keys, libadwaita color schemes, and app styling with @gtkx/css."
---

# Preferences and Theming

Every GNOME app ships a Preferences dialog, and Tasks is no exception: a `<Ctrl>,` shortcut opens an `AdwPreferencesDialog` where you pick a theme, choose the default sort order, and set the reminder lead time. This page walks through `preferences.tsx`, the typed gschema module that backs every row, the `theme.ts` helper that pushes the color scheme into libadwaita, and the `@gtkx/css` stylesheet the rest of the app draws on. The through-line is two-way data binding: each row reads and writes a GSettings key, and the app reacts to those keys.

## The preferences dialog is an Adw.Dialog, not a window

The whole surface is one component. It mounts when `app.tsx` flips `showPreferences` to `true` and renders `<Preferences onClose={...} />`:

```tsx
import { ComboRow, Dialog } from "@gtkx/components/adw";
import { AdwPreferencesDialog, AdwPreferencesGroup, AdwPreferencesPage, AdwSpinRow } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { useSetting } from "@gtkx/react";
import schema from "#data/com.gtkx.tutorial.gschema.xml";

export const Preferences = ({ onClose }: { onClose: () => void }) => {
    // ...
    return (
        <Dialog>
            <AdwPreferencesDialog title="Preferences" onClosed={onClose}>
                {/* pages */}
            </AdwPreferencesDialog>
        </Dialog>
    );
};
```

`AdwPreferencesDialog` is an `Adw.Dialog` subclass, not an `Adw.Window`. An Adw.Dialog is not shown by adding it to a tree: you call `present(parent)` on it, and it renders as an adaptive sheet (a centered floating dialog on desktop, a bottom sheet when the window is narrow). That imperative lifecycle is exactly what the `Dialog` wrapper from `@gtkx/components/adw` automates.

`Dialog` takes a single child that exposes a ref to something presentable, portals it to the root, and brackets its lifetime with the two dialog methods:

```tsx
// packages/components/src/dialog.tsx
useLayoutEffect(() => {
    if (!dialog) return;
    dialog.present(resolvedParent);
    return () => dialog.forceClose();
}, [dialog, resolvedParent]);
// ...
return createPortal(cloneElement(element, { ref: mergedRef }), rootElement);
```

So mounting `<Dialog>` calls `present` on the parent window (resolved automatically via `useParentWindow`), and unmounting calls `forceClose`, which dismisses the dialog without triggering any close confirmation. The `createPortal(..., rootElement)` part matters: the dialog is rendered at the top level of the render tree, not nested inside whatever component happens to be showing it, which is how detached windows and dialogs are meant to mount in gtkx.

The `onClosed={onClose}` handler closes the React loop. When you press Escape or click away, `AdwPreferencesDialog` emits `closed`, `onClosed` fires, and `onClose` sets `showPreferences` back to `false`. That unmounts `<Preferences>`, and the cleanup above runs `forceClose` for good measure.

::: info AdwDialog vs AdwWindow
Older libadwaita code used `AdwPreferencesWindow` and `AdwWindow` subclasses that you toggled with a `visible` prop or `transient-for`. The `Adw.Dialog` family (since libadwaita 1.5) replaced that: dialogs are adaptive by default and are driven with `present`/`close`, which is why gtkx wraps them in a lifecycle component rather than a visibility prop.
:::

## The preferences tree

Inside the dialog the structure is the standard three-level Adwaita preferences hierarchy: a page holds groups, and groups hold rows.

```tsx
<AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
    <AdwPreferencesGroup title="Appearance">
        <ComboRow<string> title="Theme" /* ... */ />
    </AdwPreferencesGroup>
    <AdwPreferencesGroup title="Tasks">
        <ComboRow<string> title="Sort order" /* ... */ />
        <AdwSpinRow title="Reminder lead time" /* ... */ />
    </AdwPreferencesGroup>
</AdwPreferencesPage>
```

`AdwPreferencesPage.iconName` gives the page a view-switcher icon (only visible once you add a second page); the group titles ("Appearance", "Tasks") render as the bold section headers you see stacked down the dialog. Each row is a self-contained control bound to one setting.

## Two-way binding with useSetting

Every row in this dialog is controlled by a GSettings key, read and written through `useSetting`. The hook returns a `[value, setValue]` tuple, value first:

```tsx
const [scheme, setScheme] = useSetting(schema, "color-scheme");
const [sortOrder, setSortOrder] = useSetting(schema, "sort-order");
const [reminderMinutes, setReminderMinutes] = useSetting(schema, "reminder-minutes");
```

Reading is live and writing persists: `setScheme("dark")` writes through `Gio.Settings` to dconf, and because the hook also subscribes to the key's `changed::color-scheme` signal, any writer (this dialog, another window, even `gsettings set` on the command line) re-renders every component that reads the key. Nothing else in the app has to be told the value changed.

The `ComboRow` for the theme wires its selection straight to the setter:

```tsx
<ComboRow<string>
    title="Theme"
    items={[
        { id: "default", value: "Follow system" },
        { id: "light", value: "Light" },
        { id: "dark", value: "Dark" },
    ]}
    selectedId={scheme}
    onSelectionChanged={(id) => {
        if (isScheme(id)) setScheme(id);
    }}
/>
```

`ComboRow` (from `@gtkx/components/adw`) is the declarative wrapper over `AdwComboRow`: instead of building a `Gio.ListModel` and a `GtkListItemFactory` by hand, you pass `items` as `{ id, value }` nodes. The `id` is the stable key persisted to the setting; the `value` is what shows in the row (here a plain string, rendered as a label by default). `selectedId={scheme}` makes it controlled, and `onSelectionChanged` hands back the selected `id`.

That `id` arrives typed as a bare `string`, which is why the type guards exist:

```tsx
type Scheme = "default" | "light" | "dark";
const isScheme = (value: string): value is Scheme => value === "default" || value === "light" || value === "dark";
```

`setScheme` is typed to the setting's string-union type (see below), so the guard narrows the raw `string` from the combo row back into `Scheme` before the write. The `sort-order` row follows the identical pattern with `isSort` and its four nicks.

The reminder row is a spin button rather than a combo:

```tsx
<AdwSpinRow
    title="Reminder lead time"
    subtitle="Minutes before a task is due"
    adjustment={
        <GtkAdjustment value={reminderMinutes} lower={0} upper={1440} stepIncrement={5} />
    }
    onNotifyValue={(value) => setReminderMinutes(value ?? 30)}
/>
```

`AdwSpinRow` needs a `Gtk.Adjustment` to define its numeric range, and gtkx lets you pass one as a JSX element into the object-valued `adjustment` prop: `lower`/`upper` bound the value at 0 to 1440 minutes (a full day) and `stepIncrement={5}` is the click step. There is no `onChanged`-style signal for the number here; instead you listen to the property notification `onNotifyValue`, which fires whenever the row's `value` property changes. Notify handlers receive `value | null`, so the `value ?? 30` guards the null case before writing back the integer setting.

## The typed gschema module

The `schema` object threaded into every `useSetting` call comes from a single import:

```tsx
import schema from "#data/com.gtkx.tutorial.gschema.xml";
```

You never hand-write a schema descriptor. `gtkx dev`/`build` parse `data/com.gtkx.tutorial.gschema.xml` and generate a typed module for it, so `schema` carries the id, path, and the value type of every key. That is what makes `useSetting(schema, "color-scheme")` return a strongly typed tuple and reject an undeclared key at compile time.

Here is the relevant slice of the XML the rows bind to:

```xml
<enum id="com.gtkx.tutorial.SortOrder">
  <value nick="manual" value="0"/>
  <value nick="due-date" value="1"/>
  <value nick="title" value="2"/>
  <value nick="created" value="3"/>
</enum>
<schema id="com.gtkx.tutorial" path="/com/gtkx/tutorial/">
  <key name="sort-order" enum="com.gtkx.tutorial.SortOrder">
    <default>'manual'</default>
  </key>
  <key name="color-scheme" type="s">
    <choices>
      <choice value="default"/>
      <choice value="light"/>
      <choice value="dark"/>
    </choices>
    <default>'default'</default>
  </key>
  <key name="reminder-minutes" type="i">
    <range min="0" max="1440"/>
    <default>30</default>
  </key>
</schema>
```

Two ways to constrain a string key are on display here, and the tutorial uses both deliberately:

- **Enum key** (`sort-order`): references a top-level `<enum>` through `enum="..."`. The `<value>` entries pair a `nick` (the string that round-trips) with an integer. The `<default>` must be one of the nicks, single-quoted.
- **Inline choices** (`color-scheme`): lists allowed values inline with `<choices>`. No separate enum declaration, no integer mapping.

Both forms produce a key whose underlying GVariant type is `s` (a string), and gtkx narrows both to a literal string union in the generated types. So `color-scheme` becomes `"default" | "light" | "dark"` and `sort-order` becomes `"manual" | "due-date" | "title" | "created"`, and the values round-trip as raw strings (through `get_string`/`set_string`, not `get_enum`). That union is precisely what the `isScheme`/`isSort` guards narrow into.

`reminder-minutes` is `type="i"` with a `<range>`, so it types as a plain `number`, which is why its setter takes the adjustment's numeric `value`.

::: tip Recompiling the schema
GSettings needs `gschemas.compiled` before it can read a schema. Under `gtkx dev`/`build` this is automatic: the CLI stages the `.gschema.xml`, runs `glib-compile-schemas`, and recompiles on save. You only run `glib-compile-schemas` by hand if you point a raw GTK binary at a schema directory outside the gtkx toolchain.
:::

## Applying the color scheme

Persisting `color-scheme` is only half the job; something has to turn `"dark"` into an actually-dark UI. libadwaita centralizes light/dark on `Adw.StyleManager`, a process-wide singleton the application owns. The `theme.ts` helper is the entire bridge:

```ts
import * as Adw from "@gtkx/gi/adw";

export const applyColorScheme = (value: string): void => {
    const manager = Adw.StyleManager.getDefault();
    const scheme =
        value === "light"
            ? Adw.ColorScheme.FORCE_LIGHT
            : value === "dark"
              ? Adw.ColorScheme.FORCE_DARK
              : Adw.ColorScheme.DEFAULT;
    manager.setColorScheme(scheme);
};
```

`Adw.StyleManager.getDefault()` returns the default manager, and `setColorScheme` takes an `Adw.ColorScheme` enum: `FORCE_LIGHT`/`FORCE_DARK` override the system, `DEFAULT` follows it (so "Follow system" tracks the desktop's dark-style preference). This is imperative GObject code, imported from `@gtkx/gi/adw` (the raw GI classes and enums) rather than the JSX components. There is no React element for a process-wide manager, so you reach for the live object.

The reactive glue lives in `app.tsx`, which reads the same setting and re-applies the scheme whenever it changes:

```tsx
const [colorScheme] = useSetting(schema, "color-scheme");

useEffect(() => {
    applyColorScheme(colorScheme);
}, [colorScheme]);
```

Because `useSetting` re-renders on the `changed::color-scheme` signal, choosing a theme in the preferences dialog updates `colorScheme` here, the effect re-runs, and libadwaita swaps the palette instantly, no manual event plumbing between the dialog and the app root.

## Custom styling with @gtkx/css

Beyond the theme toggle, Tasks styles a handful of its own widgets. `@gtkx/css` gives you a `css` tagged template that returns a generated CSS class name, which you then feed into a widget's `cssClasses` array. The app's shared styles live in `styles.ts`:

```ts
import { css } from "@gtkx/css";

export const listDot = (color: string): string => css`
    min-width: 12px;
    min-height: 12px;
    border-radius: 9999px;
    background: ${color};
`;

export const addRow = css`
    background: alpha(@accent_bg_color, 0.08);
`;

export const dueLabel = css`
    font-size: 0.9em;
`;

export const detailNotes = css`
    padding: 6px;
    min-height: 160px;
`;
```

`css` returns a string like `gtkx-1a2b3c`, a class name. There is no `className` prop anywhere in gtkx; you pass the class into the universal `cssClasses` prop, which every widget exposes as `string[]`. The sidebar uses `listDot` to give each list a colored dot:

```tsx
<GtkBox
    valign={Gtk.Align.CENTER}
    cssClasses={[listDot(entry.color)]}
    accessibleRole={Gtk.AccessibleRole.PRESENTATION}
/>
```

When you need to merge or conditionally combine classes, `@gtkx/css` also exports `cx`: it drops falsy entries and returns a `string[]` ready to spread into `cssClasses`, for example `cssClasses={cx(base, active && activeStyle)}`.

Two GTK-specific idioms show up in these rules:

- **GTK named colors** via `@name`. `@accent_bg_color` is one of libadwaita's semantic palette colors, and it resolves to whatever the current theme (including the light/dark scheme you just set) defines. Style against these instead of hardcoded hex values and your widgets stay correct across themes automatically.
- **`alpha()`**, GTK's own color function: `alpha(@accent_bg_color, 0.08)` produces a faint accent-tinted background. It is a GTK CSS function, not web CSS.

`listDot` is a function rather than a constant so each user list can pass its own `color` in through interpolation, giving every list its colored dot from one style definition.

::: warning @gtkx/css targets GTK CSS, not web CSS
The syntax looks like the web (nesting, `&:hover`, `border-radius`), and emotion/stylis do run over it, but the output goes to a `Gtk.CssProvider`, so only what GTK4's CSS parser accepts is valid. Properties like `min-width`, `background`, `border-radius`, and `font-size` work because GTK parses them; there is no box model, no flexbox, and no cascade the way a browser does it. Named colors (`@accent_bg_color`) and `alpha()` have no web equivalent. The provider is registered against the default display lazily on the first `css()` call, so you do not wire it up yourself.
:::

## Next

Continue to **Reminders and Notifications** to see how the persisted `reminder-minutes` setting drives desktop notifications through `Gio.Notification`.
