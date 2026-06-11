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

/// Writes a return pointer honoring the declared transfer mode: a borrowed
/// (transfer-none) return writes the wrapper-held pointer unchanged, while a
/// full transfer passes it through `acquire`, which produces the caller's own
/// reference or copy.
pub(super) fn write_return_with_ownership<F>(
    ret: *mut c_void,
    value: &std::result::Result<value::Value, ()>,
    ownership: super::Ownership,
    acquire: F,
) where
    F: FnOnce(*mut c_void) -> *mut c_void,
{
    write_return_object_ptr(ret, value, |ptr| {
        if ownership.is_borrowed() {
            ptr
        } else {
            acquire(ptr)
        }
    });
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

/// Decodes `ptr` to a [`value::Value`], short-circuiting a null pointer to
/// [`value::Value::Null`].
///
/// `decode` runs only for a non-null pointer and receives it unchanged. This
/// is the shared prologue of the pointer-typed `ptr_to_value` implementations.
pub(super) fn null_guarded<F>(ptr: *mut c_void, decode: F) -> anyhow::Result<value::Value>
where
    F: FnOnce(*mut c_void) -> anyhow::Result<value::Value>,
{
    if ptr.is_null() {
        return Ok(value::Value::Null);
    }
    decode(ptr)
}
