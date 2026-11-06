---
__default__: minor
---

The MCP reference tools find class, interface and record members. `gtkx_search_api` matches constructors, static methods, properties, signals, methods and record fields, so searching for `replaceContentsAsync` returns `Gio.File.replaceContentsAsync` with kind `method`. `gtkx_get_api_docs` accepts a member name and returns only that member's section; it used to reject member names, so reading one method meant fetching the whole class page, 175 KB for `Gio.File`.
