---
title: "Configuration and Codegen"
description: "Configuring GTKX with gtkx.config.ts, what codegen generates into node_modules/.gtkx, how staleness is detected, and how GIR becomes the typed JSX prop model."
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

## Option reference

`defineConfig` accepts:

**`applicationId`** is the only required option. It must be a valid `g_application_id_is_valid` ID, reverse-DNS form such as `org.example.MyApp`. It identifies your app to D-Bus and GNOME, and it flows into your component tree automatically (see [How applicationId flows](#how-applicationid-flows) below).

**`libraries`** lists GObject-Introspection namespaces in `Name-Version` form, such as `"Gtk-4.0"`, `"Adw-1"`, or `"GtkSource-5"`. Omitting it gives you `["Gtk-4.0"]`; naming libraries explicitly prepends `Gtk-4.0` unless your list already contains a `Gtk-` entry, because the GTK4 bindings are the foundation everything else builds on. The wildcard `"*"` discovers every `.gir` file on the search path and binds the highest version of each namespace, which pulls in the entire installed platform at once.

**`girPath`** adds directories to the front of the `.gir` search path. You only need this when your GIR files live somewhere nonstandard, such as a locally built GTK4.

**`reactCompiler`** controls the React Compiler, which is enabled by default. Set it to `false` to disable it, or pass `{ compilationMode, panicThreshold }` to tune it.

**`userEventSignals`** maps GLib type names to signal names that represent user interaction, such as `{ GtkEditable: ["changed"] }`. While a React commit is applying your props, these signals are suppressed on the committing tree, so a handler like `onChanged` only ever reports the user editing the widget and never echoes a programmatic write React itself performed. A built-in table covers GTK4 and Adwaita; entries you add here are unioned with it, and the type name may be a class or an interface, applying to every type that inherits or implements it.

**`elements`** carries per-element configuration keyed by GLib type name. Its `behaviors` key points at a module of custom `behaviors` and `lazy` flags, covered in [Customizing elements](#advanced-customizing-elements) below; that module is imported by your app at runtime. Its `config` key holds the entries codegen reads: `component` and `props` override what a generated element renders and extends, and `omittedProps` lists properties to leave out of an element's generated props.

**`classStructs`** lists qualified GIR record names to treat as class structs, such as `["Pango.AttrClass"]`. A class struct is a vtable rather than data, so it is never bound: the record gets no class, and any function mentioning one is left out. GIR marks them with `glib:is-gtype-struct-for` and codegen follows that, plus a built-in list of the few the annotation cannot cover (`GObject.TypeClass` and `GObject.TypeInterface` are what it points at, and `GObject.EnumClass`, `GObject.FlagsClass`, `GObject.TypePluginClass`, `Pango.AttrClass` and `Gtk.EditableClass` predate it). Names you add here extend that list, for a library that ships an unannotated vtable of its own.

**`codegen`** controls binding generation, which is on by default. Set it to `false` for a project that already has a binding store installed, such as an example inside a workspace that shares the store built at the root: the CLI then resolves that installed store instead of generating its own. A project with generation turned off has no GIR data of its own, so `gtkx docs` has nothing to document there.

## What codegen emits

Codegen writes packages into `node_modules/.gtkx` and links them into `node_modules/@gtkx` so imports resolve without either package appearing in your `package.json`:

- **`@gtkx/gi`** (in `node_modules/.gtkx/gi`) holds the raw introspected API: one lowercased directory per namespace, exposed as subpath exports such as `@gtkx/gi/gtk` and `@gtkx/gi/adw`. These are the classes, enums, and functions you use imperatively, for refs, `Gtk.Orientation.VERTICAL`, and direct method calls. Reach for them for what only the GNOME platform provides, and use the Node standard library for everything else. The generated TypeScript is type-checked and compiled to JavaScript plus `.d.ts` inside the store, which codegen builds in a temporary directory and then renames into place, so a crash never leaves half a package.
- **`@gtkx/jsx`** (in `node_modules/.gtkx/jsx`) holds the React layer: per-namespace modules exporting one PascalCase component per widget (`GtkButton`, `AdwHeaderBar`), a `Props` interface for each, and a global `React.JSX.IntrinsicElements` augmentation so the elements type-check. It also emits a `metadata` module recording, per element, the signal-handler-to-signal-name map, the construct-only and constructable prop sets, the GIR default values, and the merged element prop rules. The reconciler reads that metadata at runtime through the `virtual:gtkx-config` module the CLI's Vite plugin serves. The same pass that generates your types generates that metadata, so your types and runtime prop application cannot drift.

Both stores are generated code standing on a hand-written floor: `@gtkx/runtime`, the dependency the scaffolder installs for you. It owns the type descriptors behind every FFI call, GValue marshalling, signal connection, and the registry that maps a native handle back to its JavaScript object. It is also where you reach when generated bindings are not enough, chiefly `registerClass` for defining a GObject subclass of your own. Its surface is in the [@gtkx/runtime reference](/reference/@gtkx/runtime/).

Alongside the stores, the CLI writes `node_modules/.gtkx/env.d.ts` with a typed module declaration for every `.gschema.xml` file under your data directory (the folder your `package.json` `imports` field maps `#data/*` to, `data/` in a scaffolded project), keyed by its `#data/...` import specifier. Each key's GVariant type maps to a natural TypeScript type:

| GVariant type | TypeScript type |
| --- | --- |
| `b` | `boolean` |
| `y`, `n`, `q`, `i`, `u`, `h`, `d` | `number` |
| `x`, `t` | `bigint` |
| `s`, `o`, `g` | `string` |
| `v` | `GLib.Variant` |
| enum or flags key | `number` |
| array `a<T>` | `T[]` (`as` is `string[]`) |
| dictionary `a{k v}` | `Record<string, V>` for string keys, `Map<K, V>` otherwise |
| tuple `(...)` | a tuple of the element types, e.g. `(ii)` is `[number, number]` |
| maybe `m<T>` | `T \| null` |
| dict entry `{k v}` | `[K, V]` |

Each schema exports a typed const carrying its `id` and a `keys` map; a schema declared without a path (a relocatable schema) additionally gets an `at(path)` method that returns the same typed reference bound to a concrete path. `gtkx codegen`, `gtkx dev`, and `gtkx build` all keep this file in sync.

## How applicationId flows

The `applicationId` you set in config reaches your running app through the build. The CLI's Vite plugin serves a `virtual:gtkx-config` module that re-exports the jsx metadata together with your resolved `applicationId`. In `@gtkx/react`, the application component factory imports that value and uses it as the default for the `applicationId` prop, and codegen wraps every element descending from `GtkApplication` in that factory. Both `<GtkApplication>` and `<AdwApplication>` therefore carry your configured ID without you passing it, the wrapper runs the application when it mounts and quits it on unmount, and it provides the application instance to the tree via context (retrievable with `useApplication`). Passing an explicit `applicationId` prop overrides the default, which is how a test or a secondary tool can run under a different identity.

The ID also anchors the rest of your app's platform identity. GSettings schemas conventionally use it as their schema ID (the tutorial's schema is `com.gtkx.tutorial` in `com.gtkx.tutorial.gschema.xml`), desktop notifications and D-Bus activation key off it, and the CLI derives your GResource prefix from it by replacing dots with slashes.

## Staleness and regeneration

You rarely run `gtkx codegen` by hand, because `gtkx dev` and `gtkx build` check freshness first and regenerate only when something changed. The check has these layers:

1. **Structural**: if a store directory or its link is missing, a namespace barrel for one of your libraries is absent, or the jsx store lacks its generated modules, the bindings are stale regardless of content.
2. **Fingerprint**: the gi store carries a `.codegen-fingerprint.json` sentinel holding a SHA-256 hash over the codegen package version, the element prop types the generated elements extend, the sorted library list, and the path and full contents of every `.gir` file that fed the last run. On each check the hash is recomputed against the recorded GIR files; any mismatch, including a system GTK4 upgrade that rewrote a `.gir`, triggers regeneration. A changed library list is stale by definition.

While `gtkx dev` runs, it also watches `gtkx.config.ts`. Saving a change regenerates the bindings and restarts the dev runner for you, so adding a library or an element prop rule takes effect without stopping `gtkx dev` yourself. If codegen fails, the current runner keeps going and the error is printed; fix it and save again.

To force a clean rebuild, run:

```bash
gtkx codegen --force
```

This deletes both stores and their links before regenerating, which is the right lever when you suspect the store is corrupt rather than stale.

## The JSX prop model

Every GIR class whose ancestry reaches `GObject` becomes an intrinsic element, and its props interface is assembled from the GIR according to a small set of rules:

- **Properties become camelCase props.** Every introspectable property that is writable, construct, or construct-only becomes an optional prop under its camelCase name: GIR's `show-title-buttons` is `showTitleButtons`. Property and signal documentation from the GIR is carried onto the generated props as JSDoc, so hovering a prop in your editor shows the upstream documentation.
- **Every property gets a notify handler.** Each introspectable property gets an `onNotifyX` prop whose handler receives `(value, self)`, including read-only ones, except writable object-valued (element-accepting) properties, which expose the value as a child element prop instead. This is how you observe properties GTK4 changes on its own, such as a window's `defaultWidth`.
- **Object-typed props also accept elements.** A writable, non-construct-only property whose type is itself a GObject class accepts a `ReactElement` in addition to an instance, so you can write `sidebar={<AdwNavigationPage ... />}` and let the reconciler construct and manage the child.
- **Props a container fills from its children are left out.** An element whose config lists `omittedProps` drops those properties from its generated props entirely, so each slot has exactly one spelling. That is how the `child` property of every `setChild` container and the `content` property of `AdwToolbarView`, the split views, and the Adwaita windows disappear: JSX `children` writes them. The list is explicit per GLib type, and your own entries are added to the built-in ones.
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

Every hook receives the GObject instance and a private per-element `context` built once by the behavior's `createContext(node)`. The hooks are:

- **`attach` / `detach`** place and remove a child in a slot. `attach` receives the child plus placement info (`slot`, `index`, `sibling`); returning a non-`undefined` value claims the child, and a returned GObject becomes the object the container adopts (otherwise `resolve` supplies it). A child no behavior claims is set on its named property directly.
- **`reorder`** moves an already-placed child; without it, a reordered slot is rebuilt.
- **`resolve`** returns the object the container created for a placed child (a page, a layout child), used by later `reorder` and `detach`.
- **`update`** runs on every commit with the previous and next props; apply scalar or array props here, and return the prop names you handled so GTKX does not also set them as plain properties.
- **`flush`** runs just after the surrounding commit settles, for props that must wait until children exist, as `GtkStack`'s `visibleChildName` does.
- **`mount` / `unmount`** run once the element is created and when it leaves the tree.

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

Every widget element then accepts a `cursorName` prop and the reconciler calls `setCursorFromName` whenever the value changes. A behavior declared on a type covers every element descending from it, which is how the built-in `controllers` behavior on `GtkWidget` reaches all widgets. Your behaviors are consulted before the built-in ones, so you can also override how an existing slot or prop behaves. The same map's `lazy: true` marks a type whose GObject its parent container creates (a page or layout child), so its element defers construction until the parent adopts it.

## Next

With the codegen pipeline in hand, continue to [Async Operations](/guide/async-operations).
