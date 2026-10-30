---
__default__: minor
---

`userEvent.type` now presses the keys named in braces, as Testing Library's `user-event` does, so `type(entry, "Celebrate{Enter}")` types the text and then activates the entry, and `{Backspace}`, `{Tab}` or arrow keys edit and move focus as they would on a keyboard. It used to insert `{Enter}` as text, so a test submitting a form this way failed on a handler that never ran. Type a literal `{` by doubling it. The MCP `gtkx_type` tool still types its text verbatim.
