---
title: "Upgrading to 2.0"
description: "Migrate a GTKX 1.x application to GTKX 2, including configuration, imports, and native API changes."
---

# Upgrading to 2.0

GTKX 2.0 makes the behaviors previewed in 1.6 unconditional and removes their compatibility APIs. [Prepare on 1.6](/guide/upgrading-to-2#prepare-on-1-6), then move every `@gtkx/*` package to the same 2.0 version and work through this checklist. The [changelog](https://github.com/gtkx-org/gtkx/releases) lists each 2.0 prerelease's changes. Do not install `@gtkx/gi` or `@gtkx/jsx`; codegen creates them for the project. Security updates for 1.x end on 1 December 2026, as the [security policy](https://github.com/gtkx-org/gtkx/security/policy) states.

Upgrade to Node.js 26.7 or newer and set `"type": "module"` in `package.json`; GTKX packages are ESM-only and explicitly reject `require()`. Localized projects also need GNU gettext 0.23 or newer; see [Internationalization](/v2/guide/internationalization).

The 2.0 packages require React 19.3 or newer, and `@gtkx/testing` requires Vitest 5. Upgrade `react`, `@types/react`, and `vitest` first, then run the 2.0 upgrade command from the project directory:

::: code-group

```bash [npm]
npx @gtkx/cli@beta upgrade
```

```bash [pnpm]
pnpm dlx @gtkx/cli@beta upgrade
```

:::

The 1.x CLI has no `upgrade` command, so this runs the 2.0 CLI without installing it first. It moves every GTKX package in the project or its workspace to the newest 2.0 beta and installs it; [Updating GTKX](/v2/guide/updating) describes what it changes. Later releases need only `npx gtkx upgrade`.

On the day of a release, the package manager's [release-age gate](/v2/guide/scaffold-options#release-age-gates) also applies to downloading the CLI, and the command quietly runs an older one. pnpm 11 and newer gate by default and run the previous release. npm gates only when `min-release-age` is set, and then runs the newest stable release: during the 2.0 beta, that is the 1.x CLI, which has no `upgrade` command. Exempt GTKX for that one command:

::: code-group

```bash [npm]
npx --min-release-age=0 @gtkx/cli@beta upgrade
```

```bash [pnpm]
pnpm_config_minimum_release_age_exclude='["@gtkx/*","create-gtkx"]' \
    pnpm dlx @gtkx/cli@beta upgrade
```

:::

Yarn's gate does not apply to `npx`.

Use ESM `import` and `export` in application code, configuration files, and their local helpers. Convert `.cjs` and `.cts` files to ESM. Configuration runs through Node's native loader, so TypeScript configuration must use erasable syntax. Storybook main configuration uses `.ts`, `.mts`, `.js`, or `.mjs`; keep JSX in previews and stories. External CommonJS dependencies remain supported through ESM imports.

Stop running apps and dev sessions before the first [`gtkx codegen --force`](/v2/guide/cli#gtkx-codegen) after upgrading. Codegen replaces older generated-store layouts with a new snapshot. GI-only generation removes obsolete JSX bindings owned by the project; installing React again regenerates them.

## Clean up the configuration

Delete the `future` block and any retired ids under `deprecations.silence`. A graduated flag left at `true` is temporarily accepted with a warning; `false` is rejected because the old behavior no longer exists.

`Adw-1` is the sole default GIR root, and its GIR include generates `Gtk-4.0` transitively. Both namespaces are always present, but neither identifier belongs in `libraries`. List only additional roots:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
    libraries: ["WebKit-6.0"],
});
```

The `"*"` wildcard is gone, and explicitly listing `Adw-1` or `Gtk-4.0` is rejected. Explicit additional roots keep generated bindings stable across machines.

## Check the behavior changes

Work through the changes that apply to the project, then run `tsc --noEmit`. The typechecker catches the value and tuple changes; `gtkx build` catches stale resource imports.

### Byte sequences are `Uint8Array`

GIR byte sequences are `Uint8Array`. Check code using array mutation, `Array.isArray`, or JSON serialization.

### A returned `GObject.Value` is unwrapped

A returned `GObject.Value` is unwrapped and typed `unknown`; narrow it at the call site.

### Async results drop the success boolean

Promisified methods omit a leading success boolean from multi-value finish results when failure already rejects. `loadContentsAsync` resolves to `[Uint8Array, string | null]`.

### Inout records are updated in place

Inout records and boxed values mutate the object passed in instead of repeating it in the return value.

### Assets use query imports

Assets use relative `?resource`, `?icon`, `?font`, or `?url` imports. Settings schemas use query-free relative imports, typed by files [generated beside each schema](#type-settings-schema-imports).

### Import changes restart the app

Development apps restart and reset their state when a module starts or stops importing or re-exporting a module, or when an imported resource or icon changes. Adding a name to an existing import, editing type-only imports and editing component bodies still use Fast Refresh; [The app restarts instead of refreshing](/v2/guide/troubleshooting#the-app-restarts-instead-of-refreshing) lists every cause.

### Builds keep only reached classes

Generated classes register with their own definitions, so production builds retain only reached bindings. Import a class if `GObject.typeFromName` must find it.

### An app without a window quits

An application ends when its first render shows no window and nothing holds it. An app that rendered `null` until saved data loaded, as React Navigation's state persistence example does, now quits at once and `gtkx dev` prints `Application quit`. Render the window first and show a placeholder inside it; see [When the app ends](/v2/guide/application-lifecycle#when-the-app-ends).

### Unknown construct properties throw

Constructing an object with a key that is not one of its properties throws a `TypeError`, as in GJS, instead of skipping the key: `new Gio.Notification({ title: "Done" })` fails with "No property title on GNotification". Pass such values to the type's constructor function or setters, as in `Gio.Notification.new("Done")`.

### GLib criticals are logged

GLib criticals are logged by GLib, as in C and GJS applications, instead of becoming uncaught exceptions. They no longer end the application or fail tests; see [Error Handling](/v2/guide/error-handling#glib-criticals-and-warnings).

### Unanswered closes are undone

A close the app does not answer no longer leaves React and the toolkit out of step. Adwaita dialogs without `onClosed` or `onCloseAttempt`, and JSX tab pages whose view has no `onClosePage`, stay open when the user closes them; `showSidebar`, `showContent`, `searchModeEnabled` and the `open` of bottom sheets and tab overviews are restored when the app passes them without taking the user's change. Development builds warn with the handler to add; see [Closing](/v2/guide/modals-and-portals#closing).

### Binding transforms take the GJS shape

`bindPropertyFull` and `BindingGroup.bindFull` take transforms shaped as in GJS: `(binding, value) => [success, value]` receives the value read from one property and returns the value to write to the other, and `null` selects the default conversion. Rewrite functions taking GLib's closure arguments, `(binding, fromValue, toValue) => boolean`, to return the converted value instead of filling `toValue`. A `GObject.Closure` still receives the closure arguments. See [Binding properties](/v2/guide/subclassing#binding-properties).

### `gtkx` rejects unknown options

`gtkx` commands stop with an error on an option they do not define instead of ignoring it, naming the option and listing the ones the command takes. Remove options GTKX never read from package scripts and CI, and put options meant for the application after `--`, as in `gtkx dev -- --verbose`.

### `userEvent.type` parses key names

`userEvent.type` presses keys named in braces, so `type(entry, "Ada{Enter}")` activates the entry. Text with a literal `{`, such as JSON, fails with "Unclosed key descriptor"; write it as <span v-pre>`{{`</span>. See [Testing](/v2/guide/testing).

## Split JSX imports by namespace

The bare `@gtkx/jsx` entry point is removed. Import each element from the subpath for the namespace that declares it:

```tsx
import { AdwHeaderBar } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
```

Namespace subpaths are the public JSX surface and keep unrelated generated libraries out of the module graph.

## Drop the Adwaita subpaths

Adwaita is part of the core packages. `ComboRow`, `ToastProvider`, and `useToast` moved from `@gtkx/components/adw` to `@gtkx/components`, and the internal `@gtkx/react/adw` entry point is gone:

```tsx
import { ComboRow, ToastProvider, useToast } from "@gtkx/components";
```

`DropDown` and `ComboRow` now call `onSelectionChanged` with `null` when their items become empty. Check for `null` before storing the ID. `selectedId` no longer accepts `null`; pass `undefined` when no item is chosen.

Use `useToast().dismissAll()` in place of `useToastOverlay().dismissAll()`. `show()` returns the native `Adw.Toast`; call its `dismiss()` method to dismiss that toast. The forwarding `useToast().dismiss(toast)` method and `ToastOverlayController` type are removed.

## Update runtime imports

Import `createElementComponent` from `@gtkx/react` instead of `@gtkx/react/config`. The config subpath remains for renderer behavior and element registration APIs.

Direct native calls using `bigint64` or `biguint64` descriptors now require bigint values. Runtime bindings still accept exactly representable integer Number inputs within ±2⁵³ and normalize them before crossing the native boundary.

The generated wrapper-retention helper `retainWrapperClasses` now belongs to `@gtkx/runtime/internal`. Regenerate bindings with `gtkx codegen --force` after upgrading so their bootstrap imports match the runtime.

Use generated APIs instead of the removed runtime backing exports: `GObject.getProperty` and `GObject.setProperty`, ParamSpec accessors such as `spec.flags`, a `GObject.Value` instance's `getBoxed()` and `setBoxed()` methods, `GLib.Regex` matching methods, and generated class-structure methods. Replace `GObject.paramSpecOverride(name, source)` with `GObject.ParamSpec.override(name, source)`.

## Update application lifecycle code

React applications should keep rendering `AdwApplication` and `AdwApplicationWindow` through JSX; [When the app ends](/v2/guide/application-lifecycle#when-the-app-ends) describes how they end. The replacements below apply to code that manages an application lifecycle directly.

Replace `createApplication(ApplicationClass, props)` and `ApplicationClass.create(props)` with `new ApplicationClass(props)`. This works for Gio, Gtk, Adw, and custom application subclasses. Replace `getApplicationInstance(application)` and `application.getRegistrationState()` with `application.getIsRegistered()` and, once registered, `application.getIsRemote()`. Use the `activate` signal to build the primary instance's UI and the `runAsync(argv)` promise to observe completion.

The `ApplicationInstance`, `ApplicationRegistrationState`, `ApplicationClass`, and `ApplicationConstructor` helper types are removed. Use generated application classes and their constructor props directly. Use `Gio.Application` in place of the removed `CommandLineApplication` interface. Runtime shutdown remains `quit()` from `@gtkx/runtime`.

Replace `runApplication(application, argv)` with `application.runAsync(argv): Promise<number>` and `quitApplication(application)` with `application.quit()`. Pass an array beginning with the program name, or `null` or `[]` for no arguments; omitting the argument is an error. `RunApplicationResult` is removed. [Running without React](/v2/guide/application-lifecycle#running-without-react) describes when a run ends, how holds keep it running, and what `quit()` does.

## Update Variant values

Import `Variant` from `@gtkx/gi/glib`; its `ByteArray` type is now `VariantByteArray` in that namespace.

The `toVariant` and `fromVariant` helpers are removed. Replace `toVariant(signature, value)` with `new GLib.Variant(signature, value)`, `fromVariant(value)` with `value.deepUnpack()`, and recursive `fromVariant` calls with `value.recursiveUnpack()`. For native replies, `fromVariant("(s)", reply)` becomes `reply.deepUnpack<"(s)">()`. `FromVariantOptions` and `RecursiveFromVariantOptions` are removed too.

Variant dictionaries now use objects for every key type; replace `Map` inputs and reads with object properties. GTKX continues to use exact `bigint` values for 64-bit integers. See [GVariant packing and unpacking](/v2/guide/dbus#gvariant-packing-and-unpacking) for the unpacking modes and GJS compatibility aliases.

## Move GObject ownership into JSX

The settings hooks no longer create a `Gio.Settings` instance. Render `GSettings` from `@gtkx/jsx/gio` in the root portal, capture the instance with a state callback ref, and mount its consumers once it is available. Pass that instance first to `useSetting`, and add it as the `settings` option to `useBindSetting`. [The settings instance](/v2/guide/native-state#the-settings-instance) shows the complete ownership pattern.

`useProperty`, `useSignal`, and `useBindSetting` now take a mounted instance rather than a mutable ref object. Store callback-ref values in state and pass the value to the hook so subscriptions follow replacement and unmounting. Remove imports of the deleted `RefProp` type. See [Objects that JSX creates](/v2/guide/native-state#objects-that-jsx-creates) for the pattern.

## Give form choices explicit values

A form `ComboRow` now controls a non-nullable string field. Replace `null` or `undefined` defaults with an item ID that exists in the choices. GTKX preserves that ID while an asynchronous source is empty, so reloading choices does not alter the form value or dirty state. See [Choose a row](/v2/guide/forms#choose-a-row).

## Update internationalization

GTKX now delegates extraction and resource typing to `i18next-cli`. Keep catalog declarations in ESM files and use the exact names `t`, `useTranslation`, `Trans`, or `TransWithoutContext`; replace imported aliases, `i18n.t` member calls, dynamic keys, and CommonJS declarations with those static forms. Extraction also no longer follows a `t` received through `withTranslation`, the `Translation` render prop or a function parameter, as 1.6 did: codegen leaves those messages out without an error and keeps their translations as obsolete PO entries, and `tsc` then rejects their keys. Import `t` from `@gtkx/i18n` or call `useTranslation()` in those modules; the next codegen run restores the obsolete translations.

Replace the removed positional plural overload:

```ts
t("{{count}} file", {
    count,
    defaultValue_one: "{{count}} file",
    defaultValue_other: "{{count}} files",
});
```

Run codegen after migrating. The generated declaration now uses i18next's standard `CustomTypeOptions` resources instead of GTKX's strict translation registry, so remove imports of GTKX-specific registry types and use types exported by `i18next` or `react-i18next`.

GTKX no longer reads `GTKX_LOCALE_DIR`. A Vitest configuration that tests compiled catalogs passes their directory to the plugin instead:

```ts
plugins: [gtkx({ localeDir: resolve(import.meta.dirname, "dist/locale") })],
```

See [Test translations](/v2/guide/internationalization#test-translations).

## Type settings schema imports

Codegen, `gtkx dev` and `gtkx build` write the types of each GSettings schema beside it, as `<name>.gschema.d.xml.ts`, instead of declaring schemas in `node_modules/.gtkx/env.d.ts`. TypeScript reads these files only with [`allowArbitraryExtensions`](https://www.typescriptlang.org/tsconfig/#allowArbitraryExtensions), so enable it and keep the generated files out of version control:

```json [tsconfig.json]
{
    "compilerOptions": {
        "allowArbitraryExtensions": true
    }
}
```

```text [.gitignore]
*.d.xml.ts
```

A schema import with a wrong path now fails `tsc`, and schemas with the same file name in different directories get their own types. Codegen warns while a project with schemas lacks the option.

## Replace removed APIs

| Replace                                     | With                                                           |
| ------------------------------------------- | -------------------------------------------------------------- |
| `object.addEventListener(name, handler)`    | `object.on(name, handler)`                                     |
| `object.removeEventListener(name, handler)` | `object.off(name, handler)`                                    |
| `Gdk.RGBA.create(css)`                      | `new Gdk.RGBA()` followed by a checked `parse(css)`            |
| `Graphene.Point.create(x, y)`               | `new Graphene.Point({ x, y })`                                 |
| `Graphene.Rect.create(x, y, width, height)` | `new Graphene.Rect().init(x, y, width, height)`                |
| `Graphene.Size.create(width, height)`       | `new Graphene.Size({ width, height })`                         |
| `GObject.buildValue(...)`                   | Pass the JavaScript value, or initialize `new GObject.Value()` |
| `getObjectProperty(...)`                    | `getProperty(...)`                                             |
| `setObjectProperty(...)`                    | `setProperty(...)`                                             |
| `@gtkx/gi/cairo`                            | `@gtkx/cairo`                                                  |
| `@gtkx/components/adw`                      | `@gtkx/components`                                             |
| `animated.GtkLabel`                         | `animated(GtkLabel)`                                           |
| `AnimatedElements`                          | `AnimatedElementMap`                                           |

The cairo stub-constructor `*ConstructorProps` aliases have no replacement because their constructors no longer exist.

### Record constructors

_Only affects code that constructs records with `new` or names their `*ConstructorProps` types._

Record constructors now take a props object only when the record has public writable value fields, a supported native default constructor, or the zero-initialization contract of `GObject.Value`. For other records, `new` calls the record's native `new` constructor with the given arguments, as in GJS: `new GLib.String(text)` calls `GLib.String.new(text)`, and `new GLib.VariantType("s")` calls `GLib.VariantType.new("s")`. Records without a `new` constructor, or whose first zero-argument constructor has another name, come only from their native factories: use `GLib.Error.newLiteral(domain, code, message)` or `Graphene.Matrix.alloc().initIdentity()`. The synthetic `*ConstructorProps` types of all these records are removed. `GLib.String` exposes `str`, `len`, and `allocatedLen` as readonly; use methods such as `assign`, `append`, and `truncate` to update its buffer.

### Methods that return native addresses

_Only affects code that reads raw native memory, such as the contents of `GLib.Bytes`, `GLib.Variant` or `Gio.MemoryOutputStream`._

Generated methods that expose unmanaged native addresses are omitted. Replace `GLib.Bytes.getRegion` with `getData` or `newFromBytes`, use `GLib.Variant.getDataAsBytes` instead of `getData`, and close a `Gio.MemoryOutputStream` before calling `stealAsBytes` instead of `getData` or `stealData`.

### `sink()` on closures and param specs

_Only affects code that creates a `GObject.Closure` or `GObject.ParamSpec` and sinks it itself._

Remove calls to `GObject.Closure.sink()` and `GObject.ParamSpec.sink()`. These generated methods are removed as part of the GTKX 2 ownership model: native handles manage reference sinking and release automatically, so no replacement call is needed.

### `@gtkx/gl` debug output and sync waits

_Only affects apps that use `@gtkx/gl`._

`@gtkx/gl` no longer exposes `getDebugMessageLog` or `debugMessageCallback`, whose native contracts require caller-owned memory or callback lifetime management. Remove those calls; the shader, program, and pipeline info-log helpers remain available. Replace `clientWaitSyncLoop` with the generated `clientWaitSync`, which accepts the full timeout as a `bigint`.

### Test compositor

_Only affects test setups that chose a compositor other than the default, Sway._

Headless displays always run Sway, so the Vitest plugin no longer accepts a `compositor` option and `@gtkx/vitest` no longer exports `CompositorId`. Delete the option and any `CompositorId` imports; tests need Sway, as described in the [testing setup](/v2/guide/testing#setup).

## Rename slot props

Child slots now use their GtkBuilder child type names. Rename `topBar` and `bottomBar` on `AdwToolbarView` to `top` and `bottom`, and `overlays` on `GtkOverlay` to `overlay`. The old names are no longer accepted.

## Verify the upgrade

```bash
gtkx codegen --force
tsc --noEmit
gtkx build
```

Finally run the application and inspect it. `@gtkx/react` now registers the Adwaita elements itself, so every application initializes the Adwaita stylesheet and the build depends on the Adwaita introspection and runtime libraries even when it renders no Adwaita widget.

For current configuration and binding behavior, see [Configuration and Codegen](/v2/guide/configuration-and-codegen) and the [API reference](/v2/reference/).
