---
sidebar_position: 1
---

# CLI

The `@gtkx/cli` package provides the `gtkx` command for creating and developing GTKX applications.

## Quick Start

The recommended way to use the CLI is with `npx` (or `pnpx` for pnpm users):

```bash
npx @gtkx/cli create
```

This downloads and runs the CLI without installing it globally. After creating a project, the CLI is installed as a local dependency, so you can use `npm run dev` directly.

## Commands

### `gtkx create`

Scaffolds a new GTKX application with an interactive wizard.

```bash
gtkx create
```

The wizard prompts for:
- **Project name** — lowercase letters, numbers, and hyphens (e.g., `my-app`)
- **App ID** — reverse domain notation (e.g., `com.example.myapp`)
- **Package manager** — pnpm, npm, yarn, or bun
- **Testing framework** — Vitest, Jest, Node.js Test Runner, or none

You can also pass options directly to skip prompts:

```bash
gtkx create my-app --app-id com.example.myapp --pm pnpm --testing vitest
```

#### Options

| Option | Description |
|--------|-------------|
| `--app-id` | GTK application ID in reverse domain notation |
| `--pm` | Package manager: `pnpm`, `npm`, `yarn`, or `bun` |
| `--testing` | Testing framework: `vitest`, `jest`, `node`, or `none` |

#### Testing Setup

When you choose a testing framework, the CLI sets up:

- **Vitest** — `vitest.config.ts` and example test in `tests/app.test.tsx`
- **Jest** — `jest.config.js` with ts-jest and example test
- **Node.js Test Runner** — Example test using `node:test` and `tsx`

All options install `@gtkx/testing` which provides Testing Library-style utilities for querying GTK widgets.

### `gtkx dev`

Starts the development server with Hot Module Replacement.

```bash
gtkx dev src/app.tsx
```

This launches your application and watches for file changes. When you edit your code, the app updates instantly without restarting — just like web development with Vite.

#### How HMR Works

1. Your app renders normally on first load
2. The dev server watches for file changes
3. When a file changes, it hot-reloads the module
4. The React tree re-renders with the new code
5. Component state is preserved when possible

#### Example Workflow

```bash
# Terminal 1: Start dev server
cd my-app
npm run dev

# Terminal 2: Edit code and watch it update
# Changes to src/app.tsx will appear instantly
```

## Project Scripts

When you create a new project, these scripts are set up in `package.json`:

```json
{
  "scripts": {
    "dev": "gtkx dev src/app.tsx",
    "build": "tsc -b",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

### `npm run dev`

Starts the development server with HMR. Use this during development.

### `npm run build`

Compiles TypeScript to JavaScript in the `dist/` directory.

### `npm start`

Runs the compiled application without HMR. Use this for production or testing the built app.

### `npm test`

Runs the test suite. The test script varies based on your chosen framework:
- **Vitest**: `vitest`
- **Jest**: `jest`
- **Node.js**: `node --import tsx --test tests/**/*.test.ts`

## App ID

GTK applications require a unique identifier in reverse domain notation:

```
com.example.myapp
org.gnome.Calculator
io.github.user.project
```

The app ID is used by:
- The desktop environment for window matching
- D-Bus for inter-process communication
- Flatpak/Snap for sandboxing

### Choosing an App ID

- Use a domain you control: `com.yourcompany.appname`
- For personal projects: `io.github.username.appname`
- For GTKX demos: `org.gtkx.appname`

The CLI suggests `org.gtkx.<projectname>` as a default, but you should use your own domain for published apps.

## Using with npx/pnpx

You don't need to install the CLI globally. Use your package manager's runner:

```bash
# npm users
npx @gtkx/cli create

# pnpm users
pnpx @gtkx/cli create

# With options
npx @gtkx/cli create my-app --app-id com.example.myapp --pm pnpm
```

After creating a project, the CLI is installed as a local dependency, so `npm run dev` (or `pnpm dev`) works directly.
