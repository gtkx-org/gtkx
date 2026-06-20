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

pub use managed::{Boxed, Fundamental, NativeHandle, NativeValue};
