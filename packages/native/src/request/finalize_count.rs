#![cfg_attr(coverage_nightly, coverage(off))]

use std::sync::atomic::{AtomicU64, Ordering};

use napi_derive::napi;

pub static FINALIZE_COUNT: AtomicU64 = AtomicU64::new(0);

#[napi(catch_unwind)]
#[allow(clippy::unnecessary_wraps)]
#[cfg_attr(test, allow(dead_code))]
pub fn finalize_count() -> napi::Result<f64> {
    Ok(FINALIZE_COUNT.load(Ordering::SeqCst) as f64)
}
