# What is GTKX?

GTKX is native Linux application development for the modern age: React 19 and TypeScript on one side, real GTK4 and Libadwaita widgets on the other, and vanilla Node.js underneath. There is no Electron and no WebView — a custom React reconciler renders your components directly to GObject widgets through a Rust native module, so what you ship is a genuine GTK application with the full npm ecosystem behind it.

This is what a GTKX app looks like:

```tsx
// src/app.tsx
import { applicationId } from "@gtkx/config/runtime";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { quit } from "@gtkx/react";
import { useState } from "react";

const MainWindow = () => {
    const [count, setCount] = useState(0);

    return (
        <GtkApplicationWindow
            title="My App"
            defaultWidth={400}
            defaultHeight={300}
            onCloseRequest={() => {
                quit();
                return true;
            }}
        >
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} valign={Gtk.Align.CENTER}>
                <GtkLabel label={`Count: ${count}`} cssClasses={["title-2"]} />
                <GtkButton
                    label="Increment"
                    onClicked={() => setCount((c) => c + 1)}
                    cssClasses={["suggested-action", "pill"]}
                />
            </GtkBox>
        </GtkApplicationWindow>
    );
};

export const App = () => (
    <GtkApplication applicationId={applicationId}>
        <MainWindow />
    </GtkApplication>
);
```

The same model scales to full applications. This is the Notes app you build in the [tutorial](/docs/tutorial/1-window-and-header-bar) — Libadwaita navigation, menus, shortcuts, dialogs, and settings, all in React:

![The tutorial Notes app](/media/notes-light.webp){.light-only}
![The tutorial Notes app](/media/notes-dark.webp){.dark-only}

## How it works

GTKX is a stack of small layers. A state update at the top becomes a widget call at the bottom:

```
Your app (JSX)
 ↓
@gtkx/react (reconciler)
 ↓
@gtkx/gi (generated bindings)
 ↓
@gtkx/ffi (runtime)
 ↓
@gtkx/native (Rust/napi-rs/libffi)
 ↓
GTK4/GLib
```

- **Your app (JSX)** — Ordinary React components composing elements imported from `@gtkx/jsx/gtk`, `@gtkx/jsx/adw`, and the other namespace modules.
- **`@gtkx/react`** — A `react-reconciler` host config that maps every tree operation onto instances wrapping real GObject widgets, batching each commit so it appears atomic to GTK.
- **`@gtkx/gi`** — TypeScript classes, property accessors, and signal tables for every library you declare in `gtkx.config.ts`, generated from GObject Introspection (GIR) data.
- **`@gtkx/ffi`** — The hand-written runtime the generated bindings call into: GObject construction, value marshalling, signal connection, and object identity.
- **`@gtkx/native`** — A Rust napi-rs module exposing libffi call primitives, with all GTK work running on a dedicated GLib thread that the JS thread talks to through a mailbox.
- **GTK4/GLib** — The system libraries themselves, resolved by symbol; the widgets on screen are the same ones every GNOME app uses.

## Real React, the whole toolkit, modern tooling

GTKX runs the real React 19 — hooks, Suspense, concurrent rendering, the component model you already know. The reconciler renders to GTK widgets the way `react-dom` renders to DOM nodes, and because the runtime is plain Node.js, the npm ecosystem comes along: data fetching, state management, validation, and anything else you already depend on works unchanged.

The bindings cover the entire GTK4 and Libadwaita surface, generated from the same GObject Introspection data the toolkit publishes. Every class, property, signal, and enum is fully typed, so your editor autocompletes GTK as confidently as it autocompletes the DOM. The same pipeline reaches beyond Gtk and Adw — WebKit, GtkSourceView, Gio, Pango, and more — by adding a line to `gtkx.config.ts`.

The toolchain is the one you expect from a modern web project. `gtkx dev` gives you Vite-powered HMR that preserves application state across edits, `@gtkx/testing` and `@gtkx/vitest` run Testing Library-style tests against real widgets under Xvfb, `@gtkx/css` compiles Emotion-style CSS-in-JS to GTK CSS, and the built-in [MCP server](/docs/mcp) lets AI agents inspect the live widget tree, click, type, and take screenshots of your running app.

## Who is this for?

GTKX is a good fit if you:

- Know React and want to build Linux desktop applications
- Want native performance without learning a completely new toolkit
- Are building applications for the GNOME/Linux ecosystem
- Value developer experience and fast iteration cycles

GTKX may not be the best choice if you:

- Need cross-platform support (Windows, macOS) — GTKX targets Linux exclusively, and that tradeoff is deliberate: one platform, done properly, with real native widgets

## Where to next

- [Getting started](/docs/getting-started) — scaffold a project with the CLI and run it with HMR in a few minutes
- [Tutorial](/docs/tutorial/1-window-and-header-bar) — build the Notes app above, step by step, from a window to a packaged release
- [Widget gallery](/docs/gallery/) — browse the GTK4 and Libadwaita widgets with live code for each
