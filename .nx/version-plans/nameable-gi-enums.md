---
__default__: patch
---

Libraries that emit declarations can now export values whose inferred type is a generated enumeration or flags type, such as `export const scheme = Adw.ColorScheme.DEFAULT`, instead of failing with TS4023 because the type could not be named.
