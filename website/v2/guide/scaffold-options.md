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

## Existing directories

Without `--overwrite`, an existing scaffold-owned file stops the command before it changes anything. `--overwrite` lists and replaces only files owned by the scaffold; unrelated files remain in place. The command refuses a destination reached through a symbolic link.

The package manager's own settings are not replaced. An existing `.yarnrc.yml` keeps its registry, authentication and other settings and only gains `nodeLinker: node-modules`; an existing `pnpm-workspace.yaml` keeps its settings and `packages` and gains `allowBuilds` entries for the scaffold's native dependencies. A `packageManager` field naming the chosen package manager stays in the new `package.json`, so the project keeps its pinned version.

## Workspaces

Inside a pnpm workspace whose `packages` include the target directory, `pnpm create gtkx apps/my-app` adds the app to that workspace. It writes no `pnpm-workspace.yaml` or lockfile of its own and installs through the workspace, so `pnpm add`, `gtkx upgrade` and other commands run from the app act on the whole workspace. The scaffold does not edit the workspace's `pnpm-workspace.yaml`; when its `allowBuilds` does not mention `@swc/core` or `esbuild` yet, the command prints the entries to add there and pnpm skips those build scripts until you add them and run `pnpm install`.

## Installation failures

If dependency installation fails, the generated project remains on disk. Resolve the package manager's error, then rerun its install command in the project directory. Recreating the project is unnecessary.

For the complete option list, run:

```bash
npm create gtkx@beta -- --help
```
