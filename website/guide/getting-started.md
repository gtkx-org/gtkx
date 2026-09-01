---
title: "Getting Started"
description: "Scaffold a GTKX application and run the development loop."
---

# Getting Started

GTKX supports Linux on x64 and arm64 with glibc. Install Node.js 26.7 or later and development packages for GTK 4.20, GLib, and Adwaita 1.8.

## Create and run an app

```bash
npm create gtkx
cd my-app
npm run dev
```

The scaffolder asks for a directory, reverse-DNS application ID, package manager, TypeScript, and testing. Use `npm create gtkx -- my-app --yes --application-id com.example.myapp` for a non-interactive setup.

Keep `npm run dev` running while you edit; Fast Refresh patches the open window. The other generated commands are:

- `npm run build` creates `dist/bundle.mjs`.
- `npm start` runs that bundle.
- `npm run deploy` creates Linux packages; see [Deploying](/guide/deploying).

On the day of a release, pnpm may reject new versions because of `minimumReleaseAge`. The scaffolder prints the versions to allow in the top-level `minimumReleaseAgeExclude` list in `pnpm-workspace.yaml`.

## Mount the application

`src/index.tsx` renders the application tree:

```tsx
import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
```

The application element reads `applicationId` from `gtkx.config.ts`. Use `<AdwApplication>` from `@gtkx/jsx/adw` for an Adwaita app. `quit()` unmounts the roots and can be passed directly to the main window's `onCloseRequest`.

Continue with [Configuration and Codegen](/guide/configuration-and-codegen), or [Build Tasks](/tutorial/).
