---
__default__: patch
---

`new GLib.Error(domain, code, message)` and `error.matches(domain, code)` accept generated error domains such as `Gio.IOErrorEnum`, as in GJS, and typecheck with every domain. Promisified methods such as `loadContentsAsync` reject with the `GLib.Error` again, so `instanceof` and `error.code` identify cancellations and dismissed dialogs.
