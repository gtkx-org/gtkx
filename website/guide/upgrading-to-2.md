---
title: "Upgrading to 2.0"
description: "Prepare a GTKX 1.6 application, then move it to GTKX 2.0."
---

# Upgrading to 2.0

GTKX 1.6 can enable most 2.0 behavior before the package upgrade. Adopt those changes one at a time, then update every `@gtkx/*` package together and finish the checklist below.

## Prepare on 1.6

Run `gtkx build`, `gtkx dev`, or `gtkx codegen` and read the future-flag warning. Set one reported flag in `gtkx.config.ts`, run `tsc --noEmit`, and fix the affected call sites before enabling the next:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    future: { v2ByteArrays: true },
});
```

Work through all seven flags:

- `v2ByteArrays` returns GIR byte sequences as `Uint8Array`. Check array mutation, `Array.isArray`, and JSON serialization.
- `v2ValueReturns` unwraps returned `GObject.Value` instances and types their contents as `unknown`; narrow the value where it is used.
- `v2FinishResults` removes a leading success boolean from promisified finish results when failure already rejects.
- `v2InoutReturns` stops repeating an inout record or boxed value in the return tuple. The object passed in is still mutated.
- `v2ResourceImports` replaces `#data/` imports with relative `?resource`, `?icon`, `?font`, or `?url` imports. Settings schemas use query-free relative imports. Run `gtkx build` to find stale specifiers.
- `v2DefaultLibraries` binds Adwaita and GTK by default. Remove `Adw-1` and `Gtk-4.0` from `libraries`, then run the application and check its appearance.
- `v2TreeShaking` retains only generated classes reached by the production bundle. Import a class as a value when `GObject.typeFromName` must find it, and replace side-effect-only generated-module imports.

Silencing a warning only hides it. The behavior still changes in 2.0. The [future-flags guide](/guide/configuration-and-codegen#future-flags) explains the less common resource and tree-shaking cases.

Replace `libraries: "*"` with the additional GIR roots the project actually uses. An explicit list keeps generated bindings stable across development machines.

## Update the runtime and configuration

GTKX 2.0 requires Node.js 26.7 or newer and ESM. Set `"type": "module"` in `package.json` and stop loading GTKX packages through `require()`. Projects with translation catalogs also need GNU gettext 0.25 or newer.

After upgrading the packages, delete the `future` block and the corresponding `gtkx-v2-*` entries from `deprecations.silence`. A graduated flag left at `true` is accepted temporarily with a warning; `false` is rejected because the old behavior no longer exists.

Adwaita is the sole default GIR root in 2.0, and its GIR include supplies GTK transitively. Do not name either `Adw-1` or `Gtk-4.0` in `libraries`; list only additional roots:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
    libraries: ["WebKit-6.0"],
});
```

The `"*"` wildcard is removed.

## Update imports

The bare `@gtkx/jsx` entry point is removed. Import elements from the namespace that declares them:

```tsx
import { AdwHeaderBar } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";
```

Adwaita components now come from the main components package. Import `ComboRow`, `ToastProvider`, and `useToast` from `@gtkx/components` instead of `@gtkx/components/adw`. The internal `@gtkx/react/adw` subpath is also removed; `@gtkx/react` registers Adwaita elements itself.

Use `useToast().dismissAll()` in place of `useToastOverlay().dismissAll()`. `show()` returns the native `Adw.Toast`; call its `dismiss()` method to dismiss that toast. The forwarding `useToast().dismiss(toast)` method and `ToastOverlayController` type are removed.

Import `createElementComponent` from `@gtkx/react` instead of `@gtkx/react/config`. The config subpath remains for renderer behavior and element registration APIs.

The `@gtkx/native` root no longer exports `armParentDeath`, `addLogListener`, `removeLogListener`, or `__napiBindingTarget`. Subscribe to native logs with `onLog(listener)` and release the subscription with `unsubscribe()`. Process supervision remains internal.

The generated wrapper-retention helper `retainWrapperClasses` now belongs to `@gtkx/runtime/internal`. Regenerate bindings with `gtkx codegen --force` after upgrading so their bootstrap imports match the runtime.

## Move GObject ownership into JSX

The settings hooks no longer create a `Gio.Settings` instance. Render `GSettings` from `@gtkx/jsx/gio` in the root portal, capture the instance with a state callback ref, and mount its consumers once it is available. Pass that instance first to `useSetting`, and add it as the `settings` option to `useBindSetting`. The [2.0 settings tutorial](/v2/tutorial/preferences-and-theming#create-the-settings-instance) shows the complete ownership pattern.

`useProperty`, `useSignal`, and `useBindSetting` now take a mounted instance rather than a mutable ref object. Store callback-ref values in state and pass the value to the hook so subscriptions follow replacement and unmounting. Remove imports of the deleted `RefProp` type. See [Properties and the hooks](/v2/guide/subclassing#properties-and-the-hooks) for the pattern.

## Give form choices explicit values

A form `ComboRow` now controls a non-nullable string field. Replace `null` or `undefined` defaults with an item ID that exists in the choices. GTKX preserves that ID while an asynchronous source is empty, so reloading choices does not alter the form value or dirty state. See [Choose a row](/v2/guide/forms#choose-a-row).

## Update internationalization

GTKX 2 delegates extraction and resource typing to `i18next-cli`. Keep translation calls in ESM files and use the exact names `t`, `useTranslation`, `Trans`, or `TransWithoutContext`. Replace aliases, `i18n.t(...)` calls, dynamic keys, CommonJS declarations, and ICU components with those static forms.

Replace the removed positional plural overload with `count`, `defaultValue_one`, and `defaultValue_other` options. Run codegen after migrating. Generated declarations now use i18next's `CustomTypeOptions`, so remove uses of GTKX's `TranslationRegistry` and import shared types from `i18next` or `react-i18next`.

## Replace removed APIs

Your editor marks the 1.6 compatibility APIs as deprecated. Replace each GTKX deprecation whose annotation ends in `Removed in v2`:

| Replace | With |
| --- | --- |
| `object.addEventListener(name, handler)` | `object.on(name, handler)` |
| `object.removeEventListener(name, handler)` | `object.off(name, handler)` |
| `Gdk.RGBA.create(css)` | Construct an `RGBA`, then check `parse(css)` |
| `Graphene.Point.create(x, y)` | `new Graphene.Point({ x, y })` |
| `Graphene.Rect.create(x, y, width, height)` | `new Graphene.Rect().init(x, y, width, height)` |
| `Graphene.Size.create(width, height)` | `new Graphene.Size({ width, height })` |
| `GObject.buildValue(...)` | Pass the JavaScript value, or initialize a `GObject.Value` |
| `getObjectProperty(...)` | `getProperty(...)` |
| `setObjectProperty(...)` | `setProperty(...)` |
| `@gtkx/gi/cairo` | `@gtkx/cairo` |
| `@gtkx/components/adw` | `@gtkx/components` |
| `animated.GtkLabel` | `animated(GtkLabel)` |
| `AnimatedElements` | `AnimatedElementMap` |

The cairo stub-constructor `*ConstructorProps` aliases have no replacement because those constructors are removed. Upstream GTK and Adwaita deprecations are separate and remain available when the upstream library still provides them.

Generated methods that expose unmanaged native addresses are also omitted. Replace `GLib.Bytes.getRegion` with `getData` or `newFromBytes`, use `GLib.Variant.getDataAsBytes` instead of `getData`, and close a `Gio.MemoryOutputStream` before calling `stealAsBytes` instead of `getData` or `stealData`.

`@gtkx/gl` no longer exposes `getDebugMessageLog` or `debugMessageCallback`, whose native contracts require caller-owned memory or callback lifetime management. Remove those calls; the shader, program, and pipeline info-log helpers remain available. Replace `clientWaitSyncLoop` with the generated `clientWaitSync`, which accepts the full timeout as a `bigint`.

## Verify the upgrade

```bash
gtkx codegen --force
tsc --noEmit
gtkx build
```

Run the application and inspect every main flow. GTKX 2 initializes Adwaita for every application, and production builds now retain only the generated bindings they reach.

For 2.0 behavior after the migration, see [Configuration and Codegen](/v2/guide/configuration-and-codegen) and the [2.0 API reference](/v2/reference/).
