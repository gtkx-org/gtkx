<p align="center">
    <img src="https://raw.githubusercontent.com/gtkx-org/gtkx/main/logo.svg" alt="GTKX" width="100" height="100">
</p>

<h1 align="center">GTKX</h1>

<p align="center">
    <strong>Native Linux application development for the modern age</strong><br>
    React 19 + TypeScript render to real GTK4 and Libadwaita widgets on Node.js. No Electron, no WebView.
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/@gtkx/react"><img src="https://img.shields.io/npm/v/@gtkx/react.svg" alt="npm version"></a>
    <a href="https://github.com/gtkx-org/gtkx/actions"><img src="https://img.shields.io/github/actions/workflow/status/gtkx-org/gtkx/ci.yml" alt="CI"></a>
    <a href="https://gtkx.dev"><img src="https://img.shields.io/badge/docs-gtkx.dev-c8102e" alt="Documentation"></a>
    <a href="https://github.com/gtkx-org/gtkx/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="License"></a>
    <a href="https://github.com/gtkx-org/gtkx/discussions"><img src="https://img.shields.io/badge/discussions-GitHub-blue" alt="GitHub Discussions"></a>
</p>

---

<p align="center">
    <img src="https://raw.githubusercontent.com/gtkx-org/gtkx/main/demo.gif" alt="A GTKX-built editor saves a style edit and Vite Fast Refresh repaints the running app" width="100%">
</p>

<p align="center">
    <a href="https://gtkx.dev">▶ Watch in HD on gtkx.dev</a>
</p>

---

GTKX is a framework for building native Linux applications with React and GTK. A custom React reconciler renders your components to real GObject widgets, TypeScript bindings for the whole GTK4/GLib platform are generated from GObject Introspection, and everything runs on vanilla Node.js — so the npm ecosystem and the GNOME platform meet in one app.

## Features

- **React 19, exactly** — Hooks, Suspense, and concurrent rendering. A custom reconciler turns the component model you already know into real GTK4 widgets.
- **Native, not embedded** — No Chromium, no WebView, no second runtime. A Rust napi-rs module binds vanilla Node.js straight to GTK through libffi.
- **All of GTK4 and Libadwaita** — Every class, signal, and property, generated from GObject Introspection with full TypeScript types. The GNOME look and feel out of the box.
- **CSS-in-JS for GTK** — Emotion-style tagged templates compile to GTK CSS. Nesting, prop interpolation, and global styles.
- **Tests that touch real widgets** — A Testing Library-style API and a Vitest plugin drive real GTK under Xvfb. Query by accessible role, click, type, assert.
- **Built for AI agents** — A built-in MCP server exposes the live widget tree: agents inspect, click, type, fire signals, and screenshot your running app.

## Prerequisites

GTKX targets the Linux desktop and reads native GTK libraries at runtime. Before you start, make sure the toolchain is in place:

- **GTK 4.22+** and its development files, available on the system
- **GObject-Introspection** with the GIR XML installed (the standard `/usr/share/gir-1.0` location, or any directory pointed at by `pkg-config --variable=girdir gobject-introspection-1.0`); codegen reads these GIR files to generate the TypeScript bindings
- **Node.js >= 24**

The [getting-started guide](https://gtkx.dev/docs/getting-started) lists the exact packages per distribution.

## Quick start

```bash
npx @gtkx/cli@latest create my-app
cd my-app
npm run dev
```

## Examples

Explore complete applications in the [`examples/`](./examples) directory:

- **[hello-world](./examples/hello-world)** — Minimal application showing a counter
- **[gtk-demo](./examples/gtk-demo)** — Full replica of the official GTK demo app
- **[tutorial](./examples/tutorial)** — Notes app from the tutorial with GSettings and Adwaita
- **[browser](./examples/browser)** — Simple browser using WebKitWebView

## Documentation

Visit [https://gtkx.dev](https://gtkx.dev) for the full documentation: the [tutorial](https://gtkx.dev/docs/tutorial/1-window-and-header-bar) builds a complete GNOME Notes app, the [widget gallery](https://gtkx.dev/docs/gallery/) shows real captures of the components next to their source, and the [API reference](https://gtkx.dev/api/react/) covers every package.

## Contributing

Contributions are welcome! Please see the [contributing guidelines](./CONTRIBUTING.md).

## Community

- [GitHub Discussions](https://github.com/gtkx-org/gtkx/discussions) — Questions, ideas, and general discussion
- [Issue Tracker](https://github.com/gtkx-org/gtkx/issues) — Bug reports and feature requests

## License

[MPL-2.0](./LICENSE)
