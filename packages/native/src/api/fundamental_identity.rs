use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::handle::Handle;

/// The identity of a live fundamental instance and whether this handle owns a reference to it.
/// The key names the instance only while it remains alive; it grants no memory access.
#[napi(object)]
pub struct FundamentalIdentity {
    pub key: BigInt,
    pub owned: bool,
}

/// Returns a fundamental instance's identity, or null for another handle kind or an ended borrow.
/// Only an owned handle can keep the identity valid for a cached JavaScript wrapper's lifetime.
#[napi(catch_unwind)]
#[must_use]
pub fn get_fundamental_identity(handle: &External<Handle>) -> Option<FundamentalIdentity> {
    let ptr = handle.as_fundamental_ptr()?;

    Some(FundamentalIdentity {
        key: BigInt::from(ptr as usize as u64),
        owned: handle.as_owned_fundamental_ptr().is_some(),
    })
}
