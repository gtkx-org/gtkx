---
__default__: patch
---

`gtkx_query_widgets` with `by: "name"` now finds a label by the accessible label the app gave it, such as `<GtkLabel label={total} accessibleLabel="Total" />`, listing labels after the controls that match. Such a label used to match only through `by: "role"` with `options.name`.
