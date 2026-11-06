---
__default__: patch
---

Translation extraction now accepts a plural `Trans` whose `tOptions` write out `defaultValue_one` and `defaultValue_other` that read the same in English, such as `{{count}} selected`, as it already did for `t()`. The error for a plural without both forms now mentions `tOptions`.
