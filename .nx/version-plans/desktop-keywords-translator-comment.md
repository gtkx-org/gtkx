---
__default__: patch
---

The desktop entry's `Keywords` line now carries GNOME's translator comment, and `gtkx deploy` extracts it into the catalog template, so translators are told to keep the semicolon-separated list shape instead of seeing a bare `msgid "books;library;reading;"`.
