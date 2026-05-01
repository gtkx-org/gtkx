//! Fundamental type handling for FFI.
//!
//! GLib fundamental types are custom reference-counted types that don't
//! derive from GObject. Examples include `GParamSpec` and Pango layout types.
//! They have custom ref/unref functions rather than using `g_object_ref/unref`.

use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{self, translate::ToGlibPtr as _, translate::ToGlibPtrMut as _};
use neon::object::Object as _;
use neon::prelude::*;

use super::{FfiDecoder, FfiEncoder, GlibValueCodec, Ownership, RawPtrCodec};
use crate::managed::{Fundamental, NativeValue, RefFn, UnrefFn};
use crate::state::GtkThreadState;
use crate::{ffi, value};

#[derive(Debug, Clone)]
pub struct FundamentalType {
    pub ownership: Ownership,
    pub library: String,
    pub ref_func: String,
    pub unref_func: String,
    pub type_name: Option<String>,
}

impl FundamentalType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let ownership = Ownership::from_js_value(cx, obj, "fundamental")?;

        let library: Handle<JsString> = obj.get(cx, "library")?;
        let ref_func: Handle<JsString> = obj.get(cx, "refFn")?;
        let unref_func: Handle<JsString> = obj.get(cx, "unrefFn")?;
        let type_name: Option<Handle<JsString>> = obj.get_opt(cx, "typeName")?;

        Ok(Self {
            ownership,
            library: library.value(cx),
            ref_func: ref_func.value(cx),
            unref_func: unref_func.value(cx),
            type_name: type_name.map(|s| s.value(cx)),
        })
    }

    pub fn lookup_fns(&self) -> anyhow::Result<(Option<RefFn>, Option<UnrefFn>)> {
        GtkThreadState::with(|state| {
            state.lookup_fundamental_fns(&self.library, &self.ref_func, &self.unref_func)
        })
    }

    pub fn ptr_to_glib_value(&self, ptr: *mut c_void) -> anyhow::Result<glib::Value> {
        let gtype = self.type_name.as_deref().and_then(glib::Type::from_name);

        let Some(gtype) = gtype else {
            bail!(
                "Cannot convert Fundamental type to glib::Value: no GType for '{}'",
                self.type_name.as_deref().unwrap_or(&self.unref_func)
            )
        };

        let mut value = glib::Value::from_type(gtype);
        if gtype.is_a(glib::types::Type::VARIANT) {
            unsafe {
                glib::gobject_ffi::g_value_set_variant(value.to_glib_none_mut().0, ptr as *mut _);
            }
        } else if gtype.is_a(glib::types::Type::PARAM_SPEC) {
            unsafe {
                glib::gobject_ffi::g_value_set_param(value.to_glib_none_mut().0, ptr as *mut _);
            }
        } else {
            bail!(
                "Unsupported fundamental GType '{}' for glib::Value conversion",
                gtype.name()
            )
        }
        Ok(value)
    }
}

impl FfiEncoder for FundamentalType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let mut ptr = value.object_ptr("Fundamental")?;

        if self.ownership.is_full() && !ptr.is_null() {
            let (ref_fn, _) = self.lookup_fns()?;
            if let Some(ref_fn) = ref_fn {
                ptr = unsafe { ref_fn(ptr) };
            }
        }

        Ok(ffi::FfiValue::Ptr(ptr))
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

impl FfiDecoder for FundamentalType {
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
}

impl RawPtrCodec for FundamentalType {
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

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = value::Value::result_to_ptr(value);
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

    fn write_value_to_raw_ptr(&self, ptr: *mut c_void, value: &value::Value) -> anyhow::Result<()> {
        let obj_ptr = value.object_ptr("Fundamental field write")?;
        unsafe { (ptr as *mut *mut c_void).write_unaligned(obj_ptr) };
        Ok(())
    }
}

impl GlibValueCodec for FundamentalType {
    fn to_glib_value(&self, val: &value::Value) -> anyhow::Result<Option<glib::Value>> {
        let ptr = match val {
            value::Value::Object(handle) => handle.ptr(),
            _ => return Ok(None),
        };
        if ptr.is_null() {
            return Ok(None);
        }
        self.ptr_to_glib_value(ptr).map(Some)
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
}
