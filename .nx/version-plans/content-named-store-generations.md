---
__default__: patch
---

Codegen publishes generated bindings in a directory named after their contents, so regenerating unchanged bindings keeps their path. Build caches keyed on those paths, such as Nx task inputs, stay valid across regenerations and machines.
