# GTKX 1.0 — release notes draft

> Draft for the v1 GitHub release. Publishing the release triggers the Pages deploy, so the new site and this announcement go live together.

## Release checklist

- [ ] Upload `.github/social-preview.png` in repo Settings → Social preview (manual, no API)
- [ ] Verify the OG card with a social-card debugger against a preview deploy (`workflow_dispatch` on `website.yml`)
- [ ] Confirm `https://gtkx.dev/llms.txt` and `https://gtkx.dev/llms-full.txt` resolve after deploy

## Suggested body

**Native Linux application development for the modern age.**

GTKX 1.0 is here: React 19 and TypeScript render to real GTK4 and Libadwaita widgets on vanilla Node.js — no Electron, no WebView, no second runtime.

![GTKX demo](https://raw.githubusercontent.com/gtkx-org/gtkx/main/demo.gif)

### Highlights

- **The whole GNOME platform, typed.** Every GTK4/Libadwaita class, signal, and property is generated from GObject Introspection with full TypeScript types.
- **A real development loop.** `gtkx create`, `gtkx dev` with Vite-powered Fast Refresh that keeps window state, `gtkx build` for a single-file production bundle.
- **CSS-in-JS for GTK.** Emotion-style tagged templates compile to GTK CSS, including GTK named colors and nesting.
- **Tests against real widgets.** A Testing Library-style API and a Vitest plugin drive real GTK under Xvfb.
- **Built for AI agents.** The bundled MCP server exposes the live widget tree — inspect, click, type, and screenshot a running app.

### Start here

- [Getting started](https://gtkx.dev/docs/getting-started)
- [Tutorial: build a GNOME Notes app](https://gtkx.dev/docs/tutorial/1-window-and-header-bar)
- [Widget gallery](https://gtkx.dev/docs/gallery/)

```bash
npx @gtkx/cli@latest create my-app
```
