---
__default__: patch
---

`gtkx dev` no longer prints a module's error twice. When Vite has already reported a syntax error or a failed import with its code frame and stack, GTKX's `Hot reload failed` and `Application error` lines now name only the error message.
