---
__default__: major
---

GLib criticals and warnings are now printed by GLib's default log handler, as in C and GJS applications, instead of becoming JavaScript errors. A binding call that logs a critical returns normally, and a critical from GTK's own callbacks, such as `Unable to register the application` when the accessibility bus is unreachable, no longer ends the application or fails tests. `onLog` is removed from `@gtkx/runtime`. Addon panics still throw from the binding call or reach Node's uncaught-exception channel.
