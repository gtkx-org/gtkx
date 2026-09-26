# @gtkx/vitest

Run GTKX tests in isolated headless displays.

The Vitest plugin gives each worker a private Wayland display and D-Bus session. It requires a supported compositor and the native GTKX dependencies. Use `@gtkx/testing` to render and interact with widgets.

Scaffolded projects use the `@gtkx/cli/vitest-plugin` entry point. To configure the plugin directly, import `gtkx` from `@gtkx/vitest` and add `gtkx()` to the `plugins` array in `vitest.config.ts`.

[Guide](https://gtkx.dev/v2/guide/testing) · [API reference](https://gtkx.dev/v2/reference/@gtkx/vitest/) · [GTKX](https://gtkx.dev)

GTKX runs on Linux with Node.js and system native libraries. See [Getting Started](https://gtkx.dev/v2/guide/getting-started) for supported versions and installation. This README describes the 2.0 beta.

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
