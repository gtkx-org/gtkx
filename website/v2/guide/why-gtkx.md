---
title: "Why GTKX"
description: "Where GTKX fits: native Linux interfaces, React state, and Node.js libraries."
---

# Why GTKX

GTKX builds native Linux applications with React and TypeScript. JSX creates Adwaita and GTK widgets; React keeps them in sync with application state. Choose it when you want a Linux desktop interface and a React development workflow.

## Platform scope

GTKX supports Linux. Its widgets follow GTK and Adwaita conventions and can run on Linux desktops with the required libraries. It does not provide a Windows, macOS, mobile, or browser renderer.

Components render native widgets, so web UI libraries that expect HTML, the DOM, or browser CSS need to be replaced or adapted. React hooks and libraries that work independently of a renderer can be reused. GTK styles use [GTK CSS](/v2/guide/css), whose properties and layout differ from the web.

GTKX generates TypeScript bindings from the native libraries installed for your project. Those bindings describe the available classes, methods, and JSX props. Shipping an app still requires compatible native libraries; see [Deploying](/v2/guide/deploying).

## Why Node.js

An app runs on Node.js and can use its standard library and compatible npm packages. GLib and Gio bindings are also available for platform APIs such as settings, actions, and notifications.

Check a package's runtime assumptions before adding it. A browser package may require `window` or `document`; a native Node addon must match the deployment architecture and runtime. Keep expensive computation off the UI thread so the window remains responsive.

## Development tools

- The CLI scaffolds projects, runs Fast Refresh, and builds application bundles and Linux packages.
- [Navigation](/v2/guide/navigation) maps React Navigation to native page stacks, tabs, drawers, and split views.
- [Components](/v2/guide/components) render collections and notifications; [forms](/v2/guide/forms) connect native controls to React Hook Form.
- [Testing](/v2/guide/testing) drives the native interface. The [MCP server](/v2/guide/mcp) lets coding agents inspect widgets, interact with the app, and capture screenshots.

## Next

[Getting Started](/v2/guide/getting-started) opens a first window. The [tutorial](/v2/tutorial/) builds Tasks, a task manager with persistence and navigation.
