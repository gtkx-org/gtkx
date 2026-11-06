---
__default__: patch
---

Nesting an element where its parent only accepts it through a prop, such as a `<GtkGestureDrag>` inside `<GtkDrawingArea>` or a `<GtkAdjustment>` inside `<GtkScale>`, now fails with an error that names the prop to use, for example `controllers={<GtkGestureDrag />}` or `adjustment={<GtkAdjustment />}`.
