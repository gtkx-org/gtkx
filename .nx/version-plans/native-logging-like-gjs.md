---
__default__: major
---

GLib criticals and warnings are now printed by GLib's default log handler, as in C and GJS applications, instead of becoming JavaScript errors, so a critical from GTK's own callbacks no longer ends the application or fails tests. `onLog` is removed from `@gtkx/runtime`. Addon panics still throw from the binding call or reach Node's uncaught-exception channel. See the [upgrade guide](https://gtkx.dev/v2/guide/upgrading-to-2#check-the-behavior-changes).
