---
__default__: patch
---

Translation extraction now adds the summaries and descriptions of imported GSettings schemas to `po/POTFILES.in`, the template and the catalogs, using GLib's ITS rules, so existing schema translations no longer turn obsolete and `gsettings describe` shows them once the app is installed. The Internationalization guide shows the `gettext-domain` to set on the schema list.
