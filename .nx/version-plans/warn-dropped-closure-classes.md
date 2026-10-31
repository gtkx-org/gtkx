---
__default__: patch
---

A production bundle now warns once when an object reaches JavaScript through a closure, such as a `Gtk.ClosureExpression` callback or a D-Bus method handler, after tree shaking dropped its generated class. The warning names the class and how to keep it, for example `instanceof Adw.EnumListItem` after importing `@gtkx/gi/adw`. Such objects used to arrive silently as their nearest retained ancestor, and the app failed later on a missing method. Development and tests are unchanged.
