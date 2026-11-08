---
__default__: patch
---

`useBindSetting` now types `property` from the bound object and accepts only its writable property names in camelCase, the way `useProperty` and `useSignal` type their names. A misspelled or read-only property name used to typecheck and only failed when the bind ran.
