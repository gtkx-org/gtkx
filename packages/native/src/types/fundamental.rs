//! Fundamental type handling for FFI.
//!
//! `GLib` fundamental types are custom reference-counted types that don't
//! derive from `GObject`. Examples include `GParamSpec` and Pango layout types.
//! They have custom ref/unref functions rather than using `g_object_ref/unref`.

use napi::{Env, JsObject};

use super::prelude::*;
use crate::managed::{Fundamental, NativeValue, RefFn, UnrefFn};
use crate::state::GlibThreadState;

#[derive(Debug, Clone)]
pub struct FundamentalType {
    pub ownership: Ownership,
    pub library: String,
    pub ref_func: String,
    pub unref_func: String,
    pub type_name: Option<String>,
}

impl FundamentalType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_js_value(obj, "fundamental")?;

        let library: String = obj.get_named_property("library")?;
        let ref_func: String = obj.get_named_property("refFn")?;
        let unref_func: String = obj.get_named_property("unrefFn")?;
        let type_name: Option<String> = obj
            .get_named_property::<Option<String>>("typeName")
            .ok()
            .flatten();

        Ok(Self {
            ownership,
            library,
            ref_func,
            unref_func,
            type_name,
        })
    }

    pub fn lookup_fns(&self) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        GlibThreadState::with(|state| {
            state.lookup_fundamental_fns(&self.library, &self.ref_func, &self.unref_func)
        })
    }

    /// Wraps a non-null fundamental `ptr` into a [`value::Value`], honoring
    /// `ownership`: a full transfer adopts the pointer while a borrowed one
    /// takes a fresh reference.
    fn wrap_ptr(&self, ptr: *mut c_void) -> anyhow::Result<value::Value> {
        let (ref_fn, unref_fn) = self.lookup_fns()?;
        let fundamental = if self.ownership.is_full() {
            Fundamental::from_glib_full(ptr, ref_fn, unref_fn)
        } else {
            // SAFETY: `wrap_ptr`'s callers pass a pointer to a live
            // instance of the fundamental type, so taking a reference is
            // sound.
            unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) }
        };
        Ok(value::Value::Object(
            NativeValue::Fundamental(fundamental).into(),
        ))
    }
}

impl FfiEncoder for FundamentalType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("Fundamental")?;

        if self.ownership.is_full() && !ptr.is_null() {
            let (ref_fn, unref_fn) = self.lookup_fns()?;
            if let Some(ref_fn) = ref_fn {
                // SAFETY: `ptr` came from a NativeHandle wrapping a live
                // instance of the fundamental type `ref_fn` expects.
                let referenced = unsafe { ref_fn(ptr) };
                if let Some(unref_fn) = unref_fn {
                    return Ok(full_transfer_storage(
                        referenced,
                        ffi::PendingRelease::Fundamental(unref_fn),
                    ));
                }
                return Ok(ffi::FfiValue::Ptr(referenced));
            }
        }

        Ok(ffi::FfiValue::Ptr(ptr))
    }

    fn transfer_release(&self) -> Option<ffi::PendingRelease> {
        if self.ownership.is_borrowed() {
            return None;
        }
        let Ok((Some(_), Some(unref_fn))) = self.lookup_fns() else {
            return None;
        };
        Some(ffi::PendingRelease::Fundamental(unref_fn))
    }

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full() && !ptr.is_null() {
            let (ref_fn, _) = self.lookup_fns()?;
            if let Some(ref_fn) = ref_fn {
                // SAFETY: The caller guarantees the non-null `ptr` addresses
                // a live instance of the fundamental type `ref_fn` expects.
                return Ok(unsafe { ref_fn(ptr) });
            }
        }
        Ok(ptr)
    }
}

impl FfiDecoder for FundamentalType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = ffi_value.as_non_null_ptr("Fundamental")? else {
            return Ok(value::Value::Null);
        };
        self.wrap_ptr(ptr)
    }
}

impl RawPtrCodec for FundamentalType {
    unsafe fn ptr_to_value(
        &self,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        null_guarded(ptr, |ptr| {
            let (ref_fn, unref_fn) = self.lookup_fns()?;
            // SAFETY: The caller guarantees the non-null `ptr` addresses a
            // live instance of the fundamental type, so taking a reference
            // is sound.
            let fundamental = unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) };
            Ok(value::Value::Object(
                NativeValue::Fundamental(fundamental).into(),
            ))
        })
    }

    /// Writes a trampoline return honoring the declared transfer: a full
    /// transfer hands the caller a fresh reference; a transfer-none return
    /// writes the wrapper-held pointer unchanged.
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        write_return_with_ownership(ret, value, self.ownership, |ptr| {
            match self.lookup_fns() {
                // SAFETY: `ptr` came from a NativeHandle wrapping a live
                // instance of the fundamental type `ref_fn` expects.
                Ok((Some(ref_fn), _)) => unsafe { ref_fn(ptr) },
                _ => ptr,
            }
        });
    }

    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let new_ptr = value.object_ptr("Fundamental field write")?;
        // SAFETY: The caller guarantees `ptr` is a readable pointer-sized
        // field slot; the read is unaligned-tolerant.
        let old_ptr = unsafe { (ptr as *const *mut c_void).read_unaligned() };
        let (ref_fn, unref_fn) = self.lookup_fns()?;
        let stored_ptr = if new_ptr.is_null() {
            new_ptr
        } else {
            // SAFETY: `new_ptr` came from a NativeHandle wrapping a live
            // instance of the fundamental type `ref_fn` expects.
            ref_fn.map_or(new_ptr, |f| unsafe { f(new_ptr) })
        };
        // SAFETY: The caller guarantees `ptr` is a writable pointer-sized
        // field slot; the write is unaligned-tolerant.
        unsafe { (ptr as *mut *mut c_void).write_unaligned(stored_ptr) };
        if !old_ptr.is_null()
            && let Some(unref_fn) = unref_fn
        {
            // SAFETY: The slot held one reference to the previous instance,
            // which this release drops exactly once.
            unsafe { unref_fn(old_ptr) };
        }
        Ok(())
    }
}
