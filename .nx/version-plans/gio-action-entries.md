---
__default__: minor
---

Every `Gio.ActionMap`, including `Gio.SimpleActionGroup`, `Gtk.Application`, `Adw.Application`, `Gtk.ApplicationWindow` and classes registered from them, now has `addActionEntries(entries)`, GJS's `add_action_entries`: each entry names an action and may give an `activate` callback, a `parameterType`, a `state` in GVariant text such as `"'large'"` or `"true"`, and a `changeState` callback, typed by the new `Gio.ActionEntryObj`. Ported action tables no longer need one `Gio.SimpleAction` with its own `connect` and `addAction` per entry. `removeActionEntries` now takes the same entries and removes the actions they name; it used to take `Gio.ActionEntry` structs, which JavaScript cannot create. `Gio.SimpleActionGroup.addEntries`, deprecated since GLib 2.38 and unusable for the same reason, is no longer generated.
