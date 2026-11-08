---
title: "Comparisons"
description: "How GTKX compares with GJS, node-gtk, React Native, gtk4-rs and Relm4, and Electron and Tauri for building desktop apps."
---

# Comparisons

Several projects build GTK and Adwaita apps, or desktop apps with React and web technologies. This page describes how each one differs from GTKX in design and scope, and when it is the better fit.

## GJS

[GJS](https://gjs.guide) is GNOME's JavaScript runtime. It embeds Firefox's SpiderMonkey engine, and GNOME Shell and many GNOME apps are written with it. Your JavaScript runs inside GLib's main loop, in a runtime that implements neither the Node.js APIs nor most Web APIs. npm packages that depend on those APIs, and tools that run on Node.js such as Vitest, don't work with a GJS app.

GTKX reverses that arrangement: Node.js owns the process, and GLib's main loop runs inside it (see [Why Node.js](/v2/guide/why-gtkx#why-node-js)). The app is an ordinary Node.js program, so it can use npm packages, Vite and Vitest. GTKX's GObject APIs follow GJS's names and conventions, so knowledge of GJS carries over.

GJS is the better fit for [GNOME Shell extensions](https://gjs.guide/extensions/), which run inside GNOME Shell's own GJS, and for apps that should use the runtime GNOME already provides: a GJS app's Flatpak takes GJS from the GNOME runtime, while a GTKX package includes Node.js.

## node-gtk

[node-gtk](https://github.com/romgrk/node-gtk) also runs GTK inside a Node.js process, through GObject Introspection bindings. Its API is imperative: code creates widgets and calls their methods to keep them in step with state. It is built on Nan rather than [Node-API](https://nodejs.org/api/n-api.html), the interface that lets an addon compiled for one Node.js major version run on later ones without recompiling, and it generates TypeScript declarations on request. It also ships a project scaffolder, CSS hot reloading and Flatpak bundling.

GTKX renders declarative React components, and its native addon is written in Rust on Node-API. It is TypeScript-first: [codegen](/v2/guide/configuration-and-codegen) generates typed bindings and JSX props for the libraries your project uses.

## React Native

[React Native](https://reactnative.dev) builds native apps with React. Its core targets Android and iOS, and separately maintained [out-of-tree platforms](https://reactnative.dev/docs/out-of-tree-platforms) add others such as macOS and Windows; none of them renders GTK or Adwaita. Its components abstract over the differences between platforms, which makes it the better fit when one codebase must run on several of them.

GTKX targets one platform and exposes all of it: every GTK and Adwaita widget and API the installed libraries provide, under its native name. Readers who know React Native will recognize [navigation](/v2/guide/navigation), which maps React Navigation to Adwaita page stacks, tabs, drawers and split views.

## gtk4-rs and Relm4

[gtk4-rs](https://gtk-rs.org/gtk4-rs/) is the Rust binding for GTK 4. Code builds and updates widgets imperatively, or loads them from UI templates. [Relm4](https://relm4.org) builds on gtk4-rs with an Elm-inspired component model and a `view!` macro that declares the UI. Both suit apps written in Rust. Neither provides hot reloading, a dev server or UI test automation; gtk4-rs's `#[gtk::test]` attribute runs a test on the GTK main thread, and driving the interface is left to the test.

GTKX includes those tools along with React: a dev server with Fast Refresh, [tests](/v2/guide/testing) that find widgets by role and name and click and type into the real interface on a headless display, and [packaging](/v2/guide/deploying) for Flatpak, Debian, RPM and AppImage.

## Electron and Tauri

[Electron](https://www.electronjs.org) and [Tauri](https://tauri.app) build desktop apps whose interface is a web page written in HTML, CSS and JavaScript. Electron bundles Chromium and Node.js into each app. Tauri renders in the operating system's webview, WebKitGTK on Linux, and runs backend logic in Rust. Both build for Windows, macOS and Linux from one codebase, and Tauri also builds for Android and iOS.

GTKX renders native GTK and Adwaita widgets instead of a web page, so an app gets the platform's look, accessibility and desktop integration, on Linux only. Its React components create widgets rather than DOM elements, so UI libraries that render to the DOM don't apply.

Electron and Tauri are the better fit when one web codebase must run on several desktop platforms, or when the interface reuses DOM UI libraries.
