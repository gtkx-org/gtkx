# @gtkx/runtime

Runtime for generated GTK and GObject Introspection bindings in GTKX.

Provides native object wrappers, value conversion, signals and GObject class registration for the generated `@gtkx/gi` bindings, which hold library-specific APIs such as `GLib.Variant`. Apps created with `npm create gtkx` already depend on this package.

React apps start from `createRoot` in `@gtkx/react`. Apps that use the bindings without React run their application with [`Gio.Application.runAsync()`](https://gtkx.dev/v2/guide/application-lifecycle#running-without-react).

[Guide](https://gtkx.dev/v2/guide/native-values) · [API reference](https://gtkx.dev/v2/reference/@gtkx/runtime/) · [GTKX](https://gtkx.dev)

GTKX requires Linux, Node.js, and the [native prerequisites](https://gtkx.dev/v2/guide/getting-started#what-you-need).

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
