//! Shared raw-pointer primitives for the pointer-typed [`RawPtrCodec`] impls.
//!
//! The `GObject`, boxed, struct and fundamental codecs all marshal a single
//! machine pointer through a pointer-to-pointer slot. This module centralises
//! the three operations they share — writing a field pointer, writing a
//! return pointer, and the null-guarded read prologue — so that every
//! `unsafe` pointer write lives in one reviewed place.
//!
//! [`RawPtrCodec`]: super::RawPtrCodec

use std::ffi::c_void;

use crate::value;

/// Writes the machine pointer carried by `value` into the pointer-sized slot
/// at `ptr`.
///
/// `label` names the field being written and is surfaced in the error raised
/// when `value` does not carry an object pointer.
pub(super) fn write_object_ptr(
    ptr: *mut c_void,
    value: &value::Value,
    label: &str,
) -> anyhow::Result<()> {
    let obj_ptr = value.object_ptr(label)?;
    // SAFETY: The codec's caller guarantees `ptr` is a writable
    // pointer-sized slot; the write is unaligned-tolerant.
    unsafe { (ptr as *mut *mut c_void).write_unaligned(obj_ptr) };
    Ok(())
}

/// Writes a return pointer into the pointer-sized slot at `ret`.
///
/// A non-null pointer is first passed through `transfer`, which applies the
/// type's own ownership transfer for a returned value (a ref, a copy, …); a
/// null pointer is written through unchanged. Like [`write_object_ptr`], the
/// write is unaligned, so the helper makes no alignment assumption about the
/// slot.
pub(super) fn write_return_object_ptr<F>(
    ret: *mut c_void,
    value: &std::result::Result<value::Value, ()>,
    transfer: F,
) where
    F: FnOnce(*mut c_void) -> *mut c_void,
{
    let ptr = value::Value::result_to_ptr(value);
    let owned = if ptr.is_null() { ptr } else { transfer(ptr) };
    // SAFETY: The codec's caller guarantees `ret` is a writable
    // pointer-sized return slot; the write is unaligned-tolerant.
    unsafe { (ret as *mut *mut c_void).write_unaligned(owned) };
}

/// Swaps the strong reference a field slot holds for the one carried by
/// `value`.
///
/// Reads the incoming pointer from `value`, acquires a fresh reference on it
/// through `acquire` (a null passes through untouched, never acquired), writes
/// the slot, then releases the pointer the slot previously held through
/// `release` (a null is never released). The read-old/acquire/write-new/
/// release-old sequence is the shared skeleton every owned-pointer codec's
/// field write follows; each codec supplies only its own acquire and release.
///
/// `label` names the field being written and is surfaced in the error raised
/// when `value` does not carry an object pointer.
///
/// # Safety
///
/// `ptr` must be a writable pointer-sized field slot whose current contents
/// are either null or a pointer the codec's `release` can soundly drop.
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
    // SAFETY: The caller guarantees `ptr` is a readable pointer-sized field
    // slot; the read is unaligned-tolerant.
    let old_ptr = unsafe { (ptr as *const *mut c_void).read_unaligned() };
    let owned_new = if new_ptr.is_null() {
        new_ptr
    } else {
        acquire(new_ptr)
    };
    // SAFETY: The caller guarantees `ptr` is a writable pointer-sized field
    // slot; the write is unaligned-tolerant.
    unsafe { (ptr as *mut *mut c_void).write_unaligned(owned_new) };
    if !old_ptr.is_null() {
        release(old_ptr);
    }
    Ok(())
}

/// Wraps a transfer-full encoded pointer in storage that releases it through
/// `release` unless the call completes and disarms the transfer — the shared
/// shape of every pointer codec's full-ownership encode arm.
pub(super) fn full_transfer_storage(
    ptr: *mut c_void,
    release: crate::ffi::PendingRelease,
) -> crate::ffi::FfiValue {
    crate::ffi::FfiValue::Storage(
        crate::ffi::FfiStorage::unit(ptr).with_pending_transfer(ptr, release),
    )
}
