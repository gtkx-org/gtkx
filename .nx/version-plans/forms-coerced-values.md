---
__default__: patch
---

A `SpinRow` whose form value lies outside its adjustment's range, or an `EntryRow` or `PasswordEntryRow` whose text exceeds `maxLength`, now shows as invalid, and development builds log a warning. GTK displays the clamped or shortened value while the form keeps and submits the original, and the row used to give no sign of the difference.
