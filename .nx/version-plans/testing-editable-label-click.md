---
__default__: patch
---

`userEvent.click` and `userEvent.pointer(widget, "click")` from `@gtkx/testing` now start editing a `GtkEditableLabel` when its text is clicked, as a click does in GTK. Previously a click left the label unchanged and a pointer click threw a `Gdk-CRITICAL`.
