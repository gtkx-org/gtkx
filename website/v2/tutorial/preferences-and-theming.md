---
description: "Store preferences in GSettings, add a preferences dialog, sort the list, and follow the system theme."
---

# Preferences and the System Theme

[Deleting Without Fear](/v2/tutorial/trash-and-toasts) finished the app's dialog flow. This chapter keeps user choices in GSettings while task and list data stays in the JSON store from [Saving Tasks Between Runs](/v2/tutorial/saving-to-disk).

## Add the settings schema

GTKX imports, compiles, and generates types for the GSettings schemas used by the application. Create `data/com.gtkx.tutorial.gschema.xml`:

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

The schema uses the application ID established in [Your First Native Window](/v2/tutorial/your-first-window). Its enum, choices, ranges, and defaults are the native settings contract; the [GSettings schema reference](https://docs.gtk.org/gio/class.Settings.html) covers the XML format and storage model.

Import the file wherever GTKX needs a schema:

```ts
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
```

The import returns the generated schema module. Its key names and stored value kinds flow into `useSetting` and `useBindSetting`.

## Create the settings instance

Both hooks receive an existing `Gio.Settings` instance. Create it for the application in `src/components/settings.tsx`:

```tsx
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

```diff
+import { SettingsProvider } from "./components/settings.js";

-    <Window />
+    <SettingsProvider>
+        <Window />
+    </SettingsProvider>
```

## Bind the window size

In `src/components/window.tsx`, replace `windowRef` with a window instance held in state and bind its default size:

```tsx
import * as Adw from "@gtkx/gi/adw";
import { quit, useBindSetting, useSetting } from "@gtkx/react";
import { useEffect, useRef, useState } from "react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useAppSettings } from "./settings.js";

const settings = useAppSettings();
const [colorScheme] = useSetting(settings, schema, "color-scheme");
const [reminderMinutes] = useSetting(settings, schema, "reminder-minutes");
const [window, setWindow] = useState<Adw.ApplicationWindow | null>(null);

useBindSetting({ settings, schema, key: "window-width", object: window, property: "defaultWidth" });
useBindSetting({ settings, schema, key: "window-height", object: window, property: "defaultHeight" });
```

Set `ref={setWindow}` on `AdwApplicationWindow`. The callback ref makes the mounted instance available to the bindings on the next render. They wait while `window` is `null`, then restore the saved size and write changes back without a separate save path.

## Keep application choices together

The native schema owns storage. A small application module owns the labels and conversions used by the UI, sorter, and theme manager. Create `src/settings.ts`:

```ts
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

```ts
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

```ts
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

export type VisibleOptions = { query: string; filter: Filter; sortOrder: SortOrder };

export const visibleTasks = (tasks: Task[], selection: Selection, options: VisibleOptions): Task[] =>
    tasks
        .filter(
            (task) =>
                inSelection(task, selection) &&
                matchesQuery(task, options.query) &&
                matchesFilter(task, options.filter),
        )
        .sort(byOrder(options.sortOrder));
```

The existing filter returns a fresh array before `sort` changes its order, so the store array remains untouched. In `src/components/task-list.tsx`, read the setting and pass it to the selector:

```diff
+import { useSortOrder } from "../hooks/use-sort-order.js";

 export const TaskList = ({ selection }: { selection: Selection }) => {
+    const [sortOrder] = useSortOrder();

-    const visible = visibleTasks(tasks, selection, { query: searchQuery, filter });
+    const visible = visibleTasks(tasks, selection, { query: searchQuery, filter, sortOrder });
```

## Open Preferences

Add `"preferences"` to `DialogKind` in `src/types.ts`. Then connect the existing dialog state to a window action in `src/components/window-actions.tsx`:

```diff
     <GSimpleAction name="new" onActivate={newTask} />
+    <GSimpleAction name="preferences" onActivate={() => showDialog("preferences")} />
     <GSimpleAction name="shortcuts" onActivate={() => showDialog("shortcuts")} />
```

Register the accelerator in `src/app.tsx`:

```diff
     actionAccels={[
         { detailedActionName: "win.new", accels: ["<Control>n"] },
+        { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
         { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
     ]}
```

Add `{ label: "Preferences", action: "win.preferences" }` beside Keyboard Shortcuts in `src/components/main-menu.tsx`, and document the same accelerator in `src/components/shortcuts.tsx`:

```tsx
<AdwShortcutsItem title="Preferences" accelerator="<Control>comma" />
```

Create `src/components/preferences.tsx`:

```tsx
import { ComboRow } from "@gtkx/components";
import { AdwPreferencesDialog, AdwPreferencesGroup, AdwPreferencesPage, AdwSpinRow } from "@gtkx/jsx/adw";
import { GtkAdjustment } from "@gtkx/jsx/gtk";
import { useSetting } from "@gtkx/react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useSortOrder } from "../hooks/use-sort-order.js";
import { colorSchemeItems, sortOrderItems, type SortOrder } from "../settings.js";
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

```diff
+import { Preferences } from "./preferences.js";

     switch (dialog.kind) {
+        case "preferences":
+            return <Preferences onClose={close} />;
         case "new-list":
             return <NewListDialog />;
```

## Apply the color scheme

Create `src/theme.ts`:

```ts
import * as Adw from "@gtkx/gi/adw";
import { colorSchemeValue } from "./settings.js";

export const applyColorScheme = (value: string): void => {
    const manager = Adw.StyleManager.getDefault();
    manager.setColorScheme(colorSchemeValue(value));
};
```

Apply it when the setting changes in `src/components/window.tsx`:

```tsx
import { applyColorScheme } from "../theme.js";

useEffect(() => {
    applyColorScheme(colorScheme);
}, [colorScheme]);
```

The default table entry follows the desktop scheme; the other entries ask Adwaita to keep the app light or dark.

## Run it

Press <kbd>Ctrl</kbd>+<kbd>,</kbd>. Change the theme and sort order, then close the dialog. Both changes take effect immediately. Resize the window, quit the process, and start it again. The window size and each preference return from GSettings.

Set Reminder lead time to zero and leave it there. [Reminders That Reach the Desktop](/v2/tutorial/reminders) will make that mean “notify when due.”

## Next

[Dragging Tasks Into Order](/v2/tutorial/drag-to-reorder) adds pointer and keyboard reordering when Manual is selected.
