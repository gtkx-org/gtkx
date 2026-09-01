---
title: "Configuration and Codegen"
description: "Configure a GTKX project and generate its GIR and JSX bindings."
---

# Configuration and Codegen

Most projects need only an application ID. GTK4 and Adwaita are included by default:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
    libraries: ["WebKit-6.0"],
});
```

Additional libraries use `Name-Version`. Do not list `Gtk-4.0`, `Adw-1`, or `"*"`. Use `$development`, `$production`, and `mergeConfig` only when environments or workspace packages genuinely differ. The [configuration reference](/reference/@gtkx/config/) covers every option.

## Generate bindings

`gtkx dev` and `gtkx build` regenerate stale output. Run `gtkx codegen` to do it directly.

- Classes, enums, and functions: `@gtkx/gi/<namespace>`
- JSX elements: `@gtkx/jsx/<namespace>`
- Project element reference: `.gtkx/reference`

Prefer namespace JSX imports so bundlers see the smallest graph. Generated classes register when imported, so explicitly import any class looked up by name with `GObject.typeFromName`.

## Import project data

GTKX follows imported files into the production resource bundle:

```ts
import logoPath from "../data/logo.png?resource";
import saveIcon from "../data/save.svg?icon=example-save-symbolic";
import sourceUrl from "../data/template.txt?url";
import settings from "../data/com.example.Tasks.gschema.xml";
```

`?resource` returns a GResource path, `?icon` an icon name, and `?url` a filesystem URL. Settings imports are query-free and typed. Resource paths are rooted below the application ID.

## Extend generated elements sparingly

Use `elements.behaviors` only for native operations without a property, slot, signal, or ref method. Use `elements.config` for component, prop, omission, and lazy-element overrides. The [`ElementBehavior` reference](/reference/@gtkx/react/config/type-aliases/ElementBehavior) documents the hooks.

Codegen also maintains the marked GTKX block in `AGENTS.md`. It preserves text outside the markers. Keep `.gtkx/` ignored, or disable `agents.rules` or `agents.reference` when another workflow owns that output. `gtkx docs` produces publishable element pages from the same metadata.
