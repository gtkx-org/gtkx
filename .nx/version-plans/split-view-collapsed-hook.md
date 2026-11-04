---
__default__: patch
---

`useSplitViewCollapsed()` tells a split view navigator's screens whether its panes are collapsed, following the split view's `collapsed` property, so it holds for both `collapsed` and `collapseCondition`. A sidebar screen can switch libadwaita 1.9's `AdwSidebar` to page mode while collapsed, as libadwaita recommends, without repeating the collapse condition in a window breakpoint. The Navigation guide shows it.
