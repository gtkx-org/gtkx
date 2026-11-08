---
__default__: patch
---

A worker's `?inline` stylesheet import now gives the stylesheet's text under `gtkx dev` and Vitest, as it already did after `gtkx build`. Development and tests used to give a base64 `data:` URL instead.
