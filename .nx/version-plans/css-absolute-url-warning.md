---
__default__: patch
---

`gtkx dev` and `gtkx build` now warn when an imported `.css` file refers to an absolute path in `url()`, which GTK cannot load from the injected stylesheet and used to draw nothing without a message.
