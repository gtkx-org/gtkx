//! # GTKX Native Module
//!
//! Neon-based native module providing FFI bindings between JavaScript and GTK4.
//! This is the core bridge that enables React components to control native GTK widgets.
//!
//! ## Exported Functions
//!
//! | Function | Purpose |
//! |----------|---------|
//! | `start` | Initialize GTK application and spawn GTK thread |
//! | `stop` | Shutdown GTK application and join thread |
//! | `call` | Execute FFI function call to native library |
//! | `batchCall` | Execute multiple FFI calls in one round-trip |
//! | `alloc` | Allocate memory for boxed types |
//! | `read` | Read field from boxed memory |
//! | `write` | Write field to boxed memory |
//! | `getNativeId` | Get internal handle ID for managed object |
//! | `poll` | Process pending JavaScript callbacks |
//!
//! ## Architecture
//!
//! Two-thread model for GTK's single-threaded requirements:
//!
//! - **Neon/JS thread**: Handles JavaScript calls, argument conversion, callback dispatch
//! - **GTK thread**: Runs GTK main loop, executes all widget operations
//!
//! Communication flows through:
//! - `gtk_dispatch`: Schedules tasks from JS thread to GTK thread
//! - `js_dispatch`: Queues callbacks from GTK thread back to JS
//!
//! ## Core Types
//!
//! - `Value`: Central data interchange type (JS ↔ CIF ↔ GLib)
//! - `NativeValue`: Managed wrapper for GObject, Boxed, and Fundamental instances
//! - `Type`: Type system describing all FFI-compatible types
//! - `ffi::FfiValue`: Low-level libffi argument representation

pub mod arg;
pub mod ffi;
pub mod gtk_dispatch;
mod js_dispatch;
pub mod managed;
pub mod module;
pub mod state;
pub mod trampoline;
pub mod types;
pub mod value;

pub use managed::{Boxed, Fundamental, NativeHandle, NativeValue};

use neon::prelude::*;

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("start", module::start)?;
    cx.export_function("stop", module::stop)?;
    cx.export_function("call", module::call)?;
    cx.export_function("batchCall", module::batch_call)?;
    cx.export_function("read", module::read)?;
    cx.export_function("write", module::write)?;
    cx.export_function("alloc", module::alloc)?;
    cx.export_function("getNativeId", module::get_native_id)?;
    cx.export_function("poll", module::poll)?;
    Ok(())
}
