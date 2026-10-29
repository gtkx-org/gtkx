---
__default__: patch
---

Prebuilt Flatpak bundles from `gtkx deploy` now include the application's translations. Flatpak previously moved the catalogs into a separate locale extension that the single-file bundle does not contain, so installed bundles ran untranslated.
