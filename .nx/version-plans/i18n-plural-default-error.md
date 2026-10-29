---
__default__: patch
---

Translation extraction now explains a plural call whose singular and plural forms are the same, such as a 1.x `t("{{count}} day ago", "{{count}} days ago", { count })` call, by naming the message and asking for distinct `defaultValue_one` and `defaultValue_other` options. It used to say only that plural source strings must be distinct and non-empty.
