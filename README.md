<p align="center">
  <img src="https://raw.githubusercontent.com/gtkx-org/gtkx/main/logo.svg" alt="GTKX" width="100" />
</p>

<h1 align="center">GTKX</h1>

<p align="center">
  The React framework for Linux<br />
  Build native apps with React, TypeScript, and Adwaita widgets.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/create-gtkx"><img src="https://img.shields.io/npm/v/create-gtkx?color=cb3837&logo=npm&label=create-gtkx" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/create-gtkx"><img src="https://img.shields.io/npm/dm/create-gtkx?color=cb3837&logo=npm&label=downloads" alt="npm downloads" /></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A526.7-339933?logo=node.js&logoColor=white" alt="Node >= 26.7" />
  <a href="https://github.com/gtkx-org/gtkx/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="License: MPL-2.0" /></a>
  <a href="https://github.com/gtkx-org/gtkx/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/gtkx-org/gtkx/ci.yml?branch=main&logo=github&label=CI" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<p align="center">
  <a href="https://gtkx.dev">Homepage</a> &middot;
  <a href="https://gtkx.dev/v2/guide/getting-started">Documentation</a> &middot;
  <a href="https://github.com/gtkx-org/gtkx/tree/main/examples">Examples</a> &middot;
  <a href="https://gtkx.dev/contributing/">Contributing</a> &middot;
  <a href="https://opencollective.com/gtkx">Sponsor</a>
</p>

## Start an app

This branch develops **GTKX 2.0**, currently in beta. The stable release is scheduled for **1 December 2026**. For the current stable release, use the [1.x documentation](https://gtkx.dev/guide/getting-started).

You need Linux, Node.js 26.7 or later, GTK 4.20 or later, libadwaita 1.8 or later, and the native development libraries. Follow [Getting Started](https://gtkx.dev/v2/guide/getting-started) to install and check them before scaffolding:

```sh
npm create gtkx@beta my-app
cd my-app
npm run dev
```

The native addon ships prebuilt for x64 and arm64 glibc Linux. Other targets require building it from the repository with Rust.

## Build with React

GTKX renders native Adwaita and GTK widgets. Use React state and events to update them, Node.js for filesystem and network access, and npm packages that do not require a browser DOM.

This is a complete entry point in a scaffolded app:

```tsx
import {
  AdwApplication, AdwApplicationWindow,
  AdwHeaderBar, AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";

const App = () => (
  <AdwApplication>
    <AdwApplicationWindow title="My App" onCloseRequest={() => quit()}>
      <AdwToolbarView topBar={<AdwHeaderBar />}>
        <GtkLabel>Hello from GTKX</GtkLabel>
      </AdwToolbarView>
    </AdwApplicationWindow>
  </AdwApplication>
);

createRoot().render(<App />);
```

The CLI generates `@gtkx/jsx` elements and `@gtkx/gi` bindings from your configured native libraries. They are local to the app, not installed from npm.

## Learn GTKX

<p align="center">
  <img src="https://raw.githubusercontent.com/gtkx-org/gtkx/main/examples/tutorial/assets/screenshot.png" alt="The Tasks app: an Adwaita window with a sidebar of smart views and colored lists on the left, and a boxed task list on the right." />
</p>

<p align="center">
  <em>The Tasks app you build in the <a href="https://gtkx.dev/v2/tutorial/">tutorial</a>.</em>
</p>

- [Tutorial](https://gtkx.dev/v2/tutorial/): build the Tasks app, test it, and package it for distribution.
- [Guides](https://gtkx.dev/v2/guide/why-gtkx): forms, navigation, animation, styling, testing, and deployment.
- [API reference](https://gtkx.dev/v2/reference/): GTKX package exports. Widget props are documented in the generated `.gtkx/reference/` in your app.
- [Examples](https://github.com/gtkx-org/gtkx/tree/main/examples): a counter, browser, widget showcase, animations, navigation, and component stories.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks, the [Code of Conduct](CODE_OF_CONDUCT.md), and the [security policy](SECURITY.md). Architecture and maintainer procedures are in the [contributor docs](https://gtkx.dev/contributing/).

## Support GTKX

[Contribute through Open Collective](https://opencollective.com/gtkx) to help cover recurring costs. Our [funding plan](FUNDING.md) explains expenses, fees, and the operating reserve.

## License

[MPL-2.0](LICENSE).
