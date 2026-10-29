---
__default__: patch
---

The generated element reference, written to `.gtkx/reference` by `gtkx codegen`, produced by `gtkx docs` and served by the MCP API reference tools, now documents the `children` slot of elements their parent container creates, such as `AdwLayout`, `AdwViewStackPage`, `GtkStackPage` and `GtkGridLayoutChild`. Their pages no longer list construct-only props such as `content` and `child` that the element types reject, so code written from the reference typechecks.
