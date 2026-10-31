---
__default__: patch
---

`useProperty` now types the value of an object that cannot be null as the property's type, so `useProperty(Adw.StyleManager.getDefault(), "dark")` is a `boolean` rather than `boolean | undefined` and needs no `??` fallback. An object whose type allows `null` or `undefined` still adds `undefined`, the value while the object is absent.
