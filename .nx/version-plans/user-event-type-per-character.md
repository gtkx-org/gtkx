---
__default__: patch
---

`userEvent.type` now inserts each character as its own edit, as a keyboard does, so GtkSourceView's interactive completion and other handlers that react to single typed characters see the typed text; it used to insert each run of text at once.
