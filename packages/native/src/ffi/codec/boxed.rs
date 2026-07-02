use glib::{self, translate::IntoGlib as _};

use super::prelude::*;
use crate::ffi::library_cache::GlibThreadState;
use crate::handle::Boxed;
use crate::messaging::error_reporter::ErrorReporter;

#[derive(Debug, Clone)]
pub struct BoxedCodec {
    pub ownership: Ownership,
    pub type_name: String,
    pub shared_library: Option<String>,
    pub get_type_fn_name: Option<String>,
    pub free_fn_name: Option<String>,
    pub caller_allocated: bool,
}

impl BoxedCodec {
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

    fn lookup_free_fn(lib_name: &str, free_fn_name: &str) -> anyhow::Result<BoxedFreeFn> {
        GlibThreadState::with(|state| -> anyhow::Result<_> {
            let library = state.library(lib_name)?;
            let symbol = unsafe {
                library
                    .get::<BoxedFreeFn>(free_fn_name.as_bytes())
                    .map_err(|e| {
                        anyhow::anyhow!("Failed to find free symbol '{free_fn_name}': {e}")
                    })?
            };
            Ok(*symbol)
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
        let (Some(lib_name), Some(get_type_fn_name)) =
            (self.shared_library.as_ref(), self.get_type_fn_name.as_ref())
        else {
            return Ok(None);
        };

        let gtype = GlibThreadState::with(|state| state.resolve_gtype(lib_name, get_type_fn_name))?;
        Ok(Some(gtype).filter(|t| t.is_valid()))
    }
}

pub type BoxedFreeFn = unsafe extern "C" fn(*mut c_void);

impl Encoder for BoxedCodec {
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

impl Decoder for BoxedCodec {
    fn read_call(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        self.read_call_non_null(stashed_value, "Boxed", |boxed_ptr| {
            if let Some(free_fn_name) = self.free_fn_name.as_deref() {
                return Ok(self.boxed_with_free_fn(boxed_ptr, free_fn_name)?.into());
            }

            let gtype = self.gtype();
            let boxed = match self.ownership {
                Ownership::Full => Boxed::from_glib_full(gtype, boxed_ptr),
                Ownership::Borrowed => unsafe {
                    Boxed::from_glib_none(gtype, boxed_ptr, Some(&self.type_name))?
                },
            };

            Ok(boxed.into())
        })
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.decode_non_null(ptr, |ptr| {
            if self.free_fn_name.is_some() || self.caller_allocated {
                return Ok(Boxed::from_glib_borrow(ptr).into());
            }
            Ok(unsafe { Boxed::from_glib_none(self.gtype(), ptr, None) }?.into())
        })
    }
}

impl PtrWriter for BoxedCodec {
    unsafe fn write_return_to_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        self.write_return_with_ownership(ret, value, self.ownership, |ptr| {
            self.gtype()
                .map_or(ptr, |gtype| unsafe { Boxed::boxed_copy(gtype, ptr) })
        });
    }

    unsafe fn write_value_to_ptr(
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
