//! Fundamental type handling for FFI.
//!
//! GLib fundamental types are custom reference-counted types that don't
//! derive from GObject. Examples include `GParamSpec` and Pango layout types.
//! They have custom ref/unref functions rather than using `g_object_ref/unref`.

use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{self, translate::ToGlibPtr as _};
use neon::object::Object as _;
use neon::prelude::*;

use super::{FfiCodec, Ownership};
use crate::managed::{Fundamental, NativeValue, RefFn, UnrefFn};
use crate::state::GtkThreadState;
use crate::{ffi, value};

fn extract_object_ptr(value: &Result<value::Value, ()>) -> *mut c_void {
    match value {
        Ok(value::Value::Object(handle)) => handle.get_ptr().unwrap_or(std::ptr::null_mut()),
        _ => std::ptr::null_mut(),
    }
}

#[derive(Debug, Clone)]
pub struct FundamentalType {
    pub ownership: Ownership,
    pub library: String,
    pub ref_func: String,
    pub unref_func: String,
}

impl FundamentalType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let ownership = Ownership::from_js_value(cx, obj, "fundamental")?;

        let library: Handle<JsString> = obj.get(cx, "library")?;
        let ref_func: Handle<JsString> = obj.get(cx, "refFn")?;
        let unref_func: Handle<JsString> = obj.get(cx, "unrefFn")?;

        Ok(Self {
            ownership,
            library: library.value(cx),
            ref_func: ref_func.value(cx),
            unref_func: unref_func.value(cx),
        })
    }

    pub fn lookup_fns(&self) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        GtkThreadState::with(|state| {
            state.lookup_fundamental_fns(&self.library, &self.ref_func, &self.unref_func)
        })
    }
}

impl FfiCodec for FundamentalType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let mut ptr = value.object_ptr("Fundamental")?;

        if self.ownership.is_full() && !ptr.is_null() {
            let (ref_fn, _) = self.lookup_fns()?;
            if let Some(ref_fn) = ref_fn {
                // SAFETY: ptr is a valid fundamental type pointer and ref_fn is the correct ref function.
                // For copy-based types (like PangoAttribute), ref_fn returns a NEW pointer to a copy.
                // For ref-counted types, ref_fn returns the same pointer with incremented ref count.
                // In both cases, we must use the returned pointer.
                ptr = unsafe { ref_fn(ptr) };
            }
        }

        Ok(ffi::FfiValue::Ptr(ptr))
    }

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = ffi_value.as_non_null_ptr("Fundamental")? else {
            return Ok(value::Value::Null);
        };

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

    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let gvalue_type = gvalue.type_();
        let ptr = if gvalue_type.is_a(glib::types::Type::VARIANT) {
            unsafe {
                glib::gobject_ffi::g_value_get_variant(gvalue.to_glib_none().0 as *const _)
                    .cast::<c_void>()
            }
        } else if gvalue_type.is_a(glib::types::Type::PARAM_SPEC) {
            unsafe {
                glib::gobject_ffi::g_value_get_param(gvalue.to_glib_none().0 as *const _)
                    .cast::<c_void>()
            }
        } else {
            bail!("Unsupported fundamental type in GValue: {:?}", gvalue_type)
        };
        if ptr.is_null() {
            return Ok(value::Value::Null);
        }
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

    #[allow(clippy::not_unsafe_ptr_arg_deref)]
    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Null);
        }
        let (ref_fn, unref_fn) = self.lookup_fns()?;
        let fundamental = unsafe { Fundamental::from_glib_none(ptr, ref_fn, unref_fn) };
        Ok(value::Value::Object(
            NativeValue::Fundamental(fundamental).into(),
        ))
    }

    fn read_from_raw_ptr(&self, ptr: *const c_void, context: &str) -> anyhow::Result<value::Value> {
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        self.ptr_to_value(inner_ptr, context)
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = extract_object_ptr(value);
        let ptr = if !ptr.is_null() {
            match self.lookup_fns() {
                Ok((Some(ref_fn), _)) => unsafe { ref_fn(ptr) },
                _ => ptr,
            }
        } else {
            ptr
        };
        unsafe { *(ret as *mut *mut c_void) = ptr };
    }

    #[allow(clippy::not_unsafe_ptr_arg_deref)]
    fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if self.ownership.is_full() && !ptr.is_null() {
            let (ref_fn, _) = self.lookup_fns()?;
            if let Some(ref_fn) = ref_fn {
                return Ok(unsafe { ref_fn(ptr) });
            }
        }
        Ok(ptr)
    }
}
