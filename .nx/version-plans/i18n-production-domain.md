---
__default__: patch
---

The gettext domain and the `po/<domain>.pot` template now come from the production `applicationId`, so a development profile such as `$development: { applicationId: "org.example.App.Devel" }` keeps using the production template and catalogs in `gtkx dev`. Development used to write a second `po/org.example.App.Devel.pot` beside the real one, which was never removed and could end up committed and handed to translators.
