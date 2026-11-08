---
title: "GTKX 2.0 is out"
description: "GTKX 2.0 is the stable release of the 2.x line, with Adwaita bound by default, smaller production builds, GJS-shaped GObject APIs, Storybook, and an upgrade command."
image: /og.png
---

# GTKX 2.0

<p class="post-date">December 1, 2026</p>

GTKX 2.0 is out.

- [Getting Started](/v2/guide/getting-started)
- [Upgrading to 2.0](/v2/guide/upgrading-to-2)
- [Release notes](https://github.com/gtkx-org/gtkx/releases/tag/v2.0.0)

Start a new app with:

::: code-group

```bash [npm]
npm create gtkx@latest
```

```bash [pnpm]
pnpm create gtkx@latest
```

:::

## Why GTKX

Native desktop frameworks are still imperative: code builds the widget tree, then calls setters to keep each widget in step with application state, and none of them can draw on the React ecosystem. Web development has treated declarative components, a dev server with hot reload, automated interface tests and one-command packaging as standard for years.

GTKX brings that workflow to GTK and Adwaita apps. You write React components in TypeScript, and GTKX renders real GTK and Adwaita widgets. Node.js owns the process and runs GLib's main loop inside it, so your app is an ordinary Node program that can use npm packages, and its development and test tools build on Vite and Vitest.

GTKX targets one platform, GTK and Adwaita on Linux, and exposes all of it rather than a cross-platform subset. [Why GTKX](/v2/guide/why-gtkx) explains the design, and [Comparisons](/v2/guide/comparisons) sets it beside GJS, node-gtk, React Native, gtk4-rs and Relm4.

## What changed since 1.6

GTKX 1.6 previewed the 2.0 behaviors behind opt-in flags. In 2.0 they are the only behavior, and the APIs deprecated during 1.x are gone. The [beta](/blog/gtkx-2-0-beta-1) began on September 2; this release includes what it turned up.

### Adwaita by default, smaller builds

GTK and Adwaita are always bound, so `libraries` in `gtkx.config.ts` names only the extra namespaces an app uses. Generated classes register with their own definitions, and production builds keep only the bindings the app reaches. JSX elements come from per-namespace subpaths such as `@gtkx/jsx/gtk` and `@gtkx/jsx/adw`, and an asset is imported from where it lives with a `?resource`, `?icon`, `?font` or `?url` suffix; see [Assets](/v2/guide/assets).

### GObject APIs in the shape of GJS

More of the GObject surface now takes the shape GJS gives it. Variants are built with `new GLib.Variant(signature, value)` and read with `deepUnpack()`, applications run with `application.runAsync(argv)`, record constructors call the record's native `new` constructor, `bindPropertyFull` takes GJS-style transforms, and constructing an object with an unknown property throws a `TypeError`. GJS examples now translate to GTKX with fewer changes.

### Storybook

`gtkx storybook` opens a native Storybook explorer: browse the project's stories, edit their arguments, record actions and see edits live. The same stories run in Vitest as test fixtures. See [Storybook](/v2/guide/storybook).

### Tabbed documents

`createTabViewNavigator` from `@gtkx/navigation` opens any number of documents as tabs in an `AdwTabView`, with a tab bar and a tab overview. See [Tab view navigator](/v2/guide/navigation#tab-view-navigator).

### Testing, packaging and updates

`userEvent` sends keys the way a keyboard does: each key reaches the widget focused at that moment, and keys no widget handles reach the window's bindings, so `{Tab}` moves focus. See [Testing](/v2/guide/testing).

`gtkx deploy --arch x64,arm64` builds packages for both architectures in one run, and `deploy.architectures` sets the default; see [Deploying](/v2/guide/deploying).

`gtkx upgrade` moves every GTKX package in a project or workspace to one release and installs it. From 2.0 on, updating to the next release is one command; see [Updating GTKX](/v2/guide/updating).

## Requirements

GTKX 2.0 requires Node.js 26.7 or newer and React 19.3 or newer, and `@gtkx/testing` requires Vitest 5. Its packages are ESM-only, so applications set `"type": "module"`.

## Upgrading from 1.x

Read [Upgrading to 2.0](/v2/guide/upgrading-to-2) before you move an app. It lists the removed APIs and behavior changes, gives the command that moves every GTKX package to 2.0, and shows how to run it on a release day, when package managers' release-age gates would otherwise pick an older CLI. Security updates for 1.x end with this release; [Releases](/releases) lists the supported lines.

Report anything that worked in 1.6 and fails in 2.0 through the [issue tracker](https://github.com/gtkx-org/gtkx/issues).

## Thank you

GTKX builds on [React](https://react.dev), [Vite](https://vite.dev), [Vitest](https://vitest.dev), [napi-rs](https://napi.rs) and [React Navigation](https://reactnavigation.org), and on the [GTK](https://www.gtk.org) and [Adwaita](https://gnome.pages.gitlab.gnome.org/libadwaita/) libraries that every GTKX app renders. Its GObject APIs follow the names and conventions of [GJS](https://gjs.guide). Thanks to their maintainers, to everyone who tried the beta and reported problems, and to the [Open Collective](https://opencollective.com/gtkx) backers who cover the project's running costs.
