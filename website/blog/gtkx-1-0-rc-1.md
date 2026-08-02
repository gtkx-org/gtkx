---
title: "GTKX 1.0 RC1: a flexible React platform for the GNOME stack"
description: "GTKX 1.0.0-rc.1 reworks the framework from the ground up: bindings generated on your machine from GObject-Introspection, a DOM-like React lifecycle, a single-threaded native Rust core, and new component and OpenGL packages."
head:
  - - meta
    - property: og:type
      content: article
---

# GTKX 1.0 RC1: a flexible React platform for the GNOME stack

<p class="post-date">July 14, 2026</p>

GTKX 1.0.0-rc.1 is a ground-up rework of the framework since v0.21.0. What started as a React reconciler for a curated set of GTK4 widgets is now a general platform for driving GLib and GObject from TypeScript: the GObject instances your JSX creates, the entire introspected API surface of the libraries installed on your machine, and the React programming model on top.

This is a release candidate: the API described here is what 1.0 will ship.

## Bindings are generated on your machine, for any GObject-Introspection library

The central change in 1.0 is where bindings come from. Previous versions shipped pregenerated bindings for a fixed set of libraries (GTK4, Adwaita, WebKit, GtkSourceView, VTE, GES) baked into `@gtkx/ffi`. That set was whatever GTKX chose to build, and it could drift from the GTK4 actually installed on your system.

Now the GTKX CLI runs codegen on your machine, reading the GObject-Introspection (`.gir`) data already installed with your development libraries. You declare which libraries you want in `gtkx.config.ts`:

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
  libraries: ["Gtk-4.0", "Adw-1"],
  applicationId: "com.example.myapp",
});
```

Codegen emits packages into `node_modules` and links them as `@gtkx/gi` and `@gtkx/jsx`, so you never install them from npm:

- `@gtkx/gi/<namespace>` gives you fully typed TypeScript classes: `@gtkx/gi/gtk`, `@gtkx/gi/adw`, `@gtkx/gi/gio`, `@gtkx/gi/cairo`, and so on, with typed per-class signal maps, constructor-property interfaces, and interface mixins.
- `@gtkx/jsx/<namespace>` gives you one React component per widget, with typed props.

Set `libraries: "*"` and GTKX binds every introspection library it can find on the system, resolving transitive dependencies automatically. To bind WebKit, VTE, or GStreamer, install the development package and add it to the list. The bindings always match your installed GTK4, and a content fingerprint of the `.gir` files triggers regeneration when the system updates underneath you.

## A React model that mirrors React DOM

Applications now boot the way a React DOM app does. `createRoot().render()` mounts a tree, and the GTK4 application itself is a component:

```tsx
import { GtkApplication, GtkApplicationWindow, GtkButton } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";

createRoot().render(
  <GtkApplication>
    <GtkApplicationWindow title="Hello GTKX" onCloseRequest={quit}>
      <GtkButton label="Click me" onClicked={() => console.log("clicked")} />
    </GtkApplicationWindow>
  </GtkApplication>,
);
```

The reconciler was rewritten from hand-written per-widget node classes into a single generic reconciler that instantiates GObject classes by type and drives child attachment from generated metadata.

Because every element is a GObject, JSX composes in ways it could not before. Any element passed as a prop value is mounted and assigned to that property: a text view takes `buffer={<GtkTextBuffer>...</GtkTextBuffer>}`, a scale takes `adjustment={<GtkAdjustment .../>}`, and controllers, layout managers, and menu models are all declarative props.

Signals are typed end to end, including `notify::<property>` details. A new `useSignal` hook connects handlers, and `useSetting` is now typed against imported GSettings schemas.

## High-level building blocks

Hand-written high-level components moved out of the reconciler into focused packages:

- **`@gtkx/components`** ships declarative collection views (`ListView`, `GridView`, `ColumnView`, `DropDown`) with controlled selection, plus section headers on `ListView`, `ColumnView`, and `DropDown`, and tree expansion on `ListView` and `ColumnView`. It also ships a `Menu` builder over `Gio.Menu` and layout helpers (`Grid`, `Fixed`, `Overlay`, `SizeGroup`, `ConstraintLayout`).
- **`@gtkx/css`** was rebuilt on the stylis compiler for correct nested selectors and at-rule handling.

## A native core rebuilt for one thread

The native module was rewritten from a two-thread Neon addon into a single-threaded napi-rs design. The default GLib main context is now acquired on the Node thread and driven directly from libuv, so GTK4 and JavaScript share one thread with no cross-thread marshaling. The crate no longer links GTK4 at all: it links only GLib and loads every other library on demand, which is what makes GTKX a general GObject bridge rather than a GTK4-specific one.

Error handling improved across the boundary. GLib criticals, native failures, and Rust panics now surface as Node fatal exceptions instead of being swallowed or reduced to a message string, and exceptions thrown in your signal handlers propagate with their original stack. On top of the FFI runtime in `@gtkx/runtime` you can now subclass any GObject from TypeScript with `registerClass`, including virtual-function overrides, and bind arbitrary native functions with the typed `t` descriptor DSL.

OpenGL moved into its own `@gtkx/gl` package, generated from the Khronos registry to cover the full OpenGL 4.6 core profile.

## Tooling

The CLI is driven by `gtkx.config.ts`, and 1.0 fills out the toolchain around it:

- **CLI and build:** `gtkx codegen` and `gtkx docs` commands, a supervised dev server that restarts the process when a change is not Fast Refresh safe, a GResource-based asset pipeline (`import icon from "#data/icon.png"`), typed GSettings schema imports, and React Compiler on by default.
- **Scaffolding:** a standalone `create-gtkx` initializer.
- **Testing:** `@gtkx/testing` grew into a near-complete Testing Library port for GTK4, with the full `getBy`/`queryBy`/`findBy` matrix, widget matchers, automatic cleanup, Playwright-style actionability checks on every interaction, and a `userEvent` API that roughly doubled to cover clipboard, drag and drop, gestures, and scrolling. `@gtkx/vitest` swapped Xvfb for a per-worker headless Wayland compositor.
- **AI and docs:** the `@gtkx/mcp` server gained tools and resources that let an AI assistant browse your project's generated API reference, and this site was rebuilt around a new [guide](/guide/why-gtkx), a hands-on [tutorial](/tutorial/) that takes a complete GNOME "Tasks" app all the way to a Flathub submission, and an [API reference](/reference/) covering the core packages.

## Breaking changes

Almost every import path changed. Widgets now come from `@gtkx/jsx/<namespace>` instead of `@gtkx/react`, and typed classes and enums from `@gtkx/gi/<namespace>` instead of `@gtkx/ffi/<namespace>`. Apps boot with `createRoot()` and an explicit `<GtkApplication>` instead of `render(element, appId)`. Project configuration moved from a `package.json` field to `gtkx.config.ts`, high-level components moved to `@gtkx/components`, and the minimum supported Node.js is now 24. The [guide](/guide/why-gtkx) documents the current API in full, and the [tutorial](/tutorial/) builds a complete app from scratch.

## Try the release candidate

```bash
npm create gtkx@rc
```

The RC is published under the `rc` dist-tag, so ask for it by name: `@latest` still resolves to the current stable release. The initializer scaffolds a project pinned to the RC. You will need Linux with the GTK4 and GLib development libraries, Adwaita once you add `Adw-1`, and Node.js 24 or later. Existing projects should follow the [guide](/guide/getting-started); the import-path and lifecycle changes are mechanical, and the CLI reports actionable errors when a system introspection package is missing.

## The road to 1.0

This candidate is the shape of 1.0. Before the final release, report where the migration is rough, where the generated bindings surprise you, and what is missing from the new component and testing APIs. Open a thread in [GitHub Discussions](https://github.com/gtkx-org/gtkx/discussions) or file an issue on the [tracker](https://github.com/gtkx-org/gtkx/issues). Thank you to everyone who tested the pivots along the way.
