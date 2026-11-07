---
title: "CLI"
description: "The gtkx commands and their options, with links to the guides that use them."
---

# CLI

`@gtkx/cli` installs the `gtkx` command. Scaffolded projects call it from their package scripts, so `npm run dev` runs `gtkx dev`. Outside a script, run it from the project with `npx gtkx <command>`.

`gtkx --help` lists the commands, and `gtkx <command> --help` lists a command's options. Each section below links to the guide page that explains the workflow. In the tables, an option shown with a placeholder such as `<dir>` takes a value, and one without is a boolean flag.

A command stops with an error on an option it does not define. Boolean options also take a `--no-` form, as in `--no-read-only`. Only `gtkx dev` and `gtkx storybook` pass arguments to the application; put them after `--`, as described in [Command-line apps](/v2/guide/application-lifecycle#command-line-apps).

## `gtkx create`

Creates a project, as `npm create gtkx` does, from a directory that already has `@gtkx/cli` installed, such as a [workspace](/v2/guide/workspaces) gaining another app. It takes the same arguments and options, listed with their defaults in [Scaffold Options](/v2/guide/scaffold-options#options).

## `gtkx dev`

Runs the app from source and watches the project. Fast Refresh applies most edits to the open window. See [the dev loop](/v2/guide/getting-started#the-dev-loop).

```bash
gtkx dev [entry] [options] [-- application arguments]
```

| Option            | Default                                            | Description                                                                                                                                                  |
| ----------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[entry]`         | The first of `src/index.tsx`, `.jsx`, `.ts`, `.js` | Application entry module                                                                                                                                     |
| `--cwd <dir>`     | Current directory                                  | Project root                                                                                                                                                 |
| `--config <file>` | `gtkx.config.*`                                    | Configuration file, relative to the project root. See [Selecting another configuration](/v2/guide/configuration-and-codegen#selecting-another-configuration) |
| `--headless`      | `false`                                            | Run on an isolated headless Wayland display. See [Headless development](/v2/guide/testing#headless-development)                                              |
| `--size <WxH>`    | `1024x768`                                         | Headless display size, such as `1280x720`. Requires `--headless`                                                                                             |

## `gtkx build`

Bundles the app for production into `dist/bundle.mjs`. See [Production build output](/v2/guide/assets#production-build-output).

```bash
gtkx build [entry] [options]
```

| Option            | Default                                            | Description                                      |
| ----------------- | -------------------------------------------------- | ------------------------------------------------ |
| `[entry]`         | The first of `src/index.tsx`, `.jsx`, `.ts`, `.js` | Application entry module                         |
| `--cwd <dir>`     | Current directory                                  | Project root                                     |
| `--config <file>` | `gtkx.config.*`                                    | Configuration file, relative to the project root |
| `--out <dir>`     | `dist`                                             | Output directory below the project root          |

## `gtkx deploy`

Builds the app and packages it for distribution. See [Deploying](/v2/guide/deploying).

```bash
gtkx deploy [entry] [options]
```

| Option              | Default                                            | Description                                                             |
| ------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `[entry]`           | The first of `src/index.tsx`, `.jsx`, `.ts`, `.js` | Application entry module                                                |
| `--cwd <dir>`       | Current directory                                  | Project root                                                            |
| `--config <file>`   | `gtkx.config.*`                                    | Configuration file, relative to the project root                        |
| `--target <list>`   | `deploy.targets`, otherwise `flatpak`              | Comma-separated package formats: `appimage`, `deb`, `flatpak`, `rpm`    |
| `--arch <list>`     | `deploy.architectures`, otherwise the host         | Comma-separated architectures: `arm64`, `x64`                           |
| `--out <dir>`       | `deploy.outDir`, otherwise `build`                 | Deployment directory below the project root                             |
| `--print-manifests` | `false`                                            | Write the generated manifests and metadata, then stop without packaging |
| `--skip-build`      | `false`                                            | Package the existing `dist/` instead of building                        |

## `gtkx codegen`

Generates the project's bindings, translation catalogs and TypeScript declarations. `gtkx dev`, `gtkx build` and the Vitest plugin also generate them when they are missing or out of date. See [What codegen emits](/v2/guide/configuration-and-codegen#what-codegen-emits).

```bash
gtkx codegen [options]
```

| Option                | Default           | Description                                                                          |
| --------------------- | ----------------- | ------------------------------------------------------------------------------------ |
| `--cwd <dir>`         | Current directory | Project root                                                                         |
| `--config <file>`     | `gtkx.config.*`   | Configuration file, relative to the project root                                     |
| `--force`             | `false`           | Delete the generated store and regenerate it, for example to recover a corrupted one |
| `--lock-timeout <ms>` | `600000`          | Longest wait for each generated-store lock, in milliseconds                          |

## `gtkx docs`

Writes Markdown reference pages for the JSX elements of the libraries in `gtkx.config.ts`. See [Generating element reference docs](/v2/guide/configuration-and-codegen#generating-element-reference-docs).

```bash
gtkx docs [options]
```

| Option               | Default           | Description                                                                                  |
| -------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `--cwd <dir>`        | Current directory | Project root                                                                                 |
| `--out <dir>`        | `docs/reference`  | Output directory below the project root. It must be empty or hold an earlier `gtkx docs` run |
| `--base-path <path>` | `/reference`      | URL base path of the links between the generated pages                                       |
| `--force`            | `false`           | Regenerate even when the pages are up to date                                                |

## `gtkx storybook`

Opens the native Storybook explorer for the project's stories, with hot reload. See [Storybook](/v2/guide/storybook).

```bash
gtkx storybook [options] [-- application arguments]
```

| Option                      | Default             | Description                                            |
| --------------------------- | ------------------- | ------------------------------------------------------ |
| `--cwd <dir>`               | Current directory   | Project root                                           |
| `--config <file>`           | `gtkx.config.*`     | Configuration file, relative to the project root       |
| `--storybook-config <file>` | `.storybook/main.*` | Story configuration file, relative to the project root |
| `--headless`                | `false`             | Run on an isolated headless Wayland display            |
| `--size <WxH>`              | `1024x768`          | Headless display size. Requires `--headless`           |

## `gtkx mcp`

Runs the MCP server that exposes the running app and the generated API reference to an agent. MCP clients start it. See [App Inspection (MCP)](/v2/guide/mcp).

```bash
gtkx mcp [options]
```

| Option           | Default                    | Description                                                                                                    |
| ---------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `--cwd <dir>`    | Current directory          | Project root                                                                                                   |
| `--tools <list>` | `mcp.tools`, otherwise all | Comma-separated tool name patterns. See [Choose the available tools](/v2/guide/mcp#choose-the-available-tools) |
| `--read-only`    | `mcp.readOnly`             | Register only the tools that read state, leaving out the ones that drive the app                               |

### `gtkx mcp init`

Adds the `gtkx` server to an MCP client's project configuration file. See [Setup](/v2/guide/mcp#setup).

```bash
gtkx mcp init --client <name> [options]
```

| Option            | Default           | Description                                                                  |
| ----------------- | ----------------- | ---------------------------------------------------------------------------- |
| `--client <name>` | Required          | The client to configure: `claude`, `cursor`, `vscode`, `opencode` or `codex` |
| `--cwd <dir>`     | Current directory | Project root                                                                 |

## `gtkx upgrade`

Moves every GTKX package in the project or its workspace to one version and installs it. See [Updating GTKX](/v2/guide/updating).

```bash
gtkx upgrade [version] [options]
```

| Option        | Default                                      | Description                    |
| ------------- | -------------------------------------------- | ------------------------------ |
| `[version]`   | The newest release on the project's dist-tag | Version or dist-tag to move to |
| `--cwd <dir>` | Current directory                            | Project root                   |

## `gtkx cleanup`

Removes headless runtime directories and compile caches left by interrupted runs. They belong to your user account rather than a project, so the command ignores `--cwd`. See [Headless development](/v2/guide/testing#headless-development).

```bash
gtkx cleanup [options]
```

| Option      | Default | Description                                      |
| ----------- | ------- | ------------------------------------------------ |
| `--dry-run` | `false` | List the stale directories without removing them |
