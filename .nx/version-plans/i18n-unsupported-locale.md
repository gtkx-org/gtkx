---
__default__: patch
---

Apps using `@gtkx/i18n` no longer fail to start when the environment names a locale the C library does not provide, such as an ungenerated `LANG` or an SSH session's `LC_CTYPE=UTF-8`. They start with untranslated text and GTK's usual fallback warning, as C and GJS applications do.
