pub(super) use super::{
    Decoder, Encoder, IntegerBacked, Ownership, PtrWriter, ReadSource, SlotInit,
};
pub(super) use crate::ffi;
pub(super) use crate::value;
pub(super) use napi::Env;
pub(super) use napi::ValueType;
pub(super) use napi::bindgen_prelude::*;
pub(super) use std::ffi::c_void;

use crate::host::error_reporter::ReportErr as _;
use std::ffi::c_char;

macro_rules! bail_expected {
    ($expected:expr, $label:expr) => {
        ::anyhow::bail!("Expected {} for {} codec", $expected, $label)
    };
}
pub(super) use bail_expected;

macro_rules! reject_return_codec {
    ($kind:expr) => {
        fn call_cif(
            &self,
            _cif: &::libffi::middle::Cif,
            _ptr: ::libffi::middle::CodePtr,
            _args: &[::libffi::middle::Arg<'_>],
        ) -> ::anyhow::Result<$crate::ffi::Stash> {
            ::anyhow::bail!("{} codecs cannot be return codecs", $kind)
        }
    };
}
pub(super) use reject_return_codec;

macro_rules! read_value_non_null {
    (|$self_:ident, $env:ident, $ptr:ident| $body:expr) => {
        unsafe fn read_value<'e>(
            &$self_,
            $env: &'e ::napi::Env,
            $ptr: *mut ::std::ffi::c_void,
            _context: &str,
        ) -> ::anyhow::Result<::napi::bindgen_prelude::Unknown<'e>> {
            $self_.decode_non_null($env, $ptr, |$ptr| $body)
        }
    };
}
pub(super) use read_value_non_null;

macro_rules! write_return_transferred {
    ($label:expr) => {
        fn write_return_to_ptr(
            &self,
            env: &::napi::Env,
            ret: $crate::ffi::Slot,
            value: &::std::result::Result<::napi::bindgen_prelude::Unknown<'_>, ()>,
        ) {
            self.write_return_with_ownership(env, ret, value, self.ownership, |ptr| {
                $crate::host::error_reporter::ReportErr::report_err(
                    unsafe { self.ref_for_transfer(ptr) },
                    $label,
                )
                .unwrap_or(::std::ptr::null_mut())
            });
        }
    };
}
pub(super) use write_return_transferred;

pub(super) unsafe fn lossy_c_string(ptr: *const c_char) -> String {
    unsafe { glib::GStr::from_ptr_lossy(ptr) }.to_string()
}

pub(super) fn ref_for_full_transfer<F>(
    ownership: Ownership,
    ptr: *mut c_void,
    acquire: F,
) -> anyhow::Result<*mut c_void>
where
    F: FnOnce(*mut c_void) -> anyhow::Result<*mut c_void>,
{
    if !ownership.is_full() || ptr.is_null() {
        return Ok(ptr);
    }
    acquire(ptr)
}

pub(super) fn write_object_ptr(
    slot: ffi::Slot,
    value: Unknown<'_>,
    label: &str,
) -> anyhow::Result<()> {
    let object_ptr = value::handle_ptr(value, label)?;
    unsafe { slot.store(object_ptr) };
    Ok(())
}

pub(super) fn write_return_object_ptr<F>(
    ret: ffi::Slot,
    value: &std::result::Result<Unknown<'_>, ()>,
    transfer: F,
) where
    F: FnOnce(*mut c_void) -> *mut c_void,
{
    let ptr = match value {
        Ok(unknown) => value::handle_ptr(*unknown, "object return").unwrap_or(std::ptr::null_mut()),
        Err(()) => std::ptr::null_mut(),
    };
    let owned = if ptr.is_null() { ptr } else { transfer(ptr) };
    unsafe { ret.store(owned) };
}

pub(super) fn swap_owned_slot<A, R>(
    slot: ffi::Slot,
    value: Unknown<'_>,
    init: SlotInit,
    label: &str,
    acquire: A,
    release: R,
) -> anyhow::Result<()>
where
    A: FnOnce(*mut c_void) -> *mut c_void,
    R: FnOnce(*mut c_void),
{
    let new_ptr = value::handle_ptr(value, label)?;
    let owned = if new_ptr.is_null() {
        new_ptr
    } else {
        acquire(new_ptr)
    };
    if !init.is_initialized() {
        unsafe { slot.store(owned) };
        return Ok(());
    }
    let old_ptr = unsafe { slot.swap(owned) };
    if !old_ptr.is_null() {
        release(old_ptr);
    }
    Ok(())
}

// The callee owns the container from here on, so the pending transfers are disarmed. Only the
// backing store the C container actually points into has to outlive this call; everything else the
// stash owns is Rust-side bookkeeping that would otherwise leak on every invocation.
fn aliases_stash_backing(stash: &ffi::Stash) -> bool {
    let ffi::Stash::Storage(storage) = stash else {
        return true;
    };
    match storage.data() {
        ffi::StashData::Unit | ffi::StashData::ObjectArray(_, _) => false,
        ffi::StashData::List(list) => matches!(
            &list.payload,
            ffi::ListPayload::Strings {
                items_duped: false,
                ..
            }
        ),
        _ => true,
    }
}

pub(super) fn encode_and_leak_container<F>(
    value: &std::result::Result<Unknown<'_>, ()>,
    context: &'static str,
    encode: F,
) -> *mut c_void
where
    F: FnOnce(Unknown<'_>) -> anyhow::Result<ffi::Stash>,
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
    let Some(container) = stash.as_ptr(context).report_err(context) else {
        return std::ptr::null_mut();
    };
    stash.disarm_pending_transfer();
    if aliases_stash_backing(&stash) {
        std::mem::forget(stash);
    }
    container
}

pub(super) fn full_transfer_stash(ptr: *mut c_void, release: ffi::ReleaseKind) -> ffi::Stash {
    ffi::Stash::Storage(ffi::StashStorage::unit(ptr).with_pending_transfer(ptr, release))
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
