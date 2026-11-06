---
__default__: patch
---

`gtkx build` now warns when a stylesheet imported with `?resource` refers through `url()` or `@import` to a path under the application's resource base path that no import bundles. GTK used to draw nothing there without a message.
