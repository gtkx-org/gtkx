---
title: "Configuration and Codegen"
description: "Configuring GTKX with gtkx.config.ts, what codegen generates into node_modules/.gtkx, and how GIR becomes the typed JSX prop model."
---

# Configuration and Codegen

Codegen is driven from `gtkx.config.ts`, which declares your application ID and any GIR libraries to bind beyond GTK4 and Adwaita.

## The config file

`defineConfig` from `@gtkx/config` types your config for editor completion and validates it when the CLI loads the file:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.gtkx.tutorial",
});
```

`mergeConfig(base, override)` layers a project config over a shared base. A `$development` or `$production` block layers over the top level, per mode.

### Selecting another configuration

`gtkx codegen`, `gtkx build`, and `gtkx deploy` all accept the same project-relative `--config` option:

```bash
gtkx codegen --config gtkx.enterprise.config.ts
gtkx build --config gtkx.enterprise.config.ts
gtkx deploy --config gtkx.enterprise.config.ts
```

The path is relative to the project root selected by `--cwd` and must remain inside that root. Build and deploy
also pass the selected file through their implicit codegen and every build-time config consumer, so generated
bindings, `virtual:gtkx-config`, the bundle, and deployment metadata all use one configuration.

Every production build records both the project-relative config path and a digest of the production-mode
configuration in its build manifest. `gtkx deploy --skip-build --config ...` compares both identities before it
packages `dist/`, and rejects a bundle built with another config file or with different config values.

### Every option

`applicationId` is the only required key; the rest have defaults.

- **`applicationId`**: the GApplication identifier the app registers under, in reverse-DNS form (`com.example.Tasks`).
- **`libraries`**: additional GIR libraries to bind, as `Name-Version`. GTKX always binds `Gtk-4.0` and `Adw-1`, so list only what the project needs beyond them — `["WebKit-6.0"]` rather than `["Gtk-4.0", "Adw-1", "WebKit-6.0"]`. Explicitly listing either default or using the removed `"*"` wildcard is rejected. A different version of the Gtk or Adwaita namespace replaces its default version.
- **`girPath`**: directories searched for `.gir` files ahead of the standard locations. This can generate bindings from a newer GIR, for example libadwaita 1.10 declarations on a codegen host whose standard path has 1.9. It changes declarations only: it does not install or upgrade the shared library, and every machine that runs the result still needs a runtime providing those APIs.
- **`reactCompiler`**: the React Compiler, on by default. `false` disables it; an object forwards `compilationMode` and `panicThreshold`.
- **`codegen: false`**: skips generation, so the project imports whatever binding store is already installed.
- **`applicationIcon`**: a project-relative icon-theme directory, or one SVG, PNG, or XPM file to install as the
  desktop application icon. Directories keep their theme layout; a single file is placed under `hicolor` and
  renamed to the application ID. When omitted, GTKX uses exactly one `<applicationId>.svg`, `.png`, or `.xpm`
  file in the project root, if present; multiple matches require an explicit choice.
- **`userEventSignals`**: signals, keyed by GLib type name, that GTKX suppresses while writing to a widget itself. A write silences all of them, and silences `notify` only for the property it writes, so a property the widget changes in reaction still reaches its `onNotifyX`. Entries merge into the defaults.
- **`elements`**: the [element customizations](#advanced-customizing-elements): `behaviors` is the module default-exporting your `defineElements` map, `config` sets per-type codegen output (`component`, `props`, `omittedProps`, `isLazy`).
- **`agents`**: what codegen writes for coding agents, both on by default. `rules: false` stops the `AGENTS.md` block, `reference: false` stops the on-disk element reference. See [What agents are given](#what-agents-are-given).
- **`mcp`**: which tools the [MCP server](/v2/guide/mcp) registers: `tools` is a list of name patterns, `readOnly` drops the tools that drive the app.

### The application resource base

GTKX derives a resource base from `applicationId` by prefixing `/` and replacing dots with slashes, so
`com.example.Tasks` becomes `/com/example/Tasks`. It exports the result as `resourceBasePath` from
`virtual:gtkx-config` and uses the same prefix for derived `?resource` paths and `?icon` assets. An explicit
absolute `?resource=/path` remains exactly the path you supply.

`GtkApplication` and `AdwApplication` elements default their `resourceBasePath` prop to that config-derived
value. GApplication can derive the same value from its application ID, but GTKX supplies it explicitly so the
application and its generated resources stay aligned. Consequently, overriding an element's `applicationId`
prop alone does not move those resources; also pass `resourceBasePath` when intentionally using a different
resource tree.

## Production build output

`gtkx build` writes to `dist/` by default. Use a separate project-relative output for another independently
runnable build, such as a helper or a second entry point:

```bash
gtkx build src/helper.ts --out build/helper
gtkx build src/index.ts --out build/application
```

An `--out` path must be below the project root, cannot pass through a symbolic link, and must be absent, empty,
or contain the manifest from an earlier GTKX build. GTKX can safely replace that earlier build, but rejects the
project root and directories containing unrelated files. Each selected directory receives its own
`bundle.mjs`, build manifest, and emitted assets. `gtkx deploy --skip-build` still packages `dist/`; its own
`--out` option selects the deployment work and artifact directory instead.

### Self-contained module resolution

Production builds inspect every emitted JavaScript chunk for literal module resolution that would escape the
artifact. Node.js builtins and relative files emitted with the build are allowed; a bare package or missing
relative file that would have to resolve from the installed machine fails the build. The inspection follows
the actual lexical bindings of `require`, imported `createRequire` aliases, and aliases derived from
`import.meta.url`, so a resolver hidden behind a constant alias is still checked while an unrelated local
function that merely shares one of those names is not.

## What codegen emits

Codegen writes packages into `node_modules/.gtkx` and links them into `node_modules/@gtkx`, so imports resolve without either appearing in your `package.json`:

- **`@gtkx/gi`** is the introspected API, one subpath per namespace (`@gtkx/gi/gtk`, `@gtkx/gi/adw`): the classes, enums, and functions you call imperatively, for refs and values such as `Gtk.Orientation.VERTICAL`.
- **`@gtkx/jsx/<namespace>`** is the React layer (`@gtkx/jsx/gtk`, `@gtkx/jsx/adw`): a PascalCase component per widget (`GtkButton`, `AdwHeaderBar`), a `Props` interface for each, and a `React.JSX.IntrinsicElements` augmentation.

The `cairo` namespace is provided by the [`@gtkx/cairo`](/v2/guide/cairo) package rather than generated.

Record fields appear as accessors: a getter wherever the read lands on the right memory, and a setter only where a field slot can hold what it stores. `null`-terminated pointer arrays read, so `Gio.DBusNodeInfo.interfaces` hands back its array, but they are read-only and absent from the record's constructor props, since the slot cannot keep an array alive. Fields whose element count lives in a sibling field, and `GList` or `GSList` links, carry no accessor and are absent from the class.

A few bindings take a NUL-terminated C string that GIR describes as a byte array (`GLib.Variant.newBytestring`), so the value silently stops at the first zero byte. Binary payloads go through `GLib.Bytes` and `GLib.Variant.newFromBytes`.

### Import elements by namespace

Each JSX element is exported from its generated namespace subpath:

```tsx
import { AdwHeaderBar } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
```

There is no bare `@gtkx/jsx` entry point. Splitting imports prevents one file from evaluating every generated namespace and its matching GI module.

`@gtkx/gi` has no equivalent root. Its symbols are imported namespaced, as `import * as Gtk from "@gtkx/gi/gtk"`, so `Gtk.Orientation` and `Adw.ResponseAppearance` stay apart.

### Member precedence

Generated wrappers follow JavaScript prototype precedence. A callable on the class chain wins over implemented interfaces, and the first implemented interface wins between interfaces. An interface callable replaces an inherited member only when that member is GTKX's synthetic signal helper. The winning callable keeps its natural camelCase name. GIR `shadows` metadata also chooses the canonical public name, so create a subprocess with `Gio.Subprocess.new(argv, flags)`, not `newv`.

Most GObjects still use `connect`, `disconnect`, `emit`, `on`, `once`, and `off` for signals. When a GIR callable owns one of those names, use the signal functions exported by `@gtkx/gi/gobject` instead:

```ts
import * as Gio from "@gtkx/gi/gio";
import * as GObject from "@gtkx/gi/gobject";

const connectSocket = (socket: Gio.Socket, address: Gio.SocketAddress): void => {
    const handlerId = GObject.signalConnect(socket, "notify::blocking", () => {});

    socket.connect(address, null);
    GObject.signalDisconnect(socket, handlerId);
};
```

`GObject.signalEmit(instance, signal, ...args)` is the corresponding emission escape hatch. Properties have matching collision-safe helpers:

```ts
const blocking = GObject.getObjectProperty(socket, "blocking");
GObject.setObjectProperty(socket, "blocking", !blocking);
```

Property names use their generated camelCase spelling. The getter accepts readable properties and infers their result, while the setter accepts mutable properties and checks the value type. Both resolve the installed `GObject.ParamSpec`, so they still reach a property when a more-specific method owns the same JavaScript name. Read-only and construct-only properties are excluded from the setter. Other inherited GIR implementations remain reachable explicitly through their prototype when both versions are useful.

## Passing a GType

Every parameter that takes a GType accepts the class registered under one alongside the numeric `bigint`: a generated wrapper class, a generated interface, or a class `registerClass` registered — the same classes whose GType `SomeClass.prototype.__type__` reads. Signal arguments declared as GTypes take a class the same way. The GType is the class's own registration, so a plain `class extends Gtk.Label {}` that never went through `registerClass` is rejected rather than resolving to its parent's type, as is any other class, object, or string:

```ts
const store = Gio.ListStore.new(Gtk.Label);     // same store as new(Gtk.Label.prototype.__type__)
store.append(new Gtk.Label());
GObject.typeName(Gtk.Label);                    // "GtkLabel"
```

Only the input direction widens: a return value, out parameter, or signal handler argument still hands back the numeric GType.

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

Inference covers what a JavaScript value can say on its own, which leaves the cases that need an explicitly initialized value:

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
value.init(Gio.File);
value.setObject(file);
Gdk.ContentProvider.newForValue(value);
```

Passing a `GObject.Value` you built yourself always works, wherever inference would guess something else.

## Import project data

Use relative imports so GTKX can follow project files from source to the production resource bundle:

```ts
import logoPath from "../data/logo.png?resource";
import saveIcon from "../data/icons/scalable/actions/save.svg?icon=example-save-symbolic";
import sourcePath from "../data/template.txt?url";
import settings from "../data/com.example.Tasks.gschema.xml";
```

`?resource` bundles an asset and returns its GResource path; `?resource=/org/example/exact.png` chooses an exact path. Use `?url` when an API needs a real file. Settings schemas stay query-free and receive generated types. Build a URI only where an API requires one: `` `resource://${logoPath}` ``.

`?icon` bundles an SVG, PNG, or XPM as a private icon-theme resource and returns its extensionless icon name. An import below an `icons/hicolor/<size>/<context>/` or `icons/<size>/<context>/` tree keeps that layout. Files outside those trees become unthemed fallbacks. A query value such as `?icon=example-confirm-symbolic` overrides the name.

Production builds place bundled assets in `gtkx.gresource` beside `bundle.mjs`. Generated resource modules load and register it automatically.

## Generated return values

GIR byte sequences are `Uint8Array` in return values, out parameters, record fields, and properties. Parameters accept either `Uint8Array` or `number[]`. The cairo and OpenGL packages use their own typed-array contracts.

Bindings that return a `GObject.Value` hand back its payload typed as `unknown`, so assert the type established by the operation at the call site. Promisified finish methods omit a leading success boolean when failure already rejects, and inout records and boxed values mutate the passed object without repeating it in the return value. [Async Operations](/v2/guide/async-operations) covers the promise shapes.

## Tree-shaken bindings

Each generated class registers as part of its own definition, so production builds retain the widgets, classes, and signature dependencies the application reaches. A bare namespace import runs namespace initialization but retains no generated class by itself. Import a class explicitly when `GObject.typeFromName` must find it in a production bundle. Development and tests do not bundle and keep every generated type registered.

## The JSX prop model

Every GIR class descending from `GObject` becomes an intrinsic element whose props follow these rules:

- **Properties become camelCase props.** Writable, construct, and construct-only properties become optional props: `show-title-buttons` is `showTitleButtons`.
- **Almost every property gets a notify handler.** `onNotifyX` receives `(value, self)`, read-only properties included, so you can observe what GTK4 changes on its own, including what it changes in reaction to a write of another prop. The element-accepting object properties below are the exception: they carry their value as a child element instead.
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

Each page carries the widget's documentation, hierarchy, slot rules, props, signal handlers, and `ref` methods with their signatures. `gtkx docs --help` covers the output directory and link root. Use it for pages you intend to publish; the copy agents read is written automatically, below.

## What agents are given

A model writing GTKX code has read a great deal of GTK, nearly all of it in C, PyGObject, Vala, or GJS, and nearly none of it valid here. Codegen writes an element reference and a rules block that correct for that, and both stay in step with the bindings because the same run produces them.

`.gtkx/reference` holds the same element pages `gtkx docs` produces, generated from this project's own GIR libraries and linked by paths that resolve from the project root. It is the authority on which props, signals, and methods exist, it costs nothing to read with `grep` or `cat`, and it is regenerated whenever the libraries or element configuration change. Add `.gtkx/` to `.gitignore`, as scaffolded projects do.

The rules block is marked in `AGENTS.md`, alongside a `CLAUDE.md` importing it for Claude Code, which reads it under that name instead. The block lists the idioms models get wrong here and points at the reference:

```markdown
<!-- BEGIN:gtkx-agent-rules -->
...
<!-- END:gtkx-agent-rules -->
```

Only what is between the markers is rewritten, so anything else in the file is yours to keep. An existing `CLAUDE.md` is never touched. Committing the block keeps the working tree clean, since it is rewritten on every codegen run. Set `agents: { rules: false }` or `agents: { reference: false }` to turn either off.

## Advanced: Customizing elements

A `GtkScale`'s marks have no property behind them, only `addMark` and `clearMarks`, and adding a child is `insertChildAfter` on a `GtkBox` but `addTopBar` on an `AdwToolbarView`. **Element behaviors** cover what property setting cannot: lifecycle hooks bound to a GLib type, which the reconciler calls as elements of that type are created, populated, updated, and removed. Every hook is listed in the [`ElementBehavior` reference](/v2/reference/@gtkx/react/config/type-aliases/ElementBehavior): `attach`, `reorder`, and `detach` place, move, and remove a child in a slot, `resolve` returns the object the container made for that child, and `flush` runs once the surrounding commit has placed every child. `update` runs on each commit with the previous and next props, and the prop names it returns are the ones GTKX will not also set as plain properties.

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

Augment the namespace module that declares the props. `GtkWidgetProps` belongs to `@gtkx/jsx/gtk`, so the import and declaration above target that subpath.

A behavior on a type covers every element descending from it, and your behaviors run before the built-in ones, so they override existing prop and slot handling. `isLazy: true` in the same map marks a type whose GObject its parent container creates.

## Next

With the codegen pipeline in hand, continue to [Async Operations](/v2/guide/async-operations).
