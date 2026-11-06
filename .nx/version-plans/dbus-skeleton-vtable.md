---
__default__: patch
---

The Gio bindings no longer declare `Gio.DBusInterfaceSkeleton`'s `vfuncGetVtable`, which no subclass could implement because `Gio.DBusInterfaceVTable` cannot be constructed from JavaScript. The Async Operations guide now shows how to consume D-Bus services with proxies and name watchers and how to export an object with `registerObjectWithClosures2`, and notes that GJS's `makeProxyWrapper` and `wrapJSObject` have no GTKX equivalent.
