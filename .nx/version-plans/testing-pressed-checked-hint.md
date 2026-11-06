---
__default__: patch
---

`toBeChecked` on a `GtkToggleButton`, which exposes a pressed state rather than a checked one, now says to use `toBePressed`, and `toBePressed` or `toBePartiallyPressed` on a check button says to use `toBeChecked`.
