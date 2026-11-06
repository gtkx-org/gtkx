---
title: "Scaffold Options"
description: "Create projects without prompts, defer dependency installation, and replace scaffold files."
---

# Scaffold Options

For an interactive first project, follow [Getting Started](/v2/guide/getting-started). Use these options to script project creation:

```bash
npm create gtkx@beta -- my-app --yes --application-id com.example.MyApp --display-name "My App"
```

Without `--display-name`, noninteractive scaffolding derives a name from the project directory, so `my-app` becomes `My App`. It also derives the package name when the directory's name is not a valid one, lowercasing it, removing accents and replacing other characters with hyphens, so `Unit Converter` becomes `unit-converter` and `café` becomes `cafe`. `--skip-install` writes the project without installing dependencies; run your package manager's install command in that directory afterward.

When Yarn is the chosen package manager and the Yarn that installs the project is 2 or newer, the new `package.json` pins that release in its `packageManager` field, as `yarn init -2` does, so Corepack runs the same Yarn for the install and every later command, on every machine, instead of its default. That Yarn is the one running the scaffold, as with `corepack yarn@4 create gtkx`, or, when npm or pnpm runs it, the one Corepack runs in that directory. An app inside a Yarn workspace gets no pin; the workspace root owns it.

The new project depends on the major versions this GTKX release supports rather than the newest ones: React, `@types/react` and Vitest within the ranges GTKX declares as peers, the Vite range `@gtkx/cli` depends on, TypeScript 6, and the `@types/node` major of the oldest Node.js GTKX supports. When a later GTKX release supports a new major, run `gtkx upgrade` first, then move those packages with your package manager.

## Existing directories

Without `--overwrite`, an existing scaffold-owned file stops the command before it changes anything. `--overwrite` lists and replaces only files owned by the scaffold; unrelated files remain in place. The command refuses a destination reached through a symbolic link.

The package manager's own settings are not replaced. An existing `.yarnrc.yml` keeps its registry, authentication and other settings and only gains `nodeLinker: node-modules` and the [release-age exemptions](#release-age-gates); an existing `pnpm-workspace.yaml` keeps its settings and `packages` and gains `allowBuilds` entries for the scaffold's native dependencies and the exemptions; an existing `.npmrc` keeps its lines and gains the exemptions at the end. A `packageManager` field naming the chosen package manager stays in the new `package.json`, so the project keeps its pinned version.

## Release-age gates

Package managers can hold back versions published more recently than a set age: Yarn 4.15 and newer quarantine packages published within the last day by default (`npmMinimalAgeGate`), and pnpm (`minimumReleaseAge`) and npm (`min-release-age`) have the same kind of setting. So that a project created on the day of a GTKX release still installs it, the scaffold exempts GTKX's own packages, `@gtkx/*` and `create-gtkx`, which `@gtkx/cli` depends on, in the configuration it writes. Every other dependency keeps the gate.

::: code-group

```yaml [.yarnrc.yml]
npmPreapprovedPackages:
    - "@gtkx/*"
    - create-gtkx
```

```yaml [pnpm-workspace.yaml]
minimumReleaseAgeExclude:
    - "@gtkx/*"
    - create-gtkx
```

```ini [.npmrc]
min-release-age-exclude[]=@gtkx/*
min-release-age-exclude[]=create-gtkx
```

:::

Yarn releases before 4.10 refuse to run with a setting they do not know, so `.yarnrc.yml` gets `npmPreapprovedPackages` only when the project's Yarn is 4.10 or newer: the release its `packageManager` field pins, otherwise the Yarn running the scaffold, otherwise the one `yarn --version` reports in the project directory. `gtkx upgrade` adds the same entries to a project that lacks them before it installs a new release.

## Workspaces

Inside a pnpm workspace whose `packages` include the target directory, `pnpm create gtkx apps/my-app` adds the app to that workspace. It writes no `pnpm-workspace.yaml` or lockfile of its own and installs through the workspace, so `pnpm add`, `gtkx upgrade` and other commands run from the app act on the whole workspace. The app's dependencies get their own version ranges rather than `catalog:` references, so a workspace catalog that pins another major version of `react` or `vitest` neither changes nor applies to the app. The scaffold does not edit the workspace's `pnpm-workspace.yaml`; when its `allowBuilds` does not mention `@swc/core` or `esbuild` yet, the command prints the entries to add there and pnpm skips those build scripts until you add them and run `pnpm install`. It likewise prints the [release-age exemptions](#release-age-gates) to add to the root's `minimumReleaseAgeExclude`.

Inside an npm workspace whose root `package.json` lists the target directory in `workspaces`, `npm create gtkx@beta -- apps/my-app` installs through the workspace in the same way. npm reads `allowScripts` only from the root `package.json`, so the scaffold writes none into the app's and prints the entries to add to the root when it does not mention `@swc/core` or `esbuild` yet. npm reads `.npmrc` from the workspace root too, so the scaffold writes no `.npmrc` into the app and prints the `min-release-age-exclude[]` lines the root `.npmrc` lacks.

Inside a Yarn workspace whose root `package.json` lists the target directory in `workspaces`, the scaffold likewise writes no `.yarnrc.yml` or `dependenciesMeta` into the app, because Yarn applies `nodeLinker` and `dependenciesMeta` to the whole workspace from its root. When the root `.yarnrc.yml` does not set `nodeLinker: node-modules` or, with Yarn 4.10 or newer, lacks the `npmPreapprovedPackages` exemptions, or the root `package.json` lacks `dependenciesMeta` for `@swc/core` or `esbuild`, the command prints the entries to add. Until the root sets `nodeLinker: node-modules` and `yarn install` runs again, Yarn installs the workspace with Plug'n'Play, which GTKX does not support.

The app gets its own `.mcp.json`, and in every kind of workspace the scaffold also adds a server to the `.mcp.json` at the workspace root, where AI clients are usually opened. The entry starts the app's own MCP server through the workspace's package manager: `pnpm --dir apps/my-app exec gtkx mcp`, `npm exec --no --workspace apps/my-app -- gtkx mcp`, `yarn workspace my-app exec gtkx mcp` with Yarn 2 or newer, or `yarn --silent --cwd apps/my-app gtkx mcp` with Yarn 1, whose runner otherwise prints to the output the client reads. The scaffold takes the Yarn version from the root's `packageManager` field, otherwise from the Yarn that runs it. Other servers in the file and its indentation stay. The server is named `gtkx`. An app scaffolded next to it adds no server of its own when the root `.mcp.json` already has a GTKX server: the GTKX servers of a session share one socket, so a second one would fail to start, and the one there drives every running GTKX app; its reference tools document another app's bindings when given that app's directory as `projectRoot`. When the root `.mcp.json` is not valid JSON, the scaffold leaves it unchanged and prints the entry to add. See [MCP](/v2/guide/mcp).

## Installation failures

If dependency installation fails, the generated project remains on disk, but the scaffold stops before initializing Git. Resolve the package manager's error, then rerun its install command in the project directory. Recreating the project is unnecessary. Inside a workspace, the command first prints the root entries listed above, since a workspace whose release-age gate does not exempt GTKX yet fails this install on a release day.

For the complete option list, run:

```bash
npm create gtkx@beta -- --help
```
