---
__default__: patch
---

`gtkx dev` and `gtkx storybook` no longer open Vite's browser HMR WebSocket server, which GTKX never used. Running two sessions at once, such as two apps in a monorepo or `gtkx dev` next to `gtkx storybook`, no longer prints `WebSocket server error: Port 24678 is already in use`, and a session no longer listens on a TCP port.
