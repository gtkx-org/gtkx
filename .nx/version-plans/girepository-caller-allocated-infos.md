---
__default__: patch
---

`GIRepository.ArgInfo.loadTypeInfo`, `GIRepository.CallableInfo.loadArg` and `GIRepository.CallableInfo.loadReturnType` are no longer generated: they always threw because GTKX cannot allocate the info they fill in, and `getTypeInfo`, `getArg` and `getReturnType` return the same information.
