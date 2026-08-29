---
title: "Configuration and Codegen"
description: "Configure a GTKX project and generate its typed GIR and JSX bindings."
---

# Configuration and Codegen

Most projects need only an application ID. GTKX binds GTK4 and Adwaita by default:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.Tasks",
});
```

Add only libraries beyond those defaults:

```ts
export default defineConfig({
    applicationId: "com.example.Browser",
    libraries: ["WebKit-6.0"],
});
```

Library identifiers use `Name-Version`. Explicitly listing `Gtk-4.0`, `Adw-1`, or the old `"*"` wildcard is rejected. This keeps generated bindings consistent across build machines.

Use `mergeConfig(base, override)` for a shared workspace config. `$development` and `$production` override the top level in their respective modes. Editor completion shows less common settings such as custom GIR paths, React Compiler options, MCP tools, deployment, and agent output; the [configuration API reference](/reference/@gtkx/config/) documents the configuration helpers.

## Generate the bindings

`gtkx dev` and `gtkx build` regenerate stale bindings automatically. Run codegen directly when you want to update the generated store and project reference without starting the app:

```bash
gtkx codegen
```

The result lives under `node_modules/.gtkx` and is linked into `node_modules/@gtkx`:

- Import classes, enums, and functions from `@gtkx/gi/<namespace>`.
- Import JSX elements from `@gtkx/jsx/<namespace>`.
- Use the flat `@gtkx/jsx` entrypoint only when a file genuinely mixes namespaces; namespace subpaths give bundlers a smaller graph.

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton } from "@gtkx/jsx/gtk";

const Actions = () => (
    <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
        <GtkButton label="Save" />
    </GtkBox>
);
```

Generated classes register only when the bundle reaches them. Import a class explicitly when code looks it up by name with `GObject.typeFromName`.

## Import project data

Use relative imports so GTKX can follow files from source to the production resource bundle:

```ts
import logoPath from "../data/logo.png?resource";
import saveIcon from "../data/icons/scalable/actions/save.svg?icon=example-save-symbolic";
import sourcePath from "../data/template.txt?url";
import settings from "../data/com.example.Tasks.gschema.xml";
```

`?resource` returns a GResource path, `?icon` returns an icon name, and `?url` returns a filesystem URL for APIs that require a real file. Settings schemas stay query-free and receive generated types.

Resource paths are rooted below `applicationId`: `com.example.Tasks` becomes `/com/example/Tasks`. `GtkApplication` and `AdwApplication` use the same derived base. If an element intentionally uses a different application ID, pass its matching `resourceBasePath` too.

## Work with generated values

Pass generated classes anywhere a binding asks for a GType:

```ts
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";

const store = Gio.ListStore.new(Gtk.Label);
```

Read byte sequences as `Uint8Array`. Inputs accept `Uint8Array` or `number[]`.

Most read-only `GObject.Value` parameters accept the JavaScript value directly and infer its GType. Allocate and initialize `new GObject.Value()` only when the callee fills it, the required GType cannot be inferred, or an interface GType must be preserved. The generated API reference shows the exact accepted type at each call site.

## Customize JSX elements

Use an element behavior only when a GTK operation has no property behind it, such as positioning a child or applying a cursor. Point `elements.behaviors` at a module that default-exports `defineElements(...)`; use `elements.config` for component, props, omission, and lazy-element overrides.

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    elements: { behaviors: "./src/elements.ts" },
});
```

The [`ElementBehavior` API reference](/reference/@gtkx/react/config/type-aliases/ElementBehavior) lists the lifecycle hooks. Prefer generated properties, signal props, slots, and `ref` methods before adding a behavior.

## Keep coding-agent context current

Codegen writes `.gtkx/reference`, an exact element reference for this project's GIR libraries, and maintains the marked GTKX block in `AGENTS.md`. Keep `.gtkx/` ignored and commit the managed rules block so the tree stays clean. Existing text outside its markers is preserved.

Disable either output only when another workflow replaces it:

```ts
export default defineConfig({
    applicationId: "com.example.Tasks",
    agents: { rules: false, reference: false },
});
```

Use `gtkx docs` when you also want publishable element pages. Its output and the local agent reference come from the same generated metadata.

Continue with [Async Operations](/guide/async-operations), or use the [API reference](/reference/) for package signatures and generated binding details.
