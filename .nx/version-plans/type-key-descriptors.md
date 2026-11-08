---
__default__: major
---

`userEvent.type` now presses keys named in braces, as Testing Library does, so `type(entry, "Celebrate{Enter}")` types the text and then activates the entry. Text with a literal `{`, such as JSON, fails with "Unclosed key descriptor" until it is written as `{{`. The MCP `gtkx_type` tool still types its text verbatim. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes).
