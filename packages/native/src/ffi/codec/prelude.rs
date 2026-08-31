use std::ffi::c_char;
pub(super) use std::ffi::c_void;

pub(super) use napi::bindgen_prelude::*;
pub(super) use napi::{Env, ValueType};

pub(super) use super::{
    Decoder, Encoder, IntegerBacked, Ownership, PtrWriter, ReadCtx, ReadSource, SlotInit,
};
use crate::handle::Handle;
use crate::host::error_reporter::ReportErr as _;
pub(super) use crate::{ffi, value};

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
    (|$self_:ident, $env:ident, $ptr:ident, $transfer:pat_param| $body:expr) => {
        unsafe fn read_value<'e>(
            &$self_,
            $env: &'e ::napi::Env,
            $ptr: *mut ::std::ffi::c_void,
            _context: &str,
            $transfer: $crate::ffi::codec::Ownership,
        ) -> ::anyhow::Result<::napi::bindgen_prelude::Unknown<'e>> {
            $self_.decode_non_null($env, $ptr, |$ptr| $body)
        }
    };
}
pub(super) use read_value_non_null;

macro_rules! write_container_value_to_ptr {
    ($noun:literal, $label:literal, $release:expr) => {
        fn write_value_to_ptr(
            &self,
            env: &::napi::Env,
            slot: $crate::ffi::Slot,
            value: ::napi::bindgen_prelude::Unknown<'_>,
            init: $crate::ffi::codec::SlotInit,
        ) -> ::anyhow::Result<::std::option::Option<$crate::ffi::PendingTransfer>> {
            ::anyhow::ensure!(
                self.ownership.is_full(),
                ::std::concat!(
                    "A transfer-none ",
                    $noun,
                    " cannot be written through a pointer: nothing would own the container"
                )
            );

            let container = $crate::ffi::codec::prelude::encode_and_leak_container(
                &::std::result::Result::Ok(value),
                $label,
                |value| $crate::ffi::codec::Encoder::encode(self, env, value),
            );

            if !init.is_initialized() {
                unsafe { slot.store(container) };

                return ::std::result::Result::Ok(::std::option::Option::None);
            }

            let previous = unsafe { slot.swap(container) };

            if !previous.is_null() {
                let release: fn(&Self) -> $crate::ffi::ReleaseKind = $release;

                $crate::ffi::PendingTransfer::new(previous, release(self)).release_now();
            }

            ::std::result::Result::Ok(::std::option::Option::None)
        }
    };
}
pub(super) use write_container_value_to_ptr;

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

/// Whether the value being written already lives in the slot it is written to, which is what a
/// field read handed straight back to its own setter looks like.
pub(super) fn is_slot_its_own_source(slot: ffi::Slot, src_ptr: *mut c_void) -> bool {
    std::ptr::eq(slot.as_ptr(), src_ptr)
}

/// Copies `size` bytes into the slot, tolerating a source that overlaps it.
pub(super) fn copy_into_slot(slot: ffi::Slot, src_ptr: *mut c_void, size: usize) {
    unsafe {
        std::ptr::copy(src_ptr.cast::<u8>(), slot.as_ptr().cast::<u8>(), size);
    }
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
    check: impl FnOnce(&Handle) -> anyhow::Result<()>,
) -> anyhow::Result<Option<ffi::PendingTransfer>> {
    let object_ptr = value::handle_ptr_checked(value, label, check)?;
    unsafe { slot.store(object_ptr) };
    Ok(None)
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

pub(super) fn store_acquired_slot<A, C>(
    slot: ffi::Slot,
    value: Unknown<'_>,
    label: &str,
    check: C,
    acquire: A,
    release: Option<ffi::ReleaseKind>,
) -> anyhow::Result<Option<ffi::PendingTransfer>>
where
    A: FnOnce(*mut c_void) -> *mut c_void,
    C: FnOnce(&Handle) -> anyhow::Result<()>,
{
    let new_ptr = value::handle_ptr_checked(value, label, check)?;
    let owned = if new_ptr.is_null() {
        new_ptr
    } else {
        acquire(new_ptr)
    };
    unsafe { slot.store(owned) };
    if owned.is_null() {
        return Ok(None);
    }

    Ok(release.map(|release| ffi::PendingTransfer::new(owned, release)))
}

pub(super) fn swap_owned_slot<A, R, C>(
    slot: ffi::Slot,
    value: Unknown<'_>,
    init: SlotInit,
    label: &str,
    check: C,
    acquire: A,
    release: R,
) -> anyhow::Result<Option<ffi::PendingTransfer>>
where
    A: FnOnce(*mut c_void) -> *mut c_void,
    R: FnOnce(*mut c_void),
    C: FnOnce(&Handle) -> anyhow::Result<()>,
{
    let new_ptr = value::handle_ptr_checked(value, label, check)?;
    let owned = if new_ptr.is_null() {
        new_ptr
    } else {
        acquire(new_ptr)
    };
    if !init.is_initialized() {
        unsafe { slot.store(owned) };
        return Ok(None);
    }
    let old_ptr = unsafe { slot.swap(owned) };
    if !old_ptr.is_null() {
        release(old_ptr);
    }
    Ok(None)
}

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

pub(super) fn owned_view_storage(view: &value::TypedView) -> ffi::StashStorage {
    match view.kind() {
        value::ViewKind::Int8 => view.to_vec::<i8>().into(),
        value::ViewKind::Uint8 | value::ViewKind::Uint8Clamped | value::ViewKind::DataView => {
            view.to_vec::<u8>().into()
        }
        value::ViewKind::Int16 => view.to_vec::<i16>().into(),
        value::ViewKind::Uint16 => view.to_vec::<u16>().into(),
        value::ViewKind::Int32 => view.to_vec::<i32>().into(),
        value::ViewKind::Uint32 => view.to_vec::<u32>().into(),
        value::ViewKind::Float32 => view.to_vec::<f32>().into(),
        value::ViewKind::Float64 => view.to_vec::<f64>().into(),
        value::ViewKind::BigInt64 => view.to_vec::<i64>().into(),
        value::ViewKind::BigUint64 => view.to_vec::<u64>().into(),
    }
}

fn terminated<T: Copy + Default>(mut values: Vec<T>) -> Vec<T> {
    values.push(T::default());
    values
}

/// Copies a view into storage of this side's own, with one zero element appended, for a callee
/// that walks a length-bounded array to its terminator instead of trusting the count.
pub(super) fn terminated_view_storage(view: &value::TypedView) -> ffi::StashStorage {
    match view.kind() {
        value::ViewKind::Int8 => terminated(view.to_vec::<i8>()).into(),
        value::ViewKind::Uint8 | value::ViewKind::Uint8Clamped | value::ViewKind::DataView => {
            terminated(view.to_vec::<u8>()).into()
        }
        value::ViewKind::Int16 => terminated(view.to_vec::<i16>()).into(),
        value::ViewKind::Uint16 => terminated(view.to_vec::<u16>()).into(),
        value::ViewKind::Int32 => terminated(view.to_vec::<i32>()).into(),
        value::ViewKind::Uint32 => terminated(view.to_vec::<u32>()).into(),
        value::ViewKind::Float32 => terminated(view.to_vec::<f32>()).into(),
        value::ViewKind::Float64 => terminated(view.to_vec::<f64>()).into(),
        value::ViewKind::BigInt64 => terminated(view.to_vec::<i64>()).into(),
        value::ViewKind::BigUint64 => terminated(view.to_vec::<u64>()).into(),
    }
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
