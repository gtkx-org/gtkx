---
__default__: major
---

Compile overrides as ordinary TypeScript modules alongside generated bindings, with concrete generated types and semantic typechecking. Keep native marshalling and lifetime primitives in runtime.

Replace `createApplication(ApplicationClass, props)` and `ApplicationClass.create(props)` with `new ApplicationClass(props)`. Construct Gio, Gtk, Adw, and custom application subclasses normally. Use `getIsRegistered()` and `getIsRemote()` in place of registration-state helpers, and observe completion through `runAsync()`. The associated application helper types are removed. Generated methods support nullable receivers where declared by GIR.

Replace the removed `runApplication` and `quitApplication` helpers with applications' `runAsync(argv): Promise<number>` and `quit()` methods. `RunApplicationResult` is removed. Node remains the outer event loop. Applications finish automatically when no application windows or outstanding JavaScript holds remain, respecting inactivity timeouts and the initial service grace period. Balance `hold()` with `release()` to keep background work alive, or call `quit()` to force shutdown. GTKX cannot observe holds acquired directly by native C code.

Replace `toVariant` and `fromVariant` with GJS-style `GLib.Variant` construction and unpacking methods. Dictionaries use objects for every key type; 64-bit values remain exact bigints. Import Variant types from `@gtkx/gi/glib`; the byte-array type is now `VariantByteArray` and conversion options types are removed.

Replace `GObject.paramSpecOverride` with `GObject.ParamSpec.override`. Runtime backing functions for generated property access, ParamSpec accessors, boxed values, regex matching, and class structures are internal; use the corresponding generated APIs.
