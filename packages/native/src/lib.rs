//! # GTKX Native Module
//!
//! Neon-based native module providing FFI bindings between JavaScript and GLib/GObject-based libraries.
//! This is the core bridge that enables JavaScript to call into any GLib/GObject-based native library.
//!
//! ## Exported Functions
//!
//! | Function | Purpose |
//! |----------|---------|
//! | `start` | Initialize the `GLib` main loop and spawn its thread |
//! | `stop` | Shutdown the `GLib` main loop and join its thread |
//! | `call` | Execute FFI function call to native library |
//! | `alloc` | Allocate memory for boxed types |
//! | `read` | Read field from boxed/struct memory |
//! | `write` | Write primitive field to boxed memory (constructor initialization) |
//! | `getNativeId` | Get internal handle ID for managed object |
//! | `freeze` | Freeze tick callbacks during React commit (prevents intermediate repaints) |
//! | `unfreeze` | Unfreeze tick callbacks and allow a single repaint |
//!
//! ## Architecture
//!
//! Two-thread model for `GLib`'s single-threaded main loop requirements:
//!
//! - **Neon/JS thread**: Handles JavaScript calls, argument conversion, callback dispatch
//! - **`GLib` thread**: Runs the `GLib` main loop, executes all native operations
//!
//! Communication flows through `dispatch::Mailbox`, a single bidirectional bridge
//! that exposes a GLib-bound inbox and a JS-bound inbox. Cross-boundary calls
//! park on a wake signal while their wait loop continues to service incoming
//! requests, so re-entrance `JS → GLib → JS → GLib` falls out of the call stack
//! to arbitrary depth without explicit driver state or depth tracking.
//!
//! ## Core Types
//!
//! - `Value`: Central data interchange type (JS ↔ CIF ↔ `GLib`)
//! - `NativeValue`: Managed wrapper for `GObject`, Boxed, and Fundamental instances
//! - `Type`: Type system describing all FFI-compatible types
//! - `ffi::FfiValue`: Low-level libffi argument representation

#[macro_use]
mod macros;

pub mod arg;
pub mod callback;
pub mod dispatch;
pub mod error_reporter;
pub mod ffi;
pub mod glib_log_handler;
pub mod managed;
pub mod module;
pub mod state;
pub mod trampoline;
pub mod types;
pub mod value;
pub mod wait_signal;

pub use managed::{Boxed, Fundamental, NativeHandle, NativeValue};

use neon::prelude::*;

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("start", module::start)?;
    cx.export_function("stop", module::stop)?;
    cx.export_function("call", module::call)?;
    cx.export_function("read", module::read)?;
    cx.export_function("write", module::write)?;
    cx.export_function("alloc", module::alloc)?;
    cx.export_function("getNativeId", module::get_native_id)?;
    cx.export_function("isNativeHandle", module::is_native_handle)?;
    cx.export_function("freeze", module::freeze)?;
    cx.export_function("unfreeze", module::unfreeze)?;
    Ok(())
}
