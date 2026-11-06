---
__default__: patch
---

An application element's `onShutdown` handler now runs when `quit()` closes the application, as the scaffolded `onCloseRequest={quit}` does. It used to be disconnected while the tree unmounted, before GLib emitted `shutdown`, so cleanup there, such as stopping a timer, never ran and could keep the process alive.
