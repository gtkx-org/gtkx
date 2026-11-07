---
__default__: patch
---

Codegen, `gtkx dev`, `gtkx build` and `gtkx deploy` now accept identical copies of a GSettings schema imported from different folders, or through symlinks, and declare, compile and install the schema once; copies with the same file name but different contents fail with an error naming both files.
