---
__default__: major
---

`GObject.Object.bindPropertyFull` and `GObject.BindingGroup.bindFull` take transform functions shaped as in GJS: `(binding, value) => [success, value]`, with the value read from one property converted to JavaScript and the returned value written to the other, and `null` for the default conversion. The transform's value types follow the named properties. Plain functions written for GLib's closure arguments, `(binding, fromValue, toValue) => boolean`, no longer work: they failed at runtime with `Expected a boolean` when written the GJS way, and the GJS form now typechecks and runs. A `GObject.Closure` still receives the closure arguments.
