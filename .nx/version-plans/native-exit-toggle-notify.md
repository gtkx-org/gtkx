---
__default__: patch
---

Applications exit cleanly when native code ends the process during a call, such as GApplication printing `--help`. The exit no longer panics in a toggle-reference notification and no longer reports status 1.
