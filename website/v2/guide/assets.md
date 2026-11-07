---
title: "Assets and Build Output"
description: "Bundle images, icons, fonts, and settings schemas with a GTKX application."
---

# Assets and Build Output

Import application assets from source files so GTKX can include them in development and production builds.

## Import project data

Import each asset with a relative path and a query that says how GTKX bundles it:

```ts [src/app.tsx]
import logoPath from "../data/logo.png?resource";
import saveIcon from "./icons/scalable/actions/save.svg?icon=example-save-symbolic";
import templatePath from "../data/template.txt?url";
import bodyFont from "../data/fonts/Inter-Regular.otf?font";
import schema from "../data/com.example.Tasks.gschema.xml";
```

### Resources

`?resource` bundles a file of any type, such as an image, text, JSON or a shader, and returns its GResource path; `?resource=/org/example/exact.png` selects an exact path. Convert it to a `resource://` URI only when an API requires one.

GTKX derives resource paths from the configured application ID: `com.example.Tasks` becomes `/com/example/Tasks`. Overriding an application's `applicationId` prop alone does not move bundled resources; supply a matching `resourceBasePath` when using another resource tree. Production builds load their `gtkx.gresource` file automatically.

### Icons

`?icon` returns an icon name and registers the bundled icon with the app's private theme path. Keep icons under `icons/<size>/<context>/` or `icons/hicolor/<size>/<context>/` to preserve theme layout; other locations become unthemed fallbacks. Choose package-specific names for icons supplied by libraries.

Keep these icons outside the `applicationIcon` directory (`data/icons` in scaffolded projects): deployment installs that directory into the system icon theme in full.

A workspace package the app uses from source can import its icons the same way, and the app's declarations then include those names; see [Monorepos](/v2/guide/workspaces#monorepos).

### Fonts

`?font` bundles a font and returns its family name. GTKX makes bundled fonts available automatically. Import a font for its side effect when it only supplies fallback characters; see [CSS](/v2/guide/css) for choosing a family in styles.

### Files and text

`?url` provides a real file path: the source file during `gtkx dev` and Vitest, and the copy in `dist/` after `gtkx build`. `?raw` provides a file's text, and `?inline` inlines it into the bundle: a stylesheet's text, or a data URL for any other file.

### Settings schemas

Import the application's own `.gschema.xml` without a query. GTKX compiles and bundles the schema, and the import returns the module the settings hooks read keys through; see [Your app's schema](/v2/guide/native-state#your-app-s-schema).

### Types

The scaffold's `src/gtkx-env.d.ts` types the queries above and stylesheet imports. It types only what GTKX supports, so an asset imported without a query fails `tsc`, and so does another Vite query such as `?worker`. `gtkx build` also rejects an image, media or font file imported without a query.

### Development restarts

During development, changing, removing, or restoring an imported resource or icon restarts the app. Changing the imports that select those assets also restarts it, so resources from removed imports are released.

## Read system settings schemas

A schema installed on the system, such as `org.gnome.desktop.interface`, is described by hand rather than imported; see [System schemas](/v2/guide/native-state#system-schemas).

## Production build output

`gtkx build` writes to `dist/`. Use [`--out`](/v2/guide/cli#gtkx-build) for another independently runnable build:

```bash
gtkx build src/helper.ts --out dist-helper
```

Choose a directory below the project root that is empty or contains an earlier GTKX build, and add it to `.gitignore`, which scaffolded projects set up only for `dist/` and `build/`. GTKX rejects unrelated files, symlinked paths, output nested inside another build, and output inside the deploy output directory (`build/` unless `deploy.outDir` says otherwise), which every deployment replaces. Generated bundles contain their JavaScript dependencies; unresolved package imports fail the build.

[`gtkx deploy --skip-build`](/v2/guide/cli#gtkx-deploy) packages `dist/`. Its `--out` option selects the deployment artifact directory, not the application build directory. See [Deploying](/v2/guide/deploying), and [Helper commands](/v2/guide/deploying#helper-commands) to package a helper build beside the application.

## Next

[Deploying](/v2/guide/deploying) packages the build with a launcher, desktop integration files, and a Node.js runtime.
