//! napi-rs module exports for FFI operations.
//!
//! This module contains all the functions exported to JavaScript via napi-rs.

mod alloc;
mod call;
mod field;
mod freeze;
mod gobject;
pub(crate) mod handler;
mod init;
mod register_class;
mod stop;
mod toggle_ref;
