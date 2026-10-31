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

List additional libraries by GIR name and version, for example `libraries: ["WebKit-6.0"]`. Codegen starts from `Adw-1` and follows its GIR dependencies, including `Gtk-4.0`. Omit these two entries from `libraries`; listing them explicitly is an error. The 1.x `"*"` wildcard is also removed.

`defineConfig` provides editor completion. The CLI validates the configuration when it loads it. An application's ID uses a reverse-DNS name such as `com.example.Tasks`; `gtkx dev`, `gtkx build` and `gtkx deploy` stop when it is missing. Only a package that is not an application, such as a [component library](#component-libraries), leaves it out.

Configuration modules and their local imports use ESM. Use `.ts`, `.mts`, `.js`, or `.mjs` files with `import` and `export`; TypeScript configuration runs through Node's native type stripping and must use erasable syntax. JSON, JSONC, JSON5, YAML, and TOML configuration files are also supported.

Install the corresponding GIR files before generating bindings. Use `girPath` when they live outside the standard search directories; relative paths start at the project root. Supplying a newer GIR file changes the declarations, not the library that runs your app.

At run time the dynamic linker loads each library by the `shared-library` name its GIR file records, so a library built alongside the app has to be installed or on the linker's search path. Point `LD_LIBRARY_PATH` at its build directory for `gtkx dev`, `gtkx build` output and Vitest, as `meson devenv` does; a library the linker cannot find fails with the linker's reason, such as `cannot open shared object file`.

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

Development watches the selected config and the local dependencies it loads, including shared config layers and imported data, and the GIR files the bindings were generated from, such as a library built alongside the app into a `girPath` directory. Changes regenerate bindings and restart the app. If a reload fails, the current app keeps running until the configuration is fixed; creating a missing imported file also triggers another attempt.

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

GTKX generates modules under `node_modules/.gtkx` and links them as `@gtkx/gi` and `@gtkx/jsx`. They belong to the project and are not separate npm dependencies. Development and production builds also check whether generation is needed.

GI and JSX bindings are published together so they describe the same libraries. Projects without `@gtkx/react` generate only GI bindings and remove obsolete JSX bindings owned by that project. Installing React again regenerates JSX bindings. Projects that resolve the same dependency directory share their generated bindings, as described in [Monorepos](#monorepos).

Import classes, enums, and functions from GI modules, and elements from JSX modules:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { AdwHeaderBar } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
```

Both packages use namespace subpaths; neither has a bare root import. Use [`@gtkx/cairo`](/v2/guide/cairo) for Cairo.

Leave generation enabled for an ordinary application. `codegen: false` is for projects that reuse an installed binding store. If a generated store needs rebuilding, run `gtkx codegen --force` in the project that generates it.

Concurrent generation waits up to ten minutes for each binding-store lock. Use `gtkx codegen --lock-timeout 900000` to change that wait in milliseconds, or pass `lockTimeoutMs` to the `@gtkx/codegen` `runCodegen` API.

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

## Monorepos

GTKX apps work in pnpm and npm workspaces with the package manager's default `node_modules` layout, and in Yarn workspaces whose root `.yarnrc.yml` sets `nodeLinker: node-modules`, alongside shared packages of components. In a workspace, `create gtkx apps/my-app` adds the app to the workspace and prints any `allowBuilds`, `allowScripts`, `nodeLinker` or `dependenciesMeta` entries to add to its root configuration; see [Scaffold Options](/v2/guide/scaffold-options#workspaces).

Codegen writes the bindings into the `node_modules` directory the GTKX packages are installed in. In a workspace this is usually the root: pnpm keeps every package under the root `node_modules/.pnpm`, and npm and Yarn hoist them there. The bindings link `@gtkx/runtime`, `@gtkx/cairo`, `@gtkx/react` and `react` from the app, so they load the same copies the app does.

Apps that resolve the same directory share one set of bindings, generated for the union of their `libraries`. Codegen stops with an error naming the other app when apps sharing bindings differ in anything else:

- `girPath` or `elements`
- whether they use `@gtkx/react`
- a version of a GIR namespace, such as `Soup-2.4` and `Soup-3.0`
- the installed copies of the GTKX packages, `react` or `@types/react`

Keep these aligned across the workspace, for example with a pnpm catalog. After changing `girPath` or `elements` in every app, run `gtkx codegen --force` in one of them; the others share its bindings again the next time they generate theirs.

Each app still imports only the libraries it declares and their dependencies, which are also what `gtkx deploy` requires of the installed system. Codegen gives an app that shares bindings its own `@gtkx/gi` and `@gtkx/jsx` packages in its `node_modules`, which expose those namespaces and link them to the shared bindings. Importing a namespace that only another app declared fails in `gtkx dev`, `gtkx build` and Vitest with an error naming the library to add to `libraries`, Node reports the subpath as not exported, and `tsc` reports the namespace as having no exports. An app at the workspace root, where the bindings are written, sees all of them.

A shared package declares `@gtkx/react` as a peer dependency and imports `@gtkx/gi` and `@gtkx/jsx` subpaths like an app. List it in the dependencies of each app that uses it, so `gtkx dev` loads it through Vite. A shared package resolves the bindings from the workspace root, so it can import any library some app declares; each app that uses it has to declare the libraries the package imports.

An app's [Storybook](/v2/guide/storybook#stories-from-a-shared-package) configuration can list a shared package's stories with a pattern such as `../../packages/ui/src/**/*.stories.tsx`. A shared package can also run its own tests and Storybook explorer without an `applicationId`, as a [component library](#component-libraries) does.

## Component libraries

A component library is a package of GTKX components that apps install, from their workspace or from a registry. It is not an application, so it has no `applicationId`. It needs a `gtkx.config.ts` only to list the GIR libraries its components import beyond Adwaita and GTK:

```ts [gtkx.config.ts]
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["GtkSource-5"],
});
```

`gtkx codegen`, `gtkx storybook` and the Vitest plugin work in such a package, with or without the file, while `gtkx dev`, `gtkx build` and `gtkx deploy` stop because they need an `applicationId`. Codegen writes no `AGENTS.md`, `CLAUDE.md` or `.gtkx/reference` there unless `agents.rules` or `agents.reference` is `true`.

Its `package.json` lists `@gtkx/react` and `react` as peer dependencies, with any other GTKX package its components import at runtime, such as `@gtkx/css` or `@gtkx/cairo`, so that it uses the app's copies. It does not depend on `@gtkx/gi` or `@gtkx/jsx`: each app generates those for the libraries it declares, so an app that uses the package lists in `libraries` every GIR library the package imports beyond Adwaita and GTK. For building and testing, add the peer packages, `@gtkx/cli`, `@gtkx/config`, `@gtkx/testing`, `@types/node`, `@types/react`, `typescript` and `vitest` as development dependencies.

```json [package.json]
{
    "name": "@example/ui",
    "version": "0.1.0",
    "type": "module",
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "default": "./dist/index.js"
        }
    },
    "files": ["dist"],
    "scripts": {
        "build": "gtkx codegen && tsc -p tsconfig.build.json",
        "typecheck": "gtkx codegen && tsc",
        "test": "vitest run"
    }
}
```

Build it with `tsc` into JavaScript and declarations. Start from a scaffolded app's `tsconfig.json`, which resolves `@gtkx/gi` and `@gtkx/jsx` to the generated bindings, and add a build configuration that emits only the sources:

```json [tsconfig.build.json]
{
    "extends": "./tsconfig.json",
    "compilerOptions": {
        "noEmit": false,
        "declaration": true,
        "outDir": "dist",
        "rootDir": "src"
    },
    "include": ["src/**/*"],
    "exclude": ["src/**/*.stories.tsx"]
}
```

The output keeps its `@gtkx/gi` and `@gtkx/jsx` imports, in the JavaScript and in the declarations, so the app's own bindings resolve them when it builds and typechecks. `gtkx dev`, `gtkx build` and the Vitest plugin load an installed package that depends on `@gtkx/react` through Vite, so the app needs no extra configuration, and `gtkx build` bundles the package and lists it in `BUNDLED-NOTICES`. Publish the package with your package manager after building it, for example `npm publish`.

Test the components with `@gtkx/testing` and the Vitest plugin, as in an app:

```ts [vitest.config.ts]
import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
});
```

The tests run as the application `org.gtkx.Test`. To browse the components in the [Storybook explorer](/v2/guide/storybook), also add `@gtkx/storybook`, `@gtkx/runtime`, `@gtkx/css` and `@gtkx/cairo` as development dependencies and run `gtkx storybook`; the explorer registers as `org.gtkx.Library.Storybook`. In a workspace the package shares the bindings of the apps around it, under the rules described in [Monorepos](#monorepos).

## The JSX prop model

Generated elements follow the native API with GTKX naming conventions:

- Properties use camelCase, such as `showTitleButtons`.
- Signals use handler props, such as `onClicked`. GTKX passes the emitting object after the signal arguments.
- Property notifications use `onNotifyX`, receiving the new value and the emitting object.
- Object properties that accept elements can be expressed as JSX, with GTKX managing their lifetime.
- Elements that show one child, such as `GtkScrolledWindow`, `AdwClamp`, window content or `AdwToolbarView` content, show the last one passed. Development builds warn when such an element holds more than one visible child; wrap them in a `GtkBox`.
- Child slots that no property backs take their GtkBuilder child type, such as `start` and `end` on a header bar or `top` and `bottom` on a toolbar view.
- Refs expose the corresponding GI instance for imperative APIs.

A prop the element does not have, such as a typo, a C-style name like `margin_top` or a prop from another toolkit, throws an error that names the element and, where it can, the closest prop it does have.

Prefer JSX for object creation and child placement. The [generated element reference](#generating-element-reference-docs) shows the exact props, slots, and signals for each configured library.

### Member names

Native methods keep their generated camelCase names, even when a name overlaps a GTKX signal or property helper. For example, `Gio.Socket.connect` connects the socket; use `GObject.signalConnect` to connect one of its signals. `GObject.getProperty` and `GObject.setProperty` reach native properties when another member owns their name. Property names use camelCase and values are typechecked.

## Passing a GType

Pass a registered GI class wherever a method takes a GType. See [Native Values](/v2/guide/native-values#passing-a-gtype) for registration and returned type IDs.

## Passing a GValue

For most `GValue` inputs, pass a JavaScript value directly. See [Native Values](/v2/guide/native-values#passing-a-gvalue) for typed nulls, output values, and explicit wrappers.

### Generated return values

See [generated return values](/v2/guide/native-values#generated-return-values) for byte arrays, unpacked values, and async result shapes.

## Import project data

Use imports for resources, icons, fonts, files, and settings schemas. [Assets and Build Output](/v2/guide/assets#import-project-data) explains each import form and its native path or value.

## Production build output

`gtkx build` writes a runnable bundle and its assets to `dist/`. See [build output](/v2/guide/assets#production-build-output) for custom destinations and the files deployment needs.

## Generating element reference docs

`gtkx docs` writes reference pages for the project's generated elements to `docs/reference`:

```bash
gtkx docs
```

Use `gtkx docs --help` to choose an output directory or link root. These pages describe the project's configured libraries and element props, including props imported through `elements.config`. Rerun the command after changing those inputs; the MCP reference refreshes them automatically.

## What agents are given

In an application, codegen also writes `.gtkx/reference` for coding agents and maintains a marked GTKX section in `AGENTS.md`. Text outside that section is preserved. It creates a `CLAUDE.md` import only when that file does not already exist.

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

Continue with [Async Operations](/v2/guide/async-operations).
