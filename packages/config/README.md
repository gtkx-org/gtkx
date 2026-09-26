# @gtkx/config

Typed application configuration for GTKX.

Use `defineConfig` in `gtkx.config.ts` to declare the application ID, native libraries, resources, and deployment settings. The CLI loads this configuration for development, code generation, and builds.

```ts
import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.example.MyApp",
});
```

[Guide](https://gtkx.dev/v2/guide/configuration-and-codegen) · [API reference](https://gtkx.dev/v2/reference/@gtkx/config/) · [GTKX](https://gtkx.dev)

GTKX runs on Linux with Node.js and system native libraries. See [Getting Started](https://gtkx.dev/v2/guide/getting-started) for supported versions and installation. This README describes the 2.0 beta.

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
