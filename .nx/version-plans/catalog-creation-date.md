---
__default__: patch
---

Translation catalogs under `po/` are no longer rewritten when only their template's creation date changed. Two `gtkx dev` sessions of one project with different application IDs, such as `gtkx dev --config` for a development profile next to the main configuration, used to rewrite each other's catalogs and restart each other without end.
