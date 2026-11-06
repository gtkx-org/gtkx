---
__default__: patch
---

`gtkx_get_api_docs` and `gtkx_search_api` now accept a JSX element name as the owner of a member, so `GtkSourceView.showLineNumbers` returns the property's section and `GtkSourceView.showLine` finds it, as `GtkSource.View.showLineNumbers` already did. An agent that took the element name from a search result and asked for one of its members used to get "No symbol named".
