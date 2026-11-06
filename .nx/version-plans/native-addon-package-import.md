---
__default__: patch
---

`gtkx build` now stops with an error naming the package that loads a native addon, the addon's `?url` specifier and the Deploying guide's "Additional native addons" section when an app imports a package whose code requires a `.node` file, such as a napi-rs package. The bundler used to fail with `[UNLOADABLE_DEPENDENCY] ... stream did not contain valid UTF-8`. Addons imported with `?url` build as before.
