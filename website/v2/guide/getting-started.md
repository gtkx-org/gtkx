---
title: "Getting Started"
description: "Install the prerequisites, create a GTKX app, and run the development loop."
---

# Getting Started

Create a Linux desktop app with React and TypeScript, then edit it while its window stays open. This guide uses the GTKX 2.0 beta.

## What you need

GTKX requires Linux, Node.js 26.7 or later, GTK 4.20 or later, libadwaita 1.8 or later, and GLib development files. Prebuilt GTKX binaries support x64 and arm64 Linux with glibc.

Install [Node.js](https://nodejs.org/en/download) with your preferred version manager, then check the version in the terminal you will use for development:

```bash
node --version
```

### Native libraries on Fedora 44

Install the development packages, which supply both native libraries and the GIR files used to generate bindings:

```bash
sudo dnf install gtk4-devel libadwaita-devel glib2-devel gobject-introspection-devel pkgconf-pkg-config
```

The package names are listed in Fedora's [GTK](https://packages.fedoraproject.org/pkgs/gtk4/gtk4-devel/), [libadwaita](https://packages.fedoraproject.org/pkgs/libadwaita/libadwaita-devel/), and [GObject Introspection](https://packages.fedoraproject.org/pkgs/gobject-introspection/gobject-introspection-devel/) package documentation. Check the installed versions:

```bash
pkg-config --modversion gtk4 libadwaita-1 glib-2.0
```

Other distributions need equivalent development packages meeting the minimum versions above. See [GTK's Linux installation guide](https://www.gtk.org/docs/installations/linux) for package names. A runtime-only package is insufficient for code generation.

Run the app from a graphical desktop session. In a development container, the container also needs access to the session's display and D-Bus; installing libraries alone does not provide that connection.

## Scaffolding a new app

::: code-group

```bash [npm]
npm create gtkx@beta
```

```bash [pnpm]
pnpm create gtkx@beta
```

:::

The scaffolder asks for a project directory, a display name, an application ID such as `com.example.MyApp`, and a package manager, then whether to use TypeScript and include the Vitest setup. Keep both for typed components and native widget tests.

The directory can be a path, such as `~/Projects/my-app`, and any name works. `Unit Converter` gets the display name Unit Converter; because it is not a valid package name, the scaffolder also asks for one and suggests `unit-converter`.

`yarn create` cannot run the prerelease scaffolder. To manage the project with Yarn, start it with npm or pnpm and choose Yarn as the package manager. Yarn projects get `nodeLinker: node-modules` in `.yarnrc.yml`, because GTKX generates its bindings into `node_modules` and does not support Plug'n'Play.

Start the app:

```bash
cd my-app
npm run dev
```

The starter uses an Adwaita application window with a counter. Click the button to increase the count. Change its label in `src/app.tsx` and save; the open window should update.

For noninteractive creation and existing directories, see [Scaffold Options](/v2/guide/scaffold-options).

The [tutorial](/v2/tutorial/) follows development on `main` and may use APIs added after the published beta. Check its version prerequisites before continuing beyond this starter.

## The dev loop

`npm run dev` runs `gtkx dev`, which opens the app and watches your source files. Fast Refresh applies most edits to the open window and keeps its state:

- Editing a module that exports only components refreshes it in place.
- Editing any other module, such as a custom hook or shared styles, refreshes the component modules that import it, directly or through other modules.
- A component whose hook calls change remounts and resets only its own state.
- Editing an imported stylesheet replaces its rules. Editing a module's `injectGlobal` rules adds the edited rules, while the earlier ones stay until the app restarts.

These changes restart the app and reset its state:

- an edit that reaches the entry module before a component module
- a change to a module's runtime imports or re-exports
- an edit to an imported resource or icon, or to a file a [worker](/v2/guide/workers) loaded
- an edit that changes a construct-only prop, such as the `strings` of a `GtkStringList`
- a lockfile change from installing or updating dependencies
- any other change that Fast Refresh cannot patch

| Command          | Result                                                              |
| ---------------- | ------------------------------------------------------------------- |
| `npm run dev`    | Run the app and watch source files                                  |
| `npm run build`  | Bundle the app into `dist/bundle.mjs`                               |
| `npm start`      | Run that production bundle with Node.js                             |
| `npm run deploy` | Build a distributable package; see [Deploying](/v2/guide/deploying) |

With pnpm, run the last one as `pnpm run deploy`, because `pnpm deploy` is pnpm's built-in command.

The production bundle still needs the native runtime libraries. Packaging can supply a Node.js runtime and desktop integration files.

## Project structure

```text
my-app/
├─ gtkx.config.ts
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
├─ data/
│  └─ icons/
├─ src/
│  ├─ index.tsx
│  ├─ app.tsx
│  └─ gtkx-env.d.ts
└─ tests/
   └─ app.test.tsx
```

`gtkx.config.ts` holds the application ID, the icon directory and packaging metadata; [Configuration and Codegen](/v2/guide/configuration-and-codegen) covers its other options. `data/icons/` holds the app icon. The component lives in `src/app.tsx`; `src/index.tsx` renders it. Without TypeScript, the source files end in `.jsx` and `.js` and there is no `tsconfig.json` or `src/gtkx-env.d.ts`; without Vitest, there is no `vitest.config.ts` or `tests/`.

## The entry point: `src/index.tsx`

Create a React root and render your application. GTKX supplies the native root container, so `createRoot()` takes no DOM element:

```tsx
import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
```

The starter's `<AdwApplication>` gets its application ID from `gtkx.config.ts`. [Create a Window](/v2/tutorial/your-first-window) explains the application, window, and close handler.

## Updating GTKX

GTKX packages are released together under one version. To move a project to the newest release on the dist-tag it follows, such as `beta`, run this from the project directory:

```bash
npx gtkx upgrade
```

Pass a version or dist-tag to choose one, as in `npx gtkx upgrade 2.0.1`. The command rewrites every GTKX package version in the project, or in each package of its workspace, including pnpm catalog entries, and keeps their range operators. A `peerDependencies` range, such as a shared package's `@gtkx/react`, moves only when it does not accept the new version, so a range like `^1.6.0 || ^2.0.0` stays as written. It then installs and deduplicates with the project's package manager. When the install leaves some GTKX packages on another version, for example through a Yarn catalog, `overrides` or `resolutions`, or a peer range it cannot rewrite still excludes the new version, the command fails and names them; change those and install again.

Before installing, the command exempts GTKX's own packages from the package manager's [release-age gate](/v2/guide/scaffold-options#release-age-gates) at the project or workspace root, so a release published that day installs. If the install still fails, it restores each `package.json`, the lockfile and those settings, so the project stays on its previous release.

The CLI of 2.0.0-beta.12 and earlier releases has no `upgrade` command. Run the newer one once with `npx @gtkx/cli@beta upgrade`; on a release day, [Upgrading to 2.0](/v2/guide/upgrading-to-2) shows how to run it past a release-age gate.

`gtkx dev`, `gtkx build` and the other project commands warn when the installed GTKX packages are not all on one version. `npx gtkx <command> --help` describes a command's options.

## Troubleshooting

- **Missing GIR file:** install the library's development package, then run `npx gtkx codegen` from the project. For libraries outside the standard directories, set [`girPath`](/v2/guide/configuration-and-codegen#the-config-file).
- **Native versions are too old:** use a distribution or development container that meets the minimums. Installing newer TypeScript packages does not upgrade GTK or libadwaita.
- **No display connection:** run from a desktop terminal or configure your container's display and session access. Tests have a separate [headless setup](/v2/guide/testing#setup).
- **Dependency installation failed:** the generated files remain in the project directory, but the scaffolder stops before initializing Git. Resolve the package manager's error, rerun its install command there, and run `git init` if you want the project under version control.
- **Release-age gates:** the scaffolder exempts GTKX's own packages from the package manager's release-age gate in the project it creates (see [Scaffold Options](/v2/guide/scaffold-options#release-age-gates)), but the gate still applies to downloading the scaffolder. On the day of a GTKX release, `pnpm create gtkx@beta` with pnpm's `minimumReleaseAge` set refuses the new `create-gtkx`, and `npm create gtkx@beta` with npm's `min-release-age` set reports that no matching version was found. Start the project with `npm create gtkx@beta` and choose your package manager, as a Yarn project does, or exempt GTKX for that one command. npm ignores `min-release-age-exclude` when it downloads the scaffolder, so lift its gate for the download with `--min-release-age=0`; the scaffolder's own install still applies the gate:

  ```bash
  pnpm_config_minimum_release_age_exclude='["@gtkx/*","create-gtkx"]' pnpm create gtkx@beta
  npm create --min-release-age=0 gtkx@beta
  ```

  A project created by an earlier scaffolder has no exemption. [`gtkx upgrade`](#updating-gtkx) adds it before installing; to install on a release day without upgrading, add the [entries](/v2/guide/scaffold-options#release-age-gates) yourself, or install again a day later.

## Next

- [Tutorial](/v2/tutorial/): build Tasks, a task manager with persistence, navigation, and packaging.
- [Configuration and Codegen](/v2/guide/configuration-and-codegen): select native libraries and understand generated imports.
