---
__default__: patch
---

`new` on a class from `registerClass` now accepts its declared properties in the constructor's props object, as JSX already did, so `new TodoItem({ title: "Milk" })` typechecks and construct-only properties can be set from TypeScript.
