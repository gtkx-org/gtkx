---
__default__: patch
---

`render` without a container now gives the tree its harness window as the parent window, as a window element does in an application, and leaves the topmost window the tree opened active. An Adwaita dialog rendered on its own in a test is shown over the harness window and holds the focus, so `{Tab}` moves between its widgets instead of restarting from the dialog's header bar, and `useParentWindow()` returns the harness window instead of `null`.
