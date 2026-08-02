---
title: "Why GTKX"
description: "What GTKX is, why it exists, and how it compares to GJS and node-gtk."
---

# Why GTKX

GTK4 and Adwaita are mature, and GtkBuilder XML can lay out an interface and bind properties into it. The widget tree it builds is still fixed: keeping that structure in sync with your application state is left to imperative code you write yourself, and nothing refreshes the interface as you work. GTKX adds that missing layer, and the tooling around it, on top of the stack you already know:

- a React reconciler that exposes every GObject as a JSX element,
- a CLI for scaffolding, development, and production builds,
- a dev server with Fast Refresh that patches your running UI in place,
- CSS-in-JS styling, high-level list and grid components, and dialogs that present on mount,
- a Testing Library-style API for querying and driving your widgets in tests,
- and a Model Context Protocol (MCP) server that exposes your live app to AI agents.

## Why Node.js, and why not node-gtk/GJS

GTKX runs on Node.js. The established ways to reach GTK4 from JavaScript, GJS and node-gtk, each come with trade-offs GTKX set out to avoid.

GJS is GNOME's own JavaScript runtime, built on SpiderMonkey rather than V8. Because it is a separate runtime from Node.js, it cuts you off from native modules and from the npm packages and tooling built for Node.js APIs.

node-gtk does run on Node.js, but it is lightly maintained, and strict types are an afterthought coming from (the now deprecated) `ts-for-gir` node support. Its native addon is C++ on the older nan/V8 ABI rather than N-API, and its documentation and examples still center on GTK3.

GTKX takes a different approach. It generates the TypeScript types and the native FFI calls from the same GObject-Introspection data, so the types cannot drift from the calls they back.

A GTKX app is an ordinary Node.js process, so you do everyday work with the Node standard library and npm. Use `node:fs` for files, `fetch` for HTTP, `setTimeout` and `setInterval` for timers, and any package on the registry for the rest. The generated GLib and Gio bindings come in only where the GNOME platform itself is the point: GSettings, desktop notifications, actions, and the `Gio.File` objects a file dialog hands back.

At runtime, the native Rust core acquires the default GLib main context on the Node.js thread and drives it from the libuv event loop, so GTK and your JavaScript share a single thread and every native mutation happens on it. Calls into the system GTK4 and Adwaita libraries go through libffi directly, since the introspection data is consumed when your bindings are generated rather than loaded while the app runs.

## Next

- [Getting Started](/guide/getting-started): scaffold an app and run the dev loop.
- [Configuration and Codegen](/guide/configuration-and-codegen): how `gtkx.config.ts` drives codegen, and how GIR becomes the typed JSX prop model behind every intrinsic element.
- [Tutorial](/tutorial/): build Tasks, a complete GNOME task manager, from your first window to Flathub submission.
- [Components](/guide/components): the high-level components in `@gtkx/components` and the hooks in `@gtkx/react`.
