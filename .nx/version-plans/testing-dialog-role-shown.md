---
__default__: patch
---

Role queries in `@gtkx/testing` now match an Adwaita dialog only once its content is shown. libadwaita opens a dialog's sheet a frame after mapping the dialog, so `findByRole(Gtk.AccessibleRole.DIALOG)` could resolve while the content was still unmapped, and an immediate query inside the dialog failed in some runs.
