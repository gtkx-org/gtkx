---
__default__: patch
---

`gtkx dev` keeps running when translation catalogs change in a way it cannot use yet. Adding `po/LINGUAS` while the dev server runs, as the internationalization guide describes, used to end the session with `Missing translation catalog: po/<application-id>.pot`, and saving a malformed PO file ended it with the `msgmerge` error. The dev server now creates the missing template, and reports a catalog error while keeping the current application until the catalog is fixed.
