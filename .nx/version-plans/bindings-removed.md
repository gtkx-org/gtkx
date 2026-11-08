---
__default__: patch
---

Bindings that could never work are no longer generated, including `Gio.InputStream.readAsync` (use `readBytesAsync`), the `GIRepository` `load*` methods and `Gio.DBusInterfaceSkeleton.vfuncGetVtable`. Type errors name what was passed and the property or signal involved, a bad vfunc return names the class and vfunc, and production bundles warn when tree shaking dropped a class an object needs.
