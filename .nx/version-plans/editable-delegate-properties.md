---
__default__: patch
---

A class registered with `implements: [Gtk.Editable]` that returns an inner `Gtk.Text` from `vfuncGetDelegate`, as GTK's recipe for composite entries does, now forwards the interface's properties to that delegate, as `gtk_editable_delegate_set_property` and `gtk_editable_delegate_get_property` do in C. Writes to `text`, `editable`, `widthChars` and the other editable properties, including a controlled `text` prop, used to be dropped, and `cursorPosition` always read 0. A write to an interface property the class reads through a virtual function, such as `text` on an editable without a delegate, now throws instead of being silently lost.
