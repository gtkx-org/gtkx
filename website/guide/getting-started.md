---
title: "Getting Started"
description: "Scaffold a GTKX project, take its Adwaita-first path, and run the development loop."
---

# Getting Started

The GTKX CLI scaffolds a native project, installs its dependencies, and gives you a dev command that patches the running window through Fast Refresh as you edit TypeScript. GTKX's GNOME application foundation is libadwaita over GTK4; the stable initializer still begins with a GTK-only counter, and the tutorial's first chapter replaces that shell with Adwaita.

## What you need

GTKX is Linux-only. You need:

- Node.js 24 or later
- The GTK4 (4.20 or later), libadwaita (1.8 or later), and GLib development packages

Prebuilt binaries cover x64 and arm64 glibc Linux. On any other target, build GTKX from its repository with a Rust toolchain.

## Scaffolding a new app

::: code-group

```bash [npm]
npm create gtkx
```

```bash [pnpm]
pnpm create gtkx
```

```bash [yarn]
yarn create gtkx
```

:::

It prompts for the project directory, an application ID in reverse-DNS form, your package manager, and whether to include TypeScript and a Vitest testing setup. Answer them, then start the app:

```bash
cd my-app
npm run dev
```

The stable starter is a GTK counter. An Adwaita-first app replaces that shell with `AdwApplication`, `AdwApplicationWindow`, `AdwToolbarView`, and `AdwHeaderBar`, as [Your First Window](/tutorial/your-first-window) does. `npm create gtkx -- my-app --yes --application-id com.example.myapp` skips the prompts instead.

### If the install stops on a fresh release

pnpm holds back packages published in the last 24 hours, so scaffolding on the day a GTKX version ships can stop with `ERR_PNPM_NO_MATURE_MATCHING_VERSION` or `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`. The scaffolder prints the exact versions pnpm rejected and the `pnpm add` commands that finish the install. Run those once the versions clear the window, or allow them up front in `pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - '@gtkx/react@1.0.0'
  - '@gtkx/runtime@1.0.0'
```

The key belongs at the top level of the file, alongside `packages:` and `allowBuilds:`, never nested inside either. pnpm names only the versions the command it stopped on had to resolve, so a later run can name more; add each one to the same list.

## The dev loop

`npm run dev` runs `gtkx dev`. Leave it running while you work: saving a component patches it into the window that is already open, and a change Fast Refresh cannot patch restarts the app.

`npm run build` bundles the app to `dist/bundle.mjs`, and `npm start` runs that bundle with `node` on a machine carrying the libadwaita, GTK4, and GLib runtime libraries. `npm run deploy` goes further and packages the app as a Flatpak, a `.deb`, an `.rpm`, or an AppImage, with the desktop entry and AppStream metadata generated for you: see [Deploying](/guide/deploying).

## Project structure

```text
my-app/
├─ gtkx.config.ts        # application ID + additional native libraries
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
├─ src/
│  ├─ index.tsx          # entry point: createRoot().render(<App/>)
│  ├─ app.tsx            # generated counter; replace its shell with Adwaita
│  └─ gtkx-env.d.ts      # ambient type references
└─ tests/
   └─ app.test.tsx
```

## The entry point: `src/index.tsx`

Mounting a GTKX tree looks exactly like React DOM:

```tsx
import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
```

The stable starter's `<GtkApplication>` picks up its `applicationId` from `gtkx.config.ts` automatically. For the Adwaita-first shell, use `<AdwApplication>` and `<AdwApplicationWindow>` from `@gtkx/jsx/adw`; GTK widgets remain available inside them. [Your First Window](/tutorial/your-first-window) enables the stable release's Adwaita bindings and builds that structure from scratch. GTKX 2 makes that starter shell the default, starts codegen from `Adw-1`, and discovers GTK4 through Adwaita's GIR include.

Shutting down is the mirror image. `quit()` from `@gtkx/react` unmounts every root, and unmounting the application element quits the application it started. It returns `true` when it unmounted a root, which is what a close-request handler returns to stop GTK4 from closing the window itself, so the main window can take it as `onCloseRequest={quit}`.

## Next

- [Configuration and Codegen](/guide/configuration-and-codegen): how codegen works, and what [every config option](/guide/configuration-and-codegen#every-option) does.
- [Tutorial](/tutorial/): build Tasks, a complete GNOME task manager, end to end.
