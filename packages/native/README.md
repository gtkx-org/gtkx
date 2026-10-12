# @gtkx/native

Native addon for GTKX foreign-function calls.

This is an internal GTKX package. The Rust addon calls system GObject libraries through libffi and manages native memory, with all native functions exported from `@gtkx/native`. It is installed through GTKX runtime dependencies; application code uses the generated `@gtkx/gi` bindings. Prebuilt binaries target x64 and arm64 glibc Linux.

Generated bindings and `@gtkx/runtime` describe signatures, ABI layouts, transfer rules, and JavaScript behavior. The addon acquires native references, owns temporary storage and callback trampolines, transfers ownership, and releases memory. JavaScript can request allocations and provide native copy/free symbols through descriptors; it does not manually balance native references or choose when a handle is freed.

Native-owned handles normally follow JavaScript garbage collection. Native code also manages scoped temporaries and dependencies that must survive a call, property assignment, or wrapper teardown. Application operations such as closing a window or finishing a Cairo surface retain their library-defined behavior.

[Guide](https://gtkx.dev/v2/guide/getting-started) · [GTKX](https://gtkx.dev)

GTKX runs on Linux with Node.js and system native libraries. See [Getting Started](https://gtkx.dev/v2/guide/getting-started) for supported versions and installation. This README describes the 2.0 beta.

[MPL-2.0](https://github.com/gtkx-org/gtkx/blob/main/LICENSE).
