---
__default__: patch
---

`userEvent.dragAndDrop` and `userEvent.drop` onto an `AdwTabBar` tab or an `AdwTabOverview` thumbnail now deliver the content through the extra drop target with the negotiated action, so `onExtraDragDrop` reads the right `extraDragPreferredAction` and the drop no longer logs `Gdk-CRITICAL gdk_drop_get_actions` (on 2.0.0-beta.12 the critical failed the test).
