---
__default__: patch
---

A close the user starts and the app does not answer no longer leaves the toolkit and React out of step. Adwaita dialogs stay open on their close button, Escape or a response when nothing handles `onClosed`, `onCloseAttempt` or `onResponse`, and a JSX `AdwTabPage` stays when its `AdwTabView` has no `close-page` handler; an `AdwBottomSheet` given `open` behaves the same without `onNotifyOpen`. `showSidebar` on `AdwOverlaySplitView`, `showContent` on `AdwNavigationSplitView`, `open` on `AdwBottomSheet` and `AdwTabOverview`, and `searchModeEnabled` on `GtkSearchBar` are controlled when given: a value the user changed and the app still renders is restored before the next frame, and leaving the prop out keeps the widget's own behavior. Windows always close. In development, GTKX warns once per element type with the handler to add, and also when a closed window, dialog or popover is still rendered open.
