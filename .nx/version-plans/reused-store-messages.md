---
__default__: patch
---

A project with `codegen: false` that imports a library missing from the binding store it reuses now gets an error pointing at the project that generates the store, instead of advice to add the library to its own `libraries`, which has no effect without codegen.
