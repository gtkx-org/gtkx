---
__default__: patch
---

An instance of a class registered with `implements`, such as a `Gio.ListModel` or `Gdk.Paintable` implementation, is now assignable to that interface's type, so `const model: Gio.ListModel = new Store()` typechecks and its interface signals keep their handler types.
