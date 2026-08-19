---
title: "Configuration and Codegen"
description: "Configuring GTKX with gtkx.config.ts, what codegen generates into node_modules/.gtkx, and how GIR becomes the typed JSX prop model."
---

# Configuration and Codegen

Codegen is driven from `gtkx.config.ts`, which declares which libraries to generate bindings for, and your application ID.

## The config file

`defineConfig` from `@gtkx/config` types your config for editor completion and validates it when the CLI loads the file:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.gtkx.tutorial",
});
```

`mergeConfig(base, override)` layers a project config over a shared base. A `$development` or `$production` block layers over the top level, per mode.

### Every option

`applicationId` is the only required key; the rest have defaults.

- **`applicationId`**: the GApplication identifier the app registers under, in reverse-DNS form (`com.example.Tasks`).
- **`libraries`**: the GIR libraries to bind, as `Name-Version`. `Gtk-4.0` is the default, and joins any list that does not already name a Gtk version; the bare string `"*"` (never an array entry) binds everything on the GIR path.
- **`girPath`**: directories searched for `.gir` files ahead of the standard locations.
- **`reactCompiler`**: the React Compiler, on by default. `false` disables it; an object forwards `compilationMode` and `panicThreshold`.
- **`codegen: false`**: skips generation, so the project imports whatever binding store is already installed.
- **`userEventSignals`**: signals, keyed by GLib type name, that GTKX suppresses while writing to a widget itself. Entries merge into the defaults.
- **`elements`**: the [element customizations](#advanced-customizing-elements): `behaviors` is the module default-exporting your `defineElements` map, `config` sets per-type codegen output (`component`, `props`, `omittedProps`, `isLazy`).
- **`future`**: opts into behavior that becomes the default in the next major. See [Future flags](#future-flags).

## What codegen emits

Codegen writes packages into `node_modules/.gtkx` and links them into `node_modules/@gtkx`, so imports resolve without either appearing in your `package.json`:

- **`@gtkx/gi`** is the introspected API, one subpath per namespace (`@gtkx/gi/gtk`, `@gtkx/gi/adw`): the classes, enums, and functions you call imperatively, for refs and values such as `Gtk.Orientation.VERTICAL`.
- **`@gtkx/jsx`** is the React layer, likewise per namespace (`@gtkx/jsx/gtk`, `@gtkx/jsx/adw`): a PascalCase component per widget (`GtkButton`, `AdwHeaderBar`), a `Props` interface for each, and a `React.JSX.IntrinsicElements` augmentation.

Record fields appear as accessors: a getter wherever the read lands on the right memory, and a setter only where a field slot can hold what it stores. `null`-terminated pointer arrays read, so `Gio.DBusNodeInfo.interfaces` hands back its array, but they are read-only and absent from the record's constructor props, since the slot cannot keep an array alive. Fields whose element count lives in a sibling field, and `GList` or `GSList` links, carry no accessor and are absent from the class.

A few bindings take a NUL-terminated C string that GIR describes as a byte array (`GLib.Variant.newBytestring`), so the value silently stops at the first zero byte. Binary payloads go through `GLib.Bytes` and `GLib.Variant.newFromBytes`.

## Passing a GValue

A `GObject.Value` is GObject's boxed value: a GType plus a payload of that type. Every parameter the callee only reads — a `const GValue *` in C — is typed `GObject.Value | JsValue`, as is every `GObject.Value` argument of an emitted signal, so you can pass the JavaScript value itself and the GType is inferred from it:

```ts
Gdk.ContentProvider.newForValue("payload");             // gchararray
Gdk.ContentProvider.newForValue(rgba);                  // GdkRGBA
widget.updateProperty([Gtk.AccessibleProperty.LABEL], ["Save"]);
dropTarget.emit("drop", "payload", x, y);
```

A signal *handler* still receives a `GObject.Value`, since a handler for a binding transform produces its result by writing into the value it is given.

What each JavaScript value infers to:

| Value | GType |
| --- | --- |
| string | `gchararray` |
| boolean | `gboolean` |
| number, whole and within `gint` range | `gint` |
| any other number | `gdouble` |
| `bigint` | `gint64`, or `guint64` from 2^63 up; outside the 64-bit range it throws |
| array of strings | `GStrv` |
| a wrapper instance | the GType it carries |
| `null` | a NULL `gpointer` |

`null` infers a NULL `gpointer` because that is what GJS infers, so code ported from it behaves the same — but few callees accept a `gpointer`, and it is rarely what you want. A nullable parameter takes `null` as *no value at all*, passing the callee a NULL `GValue *`, and clearing a typed slot takes a value of that type holding nothing, such as `TYPE_OBJECT` with `setObject(null)`.

Inference covers what a JavaScript value can say on its own, which leaves two cases for an explicitly initialized value:

**A GType no JavaScript value names.** `guchar`, `guint`, `gfloat`, `glong`, enumerations, flags, and a GValue holding a GType are unreachable, since a number infers as `gint` or `gdouble` and a GType is a `bigint`. Name the type yourself:

```ts
const value = new GObject.Value();
value.init(GObject.TYPE_UCHAR);
value.setUchar(200);
```

**A `GValue` the callee fills in.** A mutable `GValue *` is storage the callee initializes itself — `Gtk.Expression.evaluate`, `Gdk.Display.getSetting`, `Gtk.accessiblePropertyInitValue` — so those parameters are typed `GObject.Value` alone and take one you allocate with `new GObject.Value()`. Handing them an already-initialized value is what `g_value_init` refuses.

**A payload negotiated by an interface GType.** A wrapper infers its own concrete type, so a `Gdk.Texture` becomes `GdkMemoryTexture` and a file from `Gio.File.newForPath` becomes `GLocalFile`. Clipboard and drag-and-drop match GTypes exactly, so a drop target declaring `types={[Gio.File.prototype.__type__]}` never sees a provider built from a bare file. Initialize the value to the interface instead:

```ts
const value = new GObject.Value();
value.init(Gio.File.prototype.__type__);
value.setObject(file);
Gdk.ContentProvider.newForValue(value);
```

Passing a `GObject.Value` you built yourself always works, wherever inference would guess something else.

## Future flags

The `future` block opts into behavior that becomes the default in the next major version, so you can migrate one change at a time instead of all at once during an upgrade. Every flag is off by default, and codegen never warns about one you have not set.

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    future: { v2ByteArrays: true },
});
```

Flag names are camelCase, so the key is `v2ByteArrays`, not `v2_byteArrays`.

- **`v2ByteArrays`**: represents GIR byte sequences as `Uint8Array` instead of `number[]`. It covers `guint8` C arrays and `GByteArray`, in return values, out parameters, record fields, and properties. It does not cover the handwritten Cairo overrides or the OpenGL bindings, which already use typed arrays.

  Parameters accept `Uint8Array | number[]` either way, so turning this flag on never breaks a call site that passes values *in*. What changes is what you get *back*: `GLib.fileGetContents` returns `[boolean, Uint8Array]` rather than `[boolean, number[]]`, so code that calls `.push`, `.concat`, `Array.isArray`, or `JSON.stringify` on a result needs updating. Flip the flag and run `tsc`: every site that needs attention is a type error.

- **`v2ValueReturns`**: hands back what a `GObject.Value` holds rather than the value itself, the read-direction counterpart of the inference above. It covers the bindings whose return type or caller-allocated out parameter is a `GValue`: `Gtk.DropTarget.getValue`, `Gtk.ConstantExpression.getValue`, `Gdk.Clipboard.readValueAsync`, `Gtk.Builder.valueFromStringType`, `Gtk.TreeModel.getValue`, and a handful more. Their type becomes `unknown`, since GIR says nothing about what the value holds, so the call site asserts the type it asked for: `(await clipboard.readValueAsync(Gio.File.prototype.__type__, 0, null)) as Gio.File`. Signal parameters and properties keep handing over a `GObject.Value`, which a handler for a binding transform writes into.

  Unlike the byte sequence flag, this one only changes what comes *back*; the `GObject.Value | JsValue` parameter widening is not part of it and applies either way. `tsc` reports every return site that needs attention, since `unknown` cannot be used without an assertion.

Changing a flag invalidates the generated store, so the next `gtkx dev`, `gtkx build`, or `gtkx codegen` regenerates it automatically.

### When a flag graduates

In the next major each flag's behavior becomes unconditional and its key is removed. Leaving a graduated flag at `true` will be accepted as a no-op with a single warning naming the key, and setting it to `false` will be a configuration error, because at that point it can no longer be honored.

## The JSX prop model

Every GIR class descending from `GObject` becomes an intrinsic element whose props follow these rules:

- **Properties become camelCase props.** Writable, construct, and construct-only properties become optional props: `show-title-buttons` is `showTitleButtons`.
- **Almost every property gets a notify handler.** `onNotifyX` receives `(value, self)`, read-only properties included, so you can observe what GTK4 changes on its own. The element-accepting object properties below are the exception: they carry their value as a child element instead.
- **Object-typed props also accept elements.** A writable, non-construct-only property typed as a GObject class takes a `ReactElement` as well as an instance, and the reconciler manages the child.
- **Signals become `on` handlers.** `clicked` is `onClicked`, `row-activated` is `onRowActivated`, and the handler receives the signal's parameters followed by `self`.
- **`ref` yields the `@gtkx/gi` instance.** Every element accepts `ref?: Ref<Self | null>` (`Gtk.Button`, `Adw.ToastOverlay`), the escape hatch to the imperative API.

```tsx
import type * as Gtk from "@gtkx/gi/gtk";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useRef } from "react";

const SaveButton = () => {
    const buttonRef = useRef<Gtk.Button | null>(null);

    return <GtkButton label="Save" onClicked={(self) => self.setSensitive(false)} ref={buttonRef} />;
};
```

## Generating element reference docs

`gtkx docs` writes one markdown page per JSX element, by default into `docs/reference`:

```bash
gtkx docs
```

Each page carries the widget's documentation, hierarchy, slot rules, props, signal handlers, and `ref` methods with their signatures. `gtkx docs --help` covers the output directory and link root.

## Advanced: Customizing elements

A `GtkScale`'s marks have no property behind them, only `addMark` and `clearMarks`, and adding a child is `insertChildAfter` on a `GtkBox` but `addTopBar` on an `AdwToolbarView`. **Element behaviors** cover what property setting cannot: lifecycle hooks bound to a GLib type, which the reconciler calls as elements of that type are created, populated, updated, and removed. Every hook is listed in the [`ElementBehavior` reference](/reference/@gtkx/react/config/type-aliases/ElementBehavior): `attach`, `reorder`, and `detach` place, move, and remove a child in a slot, `resolve` returns the object the container made for that child, and `flush` runs once the surrounding commit has placed every child. `update` runs on each commit with the previous and next props, and the prop names it returns are the ones GTKX will not also set as plain properties.

`setCursorFromName` is another method with no property behind it. Default-export a map keyed by GLib type name, wrapping each behavior in `defineBehavior` with the class it applies to:

```ts
// src/elements.ts
import type * as Gtk from "@gtkx/gi/gtk";
import { defineBehavior, defineElements } from "@gtkx/react/config";

export default defineElements({
    GtkWidget: {
        behaviors: [
            defineBehavior<Gtk.Widget>({
                update: (widget, prev, next) => {
                    if (!Object.is(prev.cursorName, next.cursorName) && typeof next.cursorName === "string") {
                        widget.setCursorFromName(next.cursorName);
                    }
                    return ["cursorName"];
                },
            }),
        ],
    },
});
```

Pass the class as the type argument so the hooks are typed. Point `elements.behaviors` at the module, then declare the prop on the generated interface:

```ts
// gtkx.config.ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.gtkx.tutorial",
    elements: { behaviors: "./src/elements.ts" },
});
```

```ts
// src/augmentations.d.ts
import "@gtkx/jsx/gtk";

declare module "@gtkx/jsx/gtk" {
    interface GtkWidgetProps {
        cursorName?: string | null | undefined;
    }
}
```

The leading `import` is what makes this an augmentation. Without a top-level import or export, `declare module` becomes an ambient module declaration that shadows the generated one, and `@gtkx/jsx/gtk` stops exporting elements.

A behavior on a type covers every element descending from it, and your behaviors run before the built-in ones, so they override existing prop and slot handling. `isLazy: true` in the same map marks a type whose GObject its parent container creates.

## Next

With the codegen pipeline in hand, continue to [Async Operations](/guide/async-operations).
