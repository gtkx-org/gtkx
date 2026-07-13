---
description: "The complete gtkx.config.ts option reference, what codegen generates into node_modules/.gtkx, how staleness is detected, and how GIR becomes the typed JSX prop model."
---

# Configuration and Codegen

Everything gtkx knows about your project comes from one file: `gtkx.config.ts`. The CLI reads it, resolves the GObject-Introspection data for the libraries you name, and generates the typed bindings your code imports. This page is the full reference for that pipeline: every config option, what codegen emits and where, how it decides when to regenerate, and how a `.gir` file turns into the props you type in JSX. If you have not scaffolded a project yet, start with [Getting Started](/guide/getting-started); this page picks up where its codegen section leaves off.

## The config file

`defineConfig` from `@gtkx/config` types your config for editor completion and validates it when the CLI loads the file:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.gtkx.tutorial",
});
```

The export can also be a function `(env) => config`, where `env.mode` is the mode the CLI is running in: `gtkx dev` loads the config with mode `development` and `gtkx build` with mode `production`. Mode-specific overrides can live inline as `$`-prefixed layers that deep-merge over the base when that mode is active:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.gtkx.tutorial",
    $development: {
        applicationId: "com.gtkx.tutorial.Devel",
    },
});
```

For sharing a base config across packages, `mergeConfig(base, override)` deep-merges two configs with the override winning on conflict.

## Option reference

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `applicationId` | `string` (required) | none | The GApplication ID; defaults the `applicationId` prop of application elements |
| `libraries` | `"*"` or `string[]` | `["Gtk-4.0"]` | GIR namespaces to generate bindings for |
| `girPath` | `string[]` | none | Extra directories searched for `.gir` files |
| `elementProps` | `Record<string, ElementProp[]>` | `{}` | Custom JSX prop rules merged over the built-ins |
| `reactCompiler` | `boolean` or options object | enabled | React Compiler over your sources in the Vite build |
| `codegen` | `boolean` | `true` | `false` disables generation and uses installed bindings |

**`applicationId`** is the only required option. It must satisfy `g_application_id_is_valid`: dot-separated reverse-DNS segments, each starting with a letter or underscore, at most 255 characters (for example `org.example.MyApp`). It identifies your app to D-Bus and GNOME, and it flows into your component tree automatically (see [How applicationId flows](#how-applicationid-flows) below). By convention it is also the ID of your GSettings schema and, with dots turned into slashes, the prefix under which the CLI bundles your GResources.

**`libraries`** lists GObject-Introspection namespaces in `Name-Version` form, such as `"Gtk-4.0"`, `"Adw-1"`, or `"GtkSource-5"`. Omitting it gives you `["Gtk-4.0"]`; naming libraries explicitly prepends `Gtk-4.0` unless your list already contains a `Gtk-` entry, because the GTK bindings are the foundation everything else builds on. The wildcard `"*"` discovers every `.gir` file on the search path and binds the highest version of each namespace, which pulls in the entire installed platform at once.

**`girPath`** adds directories to the front of the `.gir` search path. The resolved order is: your `girPath` entries, then the colon-separated `GTKX_GIR_PATH` environment variable, then `/usr/share/gir-1.0`, then whatever `pkg-config --variable=girdir gobject-introspection-1.0` reports, with duplicates removed. You only need this when your GIR files live somewhere nonstandard, such as a locally built GTK.

**`reactCompiler`** controls the React Compiler, which is enabled by default with its target fixed to React 19. Set it to `false` to disable it, or pass `{ compilationMode, panicThreshold }` to tune it: `compilationMode` is one of `"infer"`, `"syntax"`, `"annotation"`, or `"all"`, and `panicThreshold` is one of `"none"`, `"critical_errors"`, or `"all_errors"`.

**`codegen: false`** turns generation off entirely: the CLI deletes the local `node_modules/.gtkx/gi` and `node_modules/.gtkx/jsx` stores along with the `@gtkx/gi` and `@gtkx/jsx` links, and module resolution falls through to bindings installed as a regular dependency. This is for consuming a prebuilt binding package instead of generating against the local system.

**`elementProps`** deserves its own section; see [Customizing elements with elementProps](#customizing-elements-with-elementprops).

## What codegen emits

Codegen writes two packages into `node_modules/.gtkx` and links them into `node_modules/@gtkx` so imports resolve without either package appearing in your `package.json`:

- **`@gtkx/gi`** (in `node_modules/.gtkx/gi`) holds the raw introspected API: one lowercased directory per namespace, exposed as subpath exports such as `@gtkx/gi/gtk` and `@gtkx/gi/adw`. These are the classes, enums, and functions you use imperatively, for refs, `Gtk.Orientation.VERTICAL`, and direct method calls. The generated TypeScript is type-checked and compiled to JavaScript plus `.d.ts` inside the store, and the store is written atomically (built in a temporary directory, then renamed into place) so a crash mid-generation never leaves you with half a package.
- **`@gtkx/jsx`** (in `node_modules/.gtkx/jsx`) holds the React layer: per-namespace modules exporting one PascalCase component per widget (`GtkButton`, `AdwHeaderBar`), a `Props` interface for each, and a global `React.JSX.IntrinsicElements` augmentation so the elements type-check. It also emits a `metadata` module recording, per element, the signal-handler-to-signal-name map, the construct-only and constructable prop sets, the GIR default values, and the merged element prop rules. The reconciler consumes that metadata at runtime through the `virtual:gtkx-config` module the CLI's Vite plugin serves, so the same generation pass that produces your types also drives prop application at runtime and the two cannot drift.

Alongside the stores, the CLI writes `node_modules/.gtkx/env.d.ts` with a typed module declaration for every `.gschema.xml` file under your data directory, keyed by its `#data/...` import specifier. Each key's GVariant type maps to a natural TypeScript type: `b` to `boolean`, `i`, `u`, `x`, `t`, and `d` to `number`, `s` to `string`, and `as` to `string[]`; an enum key becomes a string-literal union of its nicks, a flags key an array of that union, a string key with `<choices>` a union of those choices, and anything else falls back to `GLib.Variant`. Each schema exports a typed const carrying its `id` and a `keys` map, and a schema declared without a path (a relocatable schema) additionally gets an `at(path)` method that returns the same typed reference bound to a concrete path. `gtkx codegen`, `gtkx dev`, and `gtkx build` all keep this file in sync.

## Staleness and regeneration

You rarely run `gtkx codegen` by hand, because `gtkx dev` and `gtkx build` check freshness first and regenerate only when something changed. The check has two layers:

1. **Structural**: if a store directory or its link is missing, a namespace barrel for one of your libraries is absent, or the jsx store lacks its generated modules, the bindings are stale regardless of content.
2. **Fingerprint**: the gi store carries a `.codegen-fingerprint.json` sentinel holding a SHA-256 hash over the codegen package version, your `elementProps` (serialized), the sorted library list, and the path and full contents of every `.gir` file that fed the last run. On each check the hash is recomputed against the recorded GIR files; any mismatch, including a system GTK upgrade that rewrote a `.gir`, triggers regeneration. A changed library list is stale by definition.

While `gtkx dev` runs, it also watches `gtkx.config.ts` itself and regenerates when you edit it, so adding a library or an element prop rule takes effect without restarting.

To force a clean rebuild, run:

```bash
gtkx codegen --force
```

This deletes both stores and their links before regenerating, which is the right lever when you suspect the store is corrupt rather than stale.

## The JSX prop model

Every GIR class whose ancestry reaches `GObject` becomes an intrinsic element, and its props interface is assembled from the GIR according to a small set of rules:

- **Properties become camelCase props.** Every introspectable property that is writable, construct, or construct-only becomes an optional prop under its camelCase name: GIR's `show-title-buttons` is `showTitleButtons`. Property and signal documentation from the GIR is carried onto the generated props as JSDoc, so hovering a prop in your editor shows the upstream GTK documentation.
- **Every property gets a notify handler.** Each introspectable property, including read-only ones, gets an `onNotifyX` prop whose handler receives `(value, self)`. This is how you observe properties GTK changes on its own, such as a window's `defaultWidth`.
- **Object-typed props also accept elements.** A writable, non-construct-only property whose type is itself a GObject class accepts a `ReactElement` in addition to an instance, so you can write `sidebar={<AdwNavigationPage ... />}` and let the renderer construct and manage the child. The one exception is `child` on widgets with a `setChild` method, where JSX `children` already covers the element case.
- **Signals become `on` handlers.** Every signal becomes `on` plus the UpperCamelCase signal name (`clicked` becomes `onClicked`, `row-activated` becomes `onRowActivated`), and the handler receives the signal's parameters followed by `self`, the widget instance, with parameter types rendered from the GIR.
- **`ref` yields the native instance.** Every element accepts `ref?: Ref<Self | null>`, where `Self` is the `@gtkx/gi` class (`Gtk.Button`, `Adw.ToastOverlay`). This is your escape hatch to the full imperative API.
- **`children` appears where it means something.** Widgets and types with a `children` container rule accept `children?: ReactNode`; container rules with other prop names surface as `ReactNode` props instead, which is why `AdwToolbarView` takes `topBar` and `bottomBar` and `AdwHeaderBar` takes `start` and `end`.
- **Construct-only props apply once.** Props backed by construct-only GIR properties are typed like any other but participate only in construction; the reconciler skips them on updates, so changing one on a mounted element has no effect.
- **Removing a prop restores the GIR default.** The metadata records the default value each property declares in the GIR, and when a prop disappears between renders the reconciler resets the property to that default instead of leaving the last value behind. Your JSX therefore describes the widget's full state, exactly as it would in React DOM.

## Customizing elements with elementProps

Property setting alone cannot express everything GTK does. Adding a child is `append` on a `GtkBox` but `addTopBar` on an `AdwToolbarView`; a `GtkScale`'s marks have no property at all, only `addMark` and `clearMarks`. gtkx bridges this with element prop rules: small declarative records that tell the renderer which method calls realize a given JSX prop. A large built-in set covers GTK and libadwaita (containers for over seventy types, controllers, actions, breakpoints, controlled text on `GtkEditable`, and more), and `elementProps` in your config layers your own rules on top. There are five kinds:

- **`container`**: children held under `prop` (usually `children`) of GObject type `child`, attached with `append`, detached with `remove`, optionally supporting `insert` and `reorder`, wrapping each child in an `autowrap` widget type, or adopting children the widget creates itself via `adopt`. At least one of `append` or `remove` is required.
- **`value`**: a scalar prop applied by invoking `call` whenever it changes, optionally followed by `after`. The built-in `GtkDrawingArea` rule is `{ kind: "value", prop: "drawFunc", call: "setDrawFunc", after: "queueDraw" }`.
- **`controlled-text`**: a text property kept in controlled-input sync with the user's edits, as the built-in `GtkEditable` rule does for `text`.
- **`lazy`**: a property applied after construction rather than during it, optionally deferred until a `lookup` method succeeds; `GtkStack`'s `visibleChildName` waits for `getChildByName` to find the named child.
- **`list`**: an array prop mapped to per-item calls: `add` per item, plus optional `remove` and `clear`. `GtkScale`'s `marks` uses `addMark` and `clearMarks`.

A rule references methods by their camelCase names, and each method call is either a bare string or `{ method, args }` where an argument is a reference (`"child"`, `"item"`, `"index"`, `"sibling"`), a React prop read (`{ prop }`), a list-item field with optional fallback (`{ field, or }`), or a constant (`{ literal }`). In `value` and `list` rules, a bare-string call whose method takes more than one parameter is expanded automatically: the parameters become `{ field }` arguments named after the GIR parameter names, with defaults inferred from the types (nullable becomes `null`, numeric `0`, boolean `false`). That expansion is also what types the prop: `GtkApplication`'s `actionAccels` rule points at `setAccelsForAction`, so the prop is typed as `{ detailedActionName: string; accels: string[] }[]` straight from the method signature.

User rules go through the same machinery. `GtkFixed` has no built-in container rule, so out of the box it accepts no JSX children; one config entry fixes that:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.gtkx.tutorial",
    elementProps: {
        GtkFixed: [
            {
                kind: "container",
                prop: "children",
                child: "GtkWidget",
                append: { method: "put", args: ["child", { prop: "x" }, { prop: "y" }] },
                remove: "remove",
            },
        ],
    },
});
```

After the next codegen, `<GtkFixed>` accepts children and positions each with `put(child, x, y)`, reading `x` and `y` from the child's props; because the `{ prop }` arguments map to typed method parameters, those props are typed as `number` on the child. Every rule is validated against the GIR index when codegen runs: a type name that is not in your generated libraries, a method that does not exist on the host type, or a prop that is not a property all fail with an error naming the exact `elementProps` path. Your rules merge over the built-ins, with a user rule replacing a built-in that targets the same prop (and, for containers, the same child type), so you can also override built-in behavior, not just extend it.

::: tip
The generated `ELEMENT_PROPS` metadata in `node_modules/.gtkx/jsx` shows the final merged and expanded rule set, which is the quickest way to see exactly what a built-in does before overriding it.
:::

## Generating element reference docs

The same pipeline that generates the bindings can document them. `gtkx docs` loads the GIR data for your configured libraries, applies your `elementProps` rules, and writes one markdown page per JSX element:

```bash
gtkx docs
```

By default the pages land in `docs/reference`, one directory per namespace plus index pages, with cross-page links rooted at `/reference` so the output drops straight into a static site generator or anything else that renders markdown. Each element page carries the widget's upstream GTK documentation, its hierarchy, its children and slot rules, every prop with its type and default, every signal handler with its exact signature, and the methods reachable through `ref`. A `manifest.json` alongside the pages records the namespace and element lists, which is what you want for generating a sidebar.

Three flags cover the knobs: `--out <dir>` changes the output directory, `--base-path <path>` changes the URL prefix used in links between pages, and `--force` regenerates even when the same fingerprint check that guards codegen says the pages are current. Because your `elementProps` feed the generator, custom rules like the `GtkFixed` container above appear in the generated pages too.

## How applicationId flows

The `applicationId` you set in config reaches your running app through the build. The CLI's Vite plugin serves a `virtual:gtkx-config` module that re-exports the jsx metadata together with your resolved `applicationId`. In `@gtkx/react`, the application component factory imports that value and uses it as the default for the `applicationId` prop, and codegen wraps every element descending from `GtkApplication` in that factory. Both `<GtkApplication>` and `<AdwApplication>` therefore carry your configured ID without you passing it, the wrapper runs the application when it mounts and quits it on unmount, and it provides the application instance to the tree via context (retrievable with `useApplication`). Passing an explicit `applicationId` prop overrides the default, which is how a test or a secondary tool can run under a different identity.

The ID also anchors the rest of your app's platform identity. GSettings schemas conventionally use it as their schema ID (the tutorial's schema is `com.gtkx.tutorial` in `com.gtkx.tutorial.gschema.xml`), desktop notifications and D-Bus activation key off it, and the CLI derives your GResource prefix from it by replacing dots with slashes. One string in one file, and every layer that needs to know who your app is agrees.
