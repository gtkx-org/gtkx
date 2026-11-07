---
title: "Why GTKX"
description: "Why GTKX exists: React, Fast Refresh, native UI tests, and packaging for GTK and Adwaita apps on Linux."
---

# Why GTKX

In a typical GTK application, code creates the widget tree and then keeps each widget in step with application state by hand: every change in state means finding the affected widgets and calling their setters. Web development moved past this years ago. Declarative components, a dev server with Fast Refresh, tests that query the interface the way a user sees it, and one-command builds are standard there, along with the React and npm ecosystems built around them.

GTKX brings that workflow to native GTK and Adwaita apps. You describe the interface in JSX; GTKX renders real Adwaita and GTK widgets, and React updates them when state changes.

## Why Node.js

GTKX runs your app on Node.js. Node owns the process, and GTKX drives GLib's main loop, which GTK uses for input, drawing, and timers, from Node's event loop on the main thread. Your app is an ordinary Node program, so it can use Node's standard library and npm packages, and GTKX's development and test tooling builds on Vite and Vitest. GLib and Gio bindings cover platform APIs such as settings, actions, and notifications.

Check a package's runtime assumptions before adding it. A browser package may require `window` or `document`; a native Node addon must match the deployment architecture and runtime. Keep expensive computation off the UI thread so the window remains responsive.

## Platform scope

GTKX targets one platform, GTK and Adwaita on Linux, rather than abstracting over several. Your app uses the native libraries' own APIs, not a cross-platform subset of them. GTKX does not provide a Windows, macOS, mobile, or browser renderer.

GTKX generates TypeScript bindings from the native libraries installed for your project. Those bindings describe the available classes, methods, and JSX props. Shipping an app still requires compatible native libraries; see [Deploying](/v2/guide/deploying).

Components render native widgets, so web UI libraries that expect HTML, the DOM, or browser CSS need to be replaced or adapted. React hooks and libraries that work independently of a renderer can be reused. GTK styles use [GTK CSS](/v2/guide/css), whose properties and layout differ from the web.

## Development tools

`npm run dev` opens your app, and Fast Refresh updates the open window as you save while preserving component state. [Tests](/v2/guide/testing) run in Vitest, find widgets by role and name, and click and type into the real native interface on a private headless display. `npm run deploy` builds Flatpak, Debian, RPM, and AppImage packages from your configuration; see [Deploying](/v2/guide/deploying). Coding agents can inspect and drive the running app through the [MCP server](/v2/guide/mcp).

Libraries cover common app structure: [navigation](/v2/guide/navigation) maps React Navigation to native page stacks, tabs, drawers, and split views; [components](/v2/guide/components) render collections and notifications; and [forms](/v2/guide/forms) connect native controls to React Hook Form.

## Credits

GTKX builds on [React](https://react.dev), [Vite](https://vite.dev), [Vitest](https://vitest.dev), [napi-rs](https://napi.rs), and [React Navigation](https://reactnavigation.org). Its GObject APIs follow the names and conventions of [GJS](https://gjs.guide).

## Next

[Getting Started](/v2/guide/getting-started) opens a first window. The [tutorial](/v2/tutorial/) builds Tasks, a task manager with persistence and navigation.
