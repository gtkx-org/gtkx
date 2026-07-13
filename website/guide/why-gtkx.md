---
description: "What GTKX is, why it exists, and how it compares to GJS, node-gtk, and portable UI frameworks like React Native or Electron."
---

# Why GTKX

GTKX lets you build native GTK4 and libadwaita apps in TypeScript, with React components and hooks driving real GObject widgets. No webview, no Electron. This page explains why the project exists and what sets it apart from the other ways of writing GNOME apps in JavaScript.

## A declarative layer for the GNOME stack

GTK4 is mature, and GtkBuilder XML can lay out a static interface, but nothing re-renders that interface when your application state changes, and nothing hot-reloads it as you work. GTKX adds that missing layer, and the tooling around it, on top of the stack you already know:

- a React renderer that exposes every GObject as a JSX element,
- a CLI for scaffolding, development, and production builds,
- a dev server with Fast Refresh that patches your running UI in place,
- CSS-in-JS styling, spring and tween animations, and higher-level list, grid, and dialog components,
- a Testing Library-style API for querying and driving your widgets in tests,
- and a Model Context Protocol (MCP) server that exposes your live app to AI agents.

## The full power of GNOME, not a portable subset

React Native and similar frameworks hide the native toolkit so one API can run everywhere. GTKX does the opposite: it exposes GTK4, libadwaita, and any other GObject-Introspection library on your system, and is Linux-only by design.

Your JSX becomes live GObject instances, an actual `GtkButton`, an actual `AdwHeaderBar`. There is no canvas emulating widgets and no browser engine rendering HTML that imitates them. Apps built with GTKX follow the GNOME Human Interface Guidelines because they are made of the same widgets GNOME apps are made of.

## Why Node, and why generated bindings

GTKX runs on Node.js. The two established ways to reach GTK from JavaScript, GJS and node-gtk, each come with trade-offs GTKX set out to avoid.

GJS is GNOME's own JavaScript runtime, built on SpiderMonkey rather than V8. Because it is a separate runtime from Node, it cuts you off from native modules and from the npm packages and tooling built for Node's APIs.

node-gtk does run on Node, but it is lightly maintained. Its native addon is C++ on the older nan/V8 ABI rather than N-API, and its documentation and examples still center on GTK3.

GTKX takes a different approach. It generates the TypeScript types and the native FFI calls from the same GObject-Introspection data, so the types cannot drift from the calls they back, and they cover the whole GTK4 and libadwaita surface rather than a hand-picked subset.

At runtime, the Rust N-API addon owns the single GLib main loop and calls straight into the system GTK libraries through libffi, without loading libgirepository at all. All native mutation stays on one thread.

## Next

Convinced? The [tutorial](/tutorial/) builds a complete GNOME Tasks app from scaffolding to Flathub submission, or you can jump straight to [Getting Started](/guide/getting-started) and scaffold an app of your own.
