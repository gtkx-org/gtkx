//! Fundamental type handling for FFI.
//!
//! GLib fundamental types are custom reference-counted types that don't
//! derive from GObject. Examples include `GParamSpec` and Pango layout types.
//! They have custom ref/unref functions rather than using `g_object_ref/unref`.

use libffi::middle as libffi;
use neon::object::Object as _;
use neon::prelude::*;

use super::Ownership;
use crate::managed::{Fundamental, NativeValue, RefFn, UnrefFn};
use crate::state::GtkThreadState;
use crate::{ffi, value};

#[derive(Debug, Clone)]
pub struct FundamentalType {
    pub ownership: Ownership,
    pub library: String,
    pub ref_func: String,
    pub unref_func: String,
}

impl FundamentalType {
    pub fn new(
        ownership: Ownership,
        library: String,
        ref_func: String,
        unref_func: String,
    ) -> Self {
        FundamentalType {
            ownership,
            library,
            ref_func,
            unref_func,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let ownership = Ownership::from_js_value(cx, obj, "fundamental")?;

        let library: Handle<JsString> = obj.get(cx, "library")?;
        let ref_func: Handle<JsString> = obj.get(cx, "refFunc")?;
        let unref_func: Handle<JsString> = obj.get(cx, "unrefFunc")?;

        Ok(Self::new(
            ownership,
            library.value(cx),
            ref_func.value(cx),
            unref_func.value(cx),
        ))
    }

    pub fn lookup_fns(&self) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        GtkThreadState::with(|state| {
            let library = state.library(&self.library)?;

            let ref_fn = unsafe {
                library
                    .get::<RefFn>(self.ref_func.as_bytes())
                    .ok()
                    .map(|sym| *sym)
            };

            let unref_fn = unsafe {
                library
                    .get::<UnrefFn>(self.unref_func.as_bytes())
                    .ok()
                    .map(|sym| *sym)
            };

            Ok((ref_fn, unref_fn))
        })
    }
}

impl From<&FundamentalType> for libffi::Type {
    fn from(_: &FundamentalType) -> Self {
        libffi::Type::pointer()
    }
}

impl ffi::FfiEncode for FundamentalType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("Fundamental")?;

        if self.ownership.is_full() && !ptr.is_null() {
            let (ref_fn, _) = self.lookup_fns()?;
            if let Some(ref_fn) = ref_fn {
                // SAFETY: ptr is a valid fundamental type pointer and ref_fn is the correct ref function
                unsafe { ref_fn(ptr) };
            }
        }

        Ok(ffi::FfiValue::Ptr(ptr))
    }
}

impl ffi::FfiDecode for FundamentalType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = ffi_value.as_non_null_ptr("Fundamental")? else {
            return Ok(value::Value::Null);
        };

        let (ref_fn, unref_fn) = self.lookup_fns()?;
        let fundamental = if self.ownership.is_full() {
            Fundamental::from_glib_full(ptr, ref_fn, unref_fn)
        } else {
            Fundamental::from_glib_none(ptr, ref_fn, unref_fn)
        };

        Ok(value::Value::Object(
            NativeValue::Fundamental(fundamental).into(),
        ))
    }
}
