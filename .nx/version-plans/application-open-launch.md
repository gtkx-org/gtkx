---
__default__: patch
---

An application with `flags={Gio.ApplicationFlags.HANDLES_OPEN}` launched with files, such as `node dist/bundle.mjs notes.txt` or Open With from a file manager, now renders its windows. GApplication emits `open` instead of `activate` in that case, and the application used to exit at once without showing anything.
