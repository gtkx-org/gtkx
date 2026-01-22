//! Neon module exports for FFI operations.
//!
//! This module contains all the functions exported to JavaScript via Neon.

mod alloc;
mod call;
mod field;
mod object;
mod poll;
mod start;
mod stop;

pub use alloc::alloc;
pub use call::call;
pub use field::{read, read_pointer, write, write_pointer};
pub use object::get_native_id;
pub use poll::poll;
pub use start::start;
pub use stop::stop;
