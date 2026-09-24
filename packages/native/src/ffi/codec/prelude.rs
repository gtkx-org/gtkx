use std::ffi::c_char;
pub(super) use std::ffi::c_void;

pub(super) use napi::bindgen_prelude::*;
pub(super) use napi::{Env, Status, ValueType};

pub(super) use super::{
    Decoder, Encoder, IntegerBacked, Ownership, PtrWriter, ReadCtx, ReadSource, SlotInit,
};
use crate::handle::Handle;
pub(super) use crate::{ffi, value};

macro_rules! bail_expected {
    ($expected:expr, $label:expr) => {
        ::anyhow::bail!("Expected {} for {} codec", $expected, $label)
    };
}
pub(super) use bail_expected;

pub(super) fn reject_callback_return(env: Env, error: &anyhow::Error) {
    crate::host::callback_error::CallbackErrorScope::deliver(
        env,
        Error::new(Status::InvalidArg, error.to_string()),
    );
}

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

pub(super) fn write_container_value<'e, R>(
    slot: ffi::Slot,
    value: Unknown<'e>,
    init: SlotInit,
    ownership: Ownership,
    context: &str,
    encode: impl FnOnce(Unknown<'e>) -> anyhow::Result<ffi::Stash>,
    prepare_release: impl FnOnce() -> anyhow::Result<R>,
) -> anyhow::Result<Option<ffi::PendingTransfer>>
where
    R: FnOnce(*mut c_void),
{
    anyhow::ensure!(
        ownership.is_full(),
        "{context}: a transfer-none container cannot be written through a pointer"
    );
    let release = if init.is_initialized() && !unsafe { slot.load() }.is_null() {
        Some(prepare_release()?)
    } else {
        None
    };
    let encoded = encode(value)?;
    let container = transfer_container(&encoded, context)?;

    if !init.is_initialized() {
        unsafe { slot.store(container) };
        return Ok(None);
    }

    let previous = unsafe { slot.swap(container) };
    if let Some(release) = release {
        release(previous);
    }
    Ok(None)
}

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

fn retains_transfer_backing(stash: &ffi::Stash) -> bool {
    let ffi::Stash::Storage(storage) = stash else {
        return matches!(stash, ffi::Stash::Ptr(ptr) if !ptr.is_null());
    };
    if storage.byte_len().is_some() {
        return true;
    }
    match storage.data() {
        ffi::StashData::StringArray(strings, ptrs) => {
            !strings.is_empty()
                || (!ptrs.is_empty() && storage.ptr() == ptrs.as_ptr().cast_mut().cast())
        }
        ffi::StashData::ObjectArray(_, ptrs) => {
            !ptrs.is_empty() && storage.ptr() == ptrs.as_ptr().cast_mut().cast()
        }
        ffi::StashData::List(list) => {
            list.should_free
                || matches!(
                    &list.payload,
                    ffi::ListPayload::Strings {
                        strings,
                        items_duped: false,
                        ..
                    } if !strings.is_empty()
                )
        }
        ffi::StashData::GArray(array) => array.should_free,
        ffi::StashData::GPtrArray(array) => array.should_free,
        ffi::StashData::GByteArray(array) => array.is_some(),
        ffi::StashData::HashTable(table) => table.owns_table || !table.retained_entries.is_empty(),
        ffi::StashData::Handle(_) | ffi::StashData::CString(_) | ffi::StashData::PtrSlot(_, _) => {
            true
        }
        _ => false,
    }
}

pub(super) fn encode_transferred_container<F>(
    env: Env,
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
    encode(*unknown)
        .and_then(|stash| transfer_container(&stash, context))
        .unwrap_or_else(|error| {
            reject_callback_return(env, &error.context(context));
            std::ptr::null_mut()
        })
}

pub(super) fn transfer_container(stash: &ffi::Stash, context: &str) -> anyhow::Result<*mut c_void> {
    let container = stash.as_ptr(context)?;
    anyhow::ensure!(
        !retains_transfer_backing(stash),
        "{context}: a transferred container cannot retain native backing"
    );
    stash.disarm_pending_transfer();
    Ok(container)
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
