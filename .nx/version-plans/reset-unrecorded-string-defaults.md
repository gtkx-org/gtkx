---
__default__: patch
---

Removing a prop, or passing `undefined` for it, now restores the property's default even when the library's GIR does not record one. A conditional `subtitle` on `AdwActionRow`, `description` on `AdwPreferencesGroup` or `AdwStatusPage`, `title` on `AdwBanner` and other string properties that default to an empty string used to keep showing their last value.
