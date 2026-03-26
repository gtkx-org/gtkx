<p align="center">
    <img src="https://raw.githubusercontent.com/eugeniodepalo/gtkx/main/logo.svg" alt="GTKX" width="100" height="100">
</p>

<h1 align="center">GTKX</h1>

<p align="center">
    <strong>Linux application development for the modern age powered by GTK4 and React</strong>
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/@gtkx/react"><img src="https://img.shields.io/npm/v/@gtkx/react.svg" alt="npm version"></a>
    <a href="https://github.com/gtkx-org/gtkx/actions"><img src="https://img.shields.io/github/actions/workflow/status/eugeniodepalo/gtkx/ci.yml" alt="CI"></a>
    <a href="https://github.com/gtkx-org/gtkx/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="License"></a>
    <a href="https://github.com/gtkx-org/gtkx/discussions"><img src="https://img.shields.io/badge/discussions-GitHub-blue" alt="GitHub Discussions"></a>
</p>

---

<p align="center">
    <img src="https://raw.githubusercontent.com/eugeniodepalo/gtkx/main/demo.gif" alt="GTKX Demo" width="100%">
</p>

---

GTKX is a modern framework for building native Linux applications using React and GTK. It provides the full range of GTK4, GLib, and Node.js APIs, allowing you to create rich, performant desktop applications with the tools and libraries you already know.

## Features

- **React 19** — Hooks, concurrent features, and the component model you know
- **Fully native Node.js environment** - Runs on vanilla Node.js, with the help of a Neon native module
- **TypeScript first** — Full type safety with auto-generated bindings
- **Rich GLib support** — Provides bindings for most modern GLib/GObject libraries, including Adwaita
- **HMR** — Fast refresh during development powered by Vite
- **CSS-in-JS styling** — Easy styling with GTK CSS powered by Emotion
- **Testing library** — Testing Library-inspired API for testing components and E2E

## Quick Start

```bash
npx @gtkx/cli create my-app
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

Visit [https://gtkx.dev](https://gtkx.dev) for the full documentation.

## Contributing

Contributions are welcome! Please see the [contributing guidelines](./CONTRIBUTING.md).

## Community

- [GitHub Discussions](https://github.com/gtkx-org/gtkx/discussions) — Questions, ideas, and general discussion
- [Issue Tracker](https://github.com/gtkx-org/gtkx/issues) — Bug reports and feature requests

## License

[MPL-2.0](./LICENSE)
