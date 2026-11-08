---
__default__: patch
---

Pointer helpers in `@gtkx/testing` act more like a real pointer: clicks report the button and held modifiers to `GtkGestureClick` and list selections, stop at a gesture that claims the press, and reach the nearest ancestor with a matching drag or drop controller. `userEvent.pointer` takes `[MouseRight]` and `[MouseMiddle]`, and clicks open drop-downs from their label, edit a `GtkEditableLabel` and select `AdwTabView` pages.
