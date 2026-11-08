---
__default__: patch
---

Translation catalogs under `po/` stay stable: the template uses GNU gettext's layout, so deployment now requires `msgcat`, and comes from the production `applicationId` in development profiles. GTKX manages `po/` only when `@gtkx/i18n` is installed and accepts new locales without a known plural rule, and apps start under a locale the C library does not provide. Extraction reports every error in one run, skips story files, and accepts plurals whose English forms match when both are written out.
