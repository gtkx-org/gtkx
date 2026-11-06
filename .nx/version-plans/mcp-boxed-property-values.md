---
__default__: patch
---

`gtkx_get_widget_props` now reports boxed property values such as `GdkRGBA` in their string form (`"rgb(230,97,0)"`) instead of the class name, so an agent can read a color button's color. Boxed values without a string form carry a `note`.
