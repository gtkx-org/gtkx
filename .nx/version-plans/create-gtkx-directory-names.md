---
__default__: patch
---

`create-gtkx` now expands a project directory starting with `~/` to the home directory instead of creating a directory named `~` inside the current one, and rejects a directory name that cannot be a package name by naming the directory and suggesting a valid name, rather than reporting an invalid "project name".
