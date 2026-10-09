---
title: "Upgrading to 2.0"
description: "Move a GTKX 1.x application to the final GTKX 2 behavior."
---

# Upgrading to 2.0

GTKX 2.0 makes the behaviors previewed in 1.6 unconditional and removes their compatibility APIs. Upgrade all `@gtkx/*` packages together, then work through this checklist.

Upgrade to Node.js 26.7 or newer and set `"type": "module"` in `package.json`; GTKX packages are ESM-only and explicitly reject `require()`. Localized projects also need GNU gettext 0.25 or newer.

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

- GIR byte sequences are `Uint8Array`. Check code using array mutation, `Array.isArray`, or JSON serialization.
- A returned `GObject.Value` is unwrapped and typed `unknown`; narrow it at the call site.
- Promisified finish methods omit a leading success boolean when failure already rejects. `loadContentsAsync` resolves to `[Uint8Array, string | null]`.
- Inout records and boxed values mutate the object passed in instead of repeating it in the return value.
- Assets use relative `?resource`, `?icon`, `?font`, or `?url` imports. Settings schemas use query-free relative imports.
- Generated classes register with their own definitions, so production builds retain only reached bindings. Import a class if `GObject.typeFromName` must find it.

Run `tsc --noEmit` after these changes. The typechecker catches the value and tuple changes; `gtkx build` catches stale resource imports.

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

Use `useToast().dismissAll()` in place of `useToastOverlay().dismissAll()`. `show()` returns the native `Adw.Toast`; call its `dismiss()` method to dismiss that toast. The forwarding `useToast().dismiss(toast)` method and `ToastOverlayController` type are removed.

Import `createElementComponent` from `@gtkx/react` instead of `@gtkx/react/config`. The config subpath remains for renderer behavior and element registration APIs.

The `@gtkx/native` root no longer exports `armParentDeath`, `addLogListener`, `removeLogListener`, or `__napiBindingTarget`. Subscribe to native logs with `onLog(listener)` and release the subscription with `unsubscribe()`. Process supervision remains internal.

Direct native calls using `bigint64` or `biguint64` descriptors now require bigint values. Runtime bindings still accept exactly representable integer Number inputs within ±2⁵³ and normalize them before crossing the native boundary.

The generated wrapper-retention helper `retainWrapperClasses` now belongs to `@gtkx/runtime/internal`. Regenerate bindings with `gtkx codegen --force` after upgrading so their bootstrap imports match the runtime.

Use generated APIs instead of the removed runtime backing exports: `GObject.getProperty` and `GObject.setProperty`, ParamSpec accessors such as `spec.flags`, a `GObject.Value` instance's `getBoxed()` and `setBoxed()` methods, `GLib.Regex` matching methods, and generated class-structure methods. Replace `GObject.paramSpecOverride(name, source)` with `GObject.ParamSpec.override(name, source)`.

Application lifecycle methods and the Variant class belong to their generated namespaces:

```ts
import * as Adw from "@gtkx/gi/adw";
import { Variant } from "@gtkx/gi/glib";

const application = new Adw.Application({ applicationId: "org.example.App" });
const target = new Variant("(s)", ["task-id"]);
```

Replace `createApplication(ApplicationClass, props)` and `ApplicationClass.create(props)` with `new ApplicationClass(props)`. This works for Gio, Gtk, Adw, and custom application subclasses. Replace `getApplicationInstance(application)` and `application.getRegistrationState()` with `application.getIsRegistered()` and, once registered, `application.getIsRemote()`. Use the `activate` signal to build the primary instance's UI and the `runAsync(argv)` promise to observe completion.

The `ApplicationInstance`, `ApplicationRegistrationState`, `ApplicationClass`, and `ApplicationConstructor` helper types are removed. Use generated application classes and their constructor props directly. The Variant `ByteArray` type is now `VariantByteArray` in `@gtkx/gi/glib`. Use `Gio.Application` in place of the removed `CommandLineApplication` interface. Runtime shutdown remains `quit()` from `@gtkx/runtime`.

The `toVariant` and `fromVariant` helpers are removed. Replace `toVariant(signature, value)` with `new GLib.Variant(signature, value)`, `fromVariant(value)` with `value.deepUnpack()`, and recursive `fromVariant` calls with `value.recursiveUnpack()`. For native replies, `fromVariant("(s)", reply)` becomes `reply.deepUnpack<"(s)">()`. `FromVariantOptions` and `RecursiveFromVariantOptions` are removed too.

Variant dictionaries now use objects for every key type; replace `Map` inputs and reads with object properties. GTKX continues to use exact `bigint` values for 64-bit integers. See [Calling D-Bus directly](/v2/guide/async-operations#calling-d-bus-directly) for the unpacking modes and GJS compatibility aliases.

Replace `runApplication(application, argv)` with `application.runAsync(argv): Promise<number>` and `quitApplication(application)` with `application.quit()`. Pass an array beginning with the program name, or `null` or `[]` for no arguments; omitting the argument is an error. `RunApplicationResult` is removed. Command-line handling starts immediately while Node keeps control of the event loop. Observe the promise's exit status and handle startup or shutdown rejections.

An active run finishes automatically when it has no application windows or outstanding JavaScript `hold()` calls. Balance each `hold()` with `release()` to keep background work alive; the final release observes `inactivityTimeout`. A service starts with a ten-second grace period before its first use. Call `application.quit()` to force shutdown even while holds or windows remain. The promise resolves after GTKX completes shutdown and releases the process-wide default. Rejected command lines and remote instances resolve immediately; call `application.quit()` afterward to release their retained application state.

GTKX tracks JavaScript holds and application windows; it cannot observe arbitrary holds acquired directly by native C code. Explicit holds survive forced shutdown and must still be balanced with `release()`; an unmatched release throws `RangeError`. Full native shutdown can run only once per instance; restarted applications and those already quit by native code may retain registration until finalization. Create another application when another complete lifecycle is needed.

React holds an application until its first activated tree commits. React's `quit()`, `root.unmount()`, and `root.render(null)` remove the UI while allowing explicit background holds to keep the application running. Release those holds when the work finishes. If initial asynchronous rendering or Suspense commits without a window, hold the application until that work can create one.

## Move GObject ownership into JSX

The settings hooks no longer create a `Gio.Settings` instance. Render `GSettings` from `@gtkx/jsx/gio` in the root portal, capture the instance with a state callback ref, and mount its consumers once it is available. Pass that instance first to `useSetting`, and add it as the `settings` option to `useBindSetting`. The [settings tutorial](/v2/tutorial/preferences-and-theming#create-the-settings-instance) shows the complete ownership pattern.

`useProperty`, `useSignal`, and `useBindSetting` now take a mounted instance rather than a mutable ref object. Store callback-ref values in state and pass the value to the hook so subscriptions follow replacement and unmounting. Remove imports of the deleted `RefProp` type. See [Properties and the hooks](/v2/guide/subclassing#properties-and-the-hooks) for the pattern.

## Give form choices explicit values

A form `ComboRow` now controls a non-nullable string field. Replace `null` or `undefined` defaults with an item ID that exists in the choices. GTKX preserves that ID while an asynchronous source is empty, so reloading choices does not alter the form value or dirty state. See [Choose a row](/v2/guide/forms#choose-a-row).

## Update internationalization

GTKX now delegates extraction and resource typing to `i18next-cli`. Keep catalog declarations in ESM files and use the exact names `t`, `useTranslation`, `Trans`, or `TransWithoutContext`; replace imported aliases, `i18n.t` member calls, dynamic keys, and CommonJS declarations with those static forms.

Replace the removed positional plural overload:

```ts
t("{{count}} file", {
    count,
    defaultValue_one: "{{count}} file",
    defaultValue_other: "{{count}} files",
});
```

Run codegen after migrating. The generated declaration now uses i18next's standard `CustomTypeOptions` resources instead of GTKX's strict translation registry, so remove imports of GTKX-specific registry types and use types exported by `i18next` or `react-i18next`.

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

Record constructors now require either public writable value fields, a supported native default constructor, or the zero-initialization contract of `GObject.Value`. Obtain other records from their native factories: use `GLib.String.new(text)`, `GLib.Error.newLiteral(domain, code, message)`, or `Graphene.Matrix.alloc().initIdentity()`. Their synthetic `*ConstructorProps` types are removed. `GLib.String` exposes `str`, `len`, and `allocatedLen` as readonly; use methods such as `assign`, `append`, and `truncate` to update its buffer.

Generated methods that expose unmanaged native addresses are also omitted. Replace `GLib.Bytes.getRegion` with `getData` or `newFromBytes`, use `GLib.Variant.getDataAsBytes` instead of `getData`, and close a `Gio.MemoryOutputStream` before calling `stealAsBytes` instead of `getData` or `stealData`.

`@gtkx/gl` no longer exposes `getDebugMessageLog` or `debugMessageCallback`, whose native contracts require caller-owned memory or callback lifetime management. Remove those calls; the shader, program, and pipeline info-log helpers remain available. Replace `clientWaitSyncLoop` with the generated `clientWaitSync`, which accepts the full timeout as a `bigint`.

## Verify the upgrade

```bash
gtkx codegen --force
tsc --noEmit
gtkx build
```

Finally run the application and inspect it. `@gtkx/react` now registers the Adwaita elements itself, so every application initializes the Adwaita stylesheet and the build depends on the Adwaita introspection and runtime libraries even when it renders no Adwaita widget.

For current configuration and binding behavior, see [Configuration and Codegen](/v2/guide/configuration-and-codegen) and the [API reference](/v2/reference/).
