# Introduction

Developing native applications for Linux has traditionally been a complex and repetitive process, requiring imperative UI management, complex state synchronization, slow feedback loop, and a limited ecosystem of libraries. GTKX addresses these challenges by providing a React reconciler that renders to GTK4 widgets, and runs natively on vanilla Node.js thanks to a custom Rust/Neon native module. This allows you to leverage the immense ecosystem of React/Node.js libraries and tools while building rich, native applications that integrate seamlessly with the Linux desktop.

## What you get

- **Familiar React API** — Build your UI with the component model and hooks you already know
- **Native performance** — Runs on vanilla Node.js ensuring maximum compatibility with the NPM ecosystem
- **TypeScript support** — Full type safety with auto-generated bindings for GTK4 and many GLib libraries
- **Rich GTK ecosystem** — Access to the full range of GTK4 widgets and GLib/GObject libraries, including Adwaita
- **Fast development** — HMR powered by Vite for a smooth development experience
- **Easy styling** — Style your application with GTK CSS using Emotion's CSS-in-JS API
- **Testing tools** — Testing Library-inspired API for testing components and end-to-end scenarios

## How it works

GTKX uses a multi-layer architecture to bridge the gap between React and GTK:

```
Your app (JSX intrinsic elements)
 ↓
@gtkx/react (reconciler)
 ↓
@gtkx/gi (generated TypeScript bindings)
 ↓
@gtkx/ffi (runtime + GValue/GType)
 ↓
@gtkx/native (Rust/Neon/libffi)
 ↓
GTK4/GLib (native libraries)
```

## Who is this for?

GTKX is a good fit if you:

- Know React and want to build Linux desktop applications
- Want native performance without learning a completely new toolkit
- Are building applications for the GNOME/Linux ecosystem
- Value developer experience and fast iteration cycles

GTKX may not be the best choice if you:

- Need cross-platform support (Windows, macOS) — GTKX targets Linux exclusively

## What's next?

Ready to get started? Head to the [Getting Started](./getting-started.md) guide to create your first GTKX application.

Want to see what's possible? Check out the [gtk-demo example](https://github.com/gtkx-org/gtkx/tree/main/examples/gtk-demo) for a comprehensive widget gallery.
