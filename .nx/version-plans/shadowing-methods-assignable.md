---
__default__: patch
---

Classes whose own method shares a name with an incompatible inherited one stay assignable to their parent types. An `Adw.ActionRow` (and its subclasses such as `Adw.SwitchRow`), `Adw.PreferencesPage`, `Gtk.MenuButton` or `Gio.Cancellable` can now be used where a `Gtk.Widget` or `GObject.Object` is expected, and a widget returned by a query can be narrowed with `as`, while calls to the shadowing method keep their exact signature.
