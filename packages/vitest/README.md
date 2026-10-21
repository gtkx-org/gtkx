# @gtkx/vitest

Run GTKX tests in isolated headless displays.

The Vitest plugin gives each worker a private Wayland display and D-Bus session. It requires Sway, `dbus-daemon`, and the native GTKX dependencies. Use `@gtkx/testing` to render and interact with widgets.

Scaffolded projects use the `@gtkx/cli/vitest-plugin` entry point. For direct use, install `@gtkx/vitest@beta` as a development dependency and configure its default export:

```ts
import gtkx from "@gtkx/vitest";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx()],
});
```

[Guide](https://gtkx.dev/v2/guide/testing) · [API reference](https://gtkx.dev/v2/reference/@gtkx/vitest/) · [GTKX](https://gtkx.dev)

GTKX requires Linux, Node.js, and the [native prerequisites](https://gtkx.dev/v2/guide/getting-started).

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
