---
__default__: minor
---

`new` on a boxed record that GTKX cannot build from its fields now calls the record's `new` constructor with the given arguments, as in GJS, so `new GLib.VariantType("s")`, `new GLib.KeyFile()` and `new GLib.String(text)` typecheck and work alongside `GLib.VariantType.new("s")`. A `new` constructor that returns `null` makes `new` throw. Records whose first zero-argument constructor is not `new`, such as `GLib.TimeZone` and `Graphene.Matrix`, and records without a `new` constructor still come only from their factories.
