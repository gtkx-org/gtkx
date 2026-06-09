# CLI Reference

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
| Testing         | Include Vitest testing setup    | yes, no                                  |
| Claude skills   | Add GTKX Claude skills          | yes, no                                  |

**Generated Project:**

```
project/
├── .claude/ # Claude skills (if enabled)
│ ├── skills/
│ │ ├── EXAMPLES.md
│ │ ├── SKILL.md
│ │ └── WIDGETS.md
├── src/
│ ├── app.tsx # Main component
│ └── index.tsx # Default-export entry used by `gtkx dev` and `gtkx build`
├── tests/ # Example test (if testing enabled)
│ └── app.test.tsx
├── package.json
├── tsconfig.json
└── vitest.config.ts # Test configuration (if testing enabled)
```

### `gtkx dev`

Starts the development server with Hot Module Replacement.

```bash
npx gtkx dev [entry-file]
```

**Example:**

```bash
npx gtkx dev          # uses src/index.tsx by default
npx gtkx dev src/playground.tsx
```

**Features:**

- **Single-file output** — All dependencies inlined into one minified ESM bundle
- **Vite-powered** — Uses Vite SSR mode for Node.js-targeted bundling

Static assets (images, SVGs, etc.) should be handled via Vite imports instead of `path.resolve` / `import.meta.dirname`.

### Generated npm Scripts

After `gtkx create`, your `package.json` includes:

```json
{
    "scripts": {
        "dev": "gtkx dev",
        "build": "gtkx build",
        "start": "node dist/bundle.js",
        "test": "vitest"
    }
}
```

| Script          | Description                            |
| --------------- | -------------------------------------- |
| `npm run dev`   | Start development server               |
| `npm run build` | Bundle for production via `gtkx build` |
| `npm start`     | Run production bundle                  |
| `npm test`      | Run tests (if configured)              |

## React Compiler

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
