#![allow(deprecated)]
#![allow(rustdoc::private_intra_doc_links)]
#![cfg_attr(coverage_nightly, feature(coverage_attribute))]

#[macro_use]
mod macros;

pub(crate) mod request;

// The test-support napi functions exist only in debug builds; release builds (the published
// artifact) omit them entirely. Debug builds cover every dev, test, coverage, asan, and miri run.
#[cfg(debug_assertions)]
mod test_support;

pub mod ffi;
pub mod handle;
pub mod messaging;

pub use handle::{Boxed, Handle};
