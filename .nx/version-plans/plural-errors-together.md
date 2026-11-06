---
__default__: patch
---

Codegen now reports every translation message that cannot become a gettext entry in one run, such as each call still using the removed `t(singular, plural, options)` overload, instead of stopping at the first.
