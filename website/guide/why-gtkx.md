---
title: "Why GTKX"
description: "Native GTK and Adwaita apps with React, TypeScript, and Node.js."
---

# Why GTKX

GTKX builds native Linux applications with React and TypeScript. JSX describes the Adwaita and GTK widgets, and React keeps the native interface in sync with application state.

Start application shells with `AdwApplication` and `AdwApplicationWindow`. GTKX 1.x binds `Gtk-4.0` by default; enabling `v2DefaultLibraries` also binds `Adw-1`.

GTKX generates ESM bindings and TypeScript declarations from the same GIR data. The classes, method signatures, and JSX props reflect the native libraries selected for your project.

## Development tools

- The CLI scaffolds projects, builds applications, and runs a development server with Fast Refresh.
- [CSS](/guide/css) lets you author GTK styles in JavaScript; [animations](/guide/animations) adapt React Spring to native widget props.
- [Navigation](/guide/navigation) integrates React Navigation with native stack, tab, drawer, and split view layouts.
- [Components](/guide/components) provide declarative lists and grids. [Adwaita dialogs](/guide/modals-and-portals) present when mounted and close when unmounted.
- [Testing tools](/guide/testing) query and drive native widgets; the [MCP server](/guide/mcp) exposes the running app to coding agents.

## Why Node.js

A GTKX app runs on Node.js, with access to its standard library and compatible npm packages. Generated GLib and Gio bindings are available alongside them for native file objects, settings, actions, notifications, and other platform APIs.

Keep widget work on the UI thread. Move expensive work off that thread so the application stays responsive.

## Next

- [Getting Started](/guide/getting-started): scaffold an app and run it.
- [Configuration and Codegen](/guide/configuration-and-codegen): select libraries and generate bindings.
- [Tutorial](/tutorial/): build Tasks, a native GNOME task manager.
