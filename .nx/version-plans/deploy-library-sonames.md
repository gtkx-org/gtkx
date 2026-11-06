---
__default__: patch
---

RPM packages from `gtkx deploy` now require the shared library of every configured GIR library, such as `libgtksourceview-5.so.0()(64bit)` for `GtkSource-5`, and a deb deployment with an empty `deploy.depends.deb` warns and names the shared libraries that list must cover. Packages used to depend only on GTK and libadwaita, so an app using GtkSourceView, WebKit or GStreamer installed on a system without them and then failed to start with `Failed to load library`.
