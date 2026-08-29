---
title: "Upgrading to 2.0"
description: "Move a GTKX 1.x application to the final GTKX 2 behavior."
---

# Upgrading to 2.0

GTKX 2.0 makes the behaviors previewed in 1.6 unconditional and removes their compatibility APIs. Upgrade all `@gtkx/*` packages together, then work through this checklist.

## Clean up the configuration

Delete the `future` block and any retired ids under `deprecations.silence`. A graduated flag left at `true` is temporarily accepted with a warning; `false` is rejected because the old behavior no longer exists.

`Gtk-4.0` and `Adw-1` are always bound. List only additional libraries:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
    libraries: ["WebKit-6.0"],
});
```

The `"*"` wildcard is gone. Explicit libraries keep generated bindings stable across machines.

## Check the behavior changes

- GIR byte sequences are `Uint8Array`. Check code using array mutation, `Array.isArray`, or JSON serialization.
- A returned `GObject.Value` is unwrapped and typed `unknown`; narrow it at the call site.
- Promisified finish methods omit a leading success boolean when failure already rejects. `loadContentsAsync` resolves to `[Uint8Array, string | null]`.
- Inout records and boxed values mutate the object passed in instead of repeating it in the return value.
- Assets use relative `?resource`, `?icon`, or `?url` imports. Settings schemas use query-free relative imports.
- Generated classes register with their own definitions, so production builds retain only reached bindings. Import a class if `GObject.typeFromName` must find it.

Run `tsc --noEmit` after these changes. The typechecker catches the value and tuple changes; `gtkx build` catches stale resource imports.

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
| `animated.GtkLabel` | `animated(GtkLabel)` |
| `AnimatedElements` | `AnimatedElementMap` |

The cairo stub-constructor `*ConstructorProps` aliases have no replacement because their constructors no longer exist.

## Verify the upgrade

```bash
gtkx codegen --force
tsc --noEmit
gtkx build
```

Finally run the application and inspect it. Importing Adwaita initializes its stylesheet, and the build now depends on the Adwaita introspection and runtime libraries even when `libraries` omits it.

For current configuration and binding behavior, see [Configuration and Codegen](/guide/configuration-and-codegen) and the [API reference](/reference/).
