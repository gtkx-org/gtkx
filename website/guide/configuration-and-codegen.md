---
title: "Configuration and Codegen"
description: "Configure a GTKX project and generate its bindings."
---

# Configuration and Codegen

`gtkx.config.ts` identifies your application and selects the libraries GTKX generates bindings for. This page covers GTKX 1.6; the [2.0 guide](/v2/guide/configuration-and-codegen) describes the new defaults.

## The config file

Create `gtkx.config.ts` in the project root:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
    future: { v2DefaultLibraries: true },
});
```

GTKX 1.x includes `Gtk-4.0` by default. Enabling `v2DefaultLibraries` also includes `Adw-1`, providing the Adwaita foundation used throughout these guides. List additional libraries by GIR name and version, for example `libraries: ["WebKit-6.0"]`.

`defineConfig` provides editor completion. The CLI validates the configuration when it loads it. The application ID is required and uses a reverse-DNS name such as `com.example.Tasks`.

Install the corresponding GIR files before generating bindings. Use `girPath` when they live outside the standard search directories. Supplying a newer GIR file changes the declarations, not the library that runs your app.

### Other settings {#every-option}

Use the [configuration reference](/reference/@gtkx/config/index/type-aliases/Config) for available settings. The React Compiler is enabled by default; `reactCompiler: false` disables it. Application icons and package metadata are covered in [Deploying](/guide/deploying), and agent tool settings in [MCP](/guide/mcp).

For shared configuration, `mergeConfig(base, override)` applies the override over the base; arrays concatenate with override entries first. `$development` and `$production` blocks provide mode-specific overrides.

## What codegen emits

Run generation after installing dependencies or changing the configured libraries:

```bash
gtkx codegen
```

GTKX generates real modules under `node_modules/.gtkx` and links them as `@gtkx/gi` and `@gtkx/jsx`. They belong to the project and are not separate npm dependencies. Development and production builds also check whether generation is needed.

Import classes, enums, and functions from GI modules, and elements from JSX modules:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwHeaderBar } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
```

The stable release also supports importing elements from the bare `@gtkx/jsx` entry point. Prefer namespace imports when preparing for 2.0, which removes that entry point. Use [`@gtkx/cairo`](/guide/cairo) for Cairo; the stable `@gtkx/gi/cairo` compatibility export is also removed in 2.0.

`codegen: false` reuses an installed binding store. Leave generation enabled for an ordinary application so its bindings stay aligned with its configuration.

## The JSX prop model

Generated elements follow the native API with GTKX naming conventions:

- Properties use camelCase, such as `showTitleButtons`.
- Signals use handler props, such as `onClicked`. GTKX passes the emitting object after the signal arguments.
- Property notifications use `onNotifyX`, receiving the new value and the emitting object.
- Object properties that accept elements can be expressed as JSX, with GTKX managing their lifetime.
- Refs expose the corresponding GI instance for imperative APIs.

Prefer JSX for object creation and child placement. The [generated element reference](#generating-element-reference-docs) shows the exact props, slots, and signals for each configured library.

## Passing a GType

GTKX accepts a registered class wherever a binding or JSX property takes a GType:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GListStore } from "@gtkx/jsx/gio";

<GListStore itemType={Gtk.Label} />;
```

Generated classes and interfaces, and subclasses registered with `registerClass`, can be passed this way. A plain JavaScript subclass has no registration of its own. Returned GTypes and signal handler arguments remain `bigint` values.

## Passing a GValue

When a binding reads a `GObject.Value`, GTKX usually accepts the JavaScript payload directly:

```ts
import * as Gdk from "@gtkx/gi/gdk";

const provider = Gdk.ContentProvider.newForValue("Copied text");
```

Use an explicitly initialized `GObject.Value` when the operation requires a particular native type, including an interface type for clipboard or drag-and-drop matching. A binding that fills a value instead takes a new, uninitialized `GObject.Value`; its generated signature identifies this case. Signal handlers continue to receive the value object.

For nullable value parameters, `null` means no value object. To represent a typed null payload, create a value with the required type and set its payload to null.

## Future flags

GTKX 1.6 lets you adopt the 2.0 behavior one change at a time. Enable a flag, regenerate, typecheck, and run the app and its tests before moving to the next one. Typechecking catches many changes, but cannot identify every behavioral difference, such as how a typed array is serialized.

| Flag | Change to prepare for |
| --- | --- |
| `v2ByteArrays` | Returned byte sequences become `Uint8Array`. Inputs continue to accept `number[]` too. Update array mutation and serialization code. |
| `v2ValueReturns` | Returned `GObject.Value` objects become their payloads, typed as `unknown`. Handle the payload type at the call site. |
| `v2FinishResults` | Promisified operations omit a redundant success boolean when failure already rejects. Update tuple destructuring; see [Async Operations](/guide/async-operations). |
| `v2InoutReturns` | Inout records and boxed values are updated in place without being repeated in the return value. Primitive inout results remain. |
| `v2ResourceImports` | Asset imports use relative paths and explicit queries. See the example below. |
| `v2DefaultLibraries` | Adwaita becomes a default dependency. Install its GIR data and run the app to check its appearance. |
| `v2TreeShaking` | Production builds drop unused generated classes. Import any class whose registration the app needs at runtime. |

### Migrating resource imports

With `v2ResourceImports` enabled, remove the `#data/*` mapping from `package.json` and replace its imports with relative paths:

```ts
import logoPath from "../data/logo.png?resource";
import saveIcon from "../data/icons/scalable/actions/save.svg?icon=example-save-symbolic";
import templatePath from "../data/template.txt?url";
import settings from "../data/com.example.Tasks.gschema.xml";
```

`?resource` returns a bundled GResource path; `?resource=/org/example/exact.png` selects an exact path. Convert it to a `resource://` URI only when an API requires one. `?url` provides a real file path, while settings schema imports remain query-free and receive generated types.

`?icon` returns an icon name and registers the bundled icon with the app's private theme path. Keep icons under `icons/<size>/<context>/` or `icons/hicolor/<size>/<context>/` to preserve theme layout; other locations become unthemed fallbacks. Choose package-specific names for icons supplied by libraries.

GTKX derives resource paths from the configured application ID: `com.example.Tasks` becomes `/com/example/Tasks`. Overriding an application's `applicationId` prop alone does not move bundled resources; supply a matching `resourceBasePath` when using another resource tree.

Production builds load their `gtkx.gresource` file automatically.

### Checking the remaining migration work

The CLI reports flags that have not been enabled. A warning can be silenced by its deprecation ID while you work through the migration:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    future: { v2DefaultLibraries: true },
    deprecations: { silence: ["gtkx-v2-byte-arrays"] },
});
```

Silencing a warning leaves the behavior unchanged. Remove deprecated APIs as well as adopting the flags: replace `libraries: "*"` with the libraries the app uses, split bare JSX imports by namespace, and use `animated(Component)` instead of properties on `animated`.

In 2.0, remove the graduated flags and explicit `Adw-1` or `Gtk-4.0` entries. A leftover flag set to `true` warns; `false` is rejected. Follow [Upgrading to 2.0](/guide/upgrading-to-2) for the migration checklist.

## Generating element reference docs

`gtkx docs` writes reference pages for the project's generated elements to `docs/reference`:

```bash
gtkx docs
```

Use `gtkx docs --help` to choose an output directory or link root. These pages describe the actual libraries configured for the project.

## What agents are given

Codegen also writes `.gtkx/reference` for coding agents and maintains a marked GTKX section in `AGENTS.md`. Text outside that section is preserved. It creates a `CLAUDE.md` import only when that file does not already exist.

Commit the rules file and ignore `.gtkx/`, as scaffolded projects do. Set `agents.rules` or `agents.reference` to `false` to disable the corresponding output.

## Advanced: Customizing elements

Use element behaviors when a native API needs custom prop handling or child placement. Export a `defineElements` map from a module, keyed by GLib type name, and register it through `elements.behaviors`:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    future: { v2DefaultLibraries: true },
    elements: { behaviors: "./src/elements.ts" },
});
```

Wrap each behavior with `defineBehavior` from `@gtkx/react/config`, supplying its GI class as the type argument. Behaviors apply to descendants and run before built-in behaviors. The [ElementBehavior reference](/reference/@gtkx/react/config/type-aliases/ElementBehavior) describes the hooks.

Declare additional props by augmenting the namespace module that owns them, with a top-level import of that module. Keep application effects and higher-level behavior in React components.

Continue with [Async Operations](/guide/async-operations).
