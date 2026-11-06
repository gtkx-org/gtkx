---
__default__: patch
---

A widget nested directly inside `AdwActionRow`, `AdwEntryRow`, `AdwExpanderRow`, `AdwButtonRow` or a row derived from them, such as `AdwSwitchRow`, now fails with an unclaimed-child error that points to the `prefix` and `suffix` props where the row has them. It used to replace the row's own content, leaving a blank row without its title, subtitle or controls.
