---
__default__: patch
---

An AppImage built with `deploy.appimage.updateInformation` now has its `.zsync` update file beside it in the deploy output directory. appimagetool used to write that file into the directory `gtkx deploy` was started from, usually the project root.
