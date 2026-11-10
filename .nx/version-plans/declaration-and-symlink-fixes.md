---
__default__: patch
---

A class whose signals take or return generated classes, declared through `registerClass` or `withSignals`, can be exported from a project that emits declarations. A GSettings schema imported through a file symlink gets its `.gschema.d.xml.ts` beside the link, so the import typechecks.
