---
title: "Getting Started"
description: "Scaffold a GTKX app with npm create gtkx: what you need installed, what the scaffolder writes, the dev loop, and where the entry point mounts your tree."
---

# Getting Started

The GTKX CLI scaffolds a new app, installs its dependencies, and gives you a dev command that patches a running GTK4 window through Fast Refresh as you edit TypeScript.

## What you need

GTKX is Linux-only. You need:

- Node.js 24 or later
- The GTK4 and GLib (2.68 or later) development packages, whose GObject-Introspection data codegen reads to generate your bindings
- The Adwaita development package, once you add `Adw-1` to your `libraries`

The native package (`@gtkx/native`) ships prebuilt binaries for x64 and arm64 glibc Linux. On other targets, build it from the GTKX repository with a Rust toolchain.

## Scaffolding a new app

Start any new project with the scaffolder:

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

It prompts for the project directory, an application ID in reverse-DNS form, your package manager, and whether to include TypeScript and a Vitest testing setup.

```bash
npm create gtkx -- my-app --yes --application-id com.example.myapp
cd my-app
npm run dev
```

This launches the app in dev mode. The generated starter is a counter: a window with a label and a button wired to React state.

### If the install stops on a fresh release

pnpm holds back every package published in the last 24 hours (its `minimumReleaseAge` policy) so that a compromised release has time to be caught and pulled. Most of the time pnpm records the young versions in `pnpm-workspace.yaml` itself and the install goes through. When it cannot, because the resolution is gated by `minimumReleaseAgeStrict` or because a lockfile already pins them, scaffolding on the day a GTKX version ships stops with `ERR_PNPM_NO_MATURE_MATCHING_VERSION` or `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`.

The scaffolder prints the exact versions pnpm rejected, followed by the `pnpm add` commands that put the dependencies back. It needs those commands because a refused resolution never reaches `package.json`: the scaffolded manifest is left without whatever the failed command would have added, so a bare `pnpm install` in that directory reports "Already up to date" and installs nothing.

Wait for the versions to clear the window and run those commands, or allow the versions in `pnpm-workspace.yaml` first:

```yaml
minimumReleaseAgeExclude:
  - '@gtkx/react@1.0.0'
  - '@gtkx/runtime@1.0.0'
```

The key belongs at the top level of the file, alongside `packages:` and `allowBuilds:`. Indenting it under `allowBuilds:` produces a file pnpm parses without complaint and then fails on exactly as before.

List every version pnpm named, including the packages your app pulls in transitively such as `@gtkx/native` and `create-gtkx`; a `'@gtkx/*'` pattern covers the scope but leaves `create-gtkx` blocked. pnpm reports the versions one command at a time, so the run that gets past your production dependencies can still stop on the dev ones and name several more; add those to the same list. Setting `minimumReleaseAge: 0` in the same file turns the policy off for every dependency, which is why listing the versions is the narrower fix. npm and yarn apply no such policy.

## The dev loop

`npm run dev` runs `gtkx dev`. It brings your generated bindings up to date (see [Configuration and Codegen](/guide/configuration-and-codegen)), then loads your entry module through a Vite dev server and watches your files. Saving a component patches it into the window that is already open through Fast Refresh; a change Fast Refresh cannot patch restarts the app for you. Leave the command running while you work.

When you are ready to ship, `npm run build` bundles the app to `dist/bundle.js`, and `npm start` runs that bundle with `node` on any machine carrying the GTK4 runtime libraries, plus Adwaita once you bind it. Turning it into an installable program with a desktop entry and icons is covered in [Appendix B: Making It a Real Application](/tutorial/packaging).

## Project structure

Here is what the scaffolder writes for the counter starter:

```text
my-app/
├─ .gitignore
├─ gtkx.config.ts        # application ID + which native libraries to bind
├─ package.json          # scripts, deps, the #data/* import
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

The counter starter wraps its window in `<GtkApplication>`; the Tasks app adds `Adw-1` to its `libraries` and swaps that for `<AdwApplication>` (imported from `@gtkx/jsx/adw`) to pull in Adwaita, which initializes when its bindings load (see [Your First Window](/tutorial/your-first-window)). Either way, the application element picks up the `applicationId` from your config automatically.

Shutting down is the mirror image. `quit()` from `@gtkx/react` unmounts every root, and unmounting the application element quits the application it started. It returns `true`, which is what a close-request handler returns to stop GTK4 from closing the window itself, so the starter hands it to its main window as `onCloseRequest={quit}` and lets React tear the tree down.

## Next

With the project scaffolded and `gtkx dev` running, continue to [Configuration and Codegen](/guide/configuration-and-codegen) for the full option and codegen reference. To tour the Tasks app end to end, start the [Tutorial](/tutorial/).
