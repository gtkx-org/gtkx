use anyhow::bail;
use glib::{
    self,
    translate::{FromGlib as _, IntoGlib as _},
};
use napi::{Env, JsObject};

use super::prelude::*;
use crate::error_reporter::NativeErrorReporter;
use crate::managed::{Boxed, NativeValue};
use crate::state::GlibThreadState;

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
    pub caller_allocated: bool,
}

impl FromDescriptor for BoxedType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn from_descriptor(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_js_value(obj, "boxed")?;

        let type_name: String = obj.get_named_property("innerType")?;

        let library: Option<String> = super::optional_descriptor_property(obj, "library")?;

        let get_type_fn: Option<String> = super::optional_descriptor_property(obj, "getTypeFn")?;

        let free_fn: Option<String> = super::optional_descriptor_property(obj, "freeFn")?;

        let caller_allocated: bool =
            super::optional_descriptor_property(obj, "callerAllocated")?.unwrap_or(false);

        Ok(Self {
            ownership,
            type_name,
            library,
            get_type_fn,
            free_fn,
            caller_allocated,
        })
    }
}

impl BoxedType {
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
            let sym = unsafe {
                library
                    .get::<unsafe extern "C" fn() -> glib::ffi::GType>(get_type_fn.as_bytes())
                    .map_err(|e| anyhow::anyhow!("Failed to find symbol '{get_type_fn}': {e}"))?
            };
            Ok(*sym)
        })?;

        let gtype_raw = unsafe { symbol() };
        let gtype = unsafe { glib::Type::from_glib(gtype_raw) };
        Ok(Some(gtype).filter(|t| t.is_valid()))
    }
}

pub type BoxedFreeFn = unsafe extern "C" fn(*mut c_void);

impl FfiEncoder for BoxedType {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("Boxed object")?;

        if self.ownership.is_full()
            && !ptr.is_null()
            && let Some(gtype) = self.gtype()
        {
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
            let copied = unsafe { Boxed::boxed_copy(gtype, ptr) };
            return Ok(copied);
        }
        Ok(ptr)
    }
}

impl FfiDecoder for BoxedType {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(ffi_value) => {
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
                    Ownership::Borrowed => Boxed::from_glib_none_with_size(
                        gtype,
                        boxed_ptr,
                        None,
                        Some(&self.type_name),
                    )?,
                };

                Ok(boxed_value(boxed))
            }
            ReadSource::Value(ptr, _context) => self.null_guarded(ptr, |ptr| {
                if self.free_fn.is_some() || self.caller_allocated {
                    return Ok(boxed_value(Boxed::from_ptr_unowned(ptr)));
                }
                Ok(boxed_value(Boxed::from_glib_none(self.gtype(), ptr)?))
            }),
            ReadSource::Slot(ptr, context) => unsafe { self.read_pointer_slot(ptr, context) },
        }
    }
}

impl RawPtrCodec for BoxedType {
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        self.write_return_with_ownership(ret, value, self.ownership, |ptr| {
            self.gtype()
                .map_or(ptr, |gtype| unsafe { Boxed::boxed_copy(gtype, ptr) })
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
        unsafe {
            swap_owned_slot(
                ptr,
                value,
                "Boxed field write",
                |src_ptr| Boxed::boxed_copy(gtype, src_ptr),
                |old_ptr| {
                    glib::gobject_ffi::g_boxed_free(gtype.into_glib(), old_ptr);
                },
            )
        }
    }
}

#[derive(Debug, Clone)]
pub struct StructType {
    pub ownership: Ownership,
    pub size: Option<usize>,
    pub caller_allocated: bool,
}

impl FromDescriptor for StructType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn from_descriptor(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let ownership = Ownership::from_js_value(obj, "struct")?;

        let size: Option<usize> =
            super::optional_descriptor_property::<f64>(obj, "size")?.map(|n| n as usize);

        let caller_allocated: bool =
            super::optional_descriptor_property(obj, "callerAllocated")?.unwrap_or(false);

        Ok(Self {
            ownership,
            size,
            caller_allocated,
        })
    }
}

impl FfiEncoder for StructType {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("Struct object")?;
        Ok(ffi::FfiValue::Ptr(ptr))
    }
}

impl FfiDecoder for StructType {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(ffi_value) => {
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
            ReadSource::Value(ptr, _context) => self.null_guarded(ptr, |ptr| {
                if self.caller_allocated {
                    return Ok(boxed_value(Boxed::from_ptr_unowned(ptr)));
                }
                let boxed = self.size.map_or_else(
                    || Boxed::from_ptr_unowned(ptr),
                    |size| Boxed::copy_with_size(ptr, size),
                );
                Ok(boxed_value(boxed))
            }),
            ReadSource::Slot(ptr, context) => unsafe { self.read_pointer_slot(ptr, context) },
        }
    }
}

impl RawPtrCodec for StructType {
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
