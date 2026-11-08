---
title: "Native State"
description: "Follow GObject properties and signals from components, reach the application, and read, write and bind GSettings keys."
---

# Native State

Some state lives in native objects rather than in React: the dark style in `Adw.StyleManager`, the clipboard's contents, the user's preferences in GSettings. The hooks on this page connect a component to that state, re-render it on changes and disconnect when it unmounts. Props cover the objects JSX renders; these hooks cover everything else and the objects you hold through a ref.

## Following a property

`useProperty(object, name)` returns a GObject property's current value and re-renders when it changes. Property names are camelCase, as in props:

```tsx [src/components/theme-icon.tsx]
import * as Adw from "@gtkx/gi/adw";
import { GtkImage } from "@gtkx/jsx/gtk";
import { useProperty } from "@gtkx/react";

export const ThemeIcon = () => {
    const dark = useProperty(Adw.StyleManager.getDefault(), "dark");

    return <GtkImage iconName={dark ? "weather-clear-night-symbolic" : "weather-clear-symbolic"} />;
};
```

`dark` is a `boolean`, typed from the property. To style by the color scheme, prefer the media queries in [CSS](/v2/guide/css#follow-appearance-preferences); follow the property when the component's output changes.

### Objects that JSX creates

For an instance created by JSX, use a state setter as its callback ref and pass the state to the hook:

```tsx
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkEntry, GtkLabel } from "@gtkx/jsx/gtk";
import { useProperty } from "@gtkx/react";
import { useState } from "react";

export const EntryLength = () => {
    const [entry, setEntry] = useState<Gtk.Entry | null>(null);
    const length = useProperty(entry, "textLength");

    return (
        <>
            <GtkEntry ref={setEntry} />
            <GtkLabel label={`${length ?? 0} characters`} />
        </>
    );
};
```

The hook returns `undefined` while its target is absent, and its type includes `undefined` only when the target's type allows `null` or `undefined`. React state keeps the subscription aligned when the element mounts, is replaced or unmounts. `useSignal` and `useBindSetting` take instances the same way; mutable ref objects are not subscription targets. Properties that a [registered class](/v2/guide/subclassing#properties) declares work the same, with their declared types.

## Connecting a signal

`useSignal(object, signal, handler)` connects a handler for the component's lifetime and reconnects when the object changes. Each emission runs the handler from the latest render, so it can read props and state without reconnecting. `isImmediate: true` also runs it once, with no arguments, when it connects, which reads the initial state:

```tsx [src/components/paste-button.tsx]
import * as Gdk from "@gtkx/gi/gdk";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useSignal } from "@gtkx/react";
import { useState } from "react";

export const PasteButton = ({ onPaste }: { onPaste: () => void }) => {
    const clipboard = Gdk.Display.getDefault()?.getClipboard() ?? null;
    const [hasText, setHasText] = useState(false);

    useSignal(clipboard, "changed", () => setHasText(clipboard?.getFormats().containMimeType("text/plain") ?? false), {
        isImmediate: true,
    });

    return <GtkButton iconName="edit-paste-symbolic" tooltipText="Paste" sensitive={hasText} onClicked={onPaste} />;
};
```

The signal name is typed from the object, and accepts a `::detail` suffix such as `notify::dark`. `isAfter: true` runs the handler after the object's default handler. For a signal of an element you render, use its `on…` prop instead.

## The application

`useApplication()` returns the `Gtk.Application` of the nearest [application element](/v2/guide/application-lifecycle#the-application-element), and throws outside one:

```tsx [src/hooks/use-notify.ts]
import * as Gio from "@gtkx/gi/gio";
import { useApplication } from "@gtkx/react";

export const useNotify = (): ((title: string) => void) => {
    const application = useApplication();

    return (title) => {
        application.sendNotification(null, Gio.Notification.new(title));
    };
};
```

Use it for the application's own methods: notifications, its D-Bus connection ([Exporting an object](/v2/guide/dbus#exporting-an-object)), its windows, or a [`hold()`](/v2/guide/application-lifecycle#when-the-app-ends) for background work.

## Settings

GSettings stores preferences outside the app, where they survive restarts and are shared by every running instance. The [GSettings reference](https://docs.gtk.org/gio/class.Settings.html) covers schemas and their native storage; GTKX compiles your schema, types its keys, and provides hooks to read, write and bind them.

### Your app's schema

Write the schema in a `.gschema.xml` file, usually `data/<application ID>.gschema.xml` with the application ID as the schema ID:

```xml [data/com.example.Notes.gschema.xml]
<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <schema id="com.example.Notes" path="/com/example/Notes/">
    <key name="color-scheme" type="s">
      <choices>
        <choice value="default"/>
        <choice value="light"/>
        <choice value="dark"/>
      </choices>
      <default>'default'</default>
      <summary>Color scheme</summary>
    </key>
    <key name="window-width" type="i">
      <default>800</default>
      <summary>Window width</summary>
    </key>
  </schema>
</schemalist>
```

Import the file without a query wherever a hook needs it. GTKX compiles and bundles the schema. The import's default export describes the file's first schema, and every schema in the file is also a named export (`com_example_Notes` here). The hooks use that description to check key names and value types:

```ts
import schema from "../data/com.example.Notes.gschema.xml";
```

A schema without a `path` attribute is relocatable: give `GSettings` a `path` too, and each path keeps its own values.

[Translate settings schemas](/v2/guide/internationalization#translate-settings-schemas) covers the schema text, and [Test data and settings](/v2/guide/testing#test-data-and-settings) how tests start from the defaults.

### The settings instance

The hooks take a `Gio.Settings` instance. Render `GSettings` at the top level with a portal, keep the instance in state, and share it with [React context](https://react.dev/learn/passing-data-deeply-with-context):

```tsx [src/settings.tsx]
import type * as Gio from "@gtkx/gi/gio";
import { GSettings } from "@gtkx/jsx/gio";
import { createPortal, rootElement } from "@gtkx/react";
import { createContext, type ReactNode, use, useState } from "react";
import schema from "../data/com.example.Notes.gschema.xml";

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
    if (settings === null) throw new Error("SettingsProvider is required");
    return settings;
};
```

Wrap the windows inside the application element in `SettingsProvider`. The provider renders its children once the instance exists, so `useAppSettings()` always returns one.

### Reading and writing a key

`useSetting(settings, schema, key)` returns the key's value and a setter, and re-renders when the value changes, including from another instance or `gsettings set`:

```tsx [src/components/dark-style-row.tsx]
import { AdwSwitchRow } from "@gtkx/jsx/adw";
import { useSetting } from "@gtkx/react";
import schema from "../../data/com.example.Notes.gschema.xml";
import { useAppSettings } from "../settings.js";

export const DarkStyleRow = () => {
    const [scheme, setScheme] = useSetting(useAppSettings(), schema, "color-scheme");

    return <AdwSwitchRow title="Dark Style" active={scheme === "dark"} onNotifyActive={(active) => setScheme(active ? "dark" : "default")} />;
};
```

`scheme` is `"default" | "light" | "dark"`, from the key's `<choices>`. The schema's `values` holds those choices as a readonly tuple, so `(typeof schema.values)["color-scheme"][number]` names the type and `schema.values["color-scheme"]` lists them at runtime. Other keys read as their unpacked GVariant type, such as a `number` for `i` and a `bigint` for `x`. A key declared with `enum` or `flags` reads as a number, and `values` maps each nick to its number. A key the schema does not declare fails `tsc`, and so does a value of the wrong type.

### Binding a key to a property

`useBindSetting` keeps a key and an object's property in step, both ways by default, with no React state between them. Use it for values the widget owns, such as a window's size:

```tsx
import type * as Adw from "@gtkx/gi/adw";
import { AdwApplicationWindow } from "@gtkx/jsx/adw";
import { quit, useBindSetting } from "@gtkx/react";
import { useState } from "react";
import schema from "../../data/com.example.Notes.gschema.xml";
import { useAppSettings } from "../settings.js";

export const Window = () => {
    const settings = useAppSettings();
    const [window, setWindow] = useState<Adw.ApplicationWindow | null>(null);
    useBindSetting({ settings, schema, key: "window-width", object: window, property: "defaultWidth" });

    return <AdwApplicationWindow ref={setWindow} title="Notes" onCloseRequest={quit} />;
};
```

The bind waits for the mounted window, restores the saved width, and writes changes back. `flags` takes [`Gio.SettingsBindFlags`](https://docs.gtk.org/gio/flags.SettingsBindFlags.html), such as `GET` to only read the key.

### System schemas

Schema imports type only the schemas the project ships. To read a schema installed on the system, such as `org.gnome.desktop.interface` for the desktop's fonts and color scheme, describe the keys the app uses in an object that satisfies `SettingsSchema`:

```tsx [src/components/system-appearance.tsx]
import type * as Gio from "@gtkx/gi/gio";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GSettings } from "@gtkx/jsx/gio";
import { createPortal, rootElement, type SettingsSchema, useSetting } from "@gtkx/react";
import { useState } from "react";

const desktopInterface = {
    id: "org.gnome.desktop.interface",
    path: null,
    keys: { "monospace-font-name": "s", "color-scheme": "enum" },
    values: { "color-scheme": { default: 0, "prefer-dark": 1, "prefer-light": 2 } },
} as const satisfies SettingsSchema;

const AppearanceRows = ({ settings }: { settings: Gio.Settings }) => {
    const [font] = useSetting(settings, desktopInterface, "monospace-font-name");
    const [scheme] = useSetting(settings, desktopInterface, "color-scheme");
    const prefersDark = scheme === desktopInterface.values["color-scheme"]["prefer-dark"];

    return (
        <>
            <AdwActionRow title="Monospace font" subtitle={font} />
            <AdwActionRow title="Dark style" subtitle={prefersDark ? "Preferred" : "Not preferred"} />
        </>
    );
};

export const SystemAppearance = () => {
    const [settings, setSettings] = useState<Gio.Settings | null>(null);

    return (
        <>
            {createPortal(<GSettings ref={setSettings} schemaId={desktopInterface.id} />, rootElement)}
            {settings !== null && <AppearanceRows settings={settings} />}
        </>
    );
};
```

`keys` maps each key to its GVariant type string, or to `enum` or `flags` for a key declared with those attributes; `values` gives the number of each enum nick, or the allowed strings of a key with choices. Copy the key types from the installed `.gschema.xml` under `/usr/share/glib-2.0/schemas`, and the enum numbers from the `.enums.xml` file that declares the enum, here `org.gnome.desktop.enums.xml`. Keep `as const satisfies SettingsSchema` so the hooks see literal types: `font` is a `string`, `scheme` is `0 | 1 | 2`, and a key the object does not list fails `tsc`.

GTKX does not bundle or compile a system schema; the app reads the copy installed on the user's machine. TypeScript cannot check the object against that copy. As in GJS, `GSettings` throws when the schema is not installed, and reading a key the installed schema does not declare throws, so an [error boundary](/v2/guide/error-handling#react-error-boundaries) can handle a missing package or a misspelled name.
