---
__default__: minor
---

Registered properties created with `GObject.paramSpecBoxed`, such as `color: Gdk.RGBA`, now have keys in `useProperty` and the typed `GObject.getProperty` and `GObject.setProperty` calls, as object properties already did. The value type comes from the field the class declares and is not checked against the boxed GType, so a field declared with the wrong type typechecks; previously these properties needed `useSignal(object, "notify::color", ...)` or a descriptor.
