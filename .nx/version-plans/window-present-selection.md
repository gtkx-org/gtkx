---
__default__: patch
---

Signal handlers inside a window now hear what GTK does when the window is first shown. When GTK selected the first row of a `GtkListBox` as the window took focus, `onRowSelected` stayed silent, so the app showed that row selected while its state said nothing was, and clicking the row reported nothing either.
