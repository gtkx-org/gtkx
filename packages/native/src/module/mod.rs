//! Neon module exports for FFI operations.
//!
//! This module contains all the functions exported to JavaScript via Neon.

mod alloc;
mod call;
mod field;
mod freeze;
pub(crate) mod handler;
mod object;
mod start;
mod stop;

pub use alloc::alloc;
pub use call::call;
pub use field::{read, write};
pub use freeze::{freeze, unfreeze};
pub use object::get_native_id;
pub use start::start;
pub use stop::stop;
