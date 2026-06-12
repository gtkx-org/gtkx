# Hooks

`@gtkx/react` ships a small set of hooks for the things props cannot express: reading the application, observing GObject state, persisting settings, and driving per-frame work. All of them follow one convention — a hook that watches a GObject takes a `GObjectTarget`: the instance itself, a `RefObject` holding it, or `null`/`undefined` to stay inactive. Targets resolve on every render, so a subscription follows a ref when a later commit replaces the widget behind it.

## useApplication

Returns the `Gtk.Application` (or `Adw.Application`) that owns the tree. It must be called under a `GtkApplication`/`AdwApplication` component and throws outside one.

```tsx
import { useApplication } from "@gtkx/react";

const TitleBadge = () => {
    const app = useApplication();
    return <GtkLabel label={app.applicationId} />;
};
```

The most common pairing reads the active window for dialog parenting:

```tsx
const app = useApplication();
const activeWindow = useProperty(app, "activeWindow");
```

## useProperty

Subscribes to a GObject property through its `notify::property-name` signal and returns the current value as React state. The value is read synchronously at mount and re-read whenever the subscription reattaches to a different object. An inactive target returns `undefined`, so chaining through nullable objects is safe:

```tsx
import { useProperty } from "@gtkx/react";

const WindowTitle = () => {
    const app = useApplication();
    const activeWindow = useProperty(app, "activeWindow");
    const title = useProperty(activeWindow, "title");
    return <GtkLabel label={title ?? "No window"} />;
};
```

Refs work as targets, and the subscription follows them:

```tsx
const windowRef = useRef<Gtk.Window | null>(null);
const title = useProperty(windowRef, "title");
```

## useSignal

Connects a handler to any signal on a GObject and disconnects on unmount. The handler is kept current without resubscribing, so closures over fresh state are safe. Options: `after` connects the handler after the default stage, and `immediate` invokes it once on connect — useful for syncing initial state.

```tsx
import { useSignal } from "@gtkx/react";

const selection = useMemo(() => new Gtk.MultiSelection({ model: store }), [store]);
useSignal(selection, "selection-changed", () => {
    setSelectedItems(collectSelectedItems(selection));
}, { immediate: true });
```

`notify::` detail strings observe single properties, which is exactly what [useProperty](#useproperty) wraps:

```tsx
const windowRef = useRef<Gtk.Window | null>(null);
useSignal(windowRef, "notify::fullscreened", () => {
    setFullscreened(windowRef.current?.isFullscreen() ?? false);
});
```

::: tip Signals on JSX elements
For widgets you render yourself, prefer the generated `onX` props (`onClicked`, `onNotifyTitle`, …) — they connect through the reconciler. `useSignal` is for objects you construct or receive: models, selections, animations, objects from `@gtkx/gi`.
:::

## useSetting

Reads and writes a GSettings key like `useState`, staying in sync with the backend. The typed form takes a schema imported from your project's `.gschema.xml` — the GTKX bundler turns that import into a typed `SchemaRef`, so keys and value types are checked:

```tsx
import schema from "../com.example.notes.gschema.xml";

const [fontSize, setFontSize] = useSetting(schema, "font-size");
const [compactMode, setCompactMode] = useSetting(schema, "compact-mode");
```

Relocatable schemas (declared without a fixed path) bind to an instance path first:

```tsx
import profile from "../com.example.profile.gschema.xml";

const [theme] = useSetting(profile.at(`/com/example/profiles/${profileId}/`), "theme");
```

For system schemas your project does not ship, the untyped form selects the accessor by an explicit type tag:

```tsx
const [colorScheme, setColorScheme] = useSetting("org.gnome.desktop.interface", "color-scheme", "string");
```

The tutorial's [Settings & preferences chapter](/docs/tutorial/7-settings-and-preferences) builds a full preferences dialog on this hook.

## useTickCallback

Registers a frame-clock tick callback on a widget — the GTK equivalent of `requestAnimationFrame`, fired once per frame while the widget is mapped. Return `true` to keep ticking. Store fast-changing values in refs and queue a redraw instead of setting React state per frame:

```tsx
import { useTickCallback } from "@gtkx/react";

const areaRef = useRef<Gtk.DrawingArea | null>(null);
const angleRef = useRef(0);

useTickCallback(areaRef, (widget, frameClock) => {
    angleRef.current = (frameClock.getFrameTime() / 1_000_000) % (2 * Math.PI);
    widget.queueDraw();
    return true;
});
```

## useAdjustment

Builds a stable `Gtk.Adjustment` for widgets that take one — scales, spin buttons, spin rows. Config fields update the live adjustment in place on re-render; defaults are `value: 0, lower: 0, upper: 100, stepIncrement: 1, pageIncrement: 10, pageSize: 0`.

```tsx
import { useAdjustment } from "@gtkx/react";

const fontSizeAdjustment = useAdjustment({ value: fontSize, lower: 8, upper: 32, stepIncrement: 1 });

<AdwSpinRow title="Font Size" adjustment={fontSizeAdjustment} onNotifyValue={(value) => setFontSize(value ?? 8)} />;
```

## useMergedRefs

Combines an internal ref with a forwarded one into a single callback ref — for components that need their own handle on a widget while still exposing `ref` to callers:

```tsx
import { useMergedRefs } from "@gtkx/react";

const Inner = ({ ref }: { ref?: Ref<Gtk.Entry | null> }) => {
    const entryRef = useRef<Gtk.Entry | null>(null);
    const mergedRef = useMergedRefs(entryRef, ref);
    return <GtkEntry ref={mergedRef} />;
};
```

## Hooks or props?

Props set state on widgets; hooks observe it. If you own the value, render it as a prop and let the reconciler diff it. Reach for a hook when GTK owns the value (window focus, a property another component mutates, a GSettings key, the frame clock) and your UI needs to react to it.

| Hook | Use it for | Reference |
| --- | --- | --- |
| `useApplication` | The owning `Gtk.Application` | [API](/api/react/functions/useApplication) |
| `useProperty` | One GObject property as state | [API](/api/react/functions/useProperty) |
| `useSignal` | Any signal subscription | [API](/api/react/functions/useSignal) |
| `useSetting` | GSettings keys as state | [API](/api/react/functions/useSetting) |
| `useTickCallback` | Per-frame work on a widget | [API](/api/react/functions/useTickCallback) |
| `useAdjustment` | A stable `Gtk.Adjustment` | [API](/api/react/functions/useAdjustment) |
| `useMergedRefs` | Forwarding plus internal refs | [API](/api/react/functions/useMergedRefs) |
