# @gtkx/runtime

Runtime support for generated GTKX bindings.

Provides native object wrappers, values, signals, class registration, and lifetime management without importing generated bindings. Library-specific overrides live in the generated `@gtkx/gi` modules. Import application helpers from `@gtkx/gi/gio` and Variant conversion helpers from `@gtkx/gi/glib`.

[Guide](https://gtkx.dev/v2/guide/native-values) · [API reference](https://gtkx.dev/v2/reference/@gtkx/runtime/) · [GTKX](https://gtkx.dev)

GTKX runs on Linux with Node.js and system native libraries. See [Getting Started](https://gtkx.dev/v2/guide/getting-started) for supported versions and installation. This README describes the 2.0 beta.

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
