---
__default__: patch
---

`userEvent.click` and `userEvent.pointer(widget, "click")` from `@gtkx/testing` now select an `AdwTabView` page when its `AdwTabBar` tab is clicked, and clicking a page in an open `AdwTabOverview` selects it and closes the overview, as a click does in libadwaita. Previously both threw a `Gdk-CRITICAL`. MCP `gtkx_click` gains the same behavior.
