# @gtkx/native

Native addon for GTKX foreign-function calls.

This internal Rust addon calls system libraries through libffi, integrates the GLib and Node.js event loops, and manages native memory. GTKX installs it through runtime dependencies; application code normally uses the generated `@gtkx/gi` bindings. Prebuilt binaries target x64 and arm64 glibc Linux.

Generated bindings and `@gtkx/runtime` describe call signatures and ownership rules. The addon manages native references, temporary storage, callbacks, and memory release. See [Native Runtime](https://gtkx.dev/contributing/native-runtime) for its architecture and ownership contracts.

[Guide](https://gtkx.dev/v2/guide/getting-started) · [GTKX](https://gtkx.dev)

GTKX requires Linux, Node.js, and the [native prerequisites](https://gtkx.dev/v2/guide/getting-started).

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
