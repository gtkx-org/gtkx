---
__default__: minor
---

Compile overrides as ordinary TypeScript modules alongside generated bindings, with concrete generated types and semantic typechecking. Keep native marshalling and lifetime primitives in runtime.

Replace `createApplication(ApplicationClass, props)` with `ApplicationClass.create(props)` and `getApplicationInstance(application)` with `application.getRegistrationState()`. These methods belong to `Gio.Application` and are inherited by Gtk, Adw, and custom application subclasses. Import `ApplicationRegistrationState` and `ApplicationConstructor` from `@gtkx/gi/gio` in place of runtime's `ApplicationInstance` and `ApplicationClass` types. Import Variant conversion helpers and their types from `@gtkx/gi/glib`; the byte-array type is now `VariantByteArray`. Generated methods support nullable receivers where declared by GIR.

Replace the removed `runApplication` and `quitApplication` helpers with managed applications' `runAsync(argv): Promise<number>` and `quit()` methods. `RunApplicationResult` is removed; `getRegistrationState()` reports registration and ownership, independently of run completion. Node remains the outer event loop. Managed applications finish automatically when no application windows or outstanding JavaScript holds remain, respecting inactivity timeouts and the initial service grace period. Balance `hold()` with `release()` to keep background work alive, or call `quit()` to force shutdown. Construct applications with `Application.create()`; ordinary constructors are unsupported, and GTKX cannot observe holds acquired directly by native C code.
