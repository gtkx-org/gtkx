## 2.0.0-beta.12 (2026-10-21)

### 🚀 Features

- Export `flushSync` for native signals that synchronously return JSX-created objects. Preserve independently rendered tab content when its original window closes, and support parent-page relationships in JSX. ([#841](https://github.com/gtkx-org/gtkx/pull/841))
- Add `createTabCollection` for tabs that preserve React state when moved between windows. Support declarative tab pinning, extra drop targets, `textDirection`, About dialog metadata, and updates to custom layout callbacks. ([#841](https://github.com/gtkx-org/gtkx/pull/841))

  Preserve controlled values when JSX models or adjustments change, and retain page content through transfers and child replacement. Allow menu-button content alongside popovers, and update check-button accessible names when mnemonic handling changes.

  Load imported stylesheets in development and production, and reload stylesheet edits during development.

- Subscribe to GLib log messages with `onLog` from `@gtkx/runtime`, and use its `keepAlive` API for native work in helper processes. ([#831](https://github.com/gtkx-org/gtkx/pull/831))

  Create and stop MCP servers programmatically with `createMcpServer` from `@gtkx/mcp/server`, including custom transports. Cancel `runMcpServer` with an `AbortSignal`.

- Expand generated bindings to support nested string arrays, container input/output parameters, caller-allocated arrays, records passed by value, and callback-valued properties. Fix property, signal, and virtual-function argument conversion, and keep returned collections and Cairo paths usable after their source objects are collected. ([#831](https://github.com/gtkx-org/gtkx/pull/831))

### 🩹 Fixes

- Prevent failures when repeated object callbacks traverse large collections, including searches in `Gio.ListStore`. ([#779](https://github.com/gtkx-org/gtkx/pull/779))
- Preserve original error details when reporting asynchronous, Storybook, and MCP failures. ([#860](https://github.com/gtkx-org/gtkx/pull/860))
- Document configuration fields and nested options, preserve their descriptions in the API reference, and link declarations to their original source files on GitHub. ([#783](https://github.com/gtkx-org/gtkx/pull/783))
- Prevent crashes when native events schedule React transitions. ([#781](https://github.com/gtkx-org/gtkx/pull/781))
- Clarify package descriptions and search keywords for native rendering, generated bindings, testing, and application tooling. ([#859](https://github.com/gtkx-org/gtkx/pull/859))
- Hide inactive drawer and tab pages from assistive technologies, including preloaded pages, so screen readers expose only the focused screen. ([#778](https://github.com/gtkx-org/gtkx/pull/778))
- Allow tab and drawer labels to opt into keyboard mnemonics while preserving plain header titles and accessible names. Support native mnemonic activation in keyboard test interactions. ([#793](https://github.com/gtkx-org/gtkx/pull/793))
- Report a missing `sway` or `dbus-daemon` before tests, headless development, or headless Storybook sessions start, with an install command on recognized distributions. When creating a project with tests, `create-gtkx` lists any that are missing the same way. ([#870](https://github.com/gtkx-org/gtkx/pull/870))
- Wait for the headless compositor to accept connections before initializing its virtual input devices, preventing intermittent test worker startup failures. ([#835](https://github.com/gtkx-org/gtkx/pull/835))
- Restart development sessions when imported URL assets change so binary assets reload without being parsed as JavaScript, and recover when missing URL assets are recreated. ([#780](https://github.com/gtkx-org/gtkx/pull/780))
- Signal handlers see updated props when native property changes emit notifications during a React update. ([b45674d7](https://github.com/gtkx-org/gtkx/commit/b45674d7))
- Headless development and test sessions no longer require `setpriv`. After a forced termination, recover abandoned sessions on the next startup or with `gtkx cleanup`. ([#850](https://github.com/gtkx-org/gtkx/pull/850))
- Fix ComboRow crashes in production bundles, preserve native values when signal handlers return nothing, and marshal output parameters correctly in subclass signal handlers. ([#811](https://github.com/gtkx-org/gtkx/pull/811))

### ⚠️  Breaking Changes

- Always run headless displays on Sway, removing the Vitest plugin's `compositor` option and the `CompositorId` type. Delete the option and any `CompositorId` imports; tests need Sway installed. ([#870](https://github.com/gtkx-org/gtkx/pull/870))
- Publish generated bindings through one snapshot, regenerate legacy stores, and remove obsolete JSX during GI-only generation. Restart development apps for import or bundled-asset changes while retaining Fast Refresh for component edits. Simplify configuration dependency tracking and translation extraction. ([#863](https://github.com/gtkx-org/gtkx/pull/863))
- For applications using generated bindings without React, replace `createApplication(ApplicationClass, props)` and `ApplicationClass.create(props)` with `new ApplicationClass(props)`. Use `getIsRegistered()` and `getIsRemote()` in place of registration-state helpers, and observe completion through `runAsync(argv)`. Pass an argument array or `null`; omitting the argument is an error. The associated application helper types are removed. React applications continue to declare their application in JSX. ([#813](https://github.com/gtkx-org/gtkx/pull/813))

  Replace the removed `runApplication` and `quitApplication` helpers with applications' `runAsync(argv): Promise<number>` and `quit()` methods. `RunApplicationResult` is removed. Node remains the outer event loop. Applications finish automatically when no application windows or outstanding JavaScript holds remain, respecting inactivity timeouts and the initial service grace period. Balance `hold()` with `release()` to keep background work alive, or call `quit()` to force shutdown. GTKX cannot observe holds acquired directly by native C code.

  Replace `toVariant` and `fromVariant` with GJS-style `GLib.Variant` construction and unpacking methods. Dictionaries use objects for every key type; 64-bit values remain exact bigints. Import Variant types from `@gtkx/gi/glib`; the byte-array type is now `VariantByteArray` and conversion options types are removed.

  Replace `GObject.paramSpecOverride` with `GObject.ParamSpec.override`.

  Generated methods support nullable receivers where declared by GIR.

- Remove the generated `GObject.Closure.sink()` and `GObject.ParamSpec.sink()` methods. Delete these calls from applications; reference management is automatic. ([#840](https://github.com/gtkx-org/gtkx/pull/840))
- Require ESM for application and configuration modules, including generated bindings. Convert local CommonJS files to ESM and use erasable TypeScript in configuration. Storybook main configuration accepts `.ts`, `.mts`, `.js`, and `.mjs`; previews and stories retain JSX support. External CommonJS dependencies remain supported through ESM imports. ([771acfea](https://github.com/gtkx-org/gtkx/commit/771acfea))

### ❤️ Thank You

- Eugenio Depalo @eugeniodepalo
- eugeniodepalo @eugeniodepalo

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