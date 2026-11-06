---
__default__: patch
---

MCP widget summaries now report a `GtkTextView`'s buffer text as its `text`, so an agent can read back what it typed into a text view or source view. It was always `null`.
