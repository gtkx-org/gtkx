//! Boxed and struct type handling for FFI.
//!
//! `GLib` boxed types are heap-allocated structures with reference counting
//! managed by `GLib`. Struct types are similar but may be stack-allocated
//! or have fixed sizes. This module provides [`BoxedType`] and [`StructType`]
//! descriptors that handle encoding/decoding these types for FFI calls.

use anyhow::bail;
use gtk4::glib::{
    self,
    translate::{FromGlib as _, IntoGlib as _},
};
use napi::{Env, JsObject};

use super::prelude::*;
use crate::error_reporter::NativeErrorReporter;
use crate::managed::{Boxed, NativeValue};
use crate::state::GlibThreadState;

/// Wraps a [`Boxed`] in the `Value::Object` shape the boxed and struct codecs
/// hand back to JavaScript.
fn boxed_value(boxed: Boxed) -> value::Value {
    value::Value::Object(NativeValue::Boxed(boxed).into())
}

#[derive(Debug, Clone)]
pub struct BoxedType {
    pub ownership: Ownership,
    pub type_name: String,
    pub library: Option<String>,
    pub get_type_fn: Option<String>,
    pub free_fn: Option<String>,
}

impl BoxedType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_js_value(obj, "boxed")?;

        let type_name: String = obj.get_named_property("innerType")?;

        let library: Option<String> = super::optional_descriptor_property(obj, "library")?;

        let get_type_fn: Option<String> = super::optional_descriptor_property(obj, "getTypeFn")?;

        let free_fn: Option<String> = super::optional_descriptor_property(obj, "freeFn")?;

        Ok(Self {
            ownership,
            type_name,
            library,
            get_type_fn,
            free_fn,
        })
    }

    #[must_use]
    pub fn gtype(&self) -> Option<glib::Type> {
        glib::Type::from_name(&self.type_name).or_else(|| {
            match self.try_resolve_gtype_from_library() {
                Ok(gtype) => gtype,
                Err(e) => {
                    NativeErrorReporter::global().report(&e);
                    None
                }
            }
        })
    }

    fn lookup_free_fn(lib_name: &str, free_fn: &str) -> anyhow::Result<BoxedFreeFn> {
        GlibThreadState::with(|state| -> anyhow::Result<_> {
            let library = state.library(lib_name)?;
            // SAFETY: The descriptor names a C destructor whose signature
            // matches `BoxedFreeFn`; the library stays loaded for the
            // process lifetime.
            let sym = unsafe {
                library
                    .get::<BoxedFreeFn>(free_fn.as_bytes())
                    .map_err(|e| anyhow::anyhow!("Failed to find free symbol '{free_fn}': {e}"))?
            };
            Ok(*sym)
        })
    }

    /// Constructs a [`Boxed`] for a descriptor that declares the custom
    /// destructor named `free_fn_name`. Fails when the symbol cannot be
    /// resolved instead of falling back to `g_free`, which would call the
    /// wrong destructor.
    fn boxed_with_free_fn(&self, ptr: *mut c_void, free_fn_name: &str) -> anyhow::Result<Boxed> {
        let lib_name = self.library.as_deref().unwrap_or("(no library)");

        let free_fn = Self::lookup_free_fn(lib_name, free_fn_name)
            .map_err(|e| anyhow::anyhow!("Cannot decode boxed '{}': {e}", self.type_name))?;

        if self.ownership.is_full() {
            Ok(Boxed::from_glib_full_with_free_fn(ptr, free_fn))
        } else {
            Ok(Boxed::from_ptr_unowned(ptr))
        }
    }

    fn try_resolve_gtype_from_library(&self) -> anyhow::Result<Option<glib::Type>> {
        let Some(lib_name) = self.library.as_ref() else {
            return Ok(None);
        };
        let Some(get_type_fn) = self.get_type_fn.as_ref() else {
            return Ok(None);
        };

        let symbol = GlibThreadState::with(|state| -> anyhow::Result<_> {
            let library = state.library(lib_name)?;
            // SAFETY: The descriptor names a GIR `get_type` function, whose
            // C signature is `GType (*)(void)`; the library stays loaded
            // for the process lifetime.
            let sym = unsafe {
                library
                    .get::<unsafe extern "C" fn() -> glib::ffi::GType>(get_type_fn.as_bytes())
                    .map_err(|e| anyhow::anyhow!("Failed to find symbol '{get_type_fn}': {e}"))?
            };
            Ok(*sym)
        })?;

        // SAFETY: `get_type` functions take no arguments and only register
        // and return a GType.
        let gtype_raw = unsafe { symbol() };
        // SAFETY: `gtype_raw` came from the type's own `get_type` function,
        // so it is a valid GType value.
        let gtype = unsafe { glib::Type::from_glib(gtype_raw) };
        Ok(Some(gtype).filter(|t| t.is_valid()))
    }
}

/// Signature of a custom destructor declared via the `freeFn` descriptor
/// field — e.g. `cairo_path_destroy` or `cairo_rectangle_list_destroy`.
pub type BoxedFreeFn = unsafe extern "C" fn(*mut c_void);

impl FfiEncoder for BoxedType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("Boxed object")?;

        if self.ownership.is_full()
            && !ptr.is_null()
            && let Some(gtype) = self.gtype()
        {
            // SAFETY: `ptr` came from a NativeHandle wrapping a live boxed
            // value of `gtype`, the type `ref_for_transfer`'s copy requires.
            let copied = unsafe { self.ref_for_transfer(ptr)? };
            return Ok(full_transfer_storage(
                copied,
                ffi::PendingRelease::BoxedFree(gtype),
            ));
        }

        Ok(ffi::FfiValue::Ptr(ptr))
    }

    fn transfer_release(&self) -> Option<ffi::PendingRelease> {
        if self.ownership.is_borrowed() {
            return None;
        }
        self.gtype().map(ffi::PendingRelease::BoxedFree)
    }

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full()
            && !ptr.is_null()
            && let Some(gtype) = self.gtype()
        {
            // SAFETY: The caller guarantees the non-null `ptr` addresses a
            // live boxed value of `gtype`, the type `g_boxed_copy` requires.
            let copied =
                unsafe { glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _) };
            return Ok(copied);
        }
        Ok(ptr)
    }
}

impl FfiDecoder for BoxedType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(boxed_ptr) = ffi_value.as_non_null_ptr("Boxed")? else {
            return Ok(value::Value::Null);
        };

        if let Some(free_fn_name) = self.free_fn.as_deref() {
            return Ok(boxed_value(
                self.boxed_with_free_fn(boxed_ptr, free_fn_name)?,
            ));
        }

        let gtype = self.gtype();
        let boxed = match self.ownership {
            Ownership::Full => Boxed::from_glib_full(gtype, boxed_ptr),
            Ownership::Borrowed => {
                Boxed::from_glib_none_with_size(gtype, boxed_ptr, None, Some(&self.type_name))?
            }
        };

        Ok(boxed_value(boxed))
    }
}

impl RawPtrCodec for BoxedType {
    unsafe fn ptr_to_value(
        &self,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        null_guarded(ptr, |ptr| {
            if self.free_fn.is_some() {
                return Ok(boxed_value(Boxed::from_ptr_unowned(ptr)));
            }
            Ok(boxed_value(Boxed::from_glib_none(self.gtype(), ptr)?))
        })
    }

    /// Writes a trampoline return honoring the declared transfer: a full
    /// transfer hands the caller its own boxed copy; a transfer-none return
    /// writes the wrapper-owned pointer unchanged.
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        write_return_with_ownership(ret, value, self.ownership, |ptr| {
            // SAFETY: `ptr` came from a NativeHandle wrapping a live boxed
            // value of `gtype`, the type `g_boxed_copy` requires.
            self.gtype().map_or(ptr, |gtype| unsafe {
                glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _)
            })
        });
    }

    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let Some(gtype) = self.gtype() else {
            return write_object_ptr(ptr, value, "Boxed field write");
        };
        let src_ptr = value.object_ptr("Boxed field write")?;
        // SAFETY: The caller guarantees `ptr` is a readable pointer-sized
        // field slot; the read is unaligned-tolerant.
        let old_ptr = unsafe { (ptr as *const *mut c_void).read_unaligned() };
        let new_ptr = if src_ptr.is_null() {
            std::ptr::null_mut()
        } else {
            // SAFETY: `src_ptr` came from a NativeHandle wrapping a live
            // boxed value of `gtype`, the type `g_boxed_copy` requires.
            unsafe { glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), src_ptr as *const _) }
        };
        // SAFETY: The caller guarantees `ptr` is a writable pointer-sized
        // field slot; the write is unaligned-tolerant.
        unsafe { (ptr as *mut *mut c_void).write_unaligned(new_ptr) };
        if !old_ptr.is_null() {
            // SAFETY: The slot owned the previous boxed value of `gtype`;
            // this release runs exactly once, after the slot is replaced.
            unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), old_ptr) };
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct StructType {
    pub ownership: Ownership,
    pub size: Option<usize>,
}

impl StructType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_js_value(obj, "struct")?;

        let size: Option<usize> =
            super::optional_descriptor_property::<f64>(obj, "size")?.map(|n| n as usize);

        Ok(Self { ownership, size })
    }
}

impl FfiEncoder for StructType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("Struct object")?;
        Ok(ffi::FfiValue::Ptr(ptr))
    }
}

impl FfiDecoder for StructType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(struct_ptr) = ffi_value.as_non_null_ptr("Struct")? else {
            return Ok(value::Value::Null);
        };

        let boxed = match self.ownership {
            Ownership::Full => Boxed::from_glib_full(None, struct_ptr),
            Ownership::Borrowed => self.size.map_or_else(
                || Boxed::from_ptr_unowned(struct_ptr),
                |size| Boxed::copy_with_size(struct_ptr, size),
            ),
        };

        Ok(boxed_value(boxed))
    }
}

impl RawPtrCodec for StructType {
    unsafe fn ptr_to_value(
        &self,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        null_guarded(ptr, |ptr| {
            let boxed = self.size.map_or_else(
                || Boxed::from_ptr_unowned(ptr),
                |size| Boxed::copy_with_size(ptr, size),
            );
            Ok(boxed_value(boxed))
        })
    }

    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        write_return_object_ptr(ret, value, std::convert::identity);
    }

    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        if let Some(size) = self.size {
            let src_ptr = value.object_ptr("Struct field write")?;
            if src_ptr.is_null() {
                // SAFETY: The caller guarantees `ptr` is a writable
                // pointer-sized field slot; the write is unaligned-tolerant.
                unsafe { (ptr as *mut *mut c_void).write_unaligned(std::ptr::null_mut()) };
                return Ok(());
            }
            // SAFETY: The caller guarantees `ptr` is a readable
            // pointer-sized field slot; the read is unaligned-tolerant.
            let dst_ptr = unsafe { (ptr as *const *mut c_void).read_unaligned() };
            if dst_ptr.is_null() {
                bail!("Struct field write into null pointer slot")
            }
            // SAFETY: `src_ptr` came from a NativeHandle wrapping a live
            // struct of `size` bytes, and the slot's non-null target is a
            // distinct allocation of the same struct type.
            unsafe {
                std::ptr::copy_nonoverlapping(src_ptr as *const u8, dst_ptr as *mut u8, size);
            }
            return Ok(());
        }
        write_object_ptr(ptr, value, "Struct field write")
    }
}
