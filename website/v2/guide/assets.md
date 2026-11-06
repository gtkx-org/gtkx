---
title: "Assets and Build Output"
description: "Bundle images, icons, fonts, and settings schemas with a GTKX application."
---

# Assets and Build Output

Import application assets from source files so GTKX can include them in development and production builds.

## Import project data

Use relative imports so GTKX can bundle the files with the app:

```ts
import logoPath from "../data/logo.png?resource";
import saveIcon from "../src/icons/scalable/actions/save.svg?icon=example-save-symbolic";
import templatePath from "../data/template.txt?url";
import bodyFont from "../data/fonts/Inter-Regular.otf?font";
import settings from "../data/com.example.Tasks.gschema.xml";
```

`?resource` bundles a file of any type, such as an image, text, JSON or a shader, and returns its GResource path; `?resource=/org/example/exact.png` selects an exact path. Convert it to a `resource://` URI only when an API requires one. `?url` provides a real file path, while settings schema imports remain query-free and receive generated types.

`?icon` returns an icon name and registers the bundled icon with the app's private theme path. Keep icons under `icons/<size>/<context>/` or `icons/hicolor/<size>/<context>/` to preserve theme layout; other locations become unthemed fallbacks. Keep these icons outside the `applicationIcon` directory (`data/icons` in scaffolded projects): deployment installs that directory into the system icon theme in full. Choose package-specific names for icons supplied by libraries.

`?font` bundles a font and returns its family name. GTKX makes bundled fonts available automatically. Import a font for its side effect when it only supplies fallback characters; see [CSS](/v2/guide/css) for choosing a family in styles.

The scaffold's `src/gtkx-env.d.ts` types these queries, `?raw` for a file's text, `?inline` for content inlined into the bundle, and stylesheet imports. It types only what GTKX builds, so an asset imported without a query, or with another Vite query such as `?worker`, fails `tsc` as well as `gtkx build`.

GTKX derives resource paths from the configured application ID: `com.example.Tasks` becomes `/com/example/Tasks`. Overriding an application's `applicationId` prop alone does not move bundled resources; supply a matching `resourceBasePath` when using another resource tree.

Production builds load their `gtkx.gresource` file automatically.

During development, changing, removing, or restoring an imported resource or icon restarts the app. Changing the imports that select those assets also restarts it, so resources from removed imports are released.

## Read system settings schemas

Schema imports type only the schemas the project ships. To read a schema installed on the system, such as `org.gnome.desktop.interface` for the desktop's fonts and color scheme, describe the keys the app uses in an object that satisfies `SettingsSchema`:

```tsx [src/components/system-appearance.tsx]
import type * as Gio from "@gtkx/gi/gio";
import { AdwActionRow } from "@gtkx/jsx/adw";
import { GSettings } from "@gtkx/jsx/gio";
import { createPortal, rootElement, type SettingsSchema, useSetting } from "@gtkx/react";
import { useState } from "react";

const desktopInterface = {
    id: "org.gnome.desktop.interface",
    path: null,
    keys: { "monospace-font-name": "s", "color-scheme": "enum" },
    values: { "color-scheme": { default: 0, "prefer-dark": 1, "prefer-light": 2 } },
} as const satisfies SettingsSchema;

const AppearanceRows = ({ settings }: { settings: Gio.Settings }) => {
    const [font] = useSetting(settings, desktopInterface, "monospace-font-name");
    const [scheme] = useSetting(settings, desktopInterface, "color-scheme");
    const prefersDark = scheme === desktopInterface.values["color-scheme"]["prefer-dark"];

    return (
        <>
            <AdwActionRow title="Monospace font" subtitle={font} />
            <AdwActionRow title="Dark style" subtitle={prefersDark ? "Preferred" : "Not preferred"} />
        </>
    );
};

export const SystemAppearance = () => {
    const [settings, setSettings] = useState<Gio.Settings | null>(null);

    return (
        <>
            {createPortal(<GSettings ref={setSettings} schemaId={desktopInterface.id} />, rootElement)}
            {settings !== null && <AppearanceRows settings={settings} />}
        </>
    );
};
```

`keys` maps each key to its GVariant type string, or to `enum` or `flags` for a key declared with those attributes; `values` gives the number of each enum nick, or the allowed strings of a key with choices. Copy them from the installed `.gschema.xml` under `/usr/share/glib-2.0/schemas`. `as const` keeps the literal types the hooks derive values from, and `satisfies` checks the object's shape without widening it, so `font` is a `string`, `scheme` is `0 | 1 | 2`, and a key the object does not list fails `tsc`.

GTKX does not bundle or compile a system schema; the app reads the copy installed on the user's machine. TypeScript cannot check the object against that copy. As in GJS, `GSettings` throws when the schema is not installed, and reading a key the installed schema does not declare throws, so an [error boundary](/v2/guide/error-handling#react-error-boundaries) can handle a missing package or a misspelled name.

## Production build output

`gtkx build` writes to `dist/`. Use `--out` for another independently runnable build:

```bash
gtkx build src/helper.ts --out dist-helper
```

Choose a directory below the project root that is empty or contains an earlier GTKX build, and add it to `.gitignore`, which scaffolded projects set up only for `dist/` and `build/`. GTKX rejects unrelated files, symlinked paths, output nested inside another build, and output inside the deploy output directory (`build/` unless `deploy.outDir` says otherwise), which every deployment replaces. Generated bundles contain their JavaScript dependencies; unresolved package imports fail the build.

`gtkx deploy --skip-build` packages `dist/`. Its `--out` option selects the deployment artifact directory, not the application build directory. See [Deploying](/v2/guide/deploying), and [Helper commands](/v2/guide/deploying#helper-commands) to package a helper build beside the application.

## Next

[Deploying](/v2/guide/deploying) packages the build with a launcher, desktop integration files, and a Node.js runtime.
