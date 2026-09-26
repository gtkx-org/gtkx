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
import saveIcon from "../data/icons/scalable/actions/save.svg?icon=example-save-symbolic";
import templatePath from "../data/template.txt?url";
import bodyFont from "../data/fonts/Inter-Regular.otf?font";
import settings from "../data/com.example.Tasks.gschema.xml";
```

`?resource` returns a bundled GResource path; `?resource=/org/example/exact.png` selects an exact path. Convert it to a `resource://` URI only when an API requires one. `?url` provides a real file path, while settings schema imports remain query-free and receive generated types.

`?icon` returns an icon name and registers the bundled icon with the app's private theme path. Keep icons under `icons/<size>/<context>/` or `icons/hicolor/<size>/<context>/` to preserve theme layout; other locations become unthemed fallbacks. Choose package-specific names for icons supplied by libraries.

`?font` bundles a font and returns its family name. GTKX makes bundled fonts available automatically. Import a font for its side effect when it only supplies fallback characters; see [CSS](/v2/guide/css) for choosing a family in styles.

GTKX derives resource paths from the configured application ID: `com.example.Tasks` becomes `/com/example/Tasks`. Overriding an application's `applicationId` prop alone does not move bundled resources; supply a matching `resourceBasePath` when using another resource tree.

Production builds load their `gtkx.gresource` file automatically.

## Production build output

`gtkx build` writes to `dist/`. Use `--out` for another independently runnable build:

```bash
gtkx build src/helper.ts --out build/helper
```

Choose a directory below the project root that is empty or contains an earlier GTKX build. GTKX rejects unrelated files, symlinked paths, and output nested inside another build. Generated bundles contain their JavaScript dependencies; unresolved package imports fail the build.

`gtkx deploy --skip-build` packages `dist/`. Its `--out` option selects the deployment artifact directory, not the application build directory. See [Deploying](/v2/guide/deploying).

## Next

[Deploying](/v2/guide/deploying) packages the build with a launcher, desktop integration files, and a Node.js runtime.
