---
__default__: patch
---

`gtkx codegen`, `gtkx dev` and `gtkx build` no longer fail with `ENOENT: no such file or directory, chmod '.../po/.gtkx-catalog-.../0.po'` when a project lists a locale in `po/LINGUAS` before its source has any translatable messages. GNU gettext's `msgmerge` skipped writing the empty catalog, so every run after the first stopped there.
