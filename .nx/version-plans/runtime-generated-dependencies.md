---
__default__: minor
---

Compile overrides as ordinary TypeScript modules alongside generated bindings, with concrete generated types and semantic typechecking. Keep native marshalling and lifetime primitives in runtime.

Import `createApplication`, `getApplicationInstance`, and their types from `@gtkx/gi/gio` instead of `@gtkx/runtime`; the constructor type is now `ApplicationConstructor`. Import Variant conversion helpers and their types from `@gtkx/gi/glib`; the byte-array type is now `VariantByteArray`. Generated methods support nullable receivers where declared by GIR.

Replace the removed `runApplication` and `quitApplication` helpers with managed applications' `runAsync(argv): Promise<number>` and `quit()` methods. `RunApplicationResult` is removed; `getApplicationInstance` reports primary and remote ownership. Node remains the outer event loop; ordinary application constructors and native hold/release or inactivity-driven termination are outside this API's scope.
