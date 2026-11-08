---
__default__: major
---

`GObject.Object.bindPropertyFull` and `GObject.BindingGroup.bindFull` take transform functions shaped as in GJS, `(binding, value) => [success, value]`, with `null` for the default conversion and value types that follow the named properties. Rewrite transforms written as `(binding, fromValue, toValue) => boolean`; a `GObject.Closure` still receives the closure arguments. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes).
