---
__default__: minor
---

Compile overrides as ordinary TypeScript modules alongside generated bindings, with concrete generated types and semantic typechecking. Keep native marshalling and lifetime primitives in runtime.

Import application helpers (`createApplication`, `runApplication`, `quitApplication`, and their types) from `@gtkx/gi/gio` instead of `@gtkx/runtime`; the constructor type is now `ApplicationConstructor`. Import Variant conversion helpers and their types from `@gtkx/gi/glib`; the byte-array type is now `VariantByteArray`. Generated methods support nullable receivers where declared by GIR.
