---
__default__: patch
---

Promisified methods such as `loadContentsAsync`, `enumerateChildrenAsync` and `Gtk.FileDialog.open` reject with the `GLib.Error` again, so `error instanceof Gio.IOErrorEnum` and `error.code` match cancellations, dismissed dialogs and other native failures. Previously the rejection was a plain `Error` with only the message.
