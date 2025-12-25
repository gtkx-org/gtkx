---
sidebar_position: 3
---

# CLI

The `@gtkx/cli` package provides commands for creating and developing GTKX applications.

## Installation

Use without installing globally via your package manager's runner:

```bash
npx @gtkx/cli@latest create
pnpx @gtkx/cli@latest create
```

After project creation, the CLI is installed locally and available via package scripts.

## Commands

### gtkx create

Scaffold a new GTKX application:

```bash
gtkx create [name]
```

Interactive prompts:
- **Project name** - Directory name (lowercase, hyphens allowed)
- **App ID** - Reverse-domain identifier for GTK
- **Package manager** - pnpm, npm, yarn, or bun
- **Testing framework** - vitest, jest, node, or none
- **Claude Code skills** - AI assistance configuration files

#### Options

| Option | Description |
|--------|-------------|
| `--app-id <id>` | Application ID (e.g., `com.example.myapp`) |
| `--pm <manager>` | Package manager: `pnpm`, `npm`, `yarn`, `bun` |
| `--testing <framework>` | Testing: `vitest`, `jest`, `node`, `none` |
| `--claude-skills` | Include Claude Code skill files |

```bash
gtkx create my-app \
    --app-id com.example.myapp \
    --pm pnpm \
    --testing vitest \
    --claude-skills
```

#### Generated Structure

```
my-app/
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.test.json      # if testing enabled
├── vitest.config.ts        # if vitest
├── .gitignore
├── src/
│   └── app.tsx
└── tests/                  # if testing enabled
    ├── setup.ts
    └── app.test.tsx
```

### gtkx dev

Start the development server with HMR:

```bash
gtkx dev <entry>
```

The entry file must be a module that exports:

```tsx
export default function App() {
    return <GtkApplicationWindow>...</GtkApplicationWindow>;
}

export const appId = 'com.example.myapp';
export const appFlags = Gio.ApplicationFlags.FLAGS_NONE;
```

| Export | Required | Description |
|--------|----------|-------------|
| `default` | Yes | Component function returning ReactNode |
| `appId` | No | Application identifier (defaults to `com.gtkx.app`) |
| `appFlags` | No | `Gio.ApplicationFlags` value |

## Hot Module Replacement

The dev server implements React Refresh for fast updates:

1. **Component-local HMR**: When a module exports only React components, the dev server performs a fast refresh that preserves component state
2. **Full reload**: For non-component exports or structural changes, the entire application reloads

### Refresh Boundaries

A module is a valid refresh boundary when:
- All exports are React components (functions starting with uppercase)
- No side effects that would break on re-execution

When editing a component file, only that component re-renders. Parent components and their state remain intact.

### Limitations

Full reload occurs when:
- Editing entry point exports (`appId`, `appFlags`)
- Changing module-level side effects
- Modifying non-component exports

## Project Scripts

Generated `package.json` includes:

```json
{
    "scripts": {
        "dev": "gtkx dev src/app.tsx",
        "build": "tsc -b",
        "start": "node dist/app.js",
        "test": "xvfb-run -a vitest"
    }
}
```

| Script | Description |
|--------|-------------|
| `dev` | Start dev server with HMR |
| `build` | Compile TypeScript to `dist/` |
| `start` | Run compiled application |
| `test` | Run test suite in virtual framebuffer |

## Testing Environment

GTK requires a display server. For headless testing (CI, containers):

```bash
GDK_BACKEND=x11 \
GSK_RENDERER=cairo \
LIBGL_ALWAYS_SOFTWARE=1 \
xvfb-run -a vitest
```

| Variable | Purpose |
|----------|---------|
| `GDK_BACKEND=x11` | Force X11 backend (required for Xvfb) |
| `GSK_RENDERER=cairo` | Use Cairo software renderer |
| `LIBGL_ALWAYS_SOFTWARE=1` | Disable hardware acceleration |
| `xvfb-run -a` | Run in virtual framebuffer |

These are pre-configured in generated test scripts.

## Vite Configuration

The dev server uses Vite internally. Customize via `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: 'node20',
    },
    ssr: {
        noExternal: ['@gtkx/react', '@gtkx/css'],
    },
});
```

The GTKX Vite plugin is added automatically by the dev server.

## Application IDs

GTK applications require unique identifiers in reverse-domain notation:

```
com.example.myapp
org.gnome.Calculator
io.github.username.project
```

Rules:
- Use your own domain for published apps
- The CLI defaults to `org.gtkx.<name>` for development
- Must contain at least one dot
- Lowercase letters, numbers, hyphens only

## Programmatic API

Create projects programmatically:

```typescript
import { createApp } from '@gtkx/cli';

await createApp({
    name: 'my-app',
    appId: 'com.example.myapp',
    packageManager: 'pnpm',
    testing: 'vitest',
    claudeSkills: false,
});
```

Create a dev server programmatically:

```typescript
import { createDevServer } from '@gtkx/cli';

const server = await createDevServer({
    entry: 'src/app.tsx',
    vite: {
        // Vite config overrides
    },
});
```
