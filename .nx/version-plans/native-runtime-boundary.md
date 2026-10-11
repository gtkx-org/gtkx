---
__default__: patch
---

Keep queued native log records deliverable after unsubscribe and release retired listeners. Shut down application helper processes when their owner exits even while the JavaScript event loop is blocked. Retain responsive GLib dispatch and clean up native resources when workers terminate. Import helper-process `keepAlive` control from `@gtkx/runtime`.
