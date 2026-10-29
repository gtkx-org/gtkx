---
__default__: patch
---

`gtkx_query_widgets` with `by: "name"` now also matches the accessible name, as the MCP guide describes. Icon-only buttons named by their tooltip, such as a "New Note" header button, were found only by a role query with `options.name`, and a labelled button returned its inner label instead of the button.
