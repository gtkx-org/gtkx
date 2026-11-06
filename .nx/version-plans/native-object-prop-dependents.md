---
__default__: patch
---

Replacing a native object prop, such as `adjustment={new Gtk.Adjustment(...)}` on a spin row, now keeps the element's other declared props. A new adjustment used to reset a spin row to the adjustment's value and report it through `onNotifyValue`, so a controlled value fell back to the default after Fast Refresh or any re-render that recreated the adjustment.
