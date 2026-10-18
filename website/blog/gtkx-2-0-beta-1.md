---
title: "GTKX 2.0 beta: migration changes"
description: "GTKX 2.0 beta removes compatibility APIs and updates the Node.js, ESM, and internationalization requirements."
image: /og.png
---

# GTKX 2.0 beta

<p class="post-date">September 2, 2026</p>

GTKX 2.0 beta makes the behaviors previewed in 1.6 unconditional and removes deprecated compatibility APIs. It also updates the Node.js and ESM requirements, adopts the i18next extraction toolchain, and expands native binding integration tests. Read the [beta 1 changelog](https://github.com/gtkx-org/gtkx/releases/tag/v2.0.0-beta.1) and the [upgrade guide](/v2/guide/upgrading-to-2) before moving an existing application.

This starts a three-month beta period. The final GTKX 2.0 release is scheduled for December 1, 2026. Until then, the focus is migration feedback, correctness, and release hardening; feature work remains scheduled for 2.1.

## The migration switches become the runtime

GTKX 1.6 let applications adopt 2.0 behaviors independently. In 2.0 they are unconditional:

- GIR byte sequences are `Uint8Array`.
- A binding that returns a `GObject.Value` returns the contained value as `unknown`.
- Promisified finish methods omit a redundant leading success boolean when returning multiple values. Boolean-only results are preserved.
- Inout records and boxed values mutate the value passed in without repeating it in the return tuple.
- Assets use relative `?resource`, `?icon`, or `?url` imports, while settings schemas use query-free relative imports.
- `Gtk-4.0` and `Adw-1` are always bound.
- Generated classes register with their own definitions, allowing production builds to discard bindings they never reach.

The corresponding `future` block is no longer part of the configuration. Flags left at `true` are temporarily accepted as ignored migration residue and produce a warning; `false` cannot be honored because the old behavior no longer exists. Remove the block and any retired IDs under `deprecations.silence`.

The library list now names only what an application needs in addition to GTK and Adwaita:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
    libraries: ["WebKit-6.0"],
});
```

The `"*"` wildcard is removed, and explicitly listing either default library is an error. Declare additional libraries individually. Their generated APIs still depend on the installed GIR versions.

## Less compatibility code, less generated code

The compatibility removals announced during 1.x are now complete. Generated GObjects use `on` and `off` instead of the DOM-shaped `addEventListener` and `removeEventListener` aliases. `Gdk.RGBA` and the Graphene value types use their constructors and native initialization methods instead of GTKX-only `create` helpers. `GObject.buildValue` is gone, Cairo comes from `@gtkx/cairo`, and animation components use the callable `animated(GtkLabel)` form.

Codegen now uses the tree-shakeable store by default. Importing a JSX element, class, or signature retains the definitions it needs; unused bindings can leave the production bundle. The bare `@gtkx/jsx` entry point is removed, so JSX elements come from namespace subpaths such as `@gtkx/jsx/gtk` and `@gtkx/jsx/adw`. A side-effect-only generated import no longer retains every class. Code that resolves a generated type by name must import that class so it registers. Check the production build as well as development and tests, which use an unbundled store.

Resource handling follows the same principle. The global `#data/` map and its compatibility transform are gone. An import now states both where an asset lives and what the build should produce:

```ts
import icon from "../data/tasks.svg?icon";
import logo from "../data/logo.png?resource";
import schema from "../data/com.example.Tasks.gschema.xml";
```

These imports work through ordinary module resolution, and the build reports any legacy specifier still left in an application.

## A current module and localization baseline

GTKX 2 packages require Node.js 26.7 or newer and publish explicit ESM entry points. Applications need `"type": "module"`; package exports reject CommonJS `require()` rather than letting it select an accidental build artifact. Source-mode Flatpak builds move to the Node 26 SDK extension as part of the same baseline.

Internationalization introduces a breaking change beyond the 1.6 future flags. `@gtkx/i18n` still connects i18next and react-i18next to GNU gettext, but source scanning uses `i18next-cli`, and generated declarations augment i18next's resource types. The `TranslationRegistry` and GTKX-specific `TFunction` types are removed; use `I18nResources` from `@gtkx/i18n` and `TFunction` from `i18next`. Plurals use `defaultValue_one` and `defaultValue_other`.

Source extraction recognizes statically recoverable calls named `t`, `useTranslation`, `Trans`, or `TransWithoutContext`. Imported aliases, `i18n.t` member calls, dynamic keys, and CommonJS declarations are no longer treated as catalog sources. Localized projects also require GNU gettext 0.25 or newer.

## The native boundary gets tested from JavaScript

The native module's test surface now drives the exported addon through the same generated descriptors and JavaScript calls an application uses. The resulting fixes reject invalid allocation sizes, unregistered types, non-GObject or non-instantiable types, and unknown construction properties before those values reach crash-prone native operations. GLib criticals raised during a call return through that call instead of taking down the process.

Codegen and the runtime also distinguish boxed, fundamental, and plain struct records from the GIR facts that define their lifecycle. Plain structs that declare copy and free functions now use those functions for transferred values, rather than assuming every allocation can be byte-copied or released with `g_free`. The expanded integration coverage exercises arrays, callbacks, GValues, signals, constructors, virtual functions, and ownership across that boundary.

## Try the beta

Start a new project from the beta dist-tag:

```bash
npm create gtkx@beta
```

For an existing project, update every installed GTKX package together:

```bash
npm install @gtkx/cli@beta @gtkx/react@beta
```

Add the other `@gtkx/*` packages your application uses to that command. Then remove obsolete future flags, run `gtkx codegen --force`, run `tsc --noEmit` and `gtkx build`, and inspect the running application. The [upgrade guide](/v2/guide/upgrading-to-2) covers the return shapes, resource imports, internationalization changes, and removed names.

Report migration failures and native behavior that differs from 1.6 with its future flags enabled through the [issue tracker](https://github.com/gtkx-org/gtkx/issues).
