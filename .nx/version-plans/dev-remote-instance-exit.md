---
__default__: patch
---

`gtkx dev` stops with status 1 again when another process already owns the application ID, such as an earlier `gtkx dev` session or the installed app, instead of waiting with "Entry did not mount an application".
