---
__default__: patch
---

Generated enumerations, flags and error domains registered with GObject now carry their GType as `__type__`, like generated classes, and can be passed wherever a binding, a constructor property or a `registerClass` signal takes a GType, as in `GObject.typeIsA(Gtk.SortType, GObject.TYPE_ENUM)` or `<AdwEnumListModel enumType={Gtk.SortType.__type__} />`. Reading `__type__` registers the type, which `GObject.typeFromName("GtkSortType")` needed something else to have done first. A construct property value its ParamSpec rejects, such as the `0n` `typeFromName` returns for an unregistered type, now throws a `RangeError` instead of constructing the object without it; `<AdwEnumListModel>` used to crash the process that way.
