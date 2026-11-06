---
__default__: patch
---

`userEvent.dragAndDrop`, `drop`, `drag`, `longPress`, `swipe`, `zoom` and `rotate` now start from the given widget and use the nearest ancestor that has a matching controller, as a real pointer event propagates in GTK, with coordinates translated into that ancestor's space. Dragging a list cell by its visible label works when the `GtkDragSource` or `GtkDropTarget` sits on the cell's container; it used to fail with "No DragSource controller is attached to the widget".
