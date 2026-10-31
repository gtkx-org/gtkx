---
__default__: patch
---

Setting a property to a value it cannot hold, such as a function for a widget prop, now names the object and property in the `TypeError` (`HeaderBar.title-widget: cannot set property 'title-widget' to a function; the property holds values of type 'GtkWidget'`) instead of only `Expected a native instance, got function`.
