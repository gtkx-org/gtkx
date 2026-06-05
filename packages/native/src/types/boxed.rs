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

        let library: Option<String> = obj
            .get_named_property::<Option<String>>("library")
            .ok()
            .flatten();

        let get_type_fn: Option<String> = obj
            .get_named_property::<Option<String>>("getTypeFn")
            .ok()
            .flatten();

        let free_fn: Option<String> = obj
            .get_named_property::<Option<String>>("freeFn")
            .ok()
            .flatten();

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
            let sym = unsafe {
                library
                    .get::<BoxedFreeFn>(free_fn.as_bytes())
                    .map_err(|e| anyhow::anyhow!("Failed to find free symbol '{free_fn}': {e}"))?
            };
            Ok(*sym)
        })
    }

    /// Constructs a [`Boxed`] for a descriptor that declares a custom
    /// destructor. Fails when the symbol cannot be resolved rather than
    /// falling back to `g_free`, which would call the wrong destructor.
    fn boxed_with_free_fn(&self, ptr: *mut c_void) -> anyhow::Result<Boxed> {
        let lib_name = self.library.as_deref().unwrap_or("(no library)");
        let free_fn_name = self
            .free_fn
            .as_deref()
            .expect("boxed_with_free_fn called without freeFn set");

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
            let sym = unsafe {
                library
                    .get::<unsafe extern "C" fn() -> glib::ffi::GType>(get_type_fn.as_bytes())
                    .map_err(|e| anyhow::anyhow!("Failed to find symbol '{get_type_fn}': {e}"))?
            };
            Ok(*sym)
        })?;

        let gtype_raw = unsafe { symbol() };
        let gtype = unsafe { glib::Type::from_glib(gtype_raw) };
        Ok(Some(gtype))
    }
}

/// Signature of a custom destructor declared via the `freeFn` descriptor
/// field — e.g. `cairo_path_destroy` or `cairo_rectangle_list_destroy`.
pub type BoxedFreeFn = unsafe extern "C" fn(*mut c_void);

impl FfiEncoder for BoxedType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("Boxed object")?;

        if let Some(gtype) = self.gtype()
            && self.ownership.is_full()
            && !ptr.is_null()
        {
            let copied =
                unsafe { glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _) };
            return Ok(ffi::FfiValue::Ptr(copied));
        }

        Ok(ffi::FfiValue::Ptr(ptr))
    }

    fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full()
            && !ptr.is_null()
            && let Some(gtype) = self.gtype()
        {
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

        if self.free_fn.is_some() {
            let boxed = self.boxed_with_free_fn(boxed_ptr)?;
            return Ok(value::Value::Object(NativeValue::Boxed(boxed).into()));
        }

        let gtype = self.gtype();
        let boxed = match self.ownership {
            Ownership::Full => NativeValue::Boxed(Boxed::from_glib_full(gtype, boxed_ptr)),
            Ownership::Borrowed => NativeValue::Boxed(Boxed::from_glib_none_with_size(
                gtype,
                boxed_ptr,
                None,
                Some(&self.type_name),
            )?),
            Ownership::None => NativeValue::Boxed(Boxed::from_ptr_unowned(boxed_ptr)),
        };

        Ok(value::Value::Object(boxed.into()))
    }
}

impl RawPtrCodec for BoxedType {
    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        null_guarded(ptr, |ptr| {
            if self.free_fn.is_some() {
                return Ok(value::Value::Object(
                    NativeValue::Boxed(Boxed::from_ptr_unowned(ptr)).into(),
                ));
            }
            let boxed = Boxed::from_glib_none(self.gtype(), ptr)?;
            Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
        })
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        write_return_object_ptr(ret, value, |ptr| {
            self.gtype().map_or(ptr, |gtype| unsafe {
                glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _)
            })
        });
    }

    fn write_value_to_raw_ptr(&self, ptr: *mut c_void, value: &value::Value) -> anyhow::Result<()> {
        let Some(gtype) = self.gtype() else {
            return write_object_ptr(ptr, value, "Boxed field write");
        };
        let src_ptr = value.object_ptr("Boxed field write")?;
        let old_ptr = unsafe { (ptr as *const *mut c_void).read_unaligned() };
        let new_ptr = if src_ptr.is_null() {
            std::ptr::null_mut()
        } else {
            unsafe { glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), src_ptr as *const _) }
        };
        unsafe { (ptr as *mut *mut c_void).write_unaligned(new_ptr) };
        if !old_ptr.is_null() {
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

        let size: Option<usize> = obj
            .get_named_property::<Option<f64>>("size")
            .ok()
            .flatten()
            .map(|n| n as usize);

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
            Ownership::Borrowed => match self.size {
                Some(_) => Boxed::from_glib_none_with_size(None, struct_ptr, self.size, None)
                    .expect("struct decode with a known size always succeeds"),
                None => Boxed::from_ptr_unowned(struct_ptr),
            },
            Ownership::None => Boxed::from_ptr_unowned(struct_ptr),
        };

        Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
    }
}

impl RawPtrCodec for StructType {
    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        null_guarded(ptr, |ptr| {
            let boxed = match self.size {
                Some(_) => Boxed::from_glib_none_with_size(None, ptr, self.size, None)
                    .expect("struct ptr_to_value with a known size always succeeds"),
                None => Boxed::from_ptr_unowned(ptr),
            };
            Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
        })
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        write_return_object_ptr(ret, value, std::convert::identity);
    }

    fn write_value_to_raw_ptr(&self, ptr: *mut c_void, value: &value::Value) -> anyhow::Result<()> {
        if let Some(size) = self.size {
            let src_ptr = value.object_ptr("Struct field write")?;
            if src_ptr.is_null() {
                unsafe { (ptr as *mut *mut c_void).write_unaligned(std::ptr::null_mut()) };
                return Ok(());
            }
            let dst_ptr = unsafe { (ptr as *const *mut c_void).read_unaligned() };
            if dst_ptr.is_null() {
                bail!("Struct field write into null pointer slot")
            }
            unsafe {
                std::ptr::copy_nonoverlapping(src_ptr as *const u8, dst_ptr as *mut u8, size);
            }
            return Ok(());
        }
        write_object_ptr(ptr, value, "Struct field write")
    }
}
