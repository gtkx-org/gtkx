---
__default__: major
---

For applications using generated bindings without React, replace `createApplication(ApplicationClass, props)` and `ApplicationClass.create(props)` with `new ApplicationClass(props)`. Use `getIsRegistered()` and `getIsRemote()` in place of registration-state helpers, and observe completion through `runAsync(argv)`. Pass an argument array or `null`; omitting the argument is an error. The associated application helper types are removed. React applications continue to declare their application in JSX.

Replace the removed `runApplication` and `quitApplication` helpers with applications' `runAsync(argv): Promise<number>` and `quit()` methods. `RunApplicationResult` is removed. Node remains the outer event loop. Applications finish automatically when no application windows or outstanding JavaScript holds remain, respecting inactivity timeouts and the initial service grace period. Balance `hold()` with `release()` to keep background work alive, or call `quit()` to force shutdown. GTKX cannot observe holds acquired directly by native C code.

Replace `toVariant` and `fromVariant` with GJS-style `GLib.Variant` construction and unpacking methods. Dictionaries use objects for every key type; 64-bit values remain exact bigints. Import Variant types from `@gtkx/gi/glib`; the byte-array type is now `VariantByteArray` and conversion options types are removed.

Replace `GObject.paramSpecOverride` with `GObject.ParamSpec.override`.

Generated methods support nullable receivers where declared by GIR.
