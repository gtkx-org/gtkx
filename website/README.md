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

## Visual assets

Every image the site serves is generated from real GTKX renders. One command regenerates the full still-image set:

```bash
pnpm --filter website assets
```

That chains four steps, each runnable on its own:

| Script | What it does |
| --- | --- |
| `screenshots` | Runs `vitest run --config screenshots/vitest.config.ts` under the `@gtkx/vitest` plugin (per-worker Xvfb and D-Bus, 2200x1600 screen, `GDK_SCALE=2`). `capture.test.tsx` captures the 8 tutorial chapters and `gallery.test.tsx` captures every widget-gallery fixture, each in both the light and the dark Adwaita color scheme, writing lossless 2x masters into `screenshots/out/`. Chapter 4 (open menu popover) grabs the whole display with ffmpeg, falling back to ImageMagick's `import`. |
| `assets:apps` | `capture-apps.ts` runs each built example app (`pnpm build` first) inside its own Xvfb with a private D-Bus session, in both color schemes via `ADW_DEBUG_COLOR_SCHEME`, and grabs the display with ffmpeg into `screenshots/out/showcase/`. The browser app loads a deterministic local fixture page. |
| `assets:images` | `postprocess.ts` (sharp) trims display grabs to the window, applies the rounded-corner alpha mask, encodes WebP under a size budget, and copies the deliverables to `docs/tutorial/images/`, `docs/gallery/images/`, and `public/media/`. |
| `assets:og` | `og.ts` (satori + sharp) renders the Open Graph card, the GitHub social preview, and the hero video end card from the design tokens, the logo, and the captured Notes screenshot. |

Naming convention: theme pairs are `{name}-light.webp` / `{name}-dark.webp`; the docs reference them with the `{.light-only}` / `{.dark-only}` markdown attributes.

The motion assets are a separate, local-only step (`assets:video`, `record-hero.ts`) because they need ffmpeg, xdotool, and a terminal emulator on top of the headless stack; see the script header for the storyboard. Regenerate stills whenever the tutorial UI, the example apps, the gallery fixtures, or the branding change. For byte-stable output across machines, run the capture inside the pinned CI image (`ghcr.io/gtkx-org/gtkx-ci`).

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
