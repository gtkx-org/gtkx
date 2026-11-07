---
title: "Configuration and Codegen"
description: "Configure a GTKX project and generate its bindings."
---

# Configuration and Codegen

`gtkx.config.ts` identifies your application and selects the libraries GTKX generates bindings for. GTKX 2 includes Adwaita and GTK by default. For resource imports, see [Assets and Build Output](/v2/guide/assets); for native type wrappers, see [Native Values](/v2/guide/native-values).

## The config file

Create `gtkx.config.ts` in the project root:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
});
```

List additional libraries by GIR name and version, for example `libraries: ["WebKit-6.0"]`. Codegen starts from `Adw-1` and follows its GIR dependencies, including `Gtk-4.0`. Omit these two entries from `libraries`; listing them explicitly is an error.

`defineConfig` provides editor completion. The CLI validates the configuration when it loads it. An application's ID uses a reverse-DNS name such as `com.example.Tasks`; `gtkx dev`, `gtkx build` and `gtkx deploy` stop when it is missing. Only a package that is not an application, such as a [component library](/v2/guide/workspaces#component-libraries), leaves it out.

Configuration modules and their local imports use ESM. Use `.ts`, `.mts`, `.js`, or `.mjs` files with `import` and `export`; TypeScript configuration runs through Node's native type stripping and must use erasable syntax. JSON, JSONC, JSON5, YAML, and TOML configuration files are also supported.

`gtkx dev` watches the config and the local dependencies it loads, including shared config layers and imported data, and the GIR files the bindings were generated from, such as a library built alongside the app into a `girPath` directory. Changes regenerate bindings and restart the app. If a reload fails, the current app keeps running until the configuration is fixed; creating a missing imported file also triggers another attempt.

Install the corresponding GIR files before generating bindings. Use `girPath` when they live outside the standard search directories; relative paths start at the project root. Supplying a newer GIR file changes the declarations, not the library that runs your app.

At run time the dynamic linker loads each library by the `shared-library` name its GIR file records, so a library built alongside the app has to be installed or on the linker's search path. Point `LD_LIBRARY_PATH` at its build directory for `gtkx dev`, `gtkx build` output and Vitest, as `meson devenv` does; a library the linker cannot find fails with the linker's reason, such as `cannot open shared object file`.

### Other settings {#every-option}

Use the [configuration reference](/v2/reference/@gtkx/config/index/type-aliases/Config) for available settings. The React Compiler is enabled by default; `reactCompiler: false` disables it. Application icons and package metadata are covered in [Deploying](/v2/guide/deploying), and agent tool settings in [MCP](/v2/guide/mcp).

`$development` and `$production` blocks override settings in one mode. `gtkx dev` runs in development mode; `gtkx build` and `gtkx deploy` run in production mode:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    $development: { applicationId: "com.example.Tasks.Devel" },
});
```

For shared configuration, `mergeConfig(base, override)` applies the override over the base; arrays concatenate with override entries first.

### Selecting another configuration

`gtkx dev`, `gtkx codegen`, `gtkx build`, `gtkx deploy` and `gtkx storybook` accept [`--config`](/v2/guide/cli#gtkx-dev):

```bash
gtkx dev --config gtkx.enterprise.config.ts
gtkx build --config gtkx.enterprise.config.ts
```

The path is relative to the project root selected by [`--cwd`](/v2/guide/cli#gtkx-dev) and must stay inside it. For tests, pass the same path as `gtkx({ configFile: "gtkx.enterprise.config.ts" })` in `vitest.config.ts`.

Builds use the selected configuration throughout generation and bundling. `gtkx deploy --skip-build --config ...` rejects a bundle created with another config file or different production settings.

### Environment files

`gtkx dev`, `gtkx build` and Vitest read [Vite's environment files](https://vite.dev/guide/env-and-mode#env-files) from the project directory: `.env`, `.env.local`, `.env.[mode]` and `.env.[mode].local`, where the mode is `development` for `gtkx dev`, `production` for `gtkx build` and `test` for Vitest. Variables whose names start with `VITE_` appear on `import.meta.env`; the others stay out of the app.

```ini [.env]
VITE_REPORT_URL=https://reports.example.com/submit
```

```ts
const endpoint = import.meta.env.VITE_REPORT_URL;
```

The scaffold's `src/gtkx-env.d.ts` types `import.meta.env`, including `MODE`, `DEV` and `PROD`. Declare your own variables there:

```ts [src/gtkx-env.d.ts]
interface ImportMetaEnv {
    readonly VITE_REPORT_URL: string;
}
```

Only the project directory is read. A `.env` at the root of a workspace does not apply to the apps in it, and no setting moves the directory; keep each app's files next to its `gtkx.config.ts`. Editing them restarts the app under `gtkx dev`.

`gtkx build` writes each value into `dist/bundle.mjs` as text, so it ships in every package `gtkx deploy` makes and cannot be changed on an installed app. Never put secrets in these files: anyone with the package can read them. Read settings that differ per machine or per run from `process.env` when the app runs.

## What codegen emits

Run generation after installing dependencies or changing the configured libraries:

```bash
gtkx codegen
```

GTKX generates modules under `node_modules/.gtkx` and links them as `@gtkx/gi` and `@gtkx/jsx`. They belong to the project and are not separate npm dependencies. `gtkx dev`, `gtkx build` and the Vitest plugin also generate them when they are missing or out of date.

Both packages always describe the same libraries. A project without `@gtkx/react` gets only `@gtkx/gi`, and its `@gtkx/jsx` comes back once `@gtkx/react` is installed again. Projects that resolve the same dependency directory share their generated bindings, as described in [Workspaces](/v2/guide/workspaces#monorepos).

Import classes, enums, and functions from GI modules, and elements from JSX modules:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwHeaderBar } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
```

Both packages use namespace subpaths; neither has a bare root import. Use [`@gtkx/cairo`](/v2/guide/cairo) for Cairo.

Leave generation enabled for an ordinary application. `codegen: false` is for projects that reuse an installed binding store. If a generated store needs rebuilding, run [`gtkx codegen --force`](/v2/guide/cli#gtkx-codegen) in the project that generates it.

Concurrent generation waits up to ten minutes for each binding-store lock. Use [`gtkx codegen --lock-timeout 900000`](/v2/guide/cli#gtkx-codegen) to change that wait in milliseconds, or pass `lockTimeoutMs` to the `@gtkx/codegen` `runCodegen` API.

### Library initialization

Importing a namespace initializes its library. When its GIR declares a top-level `init` function that can be called without arguments, such as `Gtk.init()`, `Adw.init()`, `GtkSource.init()` or `Gst.init()`, the namespace calls it as it loads, before any namespace that depends on it. GStreamer apps can therefore import `@gtkx/gi/gst` and plugin namespaces such as `@gtkx/gi/gstpbutils` in any order without calling `Gst.init()` first. A later `Gst.init(argv)` call does nothing, so pass GStreamer options through environment variables such as `GST_DEBUG`. Library teardown functions such as `GtkSource.finalize()` are never called; the process releases the libraries when it exits.

### Production bindings

Production builds remove unused generated classes. Import a class as a runtime value when the app needs its type registration, including when using `GObject.typeFromName`. A side-effect-only namespace import initializes the namespace but does not retain every class. Development and tests do not bundle.

An object that first reaches JavaScript through a callback GIR types only as a `GObject.Closure` loses its class in a production build unless the app references that class as a value. A type annotation is erased, so the object arrives as its nearest retained ancestor, often a plain `GObject.Object`. For example, the `invocation` that `Gio.DBusConnection.registerObjectWithClosures2` passes to a method-call handler lacks `returnValue`, and the first D-Bus call fails, although the same code works in `gtkx dev` and tests. The handlers given to `Gio.busOwnName` and other closure-typed functions behave the same way. Check the class in the handler to keep it in the bundle:

```ts
if (!(invocation instanceof Gio.DBusMethodInvocation)) throw new TypeError("Expected a D-Bus method invocation");
```

`Gtk.ClosureExpression` callbacks follow the same rule. An `AdwComboRow` whose `expression` names the items of an `AdwEnumListModel` receives `Adw.EnumListItem` objects; without a value reference to that class, the bundle passes plain objects and `item.getValue()` throws when the row first renders:

```ts
const easingName = Gtk.ClosureExpression.new(GObject.TYPE_STRING, (item: unknown) => {
    if (!(item instanceof Adw.EnumListItem)) throw new TypeError("Expected an enum list item");
    return item.getName();
}, null);
```

When a production build receives such an object through a closure and has dropped its class, it prints a warning once for that class, naming the class to reference and the module to import it from:

```text
[gtkx:runtime] warn AdwEnumListItem objects reach JavaScript as GObject because the production build dropped Adw.EnumListItem, ...
```

The object is still wrapped as its nearest retained ancestor, so the warning usually comes right before the error it explains. Objects returned from typed functions, methods and properties keep at least their declared class and never trigger it, nor do private library classes that have no generated class. Development and tests load every class and never print it.

A type assertion is erased too, so it does not keep a more derived class than the declared one. `Gst.parseLaunch` declares a `Gst.Element`, so `(pipeline as Gst.Bin).getByName("sink")` throws `getByName is not a function` in a production build unless the app references `Gst.Bin` as a value. No warning precedes these errors. Narrow with `instanceof` instead of a cast:

```ts
const pipeline = Gst.parseLaunch("videotestsrc ! videoconvert ! appsink name=sink");
if (!(pipeline instanceof Gst.Bin)) throw new TypeError("Expected a bin");
const sink = pipeline.getByName("sink");
```

## Monorepos

Running several apps and shared packages in one pnpm, npm or Yarn workspace, and how they share bindings, is described in [Workspaces](/v2/guide/workspaces#monorepos).

## Component libraries

Building, testing and publishing a package of components that apps install is described in [Workspaces](/v2/guide/workspaces#component-libraries).

## The JSX prop model

How element props, signals, notifications, child slots and refs map to the native API is described in [JSX Elements](/v2/guide/jsx-elements#the-jsx-prop-model).

### Member names

How native method names that overlap GTKX helpers are kept is described in [JSX Elements](/v2/guide/jsx-elements#member-names).

## Passing a GType

Pass a registered GI class wherever a method takes a GType. See [Native Values](/v2/guide/native-values#passing-a-gtype) for registration and returned type IDs.

## Passing a GValue

For most `GValue` inputs, pass a JavaScript value directly. See [Native Values](/v2/guide/native-values#passing-a-gvalue) for typed nulls, output values, and explicit wrappers, and [generated return values](/v2/guide/native-values#generated-return-values) for byte arrays, unpacked values, and async result shapes.

## Generating element reference docs

`gtkx docs` writes reference pages for the project's generated elements to `docs/reference`:

```bash
gtkx docs
```

[`--out`](/v2/guide/cli#gtkx-docs) chooses another directory and [`--base-path`](/v2/guide/cli#gtkx-docs) the URL root of the links between pages. The pages describe the project's configured libraries and element props, including props imported through `elements.config`. Rerun the command after changing those inputs. The [MCP](/v2/guide/mcp) reference tools read the current configuration and need no rerun.

## What agents are given

In an application, codegen also writes `.gtkx/reference` for coding agents and maintains a marked GTKX section in `AGENTS.md`. Text outside that section is preserved, and so is a section that a Markdown formatter has only rewrapped or realigned. It creates a `CLAUDE.md` import only when that file does not already exist.

Commit the rules file and ignore `.gtkx/`, as scaffolded projects do. Set `agents.rules` or `agents.reference` to `false` to disable the corresponding output. Disabling the rules removes the GTKX section from `AGENTS.md`, and deletes that file and the `CLAUDE.md` import when nothing else remains in them. Disabling the reference also removes `.gtkx/reference` and its mention from the rules.

## Advanced: Customizing elements

Use element behaviors when a native API needs custom prop handling or child placement. Export a `defineElements` map from a module, keyed by GLib type name, and register it through `elements.behaviors`:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    elements: { behaviors: "./src/elements.ts" },
});
```

Wrap each behavior with `defineBehavior` from `@gtkx/react/config`, supplying its GI class as the type argument. Behaviors apply to descendants and run before built-in behaviors. A behavior's `update` returns the names of the props it handles; any other prop must be a native property of the element. The [ElementBehavior reference](/v2/reference/@gtkx/react/config/type-aliases/ElementBehavior) describes the hooks.

Declare additional props by augmenting the namespace module that owns them, with a top-level import of that module. Keep application effects and higher-level behavior in React components.

Continue with [Workspaces](/v2/guide/workspaces) to share generated bindings and components between apps in a monorepo.
