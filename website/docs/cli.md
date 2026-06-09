# CLI reference

The GTKX CLI provides commands for creating and developing applications.

## Installation

The CLI is included when you install `@gtkx/cli`:

```bash
npm install -D @gtkx/cli
```

Or use it directly with npx:

```bash
npx @gtkx/cli <command>
```

## Commands

### `gtkx create`

Creates a new GTKX project with all necessary configuration.

```bash
npx @gtkx/cli create [project-name]
```

**Interactive Prompts:**

| Prompt          | Description                     | Validation                               |
| --------------- | ------------------------------- | ---------------------------------------- |
| Project name    | Directory name for your project | Lowercase, numbers, hyphens only         |
| App ID          | Unique application identifier   | Reverse domain (e.g., `com.example.app`) |
| Package manager | Dependency manager              | pnpm, npm, yarn                          |
| Testing         | Include testing setup (Vitest)  | yes, no                                  |
| Claude Code skills | Include Claude Code skills    | yes, no                                  |

**Generated Project:**

```
project/
├── .claude/ # Claude Code skills (if enabled)
│ └── skills/
│ └── developing-gtkx-apps/
│ ├── SKILL.md
│ ├── WIDGETS.md
│ └── EXAMPLES.md
├── src/
│ ├── app.tsx # Root component, wrapped in <GtkApplication>
│ ├── index.tsx # Entry: calls render(<App />)
│ └── gtkx-env.d.ts # Ambient types for import.meta.env
├── tests/ # Example test (if testing enabled)
│ └── app.test.tsx
├── gtkx.config.ts # GIR libraries + applicationId
├── package.json
├── tsconfig.json
└── vitest.config.ts # Test configuration (if testing enabled)
```

### `gtkx dev`

Starts the Vite development server with HMR and React Fast Refresh.

```bash
npx gtkx dev [entry-file]
```

**Example:**

```bash
npx gtkx dev          # uses src/index.tsx by default
npx gtkx dev src/playground.tsx
```

**Features:**

- **Vite dev server** — Loads your entry through Vite in SSR module mode; no production bundle is written
- **Fast Refresh** — Editing a React component refreshes it in place; non-component edits trigger a full process restart
- **Config watch** — Editing `gtkx.config.ts` (for example the `libraries` list) regenerates the bindings and restarts the runner

Before starting, `gtkx dev` runs a codegen preflight that refreshes the generated bindings when they are stale. Static assets (images, SVGs, etc.) should be handled via Vite imports instead of `path.resolve` / `import.meta.dirname`.

### `gtkx build`

Bundles the project for production.

```bash
npx gtkx build [entry-file] [--asset-base <path>]
```

**Example:**

```bash
npx gtkx build                              # uses src/index.tsx by default
npx gtkx build src/index.tsx
npx gtkx build --asset-base ../share/my-app
```

**Features:**

- **Single-file output** — Vite's SSR build mode produces one minified ESM bundle at `dist/bundle.js` with all dependencies inlined
- **Self-contained** — The native `.node` binary is copied next to the bundle as `dist/gtkx.node`, so the build runs with no `node_modules` dependency at runtime
- **GResource assets** — When the project imports assets, a `gtkx.gresource` bundle is emitted next to the bundle and registered with GIO when the entry first loads

The `--asset-base` option sets where asset imports resolve relative to the executable directory, for FHS-compliant packaging where assets live under a `share/` directory. Run the build with `node dist/bundle.js`.

### `gtkx codegen`

Regenerates the TypeScript bindings for the GIR libraries declared in `gtkx.config.ts`. `gtkx dev` and `gtkx build` run this as a preflight automatically, so you rarely invoke it directly.

```bash
npx gtkx codegen [--force] [--cwd <path>]
```

By default it regenerates only when the generated store is missing or its fingerprint is stale (a changed library set, GIR runtime, or `@gtkx/codegen` version). Pass `--force` to wipe the store and regenerate unconditionally — the recovery path for a corrupted store. `--cwd` sets the project root (defaults to the current working directory).

### Generated npm scripts

After `gtkx create`, your `package.json` includes:

```json
{
    "scripts": {
        "dev": "gtkx dev",
        "build": "gtkx build",
        "typecheck": "tsc --noEmit",
        "start": "node dist/bundle.js",
        "test": "vitest"
    }
}
```

The `test` script is included only when testing is enabled.

| Script            | Description                            |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Start development server               |
| `npm run build`   | Bundle for production via `gtkx build` |
| `npm run typecheck` | Type-check the project with `tsc`    |
| `npm start`       | Run production bundle                  |
| `npm test`        | Run tests (if configured)              |

## React compiler

The [React Compiler](https://react.dev/learn/react-compiler) is enabled by default for every `gtkx dev`, `gtkx build`, and test run. It auto-memoizes your components and hooks at build time, so the reconciler commits fewer GTK property sets and signal reconnections per render — you get the benefit without hand-writing `useMemo`/`useCallback`.

Compilation is scoped to your project's own `.ts`/`.tsx` source under the project root; dependencies in `node_modules` (which ship pre-compiled) are left untouched. The compiler targets React 19 and its `react/compiler-runtime` import resolves from your app's React dependency, so no extra setup is required.

To tune or disable it, set `reactCompiler` in `gtkx.config.ts`:

```ts
import { defineConfig } from "@gtkx/cli";

export default defineConfig({
    libraries: ["Gtk-4.0"],
    // Disable the compiler entirely:
    reactCompiler: false,
    // …or pass options:
    // reactCompiler: { compilationMode: "annotation" },
});
```

| Option            | Values                                          | Description                                                          |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| `compilationMode` | `"infer"` `"syntax"` `"annotation"` `"all"`     | Which functions to optimize. Defaults to `"infer"`.                 |
| `panicThreshold`  | `"none"` `"critical_errors"` `"all_errors"`     | How to react to code the compiler cannot safely optimize. Defaults to `"none"` (skip silently). |

## Programmatic API

You can also use the CLI functions programmatically:

```typescript
import { build, createApp } from "@gtkx/cli";

// Create a new project
await createApp({
    name: "my-app",
    applicationId: "com.example.myapp",
    packageManager: "pnpm",
    testing: "vitest",
});

// Production build
await build({ entry: "./src/index.tsx", vite: { root: process.cwd() } });
```

The dev server runs as a forked worker; invoke it via the `gtkx dev` CLI instead of constructing it programmatically.
