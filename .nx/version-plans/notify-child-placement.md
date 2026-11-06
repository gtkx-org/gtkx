---
__default__: patch
---

`onNotify…` handlers now hear about properties a widget changes when React adds or removes its children. Removing the selected JSX `AdwTabPage` reports the neighbour libadwaita selects through `onNotifySelectedPage`, and mounting a tab view reports its first page, so app state mirrored from the handler no longer goes stale. These notifications arrive after the commit and its layout effects, and not at all when the commit writes the same property itself, as a controlled `visibleChildName` does. Signals such as `onClosePage` and `onRowSelected` stay quiet during commits as before.
