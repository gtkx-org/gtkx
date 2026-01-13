# Introduction

GTKX is a framework for building native Linux desktop applications using React and TypeScript. Instead of rendering to a browser DOM or webview, your React components render as native GTK4 widgets through a Rust FFI bridge.

## Why GTKX?

If you're a React developer who wants to build Linux desktop applications, you typically have two choices:

1. **Electron** — Bundle an entire Chromium browser with your app. Works, but results in 150MB+ bundles and web-based UI that doesn't feel native.

2. **Learn a new toolkit** — Pick up GTK, Qt, or another native toolkit from scratch. Powerful, but steep learning curve if you're coming from web development.

GTKX offers a third path: use the React patterns you already know to build applications with native GTK4 widgets. You get the developer experience of React with the performance and integration of native applications.

## What you get

- **Familiar React patterns** — Hooks, JSX, component composition, state management. If you know React, you know most of GTKX.

- **Native GTK4 widgets** — Real native controls rendered by GTK, not HTML elements styled to look native. Your app integrates properly with the Linux desktop.

- **Adwaita styling** — First-class support for Libadwaita, GNOME's design system. Build modern, polished applications that fit the Linux desktop.

- **Hot Module Replacement** — Fast refresh during development. See your changes instantly without losing application state.

- **TypeScript first** — Full type safety with auto-generated type definitions from GTK's introspection data.

## How it works

GTKX uses a custom React reconciler that translates React operations into GTK widget operations:

```
React Components (JSX)
 ↓
@gtkx/react (reconciler)
 ↓
@gtkx/ffi (TypeScript bindings)
 ↓
@gtkx/native (Rust/Neon)
 ↓
GTK4 Widgets
```

When you write:

```tsx
<GtkButton label="Click me" onClicked={() => console.log("clicked")} />
```

GTKX creates a native `GtkButton` widget, sets its label property, and connects a signal handler for the `clicked` signal. The React reconciler handles updates efficiently, only changing properties that actually changed.

## Who is this for?

GTKX is a good fit if you:

- Know React and want to build Linux desktop applications
- Want native performance without learning a completely new toolkit
- Are building applications for the GNOME/Linux ecosystem
- Value developer experience and fast iteration cycles

GTKX may not be the best choice if you:

- Need cross-platform support (Windows, macOS) — GTKX targets Linux
- Are building performance-critical applications like games or video editors
- Prefer a non-React approach to UI development

## What's next?

Ready to get started? Head to the [Getting Started](./getting-started.md) guide to create your first GTKX application.

Want to see what's possible? Check out the [gtk-demo example](https://github.com/eugeniodepalo/gtkx/tree/main/examples/gtk-demo) for a comprehensive widget gallery.
