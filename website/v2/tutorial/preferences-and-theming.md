---
description: "Store preferences in GSettings, add a preferences dialog, sort the list, and follow the system theme."
---

# Add Preferences

[Add Undo and Delete Confirmation](/v2/tutorial/trash-and-toasts) finished the app's dialog flow. This chapter keeps user choices in GSettings while task and list data stays in the JSON store from [Save Tasks](/v2/tutorial/saving-to-disk).

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

Use the same application ID as the scaffold. The [GSettings reference](https://docs.gtk.org/gio/class.Settings.html) covers schemas and their native storage; GTKX supplies the typed imports and React bindings.

Import the file wherever GTKX needs a schema:

```ts
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
```

The import returns the generated schema module. Its key names and stored value kinds flow into `useSetting` and `useBindSetting`.

## Create the settings instance

Both hooks receive an existing `Gio.Settings` instance. Create it for the application in `src/components/settings.tsx`:

```tsx [src/components/settings.tsx]
import type * as Gio from "@gtkx/gi/gio";
import { GSettings } from "@gtkx/jsx/gio";
import { createPortal, rootElement } from "@gtkx/react";
import { createContext, type ReactNode, use, useState } from "react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";

const SettingsContext = createContext<Gio.Settings | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<Gio.Settings | null>(null);

    return (
        <>
            {createPortal(<GSettings ref={setSettings} schemaId={schema.id} />, rootElement)}
            {settings !== null && <SettingsContext value={settings}>{children}</SettingsContext>}
        </>
    );
};

export const useAppSettings = (): Gio.Settings => {
    const settings = use(SettingsContext);
    if (settings === null) {
        throw new Error("SettingsProvider is required");
    }

    return settings;
};
```

The portal places the non-widget settings object at GTKX's root while `SettingsProvider` owns its React lifecycle. The provider mounts its children once the instance is available and shares it through [React context](https://react.dev/learn/passing-data-deeply-with-context).

In `src/app.tsx`, wrap `Window` inside the existing `AdwApplication`:

```diff [src/app.tsx]
@@ -0,0 +1 @@
+import { SettingsProvider } from "./components/settings.js";
@@ -12 +13,3 @@
-            <Window />
+            <SettingsProvider>
+                <Window />
+            </SettingsProvider>
```

## Bind the window size

In `src/components/window.tsx`, extend the React and GTKX imports, then hold the window instance in state and bind its default size:

```diff [src/components/window.tsx]
@@ -0,0 +1,5 @@
+import * as Adw from "@gtkx/gi/adw";
+import { quit, useBindSetting, useSetting } from "@gtkx/react";
+import { useEffect, useRef, useState } from "react";
+import schema from "../../data/com.gtkx.tutorial.gschema.xml";
+import { useAppSettings } from "./settings.js";
@@ -2 +6,0 @@
-import { useRef } from "react";
@@ -13 +16,0 @@
-import * as Adw from "@gtkx/gi/adw";
@@ -16 +18,0 @@
-import { quit } from "@gtkx/react";
@@ -31,0 +34,7 @@
+    const settings = useAppSettings();
+    const [colorScheme] = useSetting(settings, schema, "color-scheme");
+    const [window, setWindow] = useState<Adw.ApplicationWindow | null>(null);
+
+    useBindSetting({ settings, schema, key: "window-width", object: window, property: "defaultWidth" });
+    useBindSetting({ settings, schema, key: "window-height", object: window, property: "defaultHeight" });
+
@@ -40,0 +50 @@
+                ref={setWindow}
```

Set `ref={setWindow}` on `AdwApplicationWindow`. Both bindings wait for the mounted instance, then restore its saved size and write changes back. Keep the existing toast overlay ref.

## Keep application choices together

The generated schema supplies the allowed choices and enum values. A small application module adds the labels and Adwaita theme mapping used by the UI. Create `src/settings.ts`:

```ts [src/settings.ts]
import * as Adw from "@gtkx/gi/adw";
import schema from "../data/com.gtkx.tutorial.gschema.xml";

export type ColorScheme = typeof schema.values["color-scheme"][number];
export type SortOrder = keyof typeof schema.values["sort-order"];
type SortOrderValue = typeof schema.values["sort-order"][SortOrder];

const COLOR_SCHEMES = {
    default: { label: "Follow system", value: Adw.ColorScheme.DEFAULT },
    light: { label: "Light", value: Adw.ColorScheme.FORCE_LIGHT },
    dark: { label: "Dark", value: Adw.ColorScheme.FORCE_DARK },
} as const satisfies Record<ColorScheme, { label: string; value: Adw.ColorScheme }>;

const SORT_ORDERS = {
    manual: "Manual",
    "due-date": "Due date",
    title: "Title",
    created: "Date created",
} satisfies Record<SortOrder, string>;

const sortOrderIds = Object.keys(SORT_ORDERS) as SortOrder[];

export const colorSchemeItems = (): { id: string; value: string }[] =>
    Object.entries(COLOR_SCHEMES).map(([id, choice]) => ({ id, value: choice.label }));

export const sortOrderItems = (): { id: string; value: string }[] =>
    sortOrderIds.map((id) => ({ id, value: SORT_ORDERS[id] }));

export const colorSchemeValue = (id: string): Adw.ColorScheme => COLOR_SCHEMES[id as ColorScheme].value;

export const sortOrderFromSetting = (value: SortOrderValue): SortOrder =>
    sortOrderIds.find((id) => schema.values["sort-order"][id] === value) as SortOrder;

export const sortOrderToSetting = (order: SortOrder): SortOrderValue => schema.values["sort-order"][order];
```

The sort setting returns the schema's integer enum value. The conversion uses those declared values, so it also works when they are nonconsecutive. The label maps require an entry for each schema choice.

Create `src/hooks/use-sort-order.ts`:

```ts [src/hooks/use-sort-order.ts]
import { useSetting } from "@gtkx/react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useAppSettings } from "../components/settings.js";
import { sortOrderFromSetting, sortOrderToSetting, type SortOrder } from "../settings.js";

export const useSortOrder = (): [SortOrder, (order: SortOrder) => void] => {
    const settings = useAppSettings();
    const [value, setValue] = useSetting(settings, schema, "sort-order");
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

In `src/components/task-list.tsx`, read the setting and pass it to the selector:

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
@@ -9,0 +10 @@
+                { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
```

Add `{ label: "Preferences", action: "win.preferences" }` beside Keyboard Shortcuts in `src/components/main-menu.tsx`, and document the same accelerator in `src/components/shortcuts.tsx`:

```diff [src/components/shortcuts.tsx]
@@ -5,0 +6 @@
+            <AdwShortcutsItem title="Preferences" accelerator="<Control>comma" />
```

Create `src/components/preferences.tsx`:

```tsx [src/components/preferences.tsx]
import { ComboRow } from "@gtkx/components";
import { AdwPreferencesDialog, AdwPreferencesGroup, AdwPreferencesPage, AdwSpinRow } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { useSetting } from "@gtkx/react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useSortOrder } from "../hooks/use-sort-order.js";
import { colorSchemeItems, sortOrderItems, type ColorScheme, type SortOrder } from "../settings.js";
import { useAppSettings } from "./settings.js";

export const Preferences = ({ onClose }: { onClose: () => void }) => {
    const settings = useAppSettings();
    const [scheme, setScheme] = useSetting(settings, schema, "color-scheme");
    const [sortOrder, setSortOrder] = useSortOrder();
    const [reminderMinutes, setReminderMinutes] = useSetting(settings, schema, "reminder-minutes");

    return (
        <AdwPreferencesDialog onClosed={onClose} title="Preferences">
            <AdwPreferencesPage title="General" iconName="preferences-system-symbolic">
                <AdwPreferencesGroup title="Appearance">
                    <ComboRow
                        title="Theme"
                        items={colorSchemeItems()}
                        selectedId={scheme}
                        onSelectionChanged={(id) => setScheme(id as ColorScheme)}
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

`ComboRow` maps the stored choice ID to an Adwaita preferences row. `GtkAdjustment` supplies the spin row's value and range through JSX.

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
@@ -45,0 +47,4 @@
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

Set Reminder lead time to zero and leave it there. [Send Reminders](/v2/tutorial/reminders) will make that mean “notify when due.”

## Next

[Reorder Tasks](/v2/tutorial/drag-to-reorder) adds pointer and keyboard reordering when Manual is selected.
