use glib::{
    self,
    translate::{FromGlib as _, IntoGlib as _},
};

use super::prelude::*;
use crate::ffi::library_cache::GlibThreadState;
use crate::handle::Boxed;
use crate::messaging::error_reporter::ErrorReporter;

#[derive(Debug, Clone)]
pub struct BoxedDescriptor {
    pub ownership: Ownership,
    pub type_name: String,
    pub shared_library: Option<String>,
    pub get_type_fn: Option<String>,
    pub free_fn: Option<String>,
    pub caller_allocated: bool,
}

impl BoxedDescriptor {
    pub fn gtype(&self) -> Option<glib::Type> {
        glib::Type::from_name(&self.type_name).or_else(|| {
            match self.try_resolve_gtype_from_library() {
                Ok(gtype) => gtype,
                Err(e) => {
                    ErrorReporter::global().report(&e);
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
        let lib_name = self.shared_library.as_deref().unwrap_or("(no library)");

        let free_fn = Self::lookup_free_fn(lib_name, free_fn_name)
            .map_err(|e| anyhow::anyhow!("Cannot decode boxed '{}': {e}", self.type_name))?;

        if self.ownership.is_full() {
            Ok(Boxed::from_glib_full_with_free_fn(ptr, free_fn))
        } else {
            Ok(Boxed::from_glib_borrow(ptr))
        }
    }

    fn try_resolve_gtype_from_library(&self) -> anyhow::Result<Option<glib::Type>> {
        let Some(lib_name) = self.shared_library.as_ref() else {
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

impl FfiEncoder for BoxedDescriptor {
    fn object_ptr_context(&self) -> &'static str {
        "Boxed object"
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

impl FfiDecoder for BoxedDescriptor {
    fn read_call(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        let Some(boxed_ptr) = stashed_value.as_non_null_ptr("Boxed")? else {
            return Ok(value::Value::Null);
        };

        if let Some(free_fn_name) = self.free_fn.as_deref() {
            return Ok(self.boxed_with_free_fn(boxed_ptr, free_fn_name)?.into());
        }

        let gtype = self.gtype();
        let boxed = match self.ownership {
            Ownership::Full => Boxed::from_glib_full(gtype, boxed_ptr),
            Ownership::Borrowed => unsafe {
                Boxed::from_glib_none_with_size(gtype, boxed_ptr, None, Some(&self.type_name))?
            },
        };

        Ok(boxed.into())
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.null_guarded(ptr, |ptr| {
            if self.free_fn.is_some() || self.caller_allocated {
                return Ok(Boxed::from_glib_borrow(ptr).into());
            }
            Ok(unsafe { Boxed::from_glib_none(self.gtype(), ptr) }?.into())
        })
    }
}

impl PointerWriter for BoxedDescriptor {
    unsafe fn write_return_to_pointer(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        self.write_return_with_ownership(ret, value, self.ownership, |ptr| {
            self.gtype()
                .map_or(ptr, |gtype| unsafe { Boxed::boxed_copy(gtype, ptr) })
        });
    }

    unsafe fn write_value_to_pointer(
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
