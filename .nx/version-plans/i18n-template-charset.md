---
__default__: patch
---

`gtkx codegen`, `gtkx dev` and `gtkx deploy` now add messages with characters outside ISO-8859-1, such as typographic quotes or an ellipsis, to a catalog template whose header does not declare UTF-8. Templates written by earlier betas for a project without messages, and templates copied from projects whose messages were all ASCII, previously failed with `GNU gettext did not extract`.
