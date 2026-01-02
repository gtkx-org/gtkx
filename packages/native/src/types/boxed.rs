//! Boxed type representation for FFI.
//!
//! Defines [`BoxedType`] for GObject boxed types (value types like `GdkRGBA`,
//! `PangoFontDescription`, etc.). Boxed types are copied and freed using
//! GLib's boxed type system.
//!
//! ## Ownership
//!
//! - `ownership: "full"` - Ownership transferred, caller should free when done
//! - `ownership: "none"` - Reference is borrowed, caller must not free
//!
//! ## Type Resolution
//!
//! The [`BoxedType::get_gtype`] method resolves the GLib type:
//! 1. First checks if the type is already registered by name
//! 2. Falls back to dynamically loading the `get_type` function from the library

use gtk4::glib::{self, translate::FromGlib as _};
use libffi::middle as ffi;
use neon::prelude::*;

use crate::ownership::parse_is_transfer_full;
use crate::state::GtkThreadState;

#[derive(Debug, Clone)]
pub struct BoxedType {
    pub is_transfer_full: bool,
    pub type_: String,
    pub lib: Option<String>,
    pub get_type_fn: Option<String>,
}

impl PartialEq for BoxedType {
    fn eq(&self, other: &Self) -> bool {
        self.type_ == other.type_
    }
}

impl Eq for BoxedType {}

impl std::hash::Hash for BoxedType {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.type_.hash(state);
    }
}

impl BoxedType {
    pub fn new(
        is_transfer_full: bool,
        type_: String,
        lib: Option<String>,
        get_type_fn: Option<String>,
    ) -> Self {
        BoxedType {
            is_transfer_full,
            type_,
            lib,
            get_type_fn,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let is_transfer_full = parse_is_transfer_full(cx, obj, "boxed")?;

        let type_prop: Handle<'_, JsValue> = obj.prop(cx, "innerType").get()?;
        let type_ = type_prop
            .downcast::<JsString, _>(cx)
            .or_throw(cx)?
            .value(cx);

        let lib_prop: Handle<'_, JsValue> = obj.prop(cx, "lib").get()?;
        let lib = lib_prop
            .downcast::<JsString, _>(cx)
            .map(|s| s.value(cx))
            .ok();

        let get_type_fn_prop: Handle<'_, JsValue> = obj.prop(cx, "getTypeFn").get()?;
        let get_type_fn = get_type_fn_prop
            .downcast::<JsString, _>(cx)
            .map(|s| s.value(cx))
            .ok();

        Ok(Self::new(is_transfer_full, type_, lib, get_type_fn))
    }

    pub fn get_gtype(&self) -> Option<glib::Type> {
        if let Some(gtype) = glib::Type::from_name(&self.type_) {
            return Some(gtype);
        }

        let lib_name = self.lib.as_ref()?;
        let get_type_fn = self
            .get_type_fn
            .clone()
            .unwrap_or_else(|| type_name_to_get_type_fn(&self.type_));

        GtkThreadState::with(|state| {
            let library = state.get_library(lib_name).ok()?;
            let symbol = unsafe {
                library
                    .get::<unsafe extern "C" fn() -> glib::ffi::GType>(get_type_fn.as_bytes())
                    .ok()?
            };
            let gtype_raw = unsafe { symbol() };
            let gtype = unsafe { glib::Type::from_glib(gtype_raw) };
            Some(gtype)
        })
    }
}

fn type_name_to_get_type_fn(type_name: &str) -> String {
    let mut result = String::new();

    for c in type_name.chars() {
        if c.is_uppercase() {
            if !result.is_empty() {
                result.push('_');
            }
            result.push(c.to_ascii_lowercase());
        } else {
            result.push(c);
        }
    }

    result.push_str("_get_type");
    result
}

impl From<&BoxedType> for ffi::Type {
    fn from(_: &BoxedType) -> Self {
        ffi::Type::pointer()
    }
}

