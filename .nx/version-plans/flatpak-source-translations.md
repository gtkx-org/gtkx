---
__default__: patch
---

Source-mode Flatpak manifests now install the locale configuration next to the bundle, so translated apps built from source find their catalogs in `/app/share/locale` instead of running untranslated.
