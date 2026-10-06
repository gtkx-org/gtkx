---
__default__: minor
---

Compile overrides as ordinary TypeScript modules alongside generated bindings, with concrete generated types and semantic typechecking. Keep native marshalling and lifetime primitives in runtime.

Import `createApplication`, `getApplicationInstance`, and their types from `@gtkx/gi/gio` instead of `@gtkx/runtime`; the constructor type is now `ApplicationConstructor`. Import Variant conversion helpers and their types from `@gtkx/gi/glib`; the byte-array type is now `VariantByteArray`. Generated methods support nullable receivers where declared by GIR.

Replace the removed `runApplication` and `quitApplication` helpers with managed applications' `runAsync(argv): Promise<number>` and `quit()` methods. `RunApplicationResult` is removed; `getApplicationInstance` reports primary and remote ownership. Node remains the outer event loop. Managed applications finish automatically when no application windows or outstanding JavaScript holds remain, respecting inactivity timeouts and the initial service grace period. Balance `hold()` with `release()` to keep background work alive, or call `quit()` to force shutdown. Construct applications with `createApplication`; ordinary constructors are unsupported, and GTKX cannot observe holds acquired directly by native C code.
