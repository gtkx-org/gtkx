---
__default__: minor
---

`ColumnView` columns take `hasExpander` to draw a tree's expander in that column, and `ListView`, `GridView` and `ListItemFactory` take `rowProps` to give rows accessible labels or make them unselectable, unactivatable or unfocusable. `GtkPopoverMenu`, `GtkPopoverMenuBar` and `GtkMenuButton` take `customChildren` to place widgets in menu items, and menu items accept the other GtkBuilder menu attributes. Construct-only object props accept JSX elements, such as `userContentManager={<WebKitUserContentManager />}` on a `WebKitWebView`.
