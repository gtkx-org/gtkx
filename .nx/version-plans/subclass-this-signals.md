---
__default__: patch
---

Signal methods called on `this` inside a subclass body, such as `this.emit("destroy")`, `this.connect("notify::visible", ...)`, `this.disconnect(id)` and `this.on(...)`, now typecheck against the inherited signals and still reject unknown names and wrong argument types. Signals declared through the `signals` option of `registerClass` are typed on the registered class, so they are available on `this` in classes that extend it.
