---
__default__: patch
---

`Gio.Settings`, its static constructors such as `Gio.Settings.new` and `<GSettings>` now throw a JavaScript error, as GJS does, when the schema is not installed, a relocatable schema has no `path`, or a method names a key or child the schema does not declare. GLib aborts the whole process in those cases, so a mistyped `schemaId` or an optional system schema missing on the user's machine used to kill the app, the dev runner's app process or the Vitest worker with `GLib-GIO-ERROR` and no JavaScript stack.
