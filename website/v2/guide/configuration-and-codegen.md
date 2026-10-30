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

`defineConfig` provides editor completion. The CLI validates the configuration when it loads it. The application ID is required and uses a reverse-DNS name such as `com.example.Tasks`.

Configuration modules and their local imports use ESM. Use `.ts`, `.mts`, `.js`, or `.mjs` files with `import` and `export`; TypeScript configuration runs through Node's native type stripping and must use erasable syntax. JSON, JSONC, JSON5, YAML, and TOML configuration files are also supported.

Install the corresponding GIR files before generating bindings. Use `girPath` when they live outside the standard search directories; relative paths start at the project root. Supplying a newer GIR file changes the declarations, not the library that runs your app.

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

Development watches the selected config and the local dependencies it loads, including shared config layers and imported data. Changes regenerate bindings and restart the app. If a reload fails, the current app keeps running until the configuration is fixed; creating a missing imported file also triggers another attempt.

Builds use the selected configuration throughout generation and bundling. `gtkx deploy --skip-build --config ...` rejects a bundle created with another config file or different production settings.

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

### Production bindings

Production builds remove unused generated classes. Import a class as a runtime value when the app needs its type registration, including when using `GObject.typeFromName`. A side-effect-only namespace import initializes the namespace but does not retain every class. Development and tests do not bundle.

An object that first reaches JavaScript through a callback GIR types only as a `GObject.Closure` loses its class in a production build unless the app references that class as a value. A type annotation is erased, so the object arrives as its nearest retained ancestor, often a plain `GObject.Object`. For example, the `invocation` that `Gio.DBusConnection.registerObjectWithClosures2` passes to a method-call handler lacks `returnValue`, and the first D-Bus call fails, although the same code works in `gtkx dev` and tests. The handlers given to `Gio.busOwnName` and other closure-typed functions behave the same way. Check the class in the handler to keep it in the bundle:

```ts
if (!(invocation instanceof Gio.DBusMethodInvocation)) throw new TypeError("Expected a D-Bus method invocation");
```

## Monorepos

GTKX apps work in pnpm, npm and Yarn workspaces with the package manager's default `node_modules` layout, alongside shared packages of components.

Codegen writes the bindings into the `node_modules` directory the GTKX packages are installed in. In a workspace this is usually the root: pnpm keeps every package under the root `node_modules/.pnpm`, and npm and Yarn hoist them there. The bindings link `@gtkx/runtime`, `@gtkx/cairo`, `@gtkx/react` and `react` from the app, so they load the same copies the app does.

Apps that resolve the same directory share one set of bindings, generated for the union of their `libraries`. Codegen stops with an error naming the other app when apps sharing bindings differ in anything else:

- `girPath` or `elements`
- whether they use `@gtkx/react`
- a version of a GIR namespace, such as `Soup-2.4` and `Soup-3.0`
- the installed copies of the GTKX packages, `react` or `@types/react`

Keep these aligned across the workspace, for example with a pnpm catalog. After changing `girPath` or `elements` in every app, run `gtkx codegen --force` in one of them; the others share its bindings again the next time they generate theirs. An app can import bindings that only another app declared, but `gtkx deploy` derives an app's requirements from its own `libraries`, so declare every library each app imports.

A shared package declares `@gtkx/react` as a peer dependency and imports `@gtkx/gi` and `@gtkx/jsx` subpaths like an app. List it in the dependencies of each app that uses it, so `gtkx dev` loads it through Vite.

## The JSX prop model

Generated elements follow the native API with GTKX naming conventions:

- Properties use camelCase, such as `showTitleButtons`.
- Signals use handler props, such as `onClicked`. GTKX passes the emitting object after the signal arguments.
- Property notifications use `onNotifyX`, receiving the new value and the emitting object.
- Object properties that accept elements can be expressed as JSX, with GTKX managing their lifetime.
- Elements that show one child, such as `GtkScrolledWindow`, `AdwClamp`, window content or `AdwToolbarView` content, show the last one passed. Development builds warn when such an element holds more than one visible child; wrap them in a `GtkBox`.
- Refs expose the corresponding GI instance for imperative APIs.

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

Codegen also writes `.gtkx/reference` for coding agents and maintains a marked GTKX section in `AGENTS.md`. Text outside that section is preserved. It creates a `CLAUDE.md` import only when that file does not already exist.

Commit the rules file and ignore `.gtkx/`, as scaffolded projects do. Set `agents.rules` or `agents.reference` to `false` to disable the corresponding output. Disabling the reference also removes `.gtkx/reference` and its mention from the rules.

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
