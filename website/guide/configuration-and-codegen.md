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

`mergeConfig(base, override)` layers a project config over a shared base. A `$development` or `$production` block layers over the top level, per mode.

### Every option

`applicationId` is the only required key; the rest have defaults.

- **`applicationId`**: the GApplication identifier the app registers under, in reverse-DNS form (`com.example.Tasks`).
- **`libraries`**: the GIR libraries to bind, as `Name-Version`. `Gtk-4.0` is the default, and joins any list that does not already name a Gtk version. Under [`v2DefaultLibraries`](#future-flags) `Adw-1` joins on the same terms, so the list becomes the libraries you want *on top of* GTK and Adwaita — `["WebKit-6.0"]` rather than `["Gtk-4.0", "Adw-1", "WebKit-6.0"]`. Each default is mandatory by namespace rather than by version, so a list that pins `Gtk-4.2` or a later Adwaita keeps its pin.

  The bare string `"*"` (never an array entry) binds everything on the GIR path. **Deprecated: the wildcard is removed in GTKX 2.0.** What it resolves to depends on which introspection packages the build host happens to have installed, so the generated store — and every type your code compiles against — changes with the machine. List the libraries the project needs instead. Codegen names the wildcard on each run while it still works.
- **`girPath`**: directories searched for `.gir` files ahead of the standard locations.
- **`reactCompiler`**: the React Compiler, on by default. `false` disables it; an object forwards `compilationMode` and `panicThreshold`.
- **`codegen: false`**: skips generation, so the project imports whatever binding store is already installed.
- **`applicationIcon`**: a project-relative icon-theme directory, or one SVG, PNG, or XPM file to install as the
  desktop application icon. Directories keep their theme layout; a single file is placed under `hicolor` and
  renamed to the application ID. When omitted, GTKX uses exactly one `<applicationId>.svg`, `.png`, or `.xpm`
  file in the project root, if present; multiple matches require an explicit choice.
- **`userEventSignals`**: signals, keyed by GLib type name, that GTKX suppresses while writing to a widget itself. A write silences all of them, and silences `notify` only for the property it writes, so a property the widget changes in reaction still reaches its `onNotifyX`. Entries merge into the defaults.
- **`elements`**: the [element customizations](#advanced-customizing-elements): `behaviors` is the module default-exporting your `defineElements` map, `config` sets per-type codegen output (`component`, `props`, `omittedProps`, `isLazy`).
- **`agents`**: what codegen writes for coding agents, both on by default. `rules: false` stops the `AGENTS.md` block, `reference: false` stops the on-disk element reference. See [What agents are given](#what-agents-are-given).
- **`mcp`**: which tools the [MCP server](/guide/mcp) registers: `tools` is a list of name patterns, `readOnly` drops the tools that drive the app.
- **`future`**: opts into behavior that becomes the default in the next major. See [Future flags](#future-flags).

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

## What codegen emits

Codegen writes packages into `node_modules/.gtkx` and links them into `node_modules/@gtkx`, so imports resolve without either appearing in your `package.json`:

- **`@gtkx/gi`** is the introspected API, one subpath per namespace (`@gtkx/gi/gtk`, `@gtkx/gi/adw`): the classes, enums, and functions you call imperatively, for refs and values such as `Gtk.Orientation.VERTICAL`.
- **`@gtkx/jsx`** is the React layer, likewise per namespace (`@gtkx/jsx/gtk`, `@gtkx/jsx/adw`): a PascalCase component per widget (`GtkButton`, `AdwHeaderBar`), a `Props` interface for each, and a `React.JSX.IntrinsicElements` augmentation.

The `cairo` namespace is provided by the [`@gtkx/cairo`](/guide/cairo) package rather than generated; the store re-exports it as `@gtkx/gi/cairo` for backward compatibility.

Record fields appear as accessors: a getter wherever the read lands on the right memory, and a setter only where a field slot can hold what it stores. `null`-terminated pointer arrays read, so `Gio.DBusNodeInfo.interfaces` hands back its array, but they are read-only and absent from the record's constructor props, since the slot cannot keep an array alive. Fields whose element count lives in a sibling field, and `GList` or `GSList` links, carry no accessor and are absent from the class.

A few bindings take a NUL-terminated C string that GIR describes as a byte array (`GLib.Variant.newBytestring`), so the value silently stops at the first zero byte. Binary payloads go through `GLib.Bytes` and `GLib.Variant.newFromBytes`.

### One import for every element

`@gtkx/jsx` itself exports everything its per-namespace subpaths do, so a file that mixes namespaces can name a single specifier:

```tsx
import { AdwHeaderBar, GtkBox, GtkButton } from "@gtkx/jsx";
```

Nothing collides, however many libraries you bind: every jsx export is keyed by its GLib type name, so `GtkBox` and `AdwActionRow` cannot claim the same name. The root is a barrel over the same per-namespace modules rather than a second copy of them, so importing it evaluates every namespace the store carries, and each of those evaluates its `@gtkx/gi` counterpart. Prefer a subpath in a file that touches one namespace while the store also carries libraries that file has no use for.

`@gtkx/gi` has no equivalent root. Its symbols are imported namespaced, as `import * as Gtk from "@gtkx/gi/gtk"`, so `Gtk.Orientation` and `Adw.ResponseAppearance` stay apart.

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

## Future flags

The `future` block opts into behavior that becomes the default in the next major version, so you can migrate one change at a time instead of all at once during an upgrade. Every flag is off by default, and the CLI warns once per run about the ones you have not set, so nothing 2.0 removes reaches you without notice. Clear every warning on the last 1.x release and upgrading to 2.0 changes nothing.

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    future: { v2ByteArrays: true },
});
```

Flag names are camelCase, so the key is `v2ByteArrays`, not `v2_byteArrays`.

- **`v2ByteArrays`**: represents GIR byte sequences as `Uint8Array` instead of `number[]`. It covers `guint8` C arrays and `GByteArray`, in return values, out parameters, record fields, and properties, and it sets what the runtime's `fromVariant` unpacks a byte array variant (`ay`) to. It does not cover `@gtkx/cairo` or `@gtkx/gl`, which already use typed arrays.

  Parameters accept `Uint8Array | number[]` either way, so turning this flag on never breaks a call site that passes values *in*. What changes is what you get *back*: `GLib.fileGetContents` returns `[boolean, Uint8Array]` rather than `[boolean, number[]]`, so code that calls `.push`, `.concat`, `Array.isArray`, or `JSON.stringify` on a result needs updating. Flip the flag and run `tsc`: every site that needs attention is a type error.

- **`v2ValueReturns`**: hands back what a `GObject.Value` holds rather than the value itself, the read-direction counterpart of the inference above. It covers the bindings whose return type or caller-allocated out parameter is a `GValue`: `Gtk.DropTarget.getValue`, `Gtk.ConstantExpression.getValue`, `Gdk.Clipboard.readValueAsync`, `Gtk.Builder.valueFromStringType`, `Gtk.TreeModel.getValue`, and a handful more. Their type becomes `unknown`, since GIR says nothing about what the value holds, so the call site asserts the type it asked for: `(await clipboard.readValueAsync(Gio.File, 0, null)) as Gio.File`. Signal parameters and properties keep handing over a `GObject.Value`, which a handler for a binding transform writes into.

  Unlike the byte sequence flag, this one only changes what comes *back*; the `GObject.Value | JsValue` parameter widening is not part of it and applies either way. `tsc` reports every return site that needs attention, since `unknown` cannot be used without an assertion.

- **`v2FinishResults`**: drops the leading success boolean from what a promisified async method resolves to. It covers every pair whose finish function reports failure by throwing and hands results back through out parameters, where the boolean is always `true`: `Gio.File.loadContentsAsync` resolves to `[Uint8Array, string | null]` rather than `[boolean, Uint8Array, string | null]`, and a call left with a single out parameter resolves to that value directly, so `Gio.File.replaceContentsAsync` resolves to the new etag rather than `[boolean, string | null]`. The finish methods themselves, like `loadContentsFinish`, keep the boolean, as do async methods whose finish returns only the boolean.

  Flip the flag and run `tsc`: destructuring sites written for the old tuple, such as `const [, contents] = await file.loadContentsAsync(null)`, become type errors pointing at what to update.
- **`v2InoutReturns`**: stops repeating an inout record or boxed parameter in a method's return value. Such a parameter is mutated in place — the instance you pass is the instance the callee updates — so the returned entry was always the same object you already hold. `Gsk.Path.getNext(point)` becomes `boolean` instead of `[boolean, PathPoint]`, `Pango.Matrix.transformRectangle(rect)` becomes `void` instead of `Rectangle`, and mixed cases only drop the repeated entry: `Soup.MessageHeadersIter.next` keeps its other out parameters. Primitive inout parameters, which cannot be mutated in place, stay in the result either way, and signal emission and virtual methods already work this way. `tsc` flags every call site that destructured the repeated value.
- **`v2ResourceImports`**: replaces the `#data/` import map with relative, query-suffixed asset imports. Remove
  `"imports": { "#data/*": "./data/*" }` from `package.json`, then migrate assets and schemas separately:

  ```ts
  // Before
  import logoUri from "#data/logo.png";
  import schema from "#data/com.example.Tasks.gschema.xml";

  // After, from src/app.tsx
  import logoPath from "../data/logo.png?resource";
  import schema from "../data/com.example.Tasks.gschema.xml";
  ```

  `?resource` bundles an asset and returns its GResource path; `?resource=/org/example/exact.png` chooses an
  exact path. Use `?url` when an API needs a real file. Schema imports stay query-free and become typed from
  their relative import. While this flag is staged, a bare relative asset import is rejected so every call
  site has to choose deliberately. Build a URI only where an API requires one: `` `resource://${logoPath}` ``.

  `?icon` bundles an SVG, PNG, or XPM as a private icon-theme resource and returns its extensionless icon
  name. `?icon=example-confirm-symbolic` overrides that name, which is useful for libraries that ship their
  own icons:

  ```ts
  import confirmIcon from "./icons/scalable/actions/confirm.svg?icon=example-confirm-symbolic";
  ```

  An import below an `icons/hicolor/<size>/<context>/` or `icons/<size>/<context>/` tree keeps its recognized
  hicolor layout, including directories such as `scalable/actions` and `16x16/apps`. A file outside one of
  those layouts is placed directly in the app's resource icon path as an unthemed fallback; put symbolic and
  size-specific icons in a theme layout when recoloring or size selection matters. Dependency imports use the
  consuming application's resource prefix, and GTKX registers that private path with the current icon theme,
  so they need no system installation. Choose package-specific icon names because two imports cannot claim
  the same icon name and layout.

  Production builds place these bundled assets in `gtkx.gresource` beside `bundle.mjs`. Generated resource
  modules load and register that file automatically; no application bootstrap code or data-file installation
  rule is required.
- **`v2DefaultLibraries`**: binds `Adw-1` alongside `Gtk-4.0` whether or not `libraries` names it. Every
  project then generates the Adwaita bindings, so `@gtkx/gi/adw` and `@gtkx/jsx/adw` are always present and
  the packages built on them — [`@gtkx/components/adw`](/guide/components), [`@gtkx/forms`](/guide/forms),
  [`@gtkx/navigation`](/guide/navigation) — need no opt-in. Each joins by namespace, so a list that pins
  another version of Gtk or Adwaita keeps its pin. Naming `Gtk-4.0` or `Adw-1` outright then changes nothing,
  and codegen says so on its next run; in 2.0, once the behavior is unconditional, naming either becomes a
  configuration error asking you to delete the line.

  Nothing reports this flag for you: it is not a type error, and unlike `v2ResourceImports` there is no build
  failure either. What it changes on its own is the build: codegen fails on a host without the Adwaita
  introspection data, since a mandatory library has to resolve to a `.gir` file; every deb and rpm gains a
  `libadwaita-1-0` or `libadwaita` relation, because those come from the libraries the store recorded; and
  every generated NOTICE file gains libadwaita's LGPL entry.

  The rest waits until something imports the generated Adwaita module — `@gtkx/gi/adw`, `@gtkx/jsx/adw`, one
  of the packages built on them, or the flat `@gtkx/jsx` root, which pulls every namespace the store carries.
  Binding `Adw-1` alone changes nothing at runtime: an application that only imports `@gtkx/jsx/gtk` never
  evaluates the Adwaita module. Once it does, `@gtkx/gi/adw` calls libadwaita's `adw_init`
  while the module evaluates, which installs the Adwaita style manager and stylesheet, so the application
  restyles even where it renders no Adwaita widget. And libadwaita becomes a hard requirement: the module
  resolves its types out of `libadwaita-1.so.0` at module scope, so a host without the library fails before
  any application code runs. Turn the flag on, import what you were going to import, run the app, and look
  at it.

- **`v2TreeShaking`**: folds each generated class's registration into its own definition, so `gtkx build`
  drops the classes an app never reaches instead of shipping every binding of every configured library.
  Rendered elements, classes your code touches, and everything their signatures reference stay; the rest —
  typically most of the store — is removed, which roughly halves a small app's bundle. No call site changes,
  so `tsc` reports nothing for this flag.

  Three behaviors move with it: a bare `import "@gtkx/gi/gtk"` registers nothing on its own; import a value
  from the namespace instead (namespace initialization such as `gtk_init` and the prototype overrides still
  run whenever the namespace is imported at all). String-driven rendering keeps working, because every path
  that resolves a type name only ever meets registered types: a rendered element's component keeps its class,
  and a value a binding hands back keeps the classes its signature names — but rendering an element whose
  component the bundle never imported throws, since constructing through an ancestor would build the wrong
  type. `typeFromName` keeps GLib's contract everywhere: it finds only types already registered in-process,
  and a production bundle registers a generated type when its class is retained, so import the class if you
  need its name to resolve — `gtkx dev` and tests never bundle, and there every type stays registered
  exactly as today.

  The `animated` binding gets a build-time rewrite of its own: `animated.GtkX` member accesses and
  `animated(...)` calls become imports of exactly the widgets they animate, while a dynamic use of the
  `animated` value itself — spreading it, `Object.keys`, computed access — keeps the whole widget namespace
  and `gtkx build` warns about the file. Property access on `animated` is deprecated and removed in GTKX 2.0
  along with its rewrite — prefer importing the component and calling `animated(GtkX)`, the only form 2.0
  keeps, where `animated` is plainly callable and no rewrite exists at all; `gtkx build` names each file
  still reading components off `animated`.

Changing a flag invalidates the generated store, so the next `gtkx dev`, `gtkx build`, or `gtkx codegen` regenerates it automatically. A key the `future` block does not define is ignored rather than rejected, and codegen names it on each run so a typo does not stay silent.

### The deprecation warning

Loading a configuration that leaves a flag unset prints one grouped block on stderr, naming every pending
flag with the stable id that identifies it:

```
[gtkx] warn 2 of 7 future flags are unset. Their behavior becomes the default in GTKX 2.0.

  [gtkx-v2-byte-arrays]       future: { v2ByteArrays: true }
    Byte sequences come back as number[]. In 2.0 they come back as Uint8Array. `Array.isArray` and `JSON.stringify` change silently; grep for them.

  [gtkx-v2-default-libraries] future: { v2DefaultLibraries: true }
    Only Gtk-4.0 is bound by default. In 2.0 Adw-1 is bound alongside it. Nothing reports this one; check the app yourself.

  Set one flag at a time and run tsc: it reports every affected call site except where noted above.
  Guide    https://gtkx.dev/guide/upgrading-to-2
  Silence  deprecations: { silence: ["gtkx-v2-byte-arrays"] }
```

The block goes to stderr, never stdout, so it cannot corrupt the JSON-RPC stream `gtkx mcp` speaks. It prints
once and then stays quiet until the set of pending flags changes, so `gtkx dev` shows it once at startup rather
than once in the supervisor and again in the runner it forks. Editing `gtkx.config.ts` to add or remove a flag
prints the new block.

Every flag has an id, and each one can be silenced on its own:

| Flag | Deprecation id |
| --- | --- |
| `v2ByteArrays` | `gtkx-v2-byte-arrays` |
| `v2ValueReturns` | `gtkx-v2-value-returns` |
| `v2FinishResults` | `gtkx-v2-finish-results` |
| `v2InoutReturns` | `gtkx-v2-inout-returns` |
| `v2ResourceImports` | `gtkx-v2-resource-imports` |
| `v2DefaultLibraries` | `gtkx-v2-default-libraries` |
| `v2TreeShaking` | `gtkx-v2-tree-shaking` |

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    future: { v2ByteArrays: true },
    deprecations: { silence: ["gtkx-v2-inout-returns"] },
});
```

Silencing is an acknowledgement, not a fix: the behavior still changes in 2.0. It exists so a project working
through the flags one at a time is not re-reading the same block every run. A silenced flag still counts in the
summary line, which reports how many are silenced, so the count never understates what 2.0 will change. An id
no flag reports is a configuration error, so a typo cannot quietly turn the warning off.

### When a flag graduates

In the next major each flag's behavior becomes unconditional and its key is removed. Leaving a graduated flag at `true` will be accepted as a no-op with a single warning naming the key, and setting it to `false` will be a configuration error, because at that point it can no longer be honored. [Upgrading to 2.0](/guide/upgrading-to-2) walks through the whole move.

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

A `GtkScale`'s marks have no property behind them, only `addMark` and `clearMarks`, and adding a child is `insertChildAfter` on a `GtkBox` but `addTopBar` on an `AdwToolbarView`. **Element behaviors** cover what property setting cannot: lifecycle hooks bound to a GLib type, which the reconciler calls as elements of that type are created, populated, updated, and removed. Every hook is listed in the [`ElementBehavior` reference](/reference/@gtkx/react/config/type-aliases/ElementBehavior): `attach`, `reorder`, and `detach` place, move, and remove a child in a slot, `resolve` returns the object the container made for that child, and `flush` runs once the surrounding commit has placed every child. `update` runs on each commit with the previous and next props, and the prop names it returns are the ones GTKX will not also set as plain properties.

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
    libraries: ["Gtk-4.0", "Adw-1"],
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

Either specifier works. `GtkWidgetProps` is declared once, in the namespace module both `@gtkx/jsx/gtk` and the flat `@gtkx/jsx` re-export, so an augmentation written against either one merges into that single declaration and is visible through both.

A behavior on a type covers every element descending from it, and your behaviors run before the built-in ones, so they override existing prop and slot handling. `isLazy: true` in the same map marks a type whose GObject its parent container creates.

## Next

With the codegen pipeline in hand, continue to [Async Operations](/guide/async-operations).
