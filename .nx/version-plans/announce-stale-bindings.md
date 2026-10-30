---
__default__: patch
---

`gtkx dev`, `gtkx build`, `gtkx storybook`, `gtkx deploy` and Vitest now print "generated bindings out of date; running codegen..." before regenerating bindings for GIR files that changed since the last run. They used to stay silent for the length of the regeneration, which takes about half a minute.
