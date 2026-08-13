---
title: "Getting Started"
description: "Scaffold a GTKX app with npm create gtkx: what you need installed, what the scaffolder writes, the dev loop, and where the entry point mounts your tree."
---

# Getting Started

The GTKX CLI scaffolds a new app, installs its dependencies, and gives you a dev command that patches a running GTK4 window through Fast Refresh as you edit TypeScript.

## What you need

GTKX is Linux-only. You need:

- Node.js 24 or later
- The GTK4 (4.20 or later) and GLib development packages
- The Adwaita (1.8 or later) development package, once you add `Adw-1` to your `libraries`

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

The starter is a counter: a window with a label and a button wired to React state. `npm create gtkx -- my-app --yes --application-id com.example.myapp` skips the prompts instead.

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

`npm run build` bundles the app to `dist/bundle.mjs`, and `npm start` runs that bundle with `node` on any machine carrying the GTK4 runtime libraries, plus Adwaita once you bind it. `npm run deploy` goes further and packages the app as a Flatpak, a `.deb`, an `.rpm`, or an AppImage, with the desktop entry and AppStream metadata generated for you: see [Deploying](/guide/deploying).

## Project structure

```text
my-app/
├─ gtkx.config.ts        # application ID + which native libraries to bind
├─ package.json
├─ tsconfig.json
├─ vitest.config.ts
├─ src/
│  ├─ index.tsx          # entry point: createRoot().render(<App/>)
│  ├─ app.tsx            # GtkApplication window with a GtkLabel + GtkButton counter
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

The application element picks up its `applicationId` from `gtkx.config.ts` automatically. An Adwaita app adds `Adw-1` to its `libraries` and uses `<AdwApplication>`, imported from `@gtkx/jsx/adw`, in place of `<GtkApplication>` (see [Your First Window](/tutorial/your-first-window)).

Shutting down is the mirror image. `quit()` from `@gtkx/react` unmounts every root, and unmounting the application element quits the application it started. It returns `true` when it unmounted a root, which is what a close-request handler returns to stop GTK4 from closing the window itself, so the starter hands it to its main window as `onCloseRequest={quit}`.

## Next

- [Configuration and Codegen](/guide/configuration-and-codegen): how codegen works, and what [every config option](/guide/configuration-and-codegen#every-option) does.
- [Tutorial](/tutorial/): build Tasks, a complete GNOME task manager, end to end.
