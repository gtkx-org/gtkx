# Configuration

Every GTKX project is configured by a single `gtkx.config.ts` file at the project root. It declares which GIR libraries to generate bindings for, the GLib application id, and optional extension tables for the code generator. The `gtkx dev`, `gtkx build`, and `gtkx codegen` commands load it with [c12](https://github.com/unjs/c12), executing the TypeScript file in-process — no compile step — and taking its default export as the config. Any of `gtkx.config.{ts,js,mjs,cjs,mts,cts}` works.

## gtkx.config.ts

Author the file with `defineConfig` from `@gtkx/cli` to get type checking and autocompletion:

```ts
// gtkx.config.ts
import { defineConfig } from "@gtkx/cli";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1"],
    applicationId: "com.gtkx.tutorial",
});
```

`defineConfig` is an identity helper that validates the config eagerly, so a malformed library identifier or an invalid application id surfaces before any GIR loading or codegen work begins. A plain object default export passes through the same validation when the CLI loads the file.

### Field reference

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `libraries` | `"*" \| string[]` | `["Gtk-4.0"]` | GIR namespace identifiers (with version) to generate bindings for, e.g. `"Gtk-4.0"`, `"Adw-1"`. `"*"` generates every `.gir` file found on the search path, keeping the newest version of each namespace. |
| `girPath` | `string[]` | `[]` | Additional directories to search for `.gir` files, prepended to the default probe chain. Resolved relative to the project root. |
| `applicationId` | `string` | `undefined` | GLib application id, validated against `g_application_id_is_valid` (e.g. `"org.example.MyApp"`). Used by the GResource pipeline and exposed to app code as the `applicationId` export of `@gtkx/config/runtime`. |
| `reactCompiler` | `boolean \| ReactCompilerOptions` | `true` | Controls the [React Compiler](./cli.md#react-compiler), enabled by default for every `gtkx dev`, `gtkx build`, and test run. `false` disables it; an object tunes `compilationMode` and `panicThreshold`. |
| `slots` | `Record<string, string[]>` | `{}` | Additional widget-typed properties to expose as single-child JSX slots with setter semantics, keyed by JSX element name. Merged with the built-in slot map. |
| `containerSlots` | `Record<string, string[]>` | `{}` | Additional container methods to expose as JSX slots with append semantics (e.g. `"packStart"`), keyed by JSX element name. Merged with the built-in container-slot map. |
| `arrayProps` | `Record<string, Record<string, ArrayPropRow>>` | `{}` | Additional array-valued props where each element maps to repeated GTK calls instead of a single property set. Merged with the built-in array-prop rows. |
| `objectProps` | `Record<string, Record<string, ObjectPropRow>>` | `{}` | Additional object-valued props whose fields map to one or more GTK calls. Merged with the built-in object-prop rows. |
| `virtualProps` | `Record<string, Record<string, VirtualPropRow>>` | `{}` | Additional props with no GObject property backing, forwarded verbatim to a setter method. Merged with the built-in virtual-prop rows. |
| `elementMap` | `ElementMapRule[]` | `[]` | Additional attach relationships for the reconciler's element map, merged after the built-in rows. |
| `bigintAliases` | `string[]` | `[]` | Qualified GIR alias names (e.g. `"Gst.ClockTime"`) whose generated surface is `bigint` instead of `number`. Listed aliases must alias a 64-bit integer GIR type. Merged with the built-in defaults. |

A few details worth knowing:

- **`libraries`** — only `Gtk-4.0` is mandatory: it is the default when `libraries` is omitted, and it is added to an explicit list that omits it. Every other namespace (libadwaita, GtkSource, WebKit, …) is generated exactly when listed.
- **`applicationId`** — when set, asset imports resolve to `resource:///<prefix>/<rel>` where `<prefix>` is derived from the id (`org.gtk.Demo4` → `/org/gtk/Demo4`). When omitted, the GResource pipeline falls back to the prefix `/gtkx/app`.
- **`reactCompiler`** — the option values and their defaults are documented in the [CLI reference](./cli.md#react-compiler).

The seven table fields (`slots` through `bigintAliases`) are extension points: their rows merge with the built-ins that already cover GTK, Adwaita, and the other supported namespaces, so projects generating bindings for their own GIR libraries can opt custom widgets into the reconciler's pipelines without patching the codegen package. The row types (`ArrayPropRow`, `ObjectPropRow`, `VirtualPropRow`, `ElementMapRule`) are exported from `@gtkx/config`.

::: details Extension field examples

```ts
// gtkx.config.ts
import { defineConfig } from "@gtkx/cli";

export default defineConfig({
    libraries: ["Gtk-4.0"],
    slots: {
        MyAppFooBar: ["content"],
    },
    containerSlots: {
        MyAppHeaderBar: ["packStart", "packEnd"],
    },
    virtualProps: {
        GtkListBox: {
            sortFunc: { type: "Gtk.ListBoxSortFunc", setter: "setSortFunc" },
        },
    },
    bigintAliases: ["MyLib.DeviceAddress"],
});
```

:::

## How `libraries` drives codegen

Each `libraries` entry names a GIR namespace, and codegen turns it into a pair of generated modules under the namespace's lowercased name:

| `libraries` entry | Bindings (classes, enums) | Components (JSX elements) |
| --- | --- | --- |
| `Gtk-4.0` | `@gtkx/gi/gtk` | `@gtkx/jsx/gtk` |
| `Adw-1` | `@gtkx/gi/adw` | `@gtkx/jsx/adw` |
| `GtkSource-5` | `@gtkx/gi/gtksource` | `@gtkx/jsx/gtksource` |
| `WebKit-6.0` | `@gtkx/gi/webkit` | `@gtkx/jsx/webkit` |

Transitive dependencies are resolved automatically from the GIR files on disk: listing `Gtk-4.0` alone also generates `@gtkx/gi/gdk`, `@gtkx/gi/gio`, `@gtkx/gi/glib`, `@gtkx/gi/pango`, and the rest of GTK's dependency chain. Every generated namespace gets a `@gtkx/gi/<ns>` module; a namespace also gets a `@gtkx/jsx/<ns>` module when it contributes at least one renderable class (so `Gio` has both, while `GLib` is bindings-only).

GIR files are searched in order of precedence:

1. Directories from `girPath` in `gtkx.config.ts`
2. The `GTKX_GIR_PATH` environment variable (colon-separated)
3. `/usr/share/gir-1.0`, the standard system location on Linux
4. The output of `pkg-config --variable=girdir gobject-introspection-1.0`

The generated packages are written into the `.gtkx` store at `node_modules/.gtkx`, with `gi` and `jsx` subdirectories. The store is a generated artifact: it is never committed, and it is regenerated whenever the fingerprint goes stale — a changed library set, GIR runtime, or codegen version. [`gtkx codegen`](./cli.md#gtkx-codegen) regenerates it on demand, `gtkx dev` and `gtkx build` run the same check as a preflight, and `gtkx dev` additionally watches `gtkx.config.ts` so editing the `libraries` list regenerates the bindings and restarts the app.

::: tip
You rarely run `gtkx codegen` yourself — the dev and build preflights keep the store current. If the store is ever corrupted, `gtkx codegen --force` wipes and regenerates it. See the [CLI reference](./cli.md#gtkx-codegen) for the full command documentation.
:::

## Runtime access

App code reads the resolved configuration through named exports of `@gtkx/config/runtime`. The canonical use is passing the configured `applicationId` to the application component, as the tutorial app does:

```tsx
// src/app.tsx
import { applicationId } from "@gtkx/config/runtime";
import { AdwApplication } from "@gtkx/jsx/adw";

export function App() {
    return (
        <AdwApplication applicationId={applicationId}>
            <NotesWindow />
        </AdwApplication>
    );
}
```

`NotesWindow` is the tutorial's root window component, defined alongside `App` in the same file.

Under the hood, `@gtkx/config/runtime` re-exports the `virtual:gtkx-config` module verbatim. The gtkx Vite plugins serve that module during `gtkx dev` and `gtkx build`, and the `@gtkx/vitest` plugin serves it under tests, so the same imports work in every pipeline; `gtkx build` inlines the resolved module into the production bundle. Each field of the resolved config is a named constant — frozen at build time, identical on every import: `libraries`, `girPath`, `applicationId`, `slots`, `containerSlots`, `arrayProps`, `objectProps`, `virtualProps`, `elementMap`, `bigintAliases`, and `reactCompiler`, with every optional field normalized to its documented default (`applicationId` stays `undefined` when unset).

::: warning
The values are snapshots of `gtkx.config.ts` taken at build time. Changing the config file does not affect an already-built bundle; rebuild (or let the `gtkx dev` config watch restart the app) to pick up new values.
:::

## Environment variables

| Variable | Read by | Effect |
| --- | --- | --- |
| `GTKX_GIR_PATH` | `gtkx codegen` | Colon-separated list of extra directories to search for `.gir` files, consulted after the config's `girPath` and before the system locations. |
| `GTKX_DISABLE_PREFLIGHT` | `gtkx dev`, `gtkx build` | Set to `1` to skip the codegen preflight that regenerates stale bindings before the command starts. |
| `GTKX_DISABLE_SHUTDOWN_HANDLERS` | `@gtkx/ffi` | Set to `1` to keep the runtime from installing its `SIGINT`/`SIGTERM`/`SIGHUP` shutdown handlers when it loads. The `@gtkx/vitest` plugin sets this automatically in test workers. |
| `GTKX_XVFB_SCREEN` | `@gtkx/vitest` | Screen geometry of the per-worker Xvfb display, in `WIDTHxHEIGHTxDEPTH` form. Defaults to `1024x768x24`. |
