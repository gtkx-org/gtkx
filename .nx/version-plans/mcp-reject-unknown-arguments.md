---
__default__: patch
---

MCP tools now reject arguments they do not declare. A misplaced option, such as `name` beside `by` in `gtkx_query_widgets` instead of inside `options`, used to be dropped silently, so the agent got unfiltered results; the call now fails with an error naming the unrecognized key.
