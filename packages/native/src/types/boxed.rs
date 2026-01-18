//! Boxed and struct type handling for FFI.
//!
//! GLib boxed types are heap-allocated structures with reference counting
//! managed by GLib. Struct types are similar but may be stack-allocated
//! or have fixed sizes. This module provides [`BoxedType`] and [`StructType`]
//! descriptors that handle encoding/decoding these types for FFI calls.

use gtk4::glib::{self, translate::FromGlib as _, translate::IntoGlib as _};
use libffi::middle as libffi;
use neon::object::Object as _;
use neon::prelude::*;

use super::Ownership;
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
    pub fn new(
        ownership: Ownership,
        type_name: String,
        library: Option<String>,
        get_type_fn: Option<String>,
    ) -> Self {
        BoxedType {
            ownership,
            type_name,
            library,
            get_type_fn,
        }
    }

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

        Ok(Self::new(ownership, type_name, library, get_type_fn))
    }

    pub fn gtype_from_name(&self) -> Option<glib::Type> {
        glib::Type::from_name(&self.type_name)
    }

    pub fn gtype(&self) -> Option<glib::Type> {
        self.gtype_from_name()
            .or_else(|| self.resolve_gtype_from_library())
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

impl From<&BoxedType> for libffi::Type {
    fn from(_: &BoxedType) -> Self {
        libffi::Type::pointer()
    }
}

impl ffi::FfiEncode for BoxedType {
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
}

impl ffi::FfiDecode for BoxedType {
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

#[derive(Debug, Clone)]
pub struct StructType {
    pub ownership: Ownership,
    pub type_name: String,
    pub size: Option<usize>,
}

impl StructType {
    pub fn new(ownership: Ownership, type_name: String, size: Option<usize>) -> Self {
        StructType {
            ownership,
            type_name,
            size,
        }
    }

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

        Ok(Self::new(ownership, type_name, size))
    }
}

impl From<&StructType> for libffi::Type {
    fn from(_: &StructType) -> Self {
        libffi::Type::pointer()
    }
}

impl ffi::FfiEncode for StructType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr("Struct object")?;
        Ok(ffi::FfiValue::Ptr(ptr))
    }
}

impl ffi::FfiDecode for StructType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(struct_ptr) = ffi_value.as_non_null_ptr("Struct")? else {
            return Ok(value::Value::Null);
        };

        let boxed = if self.ownership.is_full() {
            Boxed::from_glib_full(None, struct_ptr)
        } else {
            Boxed::from_glib_none_with_size(None, struct_ptr, self.size, Some(&self.type_name))?
        };

        Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
    }
}
