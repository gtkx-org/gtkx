---
__default__: patch
---

The `gtkx_type` MCP tool now tells agents that typing replaces text that is already selected, such as the whole entry GTK selects when a dialog opens on it, and to pass `clear` with the full text to set a value. Agents appending to a prefilled entry in a freshly opened dialog used to replace its text without knowing why.
