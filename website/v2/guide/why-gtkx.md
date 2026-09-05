---
title: "Why GTKX"
description: "Why GTKX is the React framework for Linux, why it is Adwaita-first, and why it runs on Node.js."
---

# Why GTKX

The GNOME application platform pairs GTK4 with libadwaita: GTK supplies the widget toolkit, rendering, and accessibility, while Adwaita supplies adaptive application surfaces and GNOME design patterns. GTKX treats that complete stack as its foundation. New projects start from `Adw-1` as the sole codegen root and use `AdwApplication` and `AdwApplicationWindow`; Adwaita's GIR include brings in GTK4, so every underlying GTK widget remains available when it is the right building block.

libadwaita and GTK4 are mature, and GtkBuilder XML can lay out an interface and bind properties into it. The widget tree it builds is still fixed: keeping that structure in sync with your application state is left to imperative code you write yourself, and nothing refreshes the interface as you work. GTKX adds that missing declarative layer and the tooling around it:

- a React reconciler that exposes the GNOME object graph as JSX elements,
- a CLI for scaffolding, development, and production builds,
- a dev server with Fast Refresh that patches your running UI in place,
- CSS-in-JS styling, React Spring animations, React Navigation stack, tab, drawer, and split view navigators, high-level list and grid components, and dialogs that present on mount,
- a Testing Library-style API for querying and driving your widgets in tests,
- and a Model Context Protocol (MCP) server that exposes your live app to AI agents.

## Why Node.js

GJS is GNOME's own JavaScript runtime, separate from Node.js, so native modules, npm packages, and Node.js tooling are out of reach. node-gtk runs on Node.js but is lightly maintained, with weak types and GTK3-era documentation and examples. GTKX generates the TypeScript types and the native calls from the same GObject-Introspection data, so they cannot drift apart.

A GTKX app is an ordinary Node.js process, so you do everyday work with the Node standard library and npm. Use `node:fs` for files, `fetch` for HTTP, `setTimeout` and `setInterval` for timers, and any package on the registry for the rest. The generated GLib and Gio bindings come in only where the GNOME platform itself is the point: GSettings, desktop notifications, actions, and the `Gio.File` objects a file dialog hands back.

The GNOME UI stack and JavaScript share a single thread, so keep widget work on it.

## Next

- [Getting Started](/v2/guide/getting-started): scaffold an app and run the dev loop.
- [Configuration and Codegen](/v2/guide/configuration-and-codegen): how `gtkx.config.ts` drives codegen, and how GIR becomes the typed JSX prop model behind every intrinsic element.
- [Tutorial](/v2/tutorial/): build Tasks, a complete GNOME task manager, from your first window to Flathub submission.
- [Components](/v2/guide/components): the high-level components in `@gtkx/components` and the hooks in `@gtkx/react`.
