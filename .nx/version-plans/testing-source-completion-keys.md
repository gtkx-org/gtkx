---
__default__: patch
---

`userEvent.keyboard` and `userEvent.type` now send keys to a `GtkSourceView`'s completion list while it shows, as a keyboard does: arrow keys move the selection, `{Enter}` chooses the selected proposal and `{Escape}` hides the list. `{Enter}` used to insert a newline under the open list.
