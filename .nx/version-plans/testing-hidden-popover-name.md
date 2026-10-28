---
__default__: patch
---

Accessible names computed by `@gtkx/testing` now skip hidden descendants, as GTK does. A `GtkMenuButton` with a `tooltipText` and a closed popover is named by its tooltip, so `getByRole(Gtk.AccessibleRole.BUTTON, { name: "Pick Date" })` finds it instead of a name built from the popover's labels.
