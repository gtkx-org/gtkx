---
__default__: minor
---

Translation extraction now gives translators the `Translators:` comments written before a message. A `// Translators: ...` or `/* Translators: ... */` comment right before a `t` call, a `useTranslation` `t` call or a `Trans` element becomes an extracted comment (`#.`) on that message in the `.pot` template and in every PO catalog, as xgettext's `--add-comments=Translators:` does for Meson projects. Comments used to be dropped, so translators lost notes such as what a placeholder stands for.
