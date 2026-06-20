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
            unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) }
        };
        Ok(value::Value::Object(
            NativeValue::Fundamental(fundamental).into(),
        ))
    }
}

impl FfiEncoder for FundamentalType {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("Fundamental")?;

        if self.ownership.is_full() && !ptr.is_null() {
            let (ref_fn, unref_fn) = self.lookup_fns()?;
            if let Some(ref_fn) = ref_fn {
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
                return Ok(unsafe { ref_fn(ptr) });
            }
        }
        Ok(ptr)
    }
}

impl FfiDecoder for FundamentalType {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(ffi_value) => {
                let Some(ptr) = ffi_value.as_non_null_ptr("Fundamental")? else {
                    return Ok(value::Value::Null);
                };
                self.wrap_ptr(ptr)
            }
            ReadSource::Value(ptr, _context) => self.null_guarded(ptr, |ptr| {
                let (ref_fn, unref_fn) = self.lookup_fns()?;
                let fundamental = unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) };
                Ok(value::Value::Object(
                    NativeValue::Fundamental(fundamental).into(),
                ))
            }),
            ReadSource::Slot(ptr, context) => unsafe { self.read_pointer_slot(ptr, context) },
        }
    }
}

impl RawPtrCodec for FundamentalType {
    unsafe fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        self.write_return_with_ownership(ret, value, self.ownership, |ptr| {
            match self.lookup_fns() {
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
