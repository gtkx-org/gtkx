---
__default__: patch
---

Translation extraction now accepts a plural message whose English forms are the same, such as `t("{{count}} installed", { count, defaultValue_one: "{{count}} installed", defaultValue_other: "{{count}} installed" })`, when both options are written out. The message gets a gettext plural entry, so languages such as Italian still translate it with two forms. A count message without the plural options, and a 1.x `t(singular, plural, options)` call, are still rejected.
