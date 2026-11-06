---
__default__: patch
---

Hovering or completing a `gtkx.config.ts` field in an editor now shows its documentation, including inside `$development` and `$production` overrides. The published `@gtkx/config` types used to drop every field's description, so `defineConfig` completion showed only types. Each section of the configuration also has its own exported type, such as `DeployOptions`, `DeployFlatpakOptions` and `DeployScriptsOptions`.
