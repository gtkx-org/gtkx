# @gtkx/runtime

Runtime for generated GObject Introspection bindings in GTKX.

Provides native object wrappers, value conversion, signals, and GObject class registration without importing generated bindings. Library-specific APIs such as `GLib.Variant` live in the generated `@gtkx/gi` modules.

GTKX installs this package as a dependency. React applications use `createRoot` from `@gtkx/react` and `AdwApplication` from `@gtkx/jsx/adw`. For applications that use generated GI bindings without React, `Gio.Application.runAsync()` manages the application lifecycle.

[Guide](https://gtkx.dev/v2/guide/native-values) · [API reference](https://gtkx.dev/v2/reference/@gtkx/runtime/) · [GTKX](https://gtkx.dev)

GTKX requires Linux, Node.js, and the [native prerequisites](https://gtkx.dev/v2/guide/getting-started).

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
