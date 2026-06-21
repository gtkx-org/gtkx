use std::ffi::c_void;

use crate::value;

/// Writes the raw object pointer of `value` into the pointer-sized slot at `ptr`.
///
/// `ptr` is a field/return slot supplied by the FFI marshalling layer, which only hands this
/// helper a writable, pointer-sized destination. The slot receives a borrowed pointer; no
/// ownership is transferred.
pub(super) fn write_object_ptr(
    ptr: *mut c_void,
    value: &value::Value,
    label: &str,
) -> anyhow::Result<()> {
    let obj_ptr = value.object_ptr(label)?;
    // SAFETY: `ptr` is a marshalling-provided slot guaranteed to address a pointer-sized
    // writable region; `write_unaligned` stores into it without an alignment requirement.
    unsafe { (ptr as *mut *mut c_void).write_unaligned(obj_ptr) };
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
    // SAFETY: `ret` is a marshalling-provided return slot guaranteed to address a pointer-sized
    // writable region; `write_unaligned` stores the (possibly owned) result pointer there.
    unsafe { (ret as *mut *mut c_void).write_unaligned(owned) };
}

/// Replaces the owned pointer stored in a field slot, acquiring the new value and releasing the
/// previous one so the slot's reference count stays balanced.
///
/// # Safety
///
/// `ptr` must address a pointer-sized, readable and writable slot that already holds either null
/// or a pointer owned by this slot. `acquire` must return an owned pointer for the slot to keep
/// (e.g. a fresh ref/copy), and `release` must drop exactly the ownership the slot previously
/// held; mismatching them would double-free or leak.
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
    // SAFETY: `ptr` is a pointer-sized readable slot per the contract; `read_unaligned` loads the
    // currently stored (owned-or-null) pointer without an alignment requirement.
    let old_ptr = unsafe { (ptr as *const *mut c_void).read_unaligned() };
    let owned_new = if new_ptr.is_null() {
        new_ptr
    } else {
        acquire(new_ptr)
    };
    // SAFETY: `ptr` is a pointer-sized writable slot per the contract; the owned (or null) new
    // pointer replaces the previous one, which is released below to balance ownership.
    unsafe { (ptr as *mut *mut c_void).write_unaligned(owned_new) };
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
    F: FnOnce(&value::Value) -> anyhow::Result<crate::ffi::FfiValue>,
{
    let Ok(value @ value::Value::Array(_)) = value else {
        return std::ptr::null_mut();
    };
    let ffi_value = match encode(value) {
        Ok(ffi_value) => ffi_value,
        Err(err) => {
            crate::error_reporter::NativeErrorReporter::global().report(&err.context(context));
            return std::ptr::null_mut();
        }
    };
    let container = ffi_value.as_ptr(context).unwrap_or(std::ptr::null_mut());
    std::mem::forget(ffi_value);
    container
}

pub(super) fn full_transfer_storage(
    ptr: *mut c_void,
    release: crate::ffi::PendingRelease,
) -> crate::ffi::FfiValue {
    crate::ffi::FfiValue::Storage(
        crate::ffi::FfiStorage::unit(ptr).with_pending_transfer(ptr, release),
    )
}
