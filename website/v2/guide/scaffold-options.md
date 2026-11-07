---
title: "Scaffold Options"
description: "Create projects without prompts, defer dependency installation, and replace scaffold files."
---

# Scaffold Options

For an interactive first project, follow [Getting Started](/v2/guide/getting-started). To create a project from a script, pass the directory and `--yes`:

```bash
npm create gtkx@beta -- my-app --yes --application-id com.example.MyApp --display-name "My App"
```

## Options

| Option                    | Default without prompts                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<directory>`             | Required. A name or a path, such as `apps/my-app` or `~/Projects/my-app`.                                                                                                     |
| `--application-id`        | Derived from the directory: `my-app` gets `com.myapp.app`.                                                                                                                    |
| `--display-name`          | Derived from the directory: `my-app` gets My App.                                                                                                                             |
| `-p`, `--package-manager` | `pnpm`, `npm` or `yarn`. Detected from a `packageManager` field or lockfile in the current directory or a parent, then from the command running the scaffold, otherwise pnpm. |
| `--no-typescript`         | TypeScript. Pass it for a JavaScript project.                                                                                                                                 |
| `--no-vitest`             | The Vitest setup is included. Pass it to leave it out.                                                                                                                        |
| `-y`, `--yes`             | Prompts for every option not passed. Without a terminal, as in CI, the command never prompts.                                                                                 |
| `-f`, `--overwrite`       | Refuses a directory that is not empty. See [Existing directories](#existing-directories).                                                                                     |
| `--skip-install`          | Installs dependencies. With it, run your package manager's install command in the project afterward.                                                                          |

The package name is the directory name when that is a valid npm package name. Otherwise the scaffold lowercases it, removes accents and replaces other characters with hyphens, so `Unit Converter` becomes `unit-converter` and `café` becomes `cafe`. `npm create gtkx@beta -- --help` prints every option.

The new project depends on the major versions this GTKX release supports, not the newest ones: React, `@types/react` and Vitest within the ranges GTKX declares as peers, the Vite range `@gtkx/cli` depends on, TypeScript 6, and the `@types/node` major of the oldest Node.js GTKX supports. When a later GTKX release supports a new major, run `gtkx upgrade` first, then move those packages with your package manager.

With Yarn 2 or newer, the new `package.json` pins the installing Yarn release in its `packageManager` field, as `yarn init -2` does, so Corepack runs that release on every machine. The installing release is the Yarn running the scaffold, as with `corepack yarn@4 create gtkx@beta`, otherwise the one Corepack runs in the target directory. An app inside a Yarn workspace gets no pin; the workspace root owns it.

## Existing directories

Without prompts, a directory that holds anything other than `.git` stops the command before it changes anything, and the error lists the scaffold files it would replace. `--overwrite` replaces those files and leaves every other file in place. Interactive runs ask before replacing them. The command refuses a destination reached through a symbolic link.

The package manager's own settings are added to rather than replaced. An existing `.yarnrc.yml` keeps its registry, authentication and other settings and gains `nodeLinker: node-modules` and the [release-age exemptions](#release-age-gates). An existing `pnpm-workspace.yaml` keeps its settings and `packages` and gains `allowBuilds` entries for the scaffold's native dependencies and the exemptions. An existing `.npmrc` keeps its lines and gains the exemptions at the end. A `packageManager` field naming the chosen package manager stays in the new `package.json`, so the project keeps its pinned version.

The scaffold initializes a Git repository with an initial commit only in a new or empty directory outside an existing repository.

## Release-age gates

Package managers can hold back versions published more recently than a set age. Yarn 4.15 and newer ([`npmMinimalAgeGate`](https://yarnpkg.com/configuration/yarnrc#npmMinimalAgeGate)) and pnpm 11 and newer ([`minimumReleaseAge`](https://pnpm.io/settings/dependency-resolution#minimumreleaseage)) hold back packages published within the last day by default; npm's [`min-release-age`](https://docs.npmjs.com/cli/v11/using-npm/config#min-release-age) applies only when set. So that a project created on the day of a GTKX release still installs it, the scaffold exempts GTKX's own packages, `@gtkx/*` and `create-gtkx`, which `@gtkx/cli` depends on, in the configuration it writes. Every other dependency keeps the gate.

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

Yarn releases before 4.10 refuse to run with a setting they do not know, so `.yarnrc.yml` gets `npmPreapprovedPackages` only when the project's Yarn is 4.10 or newer: the release its `yarnPath` or `packageManager` field selects, otherwise the Yarn running the scaffold. `gtkx upgrade` adds the same entries to a project that lacks them before it installs a new release.

## Workspaces

Inside a workspace whose root lists the target directory, in the `packages` of `pnpm-workspace.yaml` for pnpm or the `workspaces` of the root `package.json` for npm and Yarn, the scaffold adds the app to that workspace:

```bash
pnpm create gtkx@beta apps/my-app
```

The app installs through the workspace and gets no lockfile or package manager configuration of its own, so `pnpm add`, `gtkx upgrade` and other commands run from the app act on the whole workspace. Its dependencies get their own version ranges rather than `catalog:` references, so a workspace catalog that pins another major version of `react` or `vitest` neither changes nor applies to the app.

The package managers read these settings only from the workspace root. The scaffold does not edit the root; when the root lacks an entry, the command prints it, and you add it and run the workspace's install command:

| Package manager | Root settings the app needs                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm            | `allowBuilds` for `@swc/core` and `esbuild`, and the `minimumReleaseAgeExclude` exemptions, in `pnpm-workspace.yaml`                                                                  |
| npm             | `allowScripts` for `@swc/core` and `esbuild` in `package.json`, and the `min-release-age-exclude[]` lines in `.npmrc`                                                                 |
| Yarn            | `nodeLinker: node-modules` and, with Yarn 4.10 or newer, the `npmPreapprovedPackages` exemptions in `.yarnrc.yml`; `dependenciesMeta` for `@swc/core` and `esbuild` in `package.json` |

Until the root has them, pnpm skips the build scripts of `@swc/core` and `esbuild`, Yarn installs the workspace with Plug'n'Play, which GTKX does not support, and a release-age gate holds back a GTKX release published that day. When the install fails, the command prints the missing entries first; [Troubleshooting](/v2/guide/troubleshooting#dependency-installation-fails-while-scaffolding) covers recovery.

The app gets its own `.mcp.json`, and the scaffold also adds a server named `gtkx` to the `.mcp.json` at the workspace root, where AI clients are usually opened. That server starts the app's MCP server through the workspace's package manager:

| Workspace       | Command                                             |
| --------------- | --------------------------------------------------- |
| pnpm            | `pnpm --dir apps/my-app exec gtkx mcp`              |
| npm             | `npm exec --no --workspace apps/my-app -- gtkx mcp` |
| Yarn 2 or newer | `yarn workspace my-app exec gtkx mcp`               |
| Yarn 1          | `yarn --silent --cwd apps/my-app gtkx mcp`          |

Other servers in the file and its indentation stay. When the root `.mcp.json` already has a GTKX server, such as an earlier app's, the scaffold adds none, because [one server drives every running GTKX app](/v2/guide/mcp#several-apps). When the file is not a valid MCP configuration, the scaffold leaves it unchanged and prints the entry to add.
