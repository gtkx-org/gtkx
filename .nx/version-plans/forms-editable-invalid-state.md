---
__default__: patch
---

`EntryRow`, `PasswordEntryRow` and `SpinRow` from `@gtkx/forms` now mark the text or spin field inside the row as invalid, not only the row. Screen readers announce the invalid state on the field that has focus, and `getByRole(TEXT_BOX, { name })` or `getByRole(SPIN_BUTTON, { name })` followed by `toBeInvalid()` now passes in tests.
