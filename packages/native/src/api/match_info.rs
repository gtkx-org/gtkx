use std::cell::UnsafeCell;
use std::ffi::c_void;
use std::sync::OnceLock;

use glib::prelude::StaticType as _;
use glib::translate::{FromGlib as _, IntoGlib as _};
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::handle_memory_ptr;
use crate::handle::{Boxed as NativeBoxed, Handle};

struct OwnedMatchInfo {
    references: UnsafeCell<i32>,
    base: *mut glib::ffi::GMatchInfo,
    subject: *mut glib::ffi::GBytes,
}

impl Drop for OwnedMatchInfo {
    fn drop(&mut self) {
        unsafe {
            glib::ffi::g_match_info_unref(self.base);
            glib::ffi::g_bytes_unref(self.subject);
        }
    }
}

unsafe extern "C" fn copy_match_info(value: *mut c_void) -> *mut c_void {
    let info = value.cast::<OwnedMatchInfo>();
    unsafe { glib::ffi::g_atomic_ref_count_inc((*info).references.get()) };
    value
}

unsafe extern "C" fn free_match_info(value: *mut c_void) {
    let info = value.cast::<OwnedMatchInfo>();
    if unsafe { glib::ffi::g_atomic_ref_count_dec((*info).references.get()) } != 0 {
        drop(unsafe { Box::from_raw(info) });
    }
}

fn match_info_type() -> glib::Type {
    static TYPE: OnceLock<glib::Type> = OnceLock::new();
    *TYPE.get_or_init(|| unsafe {
        glib::Type::from_glib(glib::gobject_ffi::g_boxed_type_register_static(
            c"GtkxMatchInfo".as_ptr(),
            Some(copy_match_info),
            Some(free_match_info),
        ))
    })
}

fn boxed_pointer(handle: &Handle, expected: glib::Type) -> Result<*mut c_void> {
    if handle.boxed_type() != Some(expected) {
        return Err(Error::new(
            Status::InvalidArg,
            format!("Expected a boxed {expected} handle"),
        ));
    }
    handle_memory_ptr(handle, "MatchInfo ownership")
}

#[napi(catch_unwind)]
#[must_use]
pub fn get_match_info_type() -> BigInt {
    BigInt::from(match_info_type().into_glib() as u64)
}

#[napi(catch_unwind)]
pub fn own_match_info(
    raw_match_info: &External<Handle>,
    subject_bytes: &External<Handle>,
) -> Result<External<Handle>> {
    let base = boxed_pointer(raw_match_info, glib::MatchInfo::static_type())?
        .cast::<glib::ffi::GMatchInfo>();
    let subject =
        boxed_pointer(subject_bytes, glib::Bytes::static_type())?.cast::<glib::ffi::GBytes>();
    let input = unsafe { glib::ffi::g_match_info_get_string(base) };
    let mut length = 0;
    let data = unsafe { glib::ffi::g_bytes_get_data(subject, &raw mut length) };
    if length == 0 || unsafe { *data.cast::<u8>().add(length - 1) } != 0 {
        return Err(Error::new(
            Status::InvalidArg,
            "MatchInfo subject bytes must end with NUL",
        ));
    }
    if input.cast::<c_void>() != data {
        return Err(Error::new(
            Status::InvalidArg,
            "MatchInfo does not reference the supplied subject bytes",
        ));
    }
    let info = Box::new(OwnedMatchInfo {
        references: UnsafeCell::new(0),
        base: unsafe { glib::ffi::g_match_info_ref(base) },
        subject: unsafe { glib::ffi::g_bytes_ref(subject) },
    });
    unsafe { glib::ffi::g_atomic_ref_count_init(info.references.get()) };
    let handle = Handle::from(NativeBoxed::from_glib_full(
        match_info_type(),
        Box::into_raw(info).cast(),
    ));
    let size_hint = handle.size_hint();
    Ok(External::new_with_size_hint(handle, size_hint))
}

#[napi(catch_unwind)]
pub fn get_match_info_base(holder: &External<Handle>) -> Result<External<Handle>> {
    let pointer = boxed_pointer(holder, match_info_type())?.cast::<OwnedMatchInfo>();
    let base = unsafe { (*pointer).base };
    Ok(External::new(Handle::pointer(base.cast(), holder)))
}
