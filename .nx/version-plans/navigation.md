---
__default__: minor
---

`createTabViewNavigator` in `@gtkx/navigation` keeps an `Adw.TabView`'s pages in navigation state: tabs open, close, select, reorder and pin through actions, screens mount lazily, and pages dragged in from another window are adopted. It takes `renderMenu` for a JSX tab context menu and `replaceLastTab` to replace a closed last tab. The split view navigator takes `collapseCondition` and exposes `useSplitViewCollapsed()`, and static navigator configs with callbacks such as `screenOptions` typecheck.
