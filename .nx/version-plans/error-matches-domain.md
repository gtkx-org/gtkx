---
__default__: patch
---

`GLib.Error.matches()` accepts a generated error domain such as `Gio.IOErrorEnum` in place of its quark, as in GJS, so `error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)` works. Error domains also return their quark from `valueOf()`. The call used to fail type checking and throw `Expected a Number for uint32`.
