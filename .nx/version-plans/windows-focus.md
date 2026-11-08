---
__default__: patch
---

A window mounted with `visible={false}` stays hidden, signal handlers hear what GTK does when a window is first shown, and closing windows with title bars or tab overviews no longer logs criticals. Removing a focused subtree moves focus as GTK would, and a `<GtkPopover>` inside a button attaches to it instead of crashing. JSX tab pages close when removed from state and stay selected when their content changes.
