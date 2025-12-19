//! Native Rust module for GTKX providing FFI bindings to GTK4.
//!
//! This module exposes GTK4 functionality to JavaScript via the Neon framework.
//! It handles value conversion between JavaScript and C/GLib types, callback
//! trampolines for GTK signals, and memory management for GObject instances.

#[macro_use]
mod macros;
mod arg;
mod boxed;
mod callback;
mod cif;
mod gtk_dispatch;
mod js_dispatch;
mod module;
mod object;
mod queue;
mod state;
mod types;
mod value;

#[cfg(test)]
mod test_utils;

use neon::prelude::*;

/// Entry point for the Neon native module.
///
/// Exports the following functions to JavaScript:
/// - `start`: Initialize GTK application and start the main loop
/// - `stop`: Stop the GTK main loop
/// - `call`: Invoke a native function via FFI
/// - `batchCall`: Execute multiple void FFI calls in a single dispatch
/// - `read`: Read a field from a native object
/// - `write`: Write a field to a native object
/// - `alloc`: Allocate memory for a boxed type
/// - `getObjectId`: Get the native pointer address for an object
/// - `poll`: Process pending JS callbacks (for runtimes without proper channel support)
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
