# Website

The GTKX documentation site, published at [https://gtkx.dev](https://gtkx.dev). It is a [VitePress](https://vitepress.dev) project that pairs hand-authored guides with an API reference generated from the package source by [TypeDoc](https://typedoc.org).

Source for this package lives in the monorepo at [https://github.com/gtkx-org/gtkx](https://github.com/gtkx-org/gtkx). Run the commands below from the repository root unless noted otherwise.

## Run the docs site

Start the VitePress dev server with HMR:

```bash
pnpm --filter website dev
```

The site opens on `http://localhost:5173`. Edits to `index.md`, files under `docs/`, the theme, and the config reload in place.

The dev server reads the generated API reference from `api/`. That directory is gitignored, so generate it once before the first run if the `/api/...` routes are empty:

```bash
pnpm --filter website typedoc
```

## Build

The production build runs through Turbo so the package builds that the API reference depends on happen first:

```bash
pnpm docs
```

This resolves to `turbo run docs --filter=!gtkx`. The `docs` task depends on `@gtkx/ffi#build` and `@gtkx/react#build`, then runs the website `docs` script, which is `pnpm typedoc && vitepress build`. TypeDoc regenerates `api/`, and VitePress emits the static site into `.vitepress/dist/`.

To build only the website without invoking Turbo:

```bash
pnpm --filter website docs
```

Preview the built site locally:

```bash
pnpm --filter website preview
```

## Regenerate the API reference

The API reference is generated from TypeScript source, so it must be regenerated whenever the public surface of a documented package changes:

```bash
pnpm --filter website typedoc
```

`scripts/typedoc.ts` clears `api/` and runs TypeDoc once per package listed in `typedoc.config.ts`: `@gtkx/react`, `@gtkx/css`, `@gtkx/testing`, and `@gtkx/ffi`. Each package contributes its `src/index.ts` entry point and its `tsconfig.lib.json`. Shared options live in `typedoc.json`, which loads `typedoc-plugin-markdown` and `typedoc-vitepress-theme` to emit Markdown and a per-package `typedoc-sidebar.json`. `.vitepress/config.ts` imports those sidebar files to build the `/api/` navigation, so the site config expects `api/` to be present at build time.

## Screenshots

The tutorial images under `docs/tutorial/images/` are captured by rendering real GTK4 components and screenshotting them:

```bash
pnpm --filter website screenshots
```

This runs `vitest run --config screenshots/vitest.config.ts`. The Vitest config applies the `@gtkx/vitest` plugin, which provisions a per-worker Xvfb and D-Bus, so a display is set up automatically. `screenshots/capture.test.tsx` renders each chapter component from `screenshots/chapters/`, forces the Adwaita dark color scheme, and writes one PNG per chapter into `docs/tutorial/images/`. Most chapters use `@gtkx/testing`'s `screen.screenshot()`; chapters that show a popover or a separate window capture the whole display with ImageMagick's `import`, which must be installed on the machine running the step. Regenerate these images whenever a tutorial chapter's UI changes.

## Layout

| Path | Contents |
| --- | --- |
| `index.md` | Home page. Uses the VitePress `home` layout with the hero and feature list defined in front matter. |
| `docs/*.md` | Authored guides: introduction, getting started, core concepts, the notes-app tutorial, and the CLI and MCP reference. The sidebar and nav for these pages are defined in `.vitepress/config.ts`. |
| `docs/tutorial/images/` | Tutorial screenshots produced by the screenshots step. |
| `api/` | Generated API reference (Markdown plus per-package sidebars). Gitignored and recreated by TypeDoc. |
| `.vitepress/config.ts` | Site config: title, navigation, sidebars, local search, edit links, and the `vitepress-plugin-llms` setup for `llms.txt`. |
| `.vitepress/theme/` | Custom theme. `index.ts` extends the VitePress default theme and loads the styles under `styles/`. `components/` holds the Vue components used by the theme, including the home-page hero demo. |
| `public/` | Static assets served at the site root, including the logo, favicon, and fonts. |
| `screenshots/` | Vitest setup, chapter components, and the capture test for the screenshots step. |

## Conventions

Authored docs follow the project writing conventions: international English with American spelling, sentence case for headings and navigation labels, and package names written verbatim (`@gtkx/react`, `@gtkx/ffi`, `@gtkx/css`, `@gtkx/cli`, `@gtkx/mcp`, `@gtkx/testing`, `@gtkx/vitest`). Code in fenced blocks must compile against the current public API. Link to the site as `https://gtkx.dev` and to the repository as `https://github.com/gtkx-org/gtkx`.
