---
description: "Store preferences in GSettings, add a preferences dialog, sort the list, and follow the system theme."
---

# Preferences and the System Theme

Deletion is now recoverable, with a toast for the reversible case and a dialog for the permanent one ([Deleting Without Fear](/tutorial/trash-and-toasts)). This page carries out the split promised in [Saving Tasks Between Runs](/tutorial/saving-to-disk): user content lives in a JSON file, preferences live in GSettings.

## Preferences are not user data

Your tasks are open-ended: any number of them, each an object whose shape only your app understands. A JSON file suits that.

A preference is different. The theme is one of a closed set of names, the reminder lead time is a whole number of minutes with a floor and a ceiling, the window width is a pixel count. Each has a type, a default, and a range of legal values. The desktop has a stake in them too: `gsettings` reads and writes them from a terminal, `dconf-editor` browses them, and resetting an app to factory settings means clearing them.

GSettings provides that: a declared schema with types, defaults, and constraints, a per-user database behind it, and change notification when a value moves. A JSON file provides none of it.

## Declaring the schema

GSettings will not let you read or write a key you have not declared. The declaration is an XML schema file in your project's `data/` directory.

Create `data/com.gtkx.tutorial.gschema.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <enum id="com.gtkx.tutorial.SortOrder">
    <value nick="manual" value="0"/>
    <value nick="due-date" value="1"/>
    <value nick="title" value="2"/>
    <value nick="created" value="3"/>
  </enum>
  <schema id="com.gtkx.tutorial" path="/com/gtkx/tutorial/">
    <key name="sort-order" enum="com.gtkx.tutorial.SortOrder">
      <default>'manual'</default>
      <summary>Sort order</summary>
      <description>How tasks are ordered in the list</description>
    </key>
    <key name="color-scheme" type="s">
      <choices>
        <choice value="default"/>
        <choice value="light"/>
        <choice value="dark"/>
      </choices>
      <default>'default'</default>
      <summary>Color scheme</summary>
      <description>Follow the system theme or force light or dark</description>
    </key>
    <key name="reminder-minutes" type="i">
      <range min="0" max="1440"/>
      <default>30</default>
      <summary>Reminder lead time</summary>
      <description>Minutes before a due time to show a reminder</description>
    </key>
    <key name="window-width" type="i">
      <default>900</default>
      <summary>Window width</summary>
      <description>Last saved window width in pixels</description>
    </key>
    <key name="window-height" type="i">
      <default>600</default>
      <summary>Window height</summary>
      <description>Last saved window height in pixels</description>
    </key>
  </schema>
</schemalist>
```

The schema `id` is your application ID, and the `path` is that ID with slashes instead of dots. GNOME expects this convention, which is why the first chapter settled on a reverse-DNS application ID.

`color-scheme` uses an inline `<choices>` list, which fits when the legal values are plain strings. `sort-order` refers to a top-level `<enum>` by id, pairing each name with a stored integer, so the value on disk is compact. An enum key reads and writes as that integer; the sorting section maps it to and from the readable nick with a small hook. An enum key's `<default>` is the nick in single quotes, not the number. `reminder-minutes` takes a `<range>`, capping the lead time at a day.

GSettings enforces these constraints when you write: a value outside the declared choices or range is rejected. A value you read back is already legal, so it never needs validating.

The window keys are not something the user picks. They let the app remember its own size, and they are the same kind of small typed value, so they belong here too.

## Importing the schema

`gtkx dev`, `gtkx build`, and `gtkx codegen` scan `data/` for `.gschema.xml` files, compile them with `glib-compile-schemas`, and generate a module per schema carrying its keys and their types. You reach that module through a subpath import, so add one to `package.json`:

```diff
 {
     "name": "gtkx-tutorial",
     "version": "0.1.0",
     "private": true,
     "type": "module",
+    "imports": {
+        "#data/*": "./data/*"
+    },
```

Now any file can pull the schema in by its path:

```ts
import schema from "#data/com.gtkx.tutorial.gschema.xml";
```

That import gives you the generated module, not the XML text, and it carries the key types: `"sort-order"` resolves to `number` (its enum integer), `"window-width"` to `number`, `"color-scheme"` to `string`. Misspell a key name and the type checker catches it before the app runs.

## Binding first

Start with the window size, because it needs no dialog and no code of your own.

`useBindSetting` ties a GSettings key to a GObject property on a live widget, in both directions and for as long as the widget exists. Give it the schema, the key, a ref to the widget, and the property name in camelCase, in `src/components/window.tsx`:

```tsx
import * as Adw from "@gtkx/gi/adw";
// ...
import { quit, useBindSetting, useSetting } from "@gtkx/react";
import { useEffect, useRef } from "react";
import schema from "#data/com.gtkx.tutorial.gschema.xml";
// ...

export const Window = () => {
    // ...
    const windowRef = useRef<Adw.ApplicationWindow | null>(null);

    useBindSetting({ schema, key: "window-width", object: windowRef, property: "defaultWidth" });
    useBindSetting({ schema, key: "window-height", object: windowRef, property: "defaultHeight" });

    return (
        <AdwApplicationWindow
            ref={windowRef}
            title="Tasks"
            // ...
        >
```

There is no save handler, close handler, or restore effect: the two-way binding keeps the key and the property in sync on its own.

`useBindSetting` returns nothing. The property on the widget is the value, and React never needs to know it changed.

## Reading and writing a value

Not every preference maps to a widget property. The theme is applied by a process-wide manager, and the sort order is consumed by a plain function. For those, `useSetting` gives you a value and a setter:

```tsx
const [sortOrder, setSortOrder] = useSetting(schema, "sort-order");
```

It reads the current value, re-renders the component whenever that key changes (including when something outside your app changes it), and writes through to the database when you call the setter. Every component reading the same key sees the same value, with no store, no context, and no prop in between. GSettings is already the shared source of truth.

## Sorting

The list's order today is whatever order tasks were created in. Make it a choice instead. Mirror the schema's `<enum>` as a TypeScript enum in `src/types.ts`, and derive the nick union from it so there is one source of truth:

```diff
 export type Filter = "all" | "open" | "done";
+
+export enum SortValue {
+    manual = 0,
+    "due-date" = 1,
+    title = 2,
+    created = 3,
+}
+
+export type SortOrder = keyof typeof SortValue;
```

`SortOrder` is `keyof typeof SortValue`, which TypeScript resolves to the member names, `"manual" | "due-date" | "title" | "created"`. The rest of the app works in those nicks; only the boundary hook touches the integers.

Then a comparator in `src/store/selectors.ts`:

```ts
// ...
import type { Filter, Selection, SmartView, SortOrder, Task, TaskList } from "../types.js";

// ...

const byOrder =
    (order: SortOrder) =>
    (a: Task, b: Task): number => {
        switch (order) {
            case "due-date": {
                if (a.due === b.due) return a.position - b.position;
                if (!a.due) return 1;
                if (!b.due) return -1;
                return a.due < b.due ? -1 : 1;
            }
            case "title":
                return a.title.localeCompare(b.title);
            case "created":
                return a.createdAt.localeCompare(b.createdAt);
            default:
                return a.position - b.position;
        }
    };
```

Due date sends undated tasks to the end and breaks ties on the stored `position`, so the order within a day stays stable. Title and creation date compare with `localeCompare`, which orders accented characters the way the user's language expects rather than by code point. Due dates and creation stamps are ISO strings, which sort correctly as plain text. `manual` falls through to `position`.

`visibleTasks` gains the option and one call:

```diff
-export type VisibleOptions = { query: string; filter: Filter };
+export type VisibleOptions = { query: string; filter: Filter; sortOrder: SortOrder };

 export const visibleTasks = (tasks: Task[], selection: Selection, options: VisibleOptions): Task[] =>
     tasks
         .filter(
             (task) =>
                 inSelection(task, selection) &&
                 matchesQuery(task, options.query) &&
                 matchesFilter(task, options.filter),
-        );
+        )
+        .sort(byOrder(options.sortOrder));
```

`sort` mutates the array it is called on. That is safe here because `filter` has already produced a fresh array, so the store's own `tasks` array is untouched.

The setting stores the order as the enum's integer, but the app works in the nick. A small hook bridges the two, in `src/hooks/use-sort-order.ts`:

```ts
import { useSetting } from "@gtkx/react";
import schema from "#data/com.gtkx.tutorial.gschema.xml";
import { type SortOrder, SortValue } from "../types.js";

export const useSortOrder = (): [SortOrder, (order: SortOrder) => void] => {
    const [value, setValue] = useSetting(schema, "sort-order");
    return [SortValue[value] as SortOrder, (order) => setValue(SortValue[order])];
};
```

A TypeScript enum reads both ways, so `SortValue` is the whole translation: index it by the stored number to get the nick, or by the nick to get the number. Nothing past this hook sees the integer.

The caller supplies the order. In `src/components/task-list.tsx`:

```diff
+import { useSortOrder } from "../hooks/use-sort-order.js";
+
 export const TaskList = () => {
     // ...
+    const [sortOrder] = useSortOrder();

-    const visible = visibleTasks(tasks, selection, { query: searchQuery, filter });
+    const visible = visibleTasks(tasks, selection, { query: searchQuery, filter, sortOrder });
```

## The command that opens it

Preferences reaches the user the way every other command does: a named action, an accelerator, and a menu item. <kbd>Ctrl</kbd>+<kbd>,</kbd> is the GNOME convention for opening preferences.

Add the kind to `src/types.ts`:

```diff
-export type DialogKind = "none" | "about" | "shortcuts" | "new-list" | "delete-task";
+export type DialogKind = "none" | "about" | "shortcuts" | "new-list" | "delete-task" | "preferences";
```

Add the action in `src/components/window-actions.tsx`:

```diff
     <GSimpleAction name="about" onActivate={() => showDialog("about")} />
+    <GSimpleAction name="preferences" onActivate={() => showDialog("preferences")} />
```

Give it its accelerator in `src/app.tsx`:

```diff
     actionAccels={[
         { detailedActionName: "win.new", accels: ["<Control>n"] },
+        { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
         { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
     ]}
```

The accelerator string spells the key by name: `comma` is the GDK key name, and `<Control>,` does not parse.

And put it in the menu, in `src/components/main-menu.tsx`:

```diff
     { section: [{ label: "New Task", action: "win.new" }] },
+    { section: [{ label: "Preferences", action: "win.preferences" }] },
     { section: [{ label: "Keyboard Shortcuts", action: "win.shortcuts" }] },
```

The menu item shows `Ctrl+,` along its right edge automatically, because it reads the accelerator you registered against the same action name.

## The dialog

`AdwPreferencesDialog` holds `AdwPreferencesPage` elements, each shown with its own icon, and each page holds `AdwPreferencesGroup` elements that render as titled boxed lists. Nesting these elements gives you GNOME's preferences layout without styling anything.

Create `src/components/preferences.tsx`:

```tsx
import { DropDown } from "@gtkx/components";
import { AdwComboRow, AdwPreferencesDialog, AdwPreferencesGroup, AdwPreferencesPage, AdwSpinRow } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { useSetting } from "@gtkx/react";
import schema from "#data/com.gtkx.tutorial.gschema.xml";
import { useSortOrder } from "../hooks/use-sort-order.js";

type Scheme = "default" | "light" | "dark";
type Sort = "manual" | "due-date" | "title" | "created";

const isScheme = (value: string): value is Scheme => value === "default" || value === "light" || value === "dark";
const isSort = (value: string): value is Sort =>
    value === "manual" || value === "due-date" || value === "title" || value === "created";

export const Preferences = ({ onClose }: { onClose: () => void }) => {
    const [scheme, setScheme] = useSetting(schema, "color-scheme");
    const [sortOrder, setSortOrder] = useSortOrder();
    const [reminderMinutes, setReminderMinutes] = useSetting(schema, "reminder-minutes");

    return (
        <AdwPreferencesDialog onClosed={onClose} title="Preferences">
            <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title="Appearance">
                    <DropDown
                        component={AdwComboRow}
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
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title="Tasks">
                    <DropDown
                        component={AdwComboRow}
                        title="Sort order"
                        items={[
                            { id: "manual", value: "Manual" },
                            { id: "due-date", value: "Due date" },
                            { id: "title", value: "Title" },
                            { id: "created", value: "Date created" },
                        ]}
                        selectedId={sortOrder}
                        onSelectionChanged={(id) => {
                            if (isSort(id)) setSortOrder(id);
                        }}
                    />
                    <AdwSpinRow
                        title="Reminder lead time"
                        subtitle="Minutes before a task is due"
                        adjustment={<GtkAdjustment value={reminderMinutes} lower={0} upper={1440} stepIncrement={5} />}
                        onNotifyValue={(value) => setReminderMinutes(value ?? 30)}
                    />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesDialog>
    );
};
```

`DropDown` from `@gtkx/components` takes a `component` prop naming what it renders into. A bare `GtkDropDown` is the plain widget; `AdwComboRow` presents the same choice as a row inside a preferences group, which is what belongs here. `selectedId` drives the selection and `onSelectionChanged` reports the id the user picked: the controlled-widget pairing from [Completing, Starring, and Deleting](/tutorial/completing-and-deleting), with a settings key on the other end instead of the store.

`AdwSpinRow` takes its bounds through a `GtkAdjustment` in the `adjustment` slot, the same JSX-valued-prop shape as `topBar` and `prefix`. The adjustment carries the value, the floor, the ceiling, and the step, so the row itself takes none of them. The lead time it sets has no effect yet: the sweep that reads it arrives in [Reminders That Reach the Desktop](/tutorial/reminders).

`onSelectionChanged` hands back a bare `string`, because a drop-down of arbitrary items cannot know your key's type, while the setter wants one of the declared names. `isScheme` and `isSort` narrow the string to that union, so the write type-checks without a cast and an illegal id is ignored. Sort order writes through `useSortOrder`, which takes the nick here and stores the integer for you. This is the general pattern whenever a widget's loose type meets a typed key.

Let the dialog switch reach it, in `src/components/dialogs.tsx`:

```diff
+import { Preferences } from "./preferences.js";
+
     switch (dialog) {
         case "about":
             return <About onClose={close} />;
         case "shortcuts":
             return <Shortcuts onClose={close} />;
+        case "preferences":
+            return <Preferences onClose={close} />;
```

Same contract as the other dialogs: mounting the component presents it, `onClosed` calls back so the store can clear the state that mounted it, and unmounting closes it.

## Applying the theme

The theme picker writes a string. Something needs to turn that string into a repaint.

Adwaita's light and dark handling belongs to `Adw.StyleManager`, and the default manager covers the whole process. It is not a widget and not in your tree, so setting the scheme is a function call, not a prop.

Create `src/theme.ts`:

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

`DEFAULT` is the "Follow system" option: it hands the decision back to the desktop, so when the user switches GNOME to dark, or their night schedule does it at sunset, your window follows. `FORCE_LIGHT` and `FORCE_DARK` override that for users who want your app to stay light or dark regardless of the desktop.

Call it from an effect on the setting, in `src/components/window.tsx`:

```tsx
// ...
import { applyColorScheme } from "../theme.js";

export const Window = () => {
    // ...
    const [colorScheme] = useSetting(schema, "color-scheme");

    useEffect(() => {
        applyColorScheme(colorScheme);
    }, [colorScheme]);
```

An effect is the right tool because the target is outside React. `useSetting` re-renders the window when the key changes, the effect sees the new value in its dependency list, and the call updates process-wide state that no render produces.

## Run it

Save `window.tsx`. The window on your desktop is still the one you opened at the start of the tutorial, with the theme effect now in it.

Press <kbd>Ctrl</kbd>+<kbd>,</kbd>. The Preferences dialog slides in over the window with a General page, an Appearance group holding Theme, and a Tasks group holding Sort order and Reminder lead time.

Set Theme to Dark. The window repaints immediately, dialog included. Set it back to Follow system and it matches your desktop again.

Set Sort order to Title and close the dialog. The task list is alphabetical, and it stays alphabetical as you switch between lists and smart views.

Only a fresh process proves persistence. Resize the window to something distinctly wide and quit it. That ends the dev session too, so start it again with `npm run dev`. The window comes back at the size you left it, still sorted by title, still on the theme you chose. From another terminal, compile the schema and ask GSettings directly:

```bash
glib-compile-schemas data
GSETTINGS_SCHEMA_DIR=data gsettings get com.gtkx.tutorial window-width
```

```
1240
```

The number matches the width you dragged the window to, and it comes from your desktop's settings database, not your app.

## Next

[Dragging Tasks Into Order](/tutorial/drag-to-reorder) lets you reorder rows by hand, but only in the views where a manual order means anything.
