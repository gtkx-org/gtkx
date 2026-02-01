//! # GTKX Native Module
//!
//! Neon-based native module providing FFI bindings between JavaScript and GLib/GObject-based libraries.
//! This is the core bridge that enables JavaScript to call into any GLib/GObject-based native library.
//!
//! ## Exported Functions
//!
//! | Function | Purpose |
//! |----------|---------|
//! | `start` | Initialize the GLib main loop and spawn its thread |
//! | `stop` | Shutdown the GLib main loop and join its thread |
//! | `call` | Execute FFI function call to native library |
//! | `alloc` | Allocate memory for boxed types |
//! | `read` | Read field from boxed memory |
//! | `write` | Write field to boxed memory |
//! | `getNativeId` | Get internal handle ID for managed object |
//!
//! ## Architecture
//!
//! Two-thread model for GLib's single-threaded main loop requirements:
//!
//! - **Neon/JS thread**: Handles JavaScript calls, argument conversion, callback dispatch
//! - **GLib thread**: Runs the GLib main loop, executes all native operations
//!
//! Communication flows through:
//! - `gtk_dispatch`: Schedules tasks from JS thread to GLib thread
//! - `js_dispatch`: Queues callbacks from GLib thread back to JS
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
    cx.export_function("read", module::read)?;
    cx.export_function("write", module::write)?;
    cx.export_function("readPointer", module::read_pointer)?;
    cx.export_function("writePointer", module::write_pointer)?;
    cx.export_function("alloc", module::alloc)?;
    cx.export_function("getNativeId", module::get_native_id)?;
    Ok(())
}
