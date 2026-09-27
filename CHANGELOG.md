## 2.0.0-beta.11 (2026-09-27)

### 🚀 Features

- Add a native Storybook explorer with controls, actions, live story updates, and portable CSF3 fixtures. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#655](https://github.com/gtkx-org/gtkx/pull/655).

- Update dependencies for React 19.3 and Vite 8.3, support pnpm 12 in offline Flatpak builds, and bundle Node.js 26.8.2 by default. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#672](https://github.com/gtkx-org/gtkx/pull/672).


### 🩹 Fixes

- Update JavaScript and Rust dependencies and CI actions. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#689](https://github.com/gtkx-org/gtkx/pull/689).

- Strengthen ESLint policy and package type dependencies, correct native build caching, and verify staged release artifacts and complete package channel promotion. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#765](https://github.com/gtkx-org/gtkx/pull/765).

- Fix GitHub release draft validation and retry handling before publishing packages. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))
- Polish GTKX 2.0 foundations, framework packages, navigation, forms, components, tutorials, code generation, development tooling, deployment, native ownership, integration testing, runtime contracts, examples, declarative integration, GTK Demo, and application behavior. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#699](https://github.com/gtkx-org/gtkx/pull/699).

- Replace native pointer integers with lifetime-checked handles, move class and call policy into the runtime, and centralize generated override implementations and shared metadata. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#699](https://github.com/gtkx-org/gtkx/pull/699).

- Validate and read build and deploy ownership markers through one file descriptor. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#720](https://github.com/gtkx-org/gtkx/pull/720).

- Publish package-specific READMEs and clarify public API documentation. Clarify CLI and inspection-tool help, and use Linux in the scaffolded application description. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#763](https://github.com/gtkx-org/gtkx/pull/763).

- Reduce temporary allocations in native calls and accessibility queries. Give drawer rows accessible names, and include inherited accessibility properties in generated JSX types and reference documentation. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#764](https://github.com/gtkx-org/gtkx/pull/764).

- Update JavaScript and Rust dependencies. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Original change: [#698](https://github.com/gtkx-org/gtkx/pull/698).

### ⚠️  Breaking Changes

- Consolidate Toast controls into `useToast().show()` and `useToast().dismissAll()`, with individual dismissal through the returned toast. Restrict native exports to supported operations, move the generated wrapper-retention helper to the runtime internal entrypoint, isolate testing renderer errors by root, and centralize configuration dependency tracking. Allow TODO/FIXME comments and link upstream workarounds to their removal trackers. ([6b64c78c](https://github.com/gtkx-org/gtkx/commit/6b64c78c))

  Restrict synthetic record construction to supported initialization contracts, preserve field-allocation cleanup, and expose `GLib.String` storage fields as readonly. Native bigint codecs require bigint inputs; runtime bindings continue normalizing valid Number inputs. Render persistent collection models through JSX and share native-addon resolution between build and deployment.

  Original change: [#759](https://github.com/gtkx-org/gtkx/pull/759).

### ❤️ Thank You

- Eugenio Depalo @eugeniodepalo