---
title: "Scaffold Options"
description: "Create projects without prompts, defer dependency installation, and replace scaffold files."
---

# Scaffold Options

For an interactive first project, follow [Getting Started](/v2/guide/getting-started). Use these options to script project creation:

```bash
npm create gtkx@beta -- my-app --yes --application-id com.example.MyApp --display-name "My App"
```

Without `--display-name`, noninteractive scaffolding derives a name from the project directory, so `my-app` becomes `My App`. `--skip-install` writes the project without installing dependencies; run your package manager's install command in that directory afterward.

When Yarn 2 or newer runs the scaffold, as `corepack yarn@4 create gtkx` does, and Yarn is the chosen package manager, the new `package.json` pins that release in its `packageManager` field, as `yarn init -2` does, so Corepack runs the same Yarn for the install and every later command instead of its default. An app inside a Yarn workspace gets no pin; the workspace root owns it.

The new project depends on the major versions this GTKX release supports rather than the newest ones: React, `@types/react` and Vitest within the ranges GTKX declares as peers, the Vite range `@gtkx/cli` depends on, TypeScript 6, and the `@types/node` major of the oldest Node.js GTKX supports. When a later GTKX release supports a new major, run `gtkx upgrade` first, then move those packages with your package manager.

## Existing directories

Without `--overwrite`, an existing scaffold-owned file stops the command before it changes anything. `--overwrite` lists and replaces only files owned by the scaffold; unrelated files remain in place. The command refuses a destination reached through a symbolic link.

The package manager's own settings are not replaced. An existing `.yarnrc.yml` keeps its registry, authentication and other settings and only gains `nodeLinker: node-modules`; an existing `pnpm-workspace.yaml` keeps its settings and `packages` and gains `allowBuilds` entries for the scaffold's native dependencies. A `packageManager` field naming the chosen package manager stays in the new `package.json`, so the project keeps its pinned version.

## Workspaces

Inside a pnpm workspace whose `packages` include the target directory, `pnpm create gtkx apps/my-app` adds the app to that workspace. It writes no `pnpm-workspace.yaml` or lockfile of its own and installs through the workspace, so `pnpm add`, `gtkx upgrade` and other commands run from the app act on the whole workspace. The app's dependencies get their own version ranges rather than `catalog:` references, so a workspace catalog that pins another major version of `react` or `vitest` neither changes nor applies to the app. The scaffold does not edit the workspace's `pnpm-workspace.yaml`; when its `allowBuilds` does not mention `@swc/core` or `esbuild` yet, the command prints the entries to add there and pnpm skips those build scripts until you add them and run `pnpm install`.

Inside an npm workspace whose root `package.json` lists the target directory in `workspaces`, `npm create gtkx@beta -- apps/my-app` installs through the workspace in the same way. npm reads `allowScripts` only from the root `package.json`, so the scaffold writes none into the app's and prints the entries to add to the root when it does not mention `@swc/core` or `esbuild` yet.

Inside a Yarn workspace whose root `package.json` lists the target directory in `workspaces`, the scaffold likewise writes no `.yarnrc.yml` or `dependenciesMeta` into the app, because Yarn applies `nodeLinker` and `dependenciesMeta` to the whole workspace from its root. When the root `.yarnrc.yml` does not set `nodeLinker: node-modules`, or the root `package.json` lacks `dependenciesMeta` for `@swc/core` or `esbuild`, the command prints the entries to add. Until the root sets `nodeLinker: node-modules` and `yarn install` runs again, Yarn installs the workspace with Plug'n'Play, which GTKX does not support.

## Installation failures

If dependency installation fails, the generated project remains on disk. Resolve the package manager's error, then rerun its install command in the project directory. Recreating the project is unnecessary.

For the complete option list, run:

```bash
npm create gtkx@beta -- --help
```
