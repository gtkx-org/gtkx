//! # GTKX Native Module
//!
//! napi-rs based native module bridging JavaScript and GLib/GObject-based
//! libraries, so JavaScript can call into any GLib/GObject-based native library.
//!
//! ## Architecture
//!
//! Two-thread model for `GLib`'s single-threaded main loop requirements:
//!
//! - **Node.js/JS thread**: Handles JavaScript calls, argument conversion, callback dispatch
//! - **`GLib` thread**: Runs the `GLib` main loop, executes all native operations
//!
//! Communication flows through `dispatch::Mailbox`, a single bidirectional bridge
//! that exposes a GLib-bound inbox and a JS-bound inbox. Cross-boundary calls
//! park on a wake signal while their wait loop continues to service incoming
//! requests, so re-entrance `JS → GLib → JS → GLib` falls out of the call stack
//! to arbitrary depth. Each `GLib` task is tagged with the JS callback-nesting
//! depth in effect when it was enqueued, and a thread parked inside a callback
//! drains only the tasks nested at or below that depth.
//!
//! ## napi-rs compatibility types
//!
//! Cross-thread JavaScript reference storage (`napi::Ref<JsFunction>`,
//! `napi::Ref<JsObject>`) requires the v2-compatibility types
//! `napi::JsFunction` and `napi::JsObject` rather than the lifetime-scoped
//! `Function<'_>` / `Object<'_>` from `bindgen_prelude`. The crate-level
//! `#![allow(deprecated)]` below permits their use until napi-rs offers a
//! `Send + Sync` reference type for the typed surface.

#![allow(deprecated)]
#![allow(rustdoc::private_intra_doc_links)]
#![cfg_attr(coverage_nightly, feature(coverage_attribute))]

#[macro_use]
mod macros;

pub mod arg;
pub mod dispatch;
pub mod error_reporter;
pub mod ffi;
pub mod glib_log_handler;
pub mod managed;
pub mod module;
pub mod panic_handler;
pub mod state;
pub mod toggle_ref;
pub mod trampoline;
pub mod types;
pub mod value;
pub mod wait_signal;

pub use managed::{Boxed, Fundamental, NativeHandle, NativeValue};
