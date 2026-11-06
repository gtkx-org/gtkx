---
__default__: patch
---

`gtkx deploy` no longer fails AppStream validation with `tag-duplicated` when one locale keeps a metadata string untranslated-identical, such as a German catalog that keeps the application name. Translations for desktop entries, AppStream metainfo and MIME descriptions are now merged from `po/` in one pass, as Meson's `i18n.merge_file` does, so each locale appears once; AppStream language tags now use BCP 47 names such as `zh-Hans-CN`.
