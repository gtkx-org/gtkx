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

Static assets (images, SVGs, etc.) should be handled via Vite imports rather than `path.resolve` / `import.meta.dirname`.

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

## Programmatic API

You can also use the CLI functions programmatically:

```typescript
import { createApp, createDevServer } from "@gtkx/cli";
import { build } from "@gtkx/cli/builder";

// Create a new project
await createApp({
    name: "my-app",
    appId: "com.example.myapp",
    packageManager: "pnpm",
    testing: "vitest",
});

// Start dev server
const server = await createDevServer({
    entry: "src/index.tsx",
});

// Production build
await build({ entry: "./src/index.tsx", appId: "com.example.myapp", vite: { root: process.cwd() } });
```
