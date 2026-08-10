---
title: "Why GTKX"
description: "What GTKX is, why it exists, and why it runs on Node.js."
---

# Why GTKX

GTK4 and Adwaita are mature, and GtkBuilder XML can lay out an interface and bind properties into it. The widget tree it builds is still fixed: keeping that structure in sync with your application state is left to imperative code you write yourself, and nothing refreshes the interface as you work. GTKX adds that missing layer, and the tooling around it, on top of the stack you already know:

- a React reconciler that exposes every GObject as a JSX element,
- a CLI for scaffolding, development, and production builds,
- a dev server with Fast Refresh that patches your running UI in place,
- CSS-in-JS styling, high-level list and grid components, and dialogs that present on mount,
- a Testing Library-style API for querying and driving your widgets in tests,
- and a Model Context Protocol (MCP) server that exposes your live app to AI agents.

## Why Node.js

GJS is GNOME's own JavaScript runtime, separate from Node.js, so native modules, npm packages, and Node.js tooling are out of reach. node-gtk runs on Node.js but is lightly maintained, with weak types and GTK3-era documentation and examples. GTKX generates the TypeScript types and the native calls from the same GObject-Introspection data, so they cannot drift apart.

A GTKX app is an ordinary Node.js process, so you do everyday work with the Node standard library and npm. Use `node:fs` for files, `fetch` for HTTP, `setTimeout` and `setInterval` for timers, and any package on the registry for the rest. The generated GLib and Gio bindings come in only where the GNOME platform itself is the point: GSettings, desktop notifications, actions, and the `Gio.File` objects a file dialog hands back.

GTK and JavaScript share a single thread, so keep widget work on it.

## Next

- [Getting Started](/guide/getting-started): scaffold an app and run the dev loop.
- [Configuration and Codegen](/guide/configuration-and-codegen): how `gtkx.config.ts` drives codegen, and how GIR becomes the typed JSX prop model behind every intrinsic element.
- [Tutorial](/tutorial/): build Tasks, a complete GNOME task manager, from your first window to Flathub submission.
- [Components](/guide/components): the high-level components in `@gtkx/components` and the hooks in `@gtkx/react`.
