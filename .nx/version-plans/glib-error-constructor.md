---
__default__: patch
---

`new GLib.Error(domain, code, message)` creates an error as in GJS, with a generated domain such as `Gio.IOErrorEnum` or its quark, so GJS code that throws errors from virtual functions or returns them through `Gio.Task.returnError()` ports unchanged. `GLib.Error.newLiteral()` also accepts a generated domain. `new GLib.Error(...)` used to fail type checking and throw "use GLib.Error.newLiteral(domain, code, message) instead".
