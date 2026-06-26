#![allow(deprecated)]
#![allow(rustdoc::private_intra_doc_links)]
#![cfg_attr(coverage_nightly, feature(coverage_attribute))]

#[macro_use]
mod macros;

pub(crate) mod error_reporter;
pub(crate) mod glib_log_handler;
pub(crate) mod op;
pub(crate) mod wrapper_registry;

// These modules form no part of the napi-only public contract. They are reachable as a real
// public Rust surface only when the `test-support` feature is enabled — which the `test` and
// `native-bench` scripts pass so the in-crate integration tests and benches can reach internals
// through full module paths — and are `pub(crate)` otherwise. The `#[napi]` exports are
// registered through napi's ctor-based registration and do not depend on this visibility.
test_visible_modules! {
    arg,
    dispatch,
    ffi,
    glib_thread,
    glib_thread_state,
    managed,
    panic_handler,
    trampoline,
    types,
    value,
}

pub use managed::{Boxed, NativeHandle};
