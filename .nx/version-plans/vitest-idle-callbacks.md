---
__default__: patch
---

GLib idle callbacks now run in tests while a focused text field shows its caret. `render` turns caret blinking off, as it already turns animations off; the blinking caret kept the test display redrawing, so callbacks such as libadwaita's deferred tab close never ran, and clicking an `AdwTabBar` close button with an editor focused left the tab open.
