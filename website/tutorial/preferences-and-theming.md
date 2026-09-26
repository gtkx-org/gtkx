---
description: "Store preferences in GSettings, add a preferences dialog, sort the list, and follow the system theme."
---

# Add Preferences

[Add Undo and Delete Confirmation](/tutorial/trash-and-toasts) finished the app's dialog flow. This chapter keeps user choices in GSettings while task and list data stays in the JSON store from [Save Tasks](/tutorial/saving-to-disk).

## Add the settings schema

GTKX imports, compiles, and generates types for the GSettings schemas used by the application. Create `data/com.gtkx.tutorial.gschema.xml`:

```xml [data/com.gtkx.tutorial.gschema.xml]
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

The schema uses the application ID established in [Create a Window](/tutorial/your-first-window). Its enum, choices, ranges, and defaults are the native settings contract; the [GSettings schema reference](https://docs.gtk.org/gio/class.Settings.html) covers the XML format and storage model.

Import the file wherever GTKX needs a schema:

```ts
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
```

The import returns the generated schema module. Its key names and stored value kinds flow into `useSetting` and `useBindSetting`.

## Bind the window size

In `src/components/window.tsx`, keep an application-window ref and bind its default size:

```diff [src/components/window.tsx]
@@ -0,0 +1,4 @@
+import * as Adw from "@gtkx/gi/adw";
+import { quit, useBindSetting, useSetting } from "@gtkx/react";
+import { useEffect, useRef } from "react";
+import schema from "../../data/com.gtkx.tutorial.gschema.xml";
@@ -2 +5,0 @@
-import { useRef } from "react";
@@ -13 +15,0 @@
-import * as Adw from "@gtkx/gi/adw";
@@ -16 +17,0 @@
-import { quit } from "@gtkx/react";
@@ -31,0 +33,7 @@
+    const [colorScheme] = useSetting(schema, "color-scheme");
+    const [reminderMinutes] = useSetting(schema, "reminder-minutes");
+    const windowRef = useRef<Adw.ApplicationWindow | null>(null);
+
+    useBindSetting({ schema, key: "window-width", object: windowRef, property: "defaultWidth" });
+    useBindSetting({ schema, key: "window-height", object: windowRef, property: "defaultHeight" });
+
@@ -40,0 +49 @@
+                ref={windowRef}
```

Keep `ref={windowRef}` on `AdwApplicationWindow`. The bindings restore the values when the widget mounts and write changes back without a separate save path.

## Keep application choices together

The native schema owns storage. A small application module owns the labels and conversions used by the UI, sorter, and theme manager. Create `src/settings.ts`:

```ts [src/settings.ts]
import * as Adw from "@gtkx/gi/adw";

const COLOR_SCHEMES = {
    default: { label: "Follow system", value: Adw.ColorScheme.DEFAULT },
    light: { label: "Light", value: Adw.ColorScheme.FORCE_LIGHT },
    dark: { label: "Dark", value: Adw.ColorScheme.FORCE_DARK },
} as const;

const SORT_ORDERS = {
    manual: "Manual",
    "due-date": "Due date",
    title: "Title",
    created: "Date created",
} as const;

export type ColorScheme = keyof typeof COLOR_SCHEMES;
export type SortOrder = keyof typeof SORT_ORDERS;

const sortOrderIds = Object.keys(SORT_ORDERS) as SortOrder[];

export const colorSchemeItems = (): { id: string; value: string }[] =>
    Object.entries(COLOR_SCHEMES).map(([id, choice]) => ({ id, value: choice.label }));

export const sortOrderItems = (): { id: string; value: string }[] =>
    sortOrderIds.map((id) => ({ id, value: SORT_ORDERS[id] }));

export const colorSchemeValue = (id: string): Adw.ColorScheme => COLOR_SCHEMES[id as ColorScheme].value;

export const sortOrderFromSetting = (value: number): SortOrder => sortOrderIds[value];

export const sortOrderToSetting = (order: SortOrder): number => sortOrderIds.indexOf(order);
```

All TypeScript consumers now derive their choice names from these tables. Only this module translates the schema's integer sort value to the readable ID used by the app.

Create `src/hooks/use-sort-order.ts`:

```ts [src/hooks/use-sort-order.ts]
import { useSetting } from "@gtkx/react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { sortOrderFromSetting, sortOrderToSetting, type SortOrder } from "../settings.js";

export const useSortOrder = (): [SortOrder, (order: SortOrder) => void] => {
    const [value, setValue] = useSetting(schema, "sort-order");
    return [sortOrderFromSetting(value), (order) => setValue(sortOrderToSetting(order))];
};
```

## Sort visible tasks

Import `SortOrder` from `settings.ts` in `src/store/selectors.ts`, then add the comparator:

```diff [src/store/selectors.ts]
@@ -0,0 +1 @@
+import type { SortOrder } from "../settings.js";
@@ -48 +49,20 @@
-export type VisibleOptions = { query: string; filter: Filter };
+const byOrder =
+    (order: SortOrder) =>
+        (a: Task, b: Task): number => {
+            switch (order) {
+                case "due-date": {
+                    if (a.due === b.due) return a.position - b.position;
+                    if (!a.due) return 1;
+                    if (!b.due) return -1;
+                    return a.due < b.due ? -1 : 1;
+                }
+                case "title":
+                    return a.title.localeCompare(b.title);
+                case "created":
+                    return a.createdAt.localeCompare(b.createdAt);
+                default:
+                    return a.position - b.position;
+            }
+        };
+
+export type VisibleOptions = { query: string; filter: Filter; sortOrder: SortOrder };
@@ -58 +78 @@
-        .sort((a, b) => a.position - b.position);
+        .sort(byOrder(options.sortOrder));
```

The existing filter returns a fresh array before `sort` changes its order, so the store array remains untouched. In `src/components/task-list.tsx`, read the setting and pass it to the selector:

```diff [src/components/task-list.tsx]
@@ -0,0 +1 @@
+import { useSortOrder } from "../hooks/use-sort-order.js";
@@ -10,0 +12 @@
+    const [sortOrder] = useSortOrder();
@@ -20 +22 @@
-    const visible = visibleTasks(tasks, selection, { query: searchQuery, filter });
+    const visible = visibleTasks(tasks, selection, { query: searchQuery, filter, sortOrder });
```

## Open Preferences

Add `"preferences"` to `DialogKind` in `src/types.ts`. Then connect the existing dialog state to a window action in `src/components/window-actions.tsx`:

```diff [src/components/window-actions.tsx]
@@ -18,0 +19 @@
+            <GSimpleAction name="preferences" onActivate={() => showDialog("preferences")} />
```

Register the accelerator in `src/app.tsx`:

```diff [src/app.tsx]
@@ -8,0 +9 @@
+                { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
```

Add `{ label: "Preferences", action: "win.preferences" }` beside Keyboard Shortcuts in `src/components/main-menu.tsx`, and document the same accelerator in `src/components/shortcuts.tsx`:

```diff [src/components/shortcuts.tsx]
@@ -5,0 +6 @@
+            <AdwShortcutsItem title="Preferences" accelerator="<Control>comma" />
```

Create `src/components/preferences.tsx`:

```tsx [src/components/preferences.tsx]
import { ComboRow } from "@gtkx/components/adw";
import { AdwPreferencesDialog, AdwPreferencesGroup, AdwPreferencesPage, AdwSpinRow } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { useSetting } from "@gtkx/react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useSortOrder } from "../hooks/use-sort-order.js";
import { colorSchemeItems, sortOrderItems, type SortOrder } from "../settings.js";

export const Preferences = ({ onClose }: { onClose: () => void }) => {
    const [scheme, setScheme] = useSetting(schema, "color-scheme");
    const [sortOrder, setSortOrder] = useSortOrder();
    const [reminderMinutes, setReminderMinutes] = useSetting(schema, "reminder-minutes");

    return (
        <AdwPreferencesDialog onClosed={onClose} title="Preferences">
            <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title="Appearance">
                    <ComboRow
                        title="Theme"
                        items={colorSchemeItems()}
                        selectedId={scheme}
                        onSelectionChanged={(id) => setScheme(id as string)}
                    />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title="Tasks">
                    <ComboRow
                        title="Sort order"
                        items={sortOrderItems()}
                        selectedId={sortOrder}
                        onSelectionChanged={(id) => setSortOrder(id as SortOrder)}
                    />
                    <AdwSpinRow
                        title="Reminder lead time"
                        subtitle="Minutes before a task is due"
                        adjustment={<GtkAdjustment value={reminderMinutes} lower={0} upper={1440} stepIncrement={5} />}
                        onNotifyValue={(value) => setReminderMinutes(value as number)}
                    />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesDialog>
    );
};
```

`ComboRow` is the GTKX collection component for an Adwaita preferences row. The tables from `settings.ts` feed both rows, and the adjustment gives the native spin row its current reminder value and range.

Mount the new dialog from `src/components/dialogs.tsx`:

```diff [src/components/dialogs.tsx]
@@ -0,0 +1 @@
+import { Preferences } from "./preferences.js";
@@ -35,0 +37,2 @@
+        case "preferences":
+            return <Preferences onClose={close} />;
```

## Apply the color scheme

Create `src/theme.ts`:

```ts [src/theme.ts]
import * as Adw from "@gtkx/gi/adw";
import { colorSchemeValue } from "./settings.js";

export const applyColorScheme = (value: string): void => {
    const manager = Adw.StyleManager.getDefault();
    manager.setColorScheme(colorSchemeValue(value));
};
```

Apply it when the setting changes in `src/components/window.tsx`:

```diff [src/components/window.tsx]
@@ -0,0 +1 @@
+import { applyColorScheme } from "../theme.js";
@@ -44,0 +46,4 @@
+
+    useEffect(() => {
+        applyColorScheme(colorScheme);
+    }, [colorScheme]);
```

The default table entry follows the desktop scheme; the other entries ask Adwaita to keep the app light or dark.

Include Preferences in the dialog type:

```diff [src/types.ts]
@@ -27 +27 @@
-export type DialogKind = "none" | "about" | "shortcuts" | "new-list";
+export type DialogKind = "none" | "about" | "shortcuts" | "new-list" | "preferences";
```

Add the menu entry:

```diff [src/components/main-menu.tsx]
@@ -12,0 +13 @@
+                    { section: [{ label: "Preferences", action: "win.preferences" }] },
```

## Run it

Press <kbd>Ctrl</kbd>+<kbd>,</kbd>. Change the theme and sort order, then close the dialog. Both changes take effect immediately. Resize the window, quit the process, and start it again. The window size and each preference return from GSettings.

Set Reminder lead time to zero and leave it there. [Send Reminders](/tutorial/reminders) will make that mean “notify when due.”

## Next

[Reorder Tasks](/tutorial/drag-to-reorder) adds pointer and keyboard reordering when Manual is selected.
