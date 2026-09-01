---
title: "Why GTKX"
description: "Build native GTK4 applications with React, TypeScript, and Node.js."
---

# Why GTKX

GTKX combines GTK4 and Adwaita with React's component and state model. Its generated bindings keep TypeScript, native calls, and JSX props aligned with the GIR libraries installed for the project.

The toolchain provides Fast Refresh, production bundling, native navigation and collections, CSS-in-JS, animations, Testing Library-style integration tests, packaging, and a live-app MCP server. These features stay optional; a basic app needs only `@gtkx/react` and generated bindings.

## Why Node.js

A GTKX app is a Node.js process. Use the standard library and npm for ordinary application work, and GLib or Gio for platform integration such as settings, notifications, actions, and native file objects.

GTK and JavaScript share one thread. Keep widget work there and move CPU-heavy work to a [worker thread](/guide/async-operations#move-cpu-work-off-the-ui-thread).

Start with [Getting Started](/guide/getting-started), or [build the Tasks tutorial](/tutorial/).
