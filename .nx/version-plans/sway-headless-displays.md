---
__default__: major
---

Always run headless displays on Sway, removing the Vitest plugin's `compositor` option and the `CompositorId` type. Delete the option and any `CompositorId` imports; tests need Sway installed.
