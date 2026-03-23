//! Boxed and struct type handling for FFI.
//!
//! GLib boxed types are heap-allocated structures with reference counting
//! managed by GLib. Struct types are similar but may be stack-allocated
//! or have fixed sizes. This module provides [`BoxedType`] and [`StructType`]
//! descriptors that handle encoding/decoding these types for FFI calls.

use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{
    self,
    translate::{FromGlib as _, IntoGlib as _, ToGlibPtr as _, ToGlibPtrMut as _},
};
use neon::object::Object as _;
use neon::prelude::*;

use super::{FfiDecoder, FfiEncoder, GlibValueCodec, Ownership, RawPtrCodec};
use crate::managed::{Boxed, NativeValue};
use crate::state::GtkThreadState;
use crate::{ffi, value};

#[derive(Debug, Clone)]
pub struct BoxedType {
    pub ownership: Ownership,
    pub type_name: String,
    pub library: Option<String>,
    pub get_type_fn: Option<String>,
}

impl BoxedType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let ownership = Ownership::from_js_value(cx, obj, "boxed")?;

        let type_prop: Handle<'_, JsValue> = obj.prop(cx, "innerType").get()?;
        let type_name = type_prop
            .downcast::<JsString, _>(cx)
            .or_throw(cx)?
            .value(cx);

        let lib_prop: Handle<'_, JsValue> = obj.prop(cx, "library").get()?;
        let library = lib_prop
            .downcast::<JsString, _>(cx)
            .map(|s: Handle<'_, JsString>| s.value(cx))
            .ok();

        let get_type_fn_prop: Handle<'_, JsValue> = obj.prop(cx, "getTypeFn").get()?;
        let get_type_fn = get_type_fn_prop
            .downcast::<JsString, _>(cx)
            .map(|s: Handle<'_, JsString>| s.value(cx))
            .ok();

        Ok(Self {
            ownership,
            type_name,
            library,
            get_type_fn,
        })
    }

    #[must_use]
    pub fn gtype(&self) -> Option<glib::Type> {
        glib::Type::from_name(&self.type_name).or_else(|| self.resolve_gtype_from_library())
    }

    fn resolve_gtype_from_library(&self) -> Option<glib::Type> {
        let lib_name = self.library.as_ref()?;
        let get_type_fn = self.get_type_fn.as_ref()?;

        let symbol = GtkThreadState::with(|state| {
            let library = state.library(lib_name).ok()?;
            unsafe {
                library
                    .get::<unsafe extern "C" fn() -> glib::ffi::GType>(get_type_fn.as_bytes())
                    .ok()
                    .map(|s| *s)
            }
        })?;

        let gtype_raw = unsafe { symbol() };
        let gtype = unsafe { glib::Type::from_glib(gtype_raw) };
        Some(gtype)
    }
}

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

    #[allow(clippy::not_unsafe_ptr_arg_deref)]
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

        let gtype = self.gtype();
        let boxed = if self.ownership.is_full() {
            NativeValue::Boxed(Boxed::from_glib_full(gtype, boxed_ptr))
        } else {
            NativeValue::Boxed(Boxed::from_glib_none_with_size(
                gtype,
                boxed_ptr,
                None,
                Some(&self.type_name),
            )?)
        };

        Ok(value::Value::Object(boxed.into()))
    }
}

impl RawPtrCodec for BoxedType {
    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Null);
        }
        let gtype = self.gtype();
        let boxed = Boxed::from_glib_none(gtype, ptr)?;
        Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
    }

    fn read_from_raw_ptr(&self, ptr: *const c_void, context: &str) -> anyhow::Result<value::Value> {
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        self.ptr_to_value(inner_ptr, context)
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = value::Value::result_to_ptr(value);
        let ptr = if !ptr.is_null() {
            match self.gtype() {
                Some(gtype) => unsafe {
                    glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _)
                },
                None => ptr,
            }
        } else {
            ptr
        };
        unsafe { *(ret as *mut *mut c_void) = ptr };
    }

    fn write_value_to_raw_ptr(&self, ptr: *mut c_void, value: &value::Value) -> anyhow::Result<()> {
        let obj_ptr = value.object_ptr("Boxed field write")?;
        unsafe { (ptr as *mut *mut c_void).write_unaligned(obj_ptr) };
        Ok(())
    }
}

impl GlibValueCodec for BoxedType {
    fn to_glib_value(&self, val: &value::Value) -> anyhow::Result<Option<glib::Value>> {
        let ptr = match val {
            value::Value::Object(handle) => handle.get_ptr(),
            value::Value::Null | value::Value::Undefined => return Ok(None),
            _ => return Ok(None),
        };
        let Some(ptr) = ptr else { return Ok(None) };
        let Some(gtype) = self.gtype() else {
            return Ok(None);
        };
        let mut gvalue = glib::Value::from_type(gtype);
        unsafe {
            glib::gobject_ffi::g_value_set_boxed(gvalue.to_glib_none_mut().0, ptr as *const _);
        }
        Ok(Some(gvalue))
    }

    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let gvalue_type = gvalue.type_();

        if gvalue_type == glib::Type::STRING {
            let string: String = gvalue
                .get()
                .map_err(|e| anyhow::anyhow!("Failed to get String from GValue: {}", e))?;
            return Ok(value::Value::String(string));
        }

        let boxed_ptr =
            unsafe { glib::gobject_ffi::g_value_get_boxed(gvalue.to_glib_none().0 as *const _) };
        if boxed_ptr.is_null() {
            return Ok(value::Value::Null);
        }

        if gvalue_type.name() == "GValue" {
            let inner_gvalue = unsafe { &*(boxed_ptr as *const glib::Value) };
            return self.from_glib_value(inner_gvalue);
        }

        let gtype = self.gtype().or(Some(gvalue_type));
        let boxed = if self.ownership.is_full() {
            let owned_ptr = unsafe {
                glib::gobject_ffi::g_value_dup_boxed(gvalue.to_glib_none().0 as *const _)
            };
            Boxed::from_glib_full(gtype, owned_ptr)
        } else {
            Boxed::from_glib_none(gtype, boxed_ptr)?
        };
        Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
    }
}

#[derive(Debug, Clone)]
pub struct StructType {
    pub ownership: Ownership,
    pub type_name: String,
    pub size: Option<usize>,
}

impl StructType {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let ownership = Ownership::from_js_value(cx, obj, "struct")?;

        let type_prop: Handle<'_, JsValue> = obj.prop(cx, "innerType").get()?;
        let type_name = type_prop
            .downcast::<JsString, _>(cx)
            .or_throw(cx)?
            .value(cx);

        let size_prop: Handle<'_, JsValue> = obj.prop(cx, "size").get()?;
        let size = size_prop
            .downcast::<JsNumber, _>(cx)
            .map(|n: Handle<'_, JsNumber>| n.value(cx) as usize)
            .ok();

        Ok(Self {
            ownership,
            type_name,
            size,
        })
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

        let boxed = if self.ownership.is_full() {
            Boxed::from_glib_full(None, struct_ptr)
        } else {
            match self.size {
                Some(_) => Boxed::from_glib_none_with_size(
                    None,
                    struct_ptr,
                    self.size,
                    Some(&self.type_name),
                )?,
                None => Boxed::from_ptr_unowned(struct_ptr),
            }
        };

        Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
    }
}

impl RawPtrCodec for StructType {
    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Null);
        }
        let boxed = Boxed::from_glib_none_with_size(None, ptr, self.size, Some(&self.type_name))?;
        Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
    }

    fn read_from_raw_ptr(&self, ptr: *const c_void, context: &str) -> anyhow::Result<value::Value> {
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        self.ptr_to_value(inner_ptr, context)
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let ptr = value::Value::result_to_ptr(value);
        unsafe { *(ret as *mut *mut c_void) = ptr };
    }

    fn write_value_to_raw_ptr(&self, ptr: *mut c_void, value: &value::Value) -> anyhow::Result<()> {
        let obj_ptr = value.object_ptr("Struct field write")?;
        unsafe { (ptr as *mut *mut c_void).write_unaligned(obj_ptr) };
        Ok(())
    }
}

impl GlibValueCodec for StructType {
    fn from_glib_value(&self, _gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        bail!(
            "Plain struct type should not appear in glib value conversion - structs without GType cannot be stored in GValue"
        )
    }
}
