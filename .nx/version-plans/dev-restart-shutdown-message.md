---
__default__: patch
---

`gtkx dev` and `gtkx storybook` no longer print `Received shutdown signal - stopping dev runner...` when they restart the application after a dependency install or a configuration change. The line now appears only when the session is actually stopped, such as with Ctrl+C.
