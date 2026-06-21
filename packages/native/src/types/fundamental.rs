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

impl FromDescriptor for FundamentalType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn from_descriptor(_env: &Env, obj: &JsObject) -> napi::Result<Self> {
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
}

impl FundamentalType {
    pub fn lookup_fns(&self) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        GlibThreadState::with(|state| {
            state.lookup_fundamental_fns(&self.library, &self.ref_func, &self.unref_func)
        })
    }

    fn wrap_ptr(&self, ptr: *mut c_void) -> anyhow::Result<value::Value> {
        let (ref_fn, unref_fn) = self.lookup_fns()?;
        let fundamental = if self.ownership.is_full() {
            Fundamental::from_glib_full(ptr, ref_fn, unref_fn)
        } else {
            // SAFETY: `ptr` is the live fundamental value returned by the C call, and `ref_fn`/
            // `unref_fn` are this type's resolved ref/unref pair; `from_glib_none` takes one new
            // borrowed reference balanced by the wrapper's drop.
            unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) }
        };
        Ok(value::Value::Object(
            NativeValue::Fundamental(fundamental).into(),
        ))
    }
}

impl FfiEncoder for FundamentalType {
    fn object_ptr_context(&self) -> &'static str {
        "Fundamental"
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

    /// # Safety
    ///
    /// `ptr` must be either null or a pointer to a live fundamental value of this type owned
    /// by the gtkx-glib thread; on a full transfer with a resolved ref function the call adds
    /// one reference (`ref_fn`) that the caller owns and must release with the matching unref.
    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full() && !ptr.is_null() {
            let (ref_fn, _) = self.lookup_fns()?;
            if let Some(ref_fn) = ref_fn {
                // SAFETY: `ptr` is a non-null, live fundamental value; `ref_fn` is the
                // resolved C ref function for this type and returns the referenced pointer.
                return Ok(unsafe { ref_fn(ptr) });
            }
        }
        Ok(ptr)
    }
}

impl FfiDecoder for FundamentalType {
    fn read_call(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = ffi_value.as_non_null_ptr("Fundamental")? else {
            return Ok(value::Value::Null);
        };
        self.wrap_ptr(ptr)
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.null_guarded(ptr, |ptr| {
            let (ref_fn, unref_fn) = self.lookup_fns()?;
            // SAFETY: `null_guarded` passes a non-null `ptr` that the caller of `read_value`
            // guarantees is a live fundamental value; `ref_fn`/`unref_fn` are its resolved pair, so
            // `from_glib_none` takes one borrowed reference balanced by the wrapper's drop.
            let fundamental = unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) };
            Ok(value::Value::Object(
                NativeValue::Fundamental(fundamental).into(),
            ))
        })
    }
}

impl RawPtrCodec for FundamentalType {
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        self.write_return_with_ownership(ret, value, self.ownership, |ptr| {
            match self.lookup_fns() {
                // SAFETY: `ptr` is a non-null live fundamental value (the helper skips null) and
                // `ref_fn` is its resolved ref function; it returns the referenced pointer the
                // full-ownership return transfers out.
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
        let (ref_fn, unref_fn) = self.lookup_fns()?;
        // SAFETY: `ptr` is a fundamental field slot per `write_value_to_raw_ptr`'s contract; the
        // closures keep it balanced — `ref_fn` (if present) takes one reference on the non-null new
        // value and `unref_fn` (if present) releases the previous one — so `swap_owned_slot`'s
        // invariants and ownership accounting hold.
        unsafe {
            swap_owned_slot(
                ptr,
                value,
                "Fundamental field write",
                |new_ptr| ref_fn.map_or(new_ptr, |f| f(new_ptr)),
                |old_ptr| {
                    if let Some(unref_fn) = unref_fn {
                        unref_fn(old_ptr);
                    }
                },
            )
        }
    }
}
