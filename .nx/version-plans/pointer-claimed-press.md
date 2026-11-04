---
__default__: patch
---

`userEvent.pointer` and `click` now stop a press at the click gesture that claims it with `setState(Gtk.EventSequenceState.CLAIMED)`, as GTK stops event propagation. A right click on an item whose gesture claims the press used to reach the gestures of its ancestors too, so a test opened both the item's context menu and the background menu of the canvas around it.
