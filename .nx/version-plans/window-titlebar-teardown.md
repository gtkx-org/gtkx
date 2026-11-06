---
__default__: patch
---

Closing a window that has a `titlebar` no longer prints `gtk_window_set_titlebar() called on a realized window` or briefly shows the window again before it is destroyed, in apps and in every test that renders one.
