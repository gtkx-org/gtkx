---
__default__: patch
---

Moving a keyed `GtkListBox` or `GtkFlowBox` child no longer drops keyboard focus from it. A row reordered with the keyboard keeps focus, so the next shortcut press moves it again, as moves within a `GtkBox` already did.
