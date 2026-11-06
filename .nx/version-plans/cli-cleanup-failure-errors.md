---
__default__: patch
---

A `gtkx deploy` or `gtkx build` that fails and then cannot restore its output directory, for example because `flatpak-builder` left a FUSE mount behind, now reports the original failure followed by the restore failure and where the previous output was kept. It used to print only `An error was suppressed during disposal.`
