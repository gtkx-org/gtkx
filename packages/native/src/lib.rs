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
//! | `getObjectId` | Get internal pointer for managed object |
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
//! - `Object`: Managed wrapper for GObject, Boxed, and GVariant
//! - `Type`: Type system describing all FFI-compatible types
//! - `cif::Value`: Low-level libffi argument representation

pub mod arg;
pub mod boxed;
pub mod callback;
pub mod cif;
pub mod error;
pub mod gtk_dispatch;
pub mod integer;
mod js_dispatch;
mod module;
pub mod object;
pub mod ownership;
pub mod queue;
pub mod state;
pub mod types;
pub mod value;
pub mod variant;

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
    cx.export_function("getObjectId", module::get_object_id)?;
    cx.export_function("poll", module::poll)?;
    Ok(())
}
