---
title: "Why GTKX"
description: "Native GTK and Adwaita apps with React, TypeScript, and Node.js."
---

# Why GTKX

GTKX builds native Linux applications with React and TypeScript. JSX describes the Adwaita and GTK widgets, and React keeps the native interface in sync with application state.

Start application shells with `AdwApplication` and `AdwApplicationWindow`. GTKX 2 uses `Adw-1` as its default GIR root; Adwaita’s GIR include brings in `Gtk-4.0`.

GTKX generates ESM bindings and TypeScript declarations from the same GIR data. The classes, method signatures, and JSX props reflect the native libraries selected for your project.

## Development tools

- The CLI scaffolds projects, builds applications, and runs a development server with Fast Refresh.
- [CSS](/v2/guide/css) lets you author GTK styles in JavaScript; [animations](/v2/guide/animations) adapt React Spring to native widget props.
- [Navigation](/v2/guide/navigation) integrates React Navigation with native stack, tab, drawer, and split view layouts.
- [Components](/v2/guide/components) provide declarative lists and grids. [Adwaita dialogs](/v2/guide/modals-and-portals) present when mounted and close when unmounted.
- [Testing tools](/v2/guide/testing) query and drive native widgets; the [MCP server](/v2/guide/mcp) exposes the running app to coding agents.

## Why Node.js

A GTKX app runs on Node.js, with access to its standard library and compatible npm packages. Generated GLib and Gio bindings are available alongside them for native file objects, settings, actions, notifications, and other platform APIs.

Keep widget work on the UI thread. Move expensive work off that thread so the application stays responsive.

## Next

- [Getting Started](/v2/guide/getting-started): scaffold an app and run it.
- [Configuration and Codegen](/v2/guide/configuration-and-codegen): select libraries and generate bindings.
- [Tutorial](/v2/tutorial/): build Tasks, a native GNOME task manager.
