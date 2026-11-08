# @gtkx/native

Node.js addon that calls GTK and other C libraries for GTKX.

This internal Rust addon performs the calls that `@gtkx/runtime` and the generated `@gtkx/gi` bindings describe: it calls system libraries through libffi, integrates the GLib and Node.js event loops, and manages native references, callbacks and memory. `@gtkx/runtime` depends on it, and apps use the generated bindings instead of importing it. Prebuilt binaries target x64 and arm64 glibc Linux.

[Native Runtime](https://gtkx.dev/contributing/native-runtime) describes its architecture and ownership contracts.

[Guide](https://gtkx.dev/v2/guide/getting-started) · [GTKX](https://gtkx.dev)

GTKX requires Linux, Node.js, and the [native prerequisites](https://gtkx.dev/v2/guide/getting-started#what-you-need).

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
