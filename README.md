<p align="center">
  <img src="logo.svg" alt="GTKX" width="100" />
</p>

<h1 align="center">GTKX</h1>

<p align="center">
  Linux desktop application development for the modern age.<br />
  Write declarative JSX; GTKX renders real native GTK4 and libadwaita widgets — no webview, no Electron.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@gtkx/cli"><img src="https://img.shields.io/npm/v/@gtkx/cli?color=cb3837&logo=npm&label=%40gtkx%2Fcli" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@gtkx/cli"><img src="https://img.shields.io/npm/dm/@gtkx/cli?color=cb3837&logo=npm&label=downloads" alt="npm downloads" /></a>
  <img src="https://img.shields.io/node/v/@gtkx/cli?logo=node.js&label=node" alt="Node >=24" />
  <a href="https://github.com/gtkx-org/gtkx/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="License: MPL-2.0" /></a>
  <a href="https://github.com/gtkx-org/gtkx/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/gtkx-org/gtkx/ci.yml?branch=main&logo=github&label=CI" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<p align="center">
  <a href="https://gtkx.dev">Homepage</a> &middot;
  <a href="#documentation">Documentation</a> &middot;
  <a href="#examples">Examples</a> &middot;
  <a href="#contributing">Contributing</a>
</p>

---

GTKX is a framework for building native GTK4/libadwaita desktop applications with React, TypeScript, and JSX. You write declarative JSX whose element types are GTK widget names; a custom react-reconciler maps that tree to live GObject instances, while a Rust napi addon owns the single GLib main-loop thread and performs every call into GTK. A build-time generator turns GObject-Introspection (GIR) XML into typed bindings, JSX element types, and reconciler metadata, and a Vite-based CLI provides scaffolding, a hot-reloading dev server, single-file production bundling, and GTK-asset integration.

## Table of contents

- [Demo](#demo)
- [Why GTKX](#why-gtkx)
- [Quick start](#quick-start)
- [Examples](#examples)
- [Packages](#packages)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Demo

![GTKX demo](demo.gif)

The window above is rendered by the app below. The JSX element types are real GTK widgets, and standard React (hooks, events) drives them:

```tsx
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";
import { useState } from "react";

const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <GtkApplicationWindow
      title="Hello GTKX"
      defaultWidth={400}
      defaultHeight={300}
      onCloseRequest={quit}
    >
      <GtkBox
        orientation={Gtk.Orientation.VERTICAL}
        spacing={20}
        marginTop={40}
        marginBottom={40}
        marginStart={40}
        marginEnd={40}
        valign={Gtk.Align.CENTER}
        halign={Gtk.Align.CENTER}
      >
        <GtkLabel label="Welcome to GTKX!" cssClasses={["title-1"]} />
        <GtkLabel label={`Count: ${count}`} cssClasses={["title-2"]} />
        <GtkButton
          label="Increment"
          onClicked={() => setCount((c) => c + 1)}
          cssClasses={["suggested-action", "pill"]}
        />
      </GtkBox>
    </GtkApplicationWindow>
  );
};

const App = () => (
  <GtkApplication>
    <Counter />
  </GtkApplication>
);

createRoot().render(<App />);
```

This is the [`hello-world`](examples/hello-world) example, verbatim.

## Why GTKX

- **Real React.** Declarative JSX, hooks, and Fast Refresh, backed by a custom react-reconciler that maps your component tree to live GObject instances.
- **Full GTK4 + libadwaita.** Typed bindings, JSX element types, and reconciler metadata generated from GObject-Introspection (GIR) XML — the whole widget surface, fully typed.
- **Native performance.** A Rust napi addon owns the single GLib main-loop thread and performs every call into GTK, with no DOM and no web view in the path.
- **Modern DX.** A Vite-based CLI for scaffolding, a hot-reloading dev server, single-file production bundling, and GTK-asset integration.
- **Styling + animation.** `@gtkx/css` brings Emotion-style CSS-in-JS to GTK CSS classes, and `@gtkx/animate` provides libadwaita-driven animation components.
- **Testing + AI.** A Testing Library-style harness (`@gtkx/testing`) with `@gtkx/vitest` headless display isolation, plus an MCP server (`@gtkx/mcp`) that exposes live widgets to AI agents.

GTKX binds the GNOME stack (GTK4, libadwaita, GLib/GObject) the same way [GJS](https://gitlab.gnome.org/GNOME/gjs), [node-gtk](https://github.com/romgrk/node-gtk), and PyGObject do — but gives you the React programming model on top.

## Quick start

Scaffold and run a new app with the official `create-gtkx` initializer:

```sh
npm create gtkx@latest
```

The wizard creates the project, installs dependencies, and initializes a git repository. Then:

```sh
cd my-app
npm run dev
```

Every scaffolded app exposes the standard `dev`, `build`, and `start` scripts, which wrap the CLI (`gtkx dev` / `gtkx build` / `node dist/bundle.js`).

## License

[MPL-2.0](LICENSE)
