//! FFI type system for describing GTK and GLib types.
//!
//! This module defines the [`Type`] enum and associated types that describe
//! all values that can flow through the FFI boundary. Types are parsed from
//! JavaScript objects and converted to libffi types for native calls.
//!
//! ## Type Hierarchy
//!
//! ```text
//! Type
//! ├── Integer(IntegerType)    - Sized integers (i8..i64, u8..u64)
//! ├── Float(FloatType)        - Floating point (f32, f64)
//! ├── String(StringType)      - UTF-8 strings (owned or borrowed)
//! ├── Boolean                 - Boolean values
//! ├── Null / Undefined        - Null pointer / void return
//! ├── GObject(GObjectType)    - GObject instances
//! ├── Boxed(BoxedType)        - GObject boxed types (e.g., GdkRGBA)
//! ├── GVariant(GVariantType)  - GVariant values
//! ├── Array(ArrayType)        - Arrays, GLists, GSLists
//! ├── Callback(CallbackType)  - JavaScript callback functions
//! └── Ref(RefType)            - Pointers to values (out parameters)
//! ```
//!
//! ## Ownership
//!
//! Many types have an `is_transfer_full` flag that distinguishes:
//! - **Transfer full**: Caller takes ownership, responsible for freeing
//! - **Transfer none**: Caller receives a reference, must not free
//!
//! This is critical for correct memory management across the FFI boundary.

use libffi::middle as ffi;
use neon::prelude::*;

mod array;
mod boxed;
mod callback;
mod float;
mod gobject;
mod gparam;
mod gvariant;
mod integer;
mod r#ref;
mod string;
mod r#struct;

pub use array::*;
pub use boxed::*;
pub use callback::*;
pub use float::*;
pub use gobject::*;
pub use gparam::*;
pub use gvariant::*;
pub use integer::*;
pub use r#ref::*;
pub use string::*;
pub use r#struct::*;

#[derive(Debug, Clone, PartialEq)]
pub enum CallbackTrampoline {
    Closure,
    AsyncReady,
    Destroy,
    DrawFunc,
    ShortcutFunc,
    TreeListModelCreateFunc,
}

#[derive(Debug, Clone)]
pub struct CallbackType {
    pub trampoline: CallbackTrampoline,
    pub arg_types: Option<Vec<Type>>,
    pub return_type: Option<Box<Type>>,
    pub source_type: Option<Box<Type>>,
    pub result_type: Option<Box<Type>>,
}

#[derive(Debug, Clone)]
pub enum Type {
    Integer(IntegerType),
    Float(FloatType),
    String(StringType),
    Null,
    Undefined,
    Boolean,
    GObject(GObjectType),
    GParam(GParamType),
    Boxed(BoxedType),
    Struct(StructType),
    GVariant(GVariantType),
    Array(ArrayType),
    Callback(CallbackType),
    Ref(RefType),
}

impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Type::Integer(t) => write!(f, "Integer({}, {})", t.size, t.sign),
            Type::Float(t) => write!(f, "Float({})", t.size),
            Type::String(_) => write!(f, "String"),
            Type::Null => write!(f, "Null"),
            Type::Undefined => write!(f, "Undefined"),
            Type::Boolean => write!(f, "Boolean"),
            Type::GObject(_) => write!(f, "GObject"),
            Type::GParam(_) => write!(f, "GParam"),
            Type::Boxed(t) => write!(f, "Boxed({})", t.type_),
            Type::Struct(t) => write!(f, "Struct({})", t.type_),
            Type::GVariant(_) => write!(f, "GVariant"),
            Type::Array(_) => write!(f, "Array"),
            Type::Callback(t) => write!(f, "Callback({:?})", t.trampoline),
            Type::Ref(t) => write!(f, "Ref({})", t.inner_type),
        }
    }
}

impl Type {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let type_value: Handle<'_, JsValue> = obj.prop(cx, "type").get()?;

        let type_ = type_value
            .downcast::<JsString, _>(cx)
            .or_throw(cx)?
            .value(cx);

        match type_.as_str() {
            "int" => Ok(Type::Integer(IntegerType::from_js_value(cx, value)?)),
            "float" => Ok(Type::Float(FloatType::from_js_value(cx, value)?)),
            "string" => Ok(Type::String(StringType::from_js_value(cx, value)?)),
            "boolean" => Ok(Type::Boolean),
            "null" => Ok(Type::Null),
            "undefined" => Ok(Type::Undefined),
            "gobject" => Ok(Type::GObject(GObjectType::from_js_value(cx, value)?)),
            "gparam" => Ok(Type::GParam(GParamType::from_js_value(cx, value)?)),
            "boxed" => Ok(Type::Boxed(BoxedType::from_js_value(cx, value)?)),
            "struct" => Ok(Type::Struct(StructType::from_js_value(cx, value)?)),
            "gvariant" => Ok(Type::GVariant(GVariantType::from_js_value(cx, value)?)),
            "array" => Ok(Type::Array(ArrayType::from_js_value(cx, obj.upcast())?)),
            "callback" => {
                let trampoline_prop: Handle<'_, JsValue> = obj.prop(cx, "trampoline").get()?;
                let trampoline_str = trampoline_prop
                    .downcast::<JsString, _>(cx)
                    .or_else(|_| {
                        cx.throw_type_error("'trampoline' property is required for callback types")
                    })?
                    .value(cx);

                let trampoline = match trampoline_str.as_str() {
                    "closure" => CallbackTrampoline::Closure,
                    "asyncReady" => CallbackTrampoline::AsyncReady,
                    "destroy" => CallbackTrampoline::Destroy,
                    "drawFunc" => CallbackTrampoline::DrawFunc,
                    "shortcutFunc" => CallbackTrampoline::ShortcutFunc,
                    "treeListModelCreateFunc" => CallbackTrampoline::TreeListModelCreateFunc,
                    _ => return cx.throw_type_error("'trampoline' must be one of: 'closure', 'asyncReady', 'destroy', 'drawFunc', 'shortcutFunc', 'treeListModelCreateFunc'"),
                };

                let arg_types: Option<Handle<JsArray>> = obj.get_opt(cx, "argTypes")?;
                let arg_types = match arg_types {
                    Some(arr) => {
                        let vec = arr.to_vec(cx)?;
                        let mut types = Vec::with_capacity(vec.len());
                        for item in vec {
                            types.push(Type::from_js_value(cx, item)?);
                        }
                        Some(types)
                    }
                    None => None,
                };

                let return_type: Option<Handle<JsValue>> = obj.get_opt(cx, "returnType")?;
                let return_type = match return_type {
                    Some(v) => Some(Box::new(Type::from_js_value(cx, v)?)),
                    None => None,
                };

                let source_type: Option<Handle<JsValue>> = obj.get_opt(cx, "sourceType")?;
                let source_type = match source_type {
                    Some(v) => Some(Box::new(Type::from_js_value(cx, v)?)),
                    None => None,
                };

                let result_type: Option<Handle<JsValue>> = obj.get_opt(cx, "resultType")?;
                let result_type = match result_type {
                    Some(v) => Some(Box::new(Type::from_js_value(cx, v)?)),
                    None => None,
                };

                Ok(Type::Callback(CallbackType {
                    trampoline,
                    arg_types,
                    return_type,
                    source_type,
                    result_type,
                }))
            }
            "ref" => Ok(Type::Ref(RefType::from_js_value(cx, obj.upcast())?)),
            _ => cx.throw_type_error(format!("Unknown type: {}", type_)),
        }
    }
}

impl From<&Type> for ffi::Type {
    fn from(value: &Type) -> Self {
        match value {
            Type::Integer(type_) => type_.into(),
            Type::Float(type_) => type_.into(),
            Type::String(type_) => type_.into(),
            Type::Boolean => ffi::Type::u8(),
            Type::Null => ffi::Type::pointer(),
            Type::GObject(type_) => type_.into(),
            Type::GParam(type_) => type_.into(),
            Type::Boxed(type_) => type_.into(),
            Type::Struct(type_) => type_.into(),
            Type::GVariant(type_) => type_.into(),
            Type::Array(type_) => type_.into(),
            Type::Callback(_) => ffi::Type::pointer(),
            Type::Ref(type_) => type_.into(),
            Type::Undefined => ffi::Type::void(),
        }
    }
}
