pub(super) use super::{Decoder, Encoder, Ownership, PtrWriter, ReadSource};
pub(super) use crate::ffi::{self, value};
pub(super) use napi::Env;
pub(super) use napi::ValueType;
pub(super) use napi::bindgen_prelude::*;
pub(super) use std::ffi::c_void;

use crate::messaging::error_reporter::ReportErr as _;
use std::ffi::c_char;

macro_rules! bail_expected {
    ($expected:expr, $label:expr) => {
        ::anyhow::bail!("Expected {} for {} codec", $expected, $label)
    };
}
pub(super) use bail_expected;

pub(super) unsafe fn lossy_c_string(ptr: *const c_char) -> String {
    unsafe { glib::GStr::from_ptr_lossy(ptr) }.to_string()
}

pub(super) fn reject_return_codec(kind: &str) -> anyhow::Result<ffi::Stash> {
    ::anyhow::bail!("{kind} codecs cannot be return codecs")
}

pub(super) fn write_object_ptr(
    env: &Env,
    slot: ffi::Slot,
    value: Unknown<'_>,
    label: &str,
) -> anyhow::Result<()> {
    let object_ptr = value::handle_ptr(env, value, label)?;
    unsafe { slot.store(object_ptr) };
    Ok(())
}

pub(super) fn write_return_object_ptr<F>(
    env: &Env,
    ret: ffi::Slot,
    value: &std::result::Result<Unknown<'_>, ()>,
    transfer: F,
) where
    F: FnOnce(*mut c_void) -> *mut c_void,
{
    let ptr = match value {
        Ok(unknown) => {
            value::handle_ptr(env, *unknown, "object return").unwrap_or(std::ptr::null_mut())
        }
        Err(()) => std::ptr::null_mut(),
    };
    let owned = if ptr.is_null() { ptr } else { transfer(ptr) };
    unsafe { ret.store(owned) };
}

pub(super) fn swap_owned_slot<A, R>(
    env: &Env,
    slot: ffi::Slot,
    value: Unknown<'_>,
    label: &str,
    acquire: A,
    release: R,
) -> anyhow::Result<()>
where
    A: FnOnce(*mut c_void) -> *mut c_void,
    R: FnOnce(*mut c_void),
{
    let new_ptr = value::handle_ptr(env, value, label)?;
    let owned = if new_ptr.is_null() {
        new_ptr
    } else {
        acquire(new_ptr)
    };
    let old_ptr = unsafe { slot.swap(owned) };
    if !old_ptr.is_null() {
        release(old_ptr);
    }
    Ok(())
}

pub(super) fn encode_and_leak_container<F>(
    value: &std::result::Result<Unknown<'_>, ()>,
    context: &'static str,
    encode: F,
) -> *mut c_void
where
    F: FnOnce(Unknown<'_>) -> anyhow::Result<crate::ffi::Stash>,
{
    let Ok(unknown) = value else {
        return std::ptr::null_mut();
    };
    if !unknown.is_array().unwrap_or(false) {
        return std::ptr::null_mut();
    }
    let Some(stash) = encode(*unknown).report_err(context) else {
        return std::ptr::null_mut();
    };
    let container = stash.as_ptr(context).expect(context);
    std::mem::forget(stash);
    container
}

pub(super) fn full_transfer_stash(
    ptr: *mut c_void,
    release: crate::ffi::ReleaseKind,
) -> crate::ffi::Stash {
    crate::ffi::Stash::Storage(
        crate::ffi::StashStorage::unit(ptr).with_pending_transfer(ptr, release),
    )
}

pub(super) fn finalize_container_stash(
    storage: ffi::StashStorage,
    should_free: bool,
    mut acquired: Vec<ffi::PendingTransfer>,
    container_release: ffi::ReleaseKind,
) -> ffi::Stash {
    let container = storage.ptr();
    if !should_free {
        acquired.push(ffi::PendingTransfer::new(container, container_release));
    }
    ffi::Stash::Storage(storage.with_pending_transfers(acquired))
}
