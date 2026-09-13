---
title: "Configuration and Codegen"
description: "Configure a GTKX project and generate its bindings."
---

# Configuration and Codegen

`gtkx.config.ts` identifies your application and selects the libraries GTKX generates bindings for. GTKX 2 includes Adwaita and GTK by default.

## The config file

Create `gtkx.config.ts` in the project root:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
});
```

List additional libraries by GIR name and version, for example `libraries: ["WebKit-6.0"]`. Codegen starts from `Adw-1` and follows its GIR dependencies, including `Gtk-4.0`. Omit these two entries from `libraries`; listing them explicitly is an error. The 1.x `"*"` wildcard is also removed.

`defineConfig` provides editor completion. The CLI validates the configuration when it loads it. The application ID is required and uses a reverse-DNS name such as `com.example.Tasks`.

Install the corresponding GIR files before generating bindings. Use `girPath` when they live outside the standard search directories. Supplying a newer GIR file changes the declarations, not the library that runs your app.

### Other settings {#every-option}

Use the [configuration reference](/v2/reference/@gtkx/config/index/type-aliases/Config) for available settings. The React Compiler is enabled by default; `reactCompiler: false` disables it. Application icons and package metadata are covered in [Deploying](/v2/guide/deploying), and agent tool settings in [MCP](/v2/guide/mcp).

For shared configuration, `mergeConfig(base, override)` applies the override over the base; arrays concatenate with override entries first. `$development` and `$production` blocks provide mode-specific overrides.

### Selecting another configuration

`gtkx dev`, `gtkx codegen`, `gtkx build`, and `gtkx deploy` accept `--config`:

```bash
gtkx dev --config gtkx.enterprise.config.ts
gtkx build --config gtkx.enterprise.config.ts
```

The path is relative to the project root selected by `--cwd` and must stay inside it. For tests, pass the same path as `gtkx({ configFile: "gtkx.enterprise.config.ts" })` in `vitest.config.ts`.

Development watches the selected config and its local dependencies, including shared config layers and imported data. Changes regenerate bindings and restart the app. If a reload fails, the current app keeps running until the configuration is fixed.

Builds use the selected configuration throughout generation and bundling. `gtkx deploy --skip-build --config ...` rejects a bundle created with another config file or different production settings.

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

Both packages use namespace subpaths; neither has a bare root import. Use [`@gtkx/cairo`](/v2/guide/cairo) for Cairo.

Leave generation enabled for an ordinary application. `codegen: false` is for projects that reuse an installed binding store. If a generated store needs rebuilding, run `gtkx codegen --force` in the project that generates it.

### Production bindings

Production builds remove unused generated classes. Import a class as a runtime value when the app needs its type registration, including when using `GObject.typeFromName`. A side-effect-only namespace import initializes the namespace but does not retain every class. Development and tests do not bundle.

## The JSX prop model

Generated elements follow the native API with GTKX naming conventions:

- Properties use camelCase, such as `showTitleButtons`.
- Signals use handler props, such as `onClicked`. GTKX passes the emitting object after the signal arguments.
- Property notifications use `onNotifyX`, receiving the new value and the emitting object.
- Object properties that accept elements can be expressed as JSX, with GTKX managing their lifetime.
- Refs expose the corresponding GI instance for imperative APIs.

Prefer JSX for object creation and child placement. The [generated element reference](#generating-element-reference-docs) shows the exact props, slots, and signals for each configured library.

### Member names

Native methods keep their generated camelCase names, even when a name overlaps a GTKX signal or property helper. For example, `Gio.Socket.connect` connects the socket; use `GObject.signalConnect` to connect one of its signals. `GObject.getProperty` and `GObject.setProperty` reach native properties when another member owns their name. Property names use camelCase and values are typechecked.

## Passing a GType

GTKX accepts a registered class wherever a binding takes a GType:

```ts
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const store = Gio.ListStore.new(Gtk.Label);
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

### Generated return values

Returned byte sequences use `Uint8Array`; byte inputs accept `Uint8Array` or `number[]`. Returned `GObject.Value` objects are unpacked to their payloads, typed as `unknown`.

Promisified operations omit a redundant success boolean when failure already rejects. Inout records and boxed values are updated in place without being repeated in the return value. See [Async Operations](/v2/guide/async-operations) for promise usage.

## Import project data

Use relative imports so GTKX can bundle the files with the app:

```ts
import logoPath from "../data/logo.png?resource";
import saveIcon from "../data/icons/scalable/actions/save.svg?icon=example-save-symbolic";
import templatePath from "../data/template.txt?url";
import bodyFont from "../data/fonts/Inter-Regular.otf?font";
import settings from "../data/com.example.Tasks.gschema.xml";
```

`?resource` returns a bundled GResource path; `?resource=/org/example/exact.png` selects an exact path. Convert it to a `resource://` URI only when an API requires one. `?url` provides a real file path, while settings schema imports remain query-free and receive generated types.

`?icon` returns an icon name and registers the bundled icon with the app's private theme path. Keep icons under `icons/<size>/<context>/` or `icons/hicolor/<size>/<context>/` to preserve theme layout; other locations become unthemed fallbacks. Choose package-specific names for icons supplied by libraries.

`?font` bundles a font and returns its family name. GTKX makes bundled fonts available automatically. Import a font for its side effect when it only supplies fallback characters; see [CSS](/v2/guide/css) for choosing a family in styles.

GTKX derives resource paths from the configured application ID: `com.example.Tasks` becomes `/com/example/Tasks`. Overriding an application's `applicationId` prop alone does not move bundled resources; supply a matching `resourceBasePath` when using another resource tree.

Production builds load their `gtkx.gresource` file automatically.

## Production build output

`gtkx build` writes to `dist/`. Use `--out` for another independently runnable build:

```bash
gtkx build src/helper.ts --out build/helper
```

Choose a directory below the project root that is empty or contains an earlier GTKX build. GTKX rejects unrelated files, symlinked paths, and output nested inside another build. Generated bundles contain their JavaScript dependencies; unresolved package imports fail the build.

`gtkx deploy --skip-build` packages `dist/`. Its `--out` option selects the deployment artifact directory, not the application build directory. See [Deploying](/v2/guide/deploying).

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
    elements: { behaviors: "./src/elements.ts" },
});
```

Wrap each behavior with `defineBehavior` from `@gtkx/react/config`, supplying its GI class as the type argument. Behaviors apply to descendants and run before built-in behaviors. The [ElementBehavior reference](/v2/reference/@gtkx/react/config/type-aliases/ElementBehavior) describes the hooks.

Declare additional props by augmenting the namespace module that owns them, with a top-level import of that module. Keep application effects and higher-level behavior in React components.

Continue with [Async Operations](/v2/guide/async-operations).
