---
__default__: patch
---

GTKX now sets the program name to the last segment of the production application ID, in every mode, before the app's entry module runs, as GJS sets it before an app's code. A library that initializes while the app's modules load, such as GTK's GStreamer media backend behind a module-scope `Gtk.MediaFile.new()`, used to name the program `node`, so the installed app's `--help` printed `Usage: node [OPTION…]` and its X11 windows had the class `node`.
