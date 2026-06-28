#![allow(deprecated)]
#![allow(rustdoc::private_intra_doc_links)]
#![cfg_attr(coverage_nightly, feature(coverage_attribute))]

#[macro_use]
mod macros;

pub(crate) mod request;

pub mod ffi;
pub mod handle;
pub mod messaging;

pub use handle::{Boxed, Handle};
