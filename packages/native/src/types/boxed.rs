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
        let ownership = Ownership::from_descriptor(obj, "boxed")?;

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
            // SAFETY: `library` is a loaded library; `get` resolves the named free symbol whose C
            // signature matches the declared `BoxedFreeFn`, and the deref copies out the pointer.
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
            Ok(Boxed::from_glib_borrow(ptr))
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
            // SAFETY: `library` is a loaded library; `get` resolves the named `*_get_type` symbol
            // whose C signature matches the declared zero-arg GType-returning fn pointer.
            let sym = unsafe {
                library
                    .get::<unsafe extern "C" fn() -> glib::ffi::GType>(get_type_fn.as_bytes())
                    .map_err(|e| anyhow::anyhow!("Failed to find symbol '{get_type_fn}': {e}"))?
            };
            Ok(*sym)
        })?;

        // SAFETY: `symbol` is the resolved zero-arg `*_get_type` function; calling it on the
        // gtkx-glib thread returns the registered GType, registering it idempotently if needed.
        let gtype_raw = unsafe { symbol() };
        // SAFETY: `gtype_raw` is a valid `GType` returned by a `*_get_type` function.
        let gtype = unsafe { glib::Type::from_glib(gtype_raw) };
        Ok(Some(gtype).filter(|t| t.is_valid()))
    }
}

pub type BoxedFreeFn = unsafe extern "C" fn(*mut c_void);

impl FfiEncoder for BoxedType {
    fn object_ptr_context(&self) -> &'static str {
        "Boxed object"
    }

    fn transfer_release(&self) -> Option<ffi::PendingRelease> {
        if self.ownership.is_borrowed() {
            return None;
        }
        self.gtype().map(ffi::PendingRelease::BoxedFree)
    }

    /// # Safety
    ///
    /// `ptr` must be either null or a pointer to a live boxed value of `self.gtype()` owned by
    /// the gtkx-glib thread; on a full transfer the call produces a fresh `g_boxed_copy` that
    /// the caller owns and must free with `g_boxed_free` for the same gtype.
    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full()
            && !ptr.is_null()
            && let Some(gtype) = self.gtype()
        {
            // SAFETY: `ptr` is a non-null, live boxed value of `gtype`; `boxed_copy` calls
            // `g_boxed_copy(gtype, ptr)`, returning an independently owned copy.
            let copied = unsafe { Boxed::boxed_copy(gtype, ptr) };
            return Ok(copied);
        }
        Ok(ptr)
    }
}

impl FfiDecoder for BoxedType {
    fn read_call(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
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

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.null_guarded(ptr, |ptr| {
            if self.free_fn.is_some() || self.caller_allocated {
                return Ok(boxed_value(Boxed::from_glib_borrow(ptr)));
            }
            Ok(boxed_value(Boxed::from_glib_none(self.gtype(), ptr)?))
        })
    }
}

impl RawPtrWriter for BoxedType {
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        self.write_return_with_ownership(ret, value, self.ownership, |ptr| {
            self.gtype().map_or(ptr, |gtype| {
                // SAFETY: `ptr` is a non-null live boxed value of `gtype` (the helper skips null);
                // `boxed_copy` produces an independently owned `g_boxed_copy` for the full return.
                unsafe { Boxed::boxed_copy(gtype, ptr) }
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
        // SAFETY: `ptr` is a boxed field slot per `write_value_to_raw_ptr`'s contract; the closures
        // keep the slot balanced — `boxed_copy` installs a fresh owned copy of `gtype` for the
        // non-null source value, and `g_boxed_free` frees the previous one — so `swap_owned_slot`'s
        // invariants and ownership accounting hold.
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
