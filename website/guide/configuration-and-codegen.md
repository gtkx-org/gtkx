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

For sharing a base config across packages, `mergeConfig(base, override)` deep-merges configs with the override winning on conflict. The config is loaded per mode, so a `$development` or `$production` block layers over the top-level values when `gtkx dev` or `gtkx build` reads the file.

## What codegen emits

Codegen writes packages into `node_modules/.gtkx` and links them into `node_modules/@gtkx` so imports resolve without either package appearing in your `package.json`:

- **`@gtkx/gi`** (in `node_modules/.gtkx/gi`) holds the raw introspected API: one lowercased directory per namespace, exposed as subpath exports such as `@gtkx/gi/gtk` and `@gtkx/gi/adw`. These are the classes, enums, and functions you use imperatively, for refs, `Gtk.Orientation.VERTICAL`, and direct method calls. Reach for them for what only the GNOME platform provides, and use the Node standard library for everything else. The generated TypeScript is type-checked and compiled to JavaScript plus `.d.ts` inside the store, which codegen builds in a temporary directory and then renames into place, so a crash never leaves half a package.
- **`@gtkx/jsx`** (in `node_modules/.gtkx/jsx`) holds the React layer: per-namespace modules exporting one PascalCase component per widget (`GtkButton`, `AdwHeaderBar`), a `Props` interface for each, and a global `React.JSX.IntrinsicElements` augmentation so the elements type-check. It also emits a `metadata` module recording, per element, the signal-handler-to-signal-name map, the construct-only and constructable prop sets, the GIR default values, and the merged element prop rules. The reconciler reads that metadata at runtime through the `virtual:gtkx-config` module the CLI's Vite plugin serves. The same pass that generates your types generates that metadata, so your types and runtime prop application cannot drift.

### Byte arrays that are really C strings

A handful of C functions take a NUL-terminated `const char *` that GIR describes as an array of bytes. The generated signature reads like a byte buffer, `GLib.Variant.newBytestring(string: number[])`, but the C function calls `strlen` on it, so the value stops at the first zero byte and everything after it is dropped with no error.

Codegen detects that shape from the GIR and appends a note to the binding's documentation naming the affected parameter, so the constraint is visible in your editor and in the API reference. For binary payloads, go through `GLib.Bytes` instead:

```ts
const variant = GLib.Variant.newFromBytes(GLib.VariantType.new("ay"), GLib.Bytes.new(buffer), true);
variant.getDataAsBytes().getData(); // every byte, including zeros
```

## The JSX prop model

Every GIR class whose ancestry reaches `GObject` becomes an intrinsic element, and its props interface is assembled from the GIR according to a small set of rules:

- **Properties become camelCase props.** Every introspectable property that is writable, construct, or construct-only becomes an optional prop under its camelCase name: GIR's `show-title-buttons` is `showTitleButtons`. Property and signal documentation from the GIR is carried onto the generated props as JSDoc, so hovering a prop in your editor shows the upstream documentation.
- **Every property gets a notify handler.** Each introspectable property gets an `onNotifyX` prop whose handler receives `(value, self)`, including read-only ones, except writable object-valued (element-accepting) properties, which expose the value as a child element prop instead. This is how you observe properties GTK4 changes on its own, such as a window's `defaultWidth`.
- **Object-typed props also accept elements.** A writable, non-construct-only property whose type is itself a GObject class accepts a `ReactElement` in addition to an instance, so you can write `sidebar={<AdwNavigationPage ... />}` and let the reconciler construct and manage the child.
- **Signals become `on` handlers.** Every signal becomes `on` plus the UpperCamelCase signal name (`clicked` becomes `onClicked`, `row-activated` becomes `onRowActivated`), and the handler receives the signal's parameters followed by `self`, the widget instance, with parameter types rendered from the GIR.
- **`ref` yields the native instance.** Every element accepts `ref?: Ref<Self | null>`, where `Self` is the `@gtkx/gi` class (`Gtk.Button`, `Adw.ToastOverlay`). This is your escape hatch to the full imperative API.

## Generating element reference docs

The same pipeline that generates the bindings can document them. `gtkx docs` loads the GIR data for your configured libraries and writes one markdown page per JSX element:

```bash
gtkx docs
```

By default the pages land in `docs/reference`, one directory per namespace plus index pages, with cross-page links rooted at `/reference` so the output drops straight into a static site generator or anything else that renders markdown. Each element page carries the widget's upstream documentation, its hierarchy, and its children and slot rules. It then documents the element's own props with their types and defaults, its own signal handlers with their exact signatures, and its own methods reachable through `ref`. Members inherited from an ancestor are documented on that ancestor's page, which the hierarchy links to. A `manifest.json` alongside the pages records the namespace and element lists, which is what you want for generating a sidebar.

Run `gtkx docs --help` if you need the pages somewhere else or their links rooted elsewhere.

## Advanced: Customizing elements

Property setting alone cannot express everything GTK4 does. Adding a child is `insertChildAfter` on a `GtkBox` but `addTopBar` on an `AdwToolbarView`; a `GtkScale`'s marks have no property at all, only `addMark` and `clearMarks`. GTKX bridges this with **element behaviors**: a behavior is a small object of React-node lifecycle hooks bound to a GLib type, and the reconciler calls its hooks as elements of that type are created, populated, updated, and removed. A built-in set covers GTK4 and Adwaita (containers for many types, controllers, actions, breakpoints, controlled text on `GtkEditable`, and more); you register your own through the `elements` module, keyed by GLib type name with `defineElements`.

Every hook receives the GObject instance and a private per-element `context` built once by the behavior's `initialize(object)`. The hooks are:

- **`attach` / `detach`** place and remove a child in a slot. `attach` receives the child plus placement info (`slot`, `index`, `sibling`); returning a non-`undefined` value claims the child, and a returned GObject becomes the object the container adopts (otherwise `resolve` supplies it). A child no behavior claims is set on its named property directly.
- **`reorder`** moves an already-placed child; without it, a reordered slot is rebuilt.
- **`resolve`** returns the object the container created for a placed child (a page, a layout child), used by later `reorder` and `detach`.
- **`update`** runs on every commit with the previous and next props; apply scalar or array props here, and return the prop names you handled so GTKX does not also set them as plain properties.
- **`flush`** runs just after the surrounding commit settles, for props that must wait until children exist, as `GtkStack`'s `visibleChildName` does.

Your own behaviors go through the same machinery. GTK4's named-cursor API is a method with no property behind it: `setCursorFromName("pointer")` shows the pointer cursor while hovering a widget, whereas the `cursor` property takes a `Gdk.Cursor` object. Write a module that default-exports a map keyed by GLib type name, giving each type its `behaviors` and wrapping each one in `defineBehavior` with the class it applies to:

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

The type argument is what gives `widget` its type. A behavior written as a bare object literal still works, but each hook's object parameter is then typed `never`, so it has to be annotated by hand.

Point `elements.behaviors` at it and declare the prop on the generated interface:

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
declare module "@gtkx/jsx/gtk" {
    interface GtkWidgetProps {
        cursorName?: string | null | undefined;
    }
}
```

Every widget element then accepts a `cursorName` prop and the reconciler calls `setCursorFromName` whenever the value changes. A behavior declared on a type covers every element descending from it, which is how the built-in `controllers` behavior on `GtkWidget` reaches all widgets. Your behaviors are consulted before the built-in ones, so you can also override how an existing slot or prop behaves. The same map's `isLazy: true` marks a type whose GObject its parent container creates (a page or layout child), so its element defers construction until the parent adopts it.

## Next

With the codegen pipeline in hand, continue to [Async Operations](/guide/async-operations).
