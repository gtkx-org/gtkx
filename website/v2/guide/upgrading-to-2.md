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
- Assets use relative `?resource`, `?icon`, or `?url` imports. Settings schemas use query-free relative imports.
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

Adwaita is part of the core packages. `ComboRow`, `ToastProvider`, `useToast`, and `useToastOverlay` moved from `@gtkx/components/adw` to `@gtkx/components`, and the internal `@gtkx/react/adw` entry point is gone:

```tsx
import { ComboRow, ToastProvider, useToast } from "@gtkx/components";
```

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

| Replace | With |
| --- | --- |
| `object.addEventListener(name, handler)` | `object.on(name, handler)` |
| `object.removeEventListener(name, handler)` | `object.off(name, handler)` |
| `Gdk.RGBA.create(css)` | `new Gdk.RGBA()` followed by a checked `parse(css)` |
| `Graphene.Point.create(x, y)` | `new Graphene.Point({ x, y })` |
| `Graphene.Rect.create(x, y, width, height)` | `new Graphene.Rect().init(x, y, width, height)` |
| `Graphene.Size.create(width, height)` | `new Graphene.Size({ width, height })` |
| `GObject.buildValue(...)` | Pass the JavaScript value, or initialize `new GObject.Value()` |
| `@gtkx/gi/cairo` | `@gtkx/cairo` |
| `@gtkx/components/adw` | `@gtkx/components` |
| `animated.GtkLabel` | `animated(GtkLabel)` |
| `AnimatedElements` | `AnimatedElementMap` |

The cairo stub-constructor `*ConstructorProps` aliases have no replacement because their constructors no longer exist.

## Verify the upgrade

```bash
gtkx codegen --force
tsc --noEmit
gtkx build
```

Finally run the application and inspect it. `@gtkx/react` now registers the Adwaita elements itself, so every application initializes the Adwaita stylesheet and the build depends on the Adwaita introspection and runtime libraries even when it renders no Adwaita widget.

For current configuration and binding behavior, see [Configuration and Codegen](/v2/guide/configuration-and-codegen) and the [API reference](/v2/reference/).
