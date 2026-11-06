---
__default__: patch
---

The split view navigator takes a `collapseCondition`, such as `"max-width: 500sp"`, and collapses its panes while that breakpoint condition holds. libadwaita applies it during layout, so widening a collapsed window shows `contentPlaceholder` instead of selecting the focused sidebar row again, which happened when `collapsed` was set from an `AdwBreakpoint` handler. The tutorial's "Adapt the Layout" chapter and the Navigation guide now use it.
