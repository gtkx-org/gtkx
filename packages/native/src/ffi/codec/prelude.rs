pub(super) use super::{Decoder, Encoder, Ownership, PtrWriter, ReadSource};
pub(super) use crate::ffi::{self, value};
pub(super) use std::ffi::c_void;

use crate::messaging::error_reporter::ReportErr as _;
use std::ffi::c_char;

macro_rules! bail_expected {
    ($expected:expr, $label:expr, $value:expr) => {
        ::anyhow::bail!("Expected {} for {} codec, got {:?}", $expected, $label, $value)
    };
}
pub(super) use bail_expected;

pub(super) unsafe fn lossy_c_string(ptr: *const c_char) -> String {
    unsafe { glib::GStr::from_ptr_lossy(ptr) }.to_string()
}

pub(super) fn write_object_ptr(
    ptr: *mut c_void,
    value: &value::Value,
    label: &str,
) -> anyhow::Result<()> {
    let object_ptr = value.object_ptr(label)?;
    unsafe { ffi::Slot::new(ptr).store(object_ptr) };
    Ok(())
}

pub(super) fn write_return_object_ptr<F>(
    ret: *mut c_void,
    value: &std::result::Result<value::Value, ()>,
    transfer: F,
) where
    F: FnOnce(*mut c_void) -> *mut c_void,
{
    let ptr = value::Value::result_to_ptr(value);
    let owned = if ptr.is_null() { ptr } else { transfer(ptr) };
    unsafe { ffi::Slot::new(ret).store(owned) };
}

pub(super) unsafe fn swap_owned_slot<A, R>(
    ptr: *mut c_void,
    value: &value::Value,
    label: &str,
    acquire: A,
    release: R,
) -> anyhow::Result<()>
where
    A: FnOnce(*mut c_void) -> *mut c_void,
    R: FnOnce(*mut c_void),
{
    let new_ptr = value.object_ptr(label)?;
    let owned_new = if new_ptr.is_null() {
        new_ptr
    } else {
        acquire(new_ptr)
    };
    let old_ptr = unsafe { ffi::Slot::new(ptr).swap(owned_new) };
    if !old_ptr.is_null() {
        release(old_ptr);
    }
    Ok(())
}

pub(super) fn encode_and_leak_container<F>(
    value: &std::result::Result<value::Value, ()>,
    context: &'static str,
    encode: F,
) -> *mut c_void
where
    F: FnOnce(&value::Value) -> anyhow::Result<crate::ffi::StashedValue>,
{
    let Ok(value @ value::Value::Array(_)) = value else {
        return std::ptr::null_mut();
    };
    let Some(stashed_value) = encode(value).report_err(context) else {
        return std::ptr::null_mut();
    };
    let container = stashed_value.as_ptr(context).expect(context);
    std::mem::forget(stashed_value);
    container
}

pub(super) fn full_transfer_stashed(
    ptr: *mut c_void,
    release: crate::ffi::PendingRelease,
) -> crate::ffi::StashedValue {
    crate::ffi::StashedValue::Stashed(
        crate::ffi::Stash::unit(ptr).with_pending_transfer(ptr, release),
    )
}

pub(super) fn finalize_container_stash(
    storage: ffi::Stash,
    should_free: bool,
    mut acquired: Vec<ffi::PendingTransfer>,
    container_release: ffi::PendingRelease,
) -> ffi::StashedValue {
    let container = storage.ptr();
    if !should_free {
        acquired.push(ffi::PendingTransfer::new(container, container_release));
    }
    ffi::StashedValue::Stashed(storage.with_pending_transfers(acquired))
}
