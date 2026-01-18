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
//! ├── Integer(IntegerKind)    - Sized integers (i8..i64, u8..u64)
//! ├── Float(FloatKind)        - Floating point (f32, f64)
//! ├── String(StringType)      - UTF-8 strings (owned or borrowed)
//! ├── Boolean                 - Boolean values
//! ├── Null / Undefined        - Null pointer / void return
//! ├── GObject(GObjectType)    - GObject instances
//! ├── Boxed(BoxedType)        - GObject boxed types (e.g., GdkRGBA)
//! ├── Fundamental(FundamentalType) - Fundamental types (GVariant, GParamSpec, etc.)
//! ├── Array(ArrayType)        - Arrays, GLists, GSLists
//! ├── Callback(CallbackType)  - JavaScript callback functions
//! └── Ref(RefType)            - Pointers to values (out parameters)
//! ```
//!
//! ## Ownership
//!
//! Many types have an `ownership` field using the [`Ownership`] enum:
//! - **`Ownership::Full`**: Caller takes ownership, responsible for freeing
//! - **`Ownership::Borrowed`**: Caller receives a reference, must not free
//!
//! This is critical for correct memory management across the FFI boundary.
//!
//! [`Ownership`]: Ownership

use std::ffi::{c_char, c_void};

use anyhow::bail;
use gtk4::glib::{self, translate::FromGlibPtrNone as _};
use libffi::middle as libffi;
use neon::prelude::*;

use crate::{ffi, value};

mod array;
mod boxed;
mod callback;
mod fundamental;
mod gobject;
mod hashtable;
mod numeric;
mod ref_type;
mod string;

pub use array::{ArrayKind, ArrayType};
pub use boxed::{BoxedType, StructType};
pub use callback::{CallbackKind, CallbackType};
pub use fundamental::FundamentalType;
pub use gobject::GObjectType;
pub use hashtable::HashTableType;
pub use numeric::{FloatKind, IntegerKind, IntegerPrimitive, IntegerType, NumericPrimitive};
pub use ref_type::RefType;
pub use string::StringType;

#[derive(Debug, Clone, Copy, Default)]
pub enum Ownership {
    #[default]
    Borrowed,
    Full,
}

impl Ownership {
    #[inline]
    pub fn is_full(self) -> bool {
        matches!(self, Ownership::Full)
    }

    #[inline]
    pub fn is_borrowed(self) -> bool {
        matches!(self, Ownership::Borrowed)
    }
}

impl Ownership {
    pub fn from_js_value(
        cx: &mut FunctionContext,
        obj: Handle<JsObject>,
        type_name: &str,
    ) -> NeonResult<Self> {
        let ownership_prop: Handle<'_, JsValue> = obj.prop(cx, "ownership").get()?;

        let ownership = ownership_prop
            .downcast::<JsString, _>(cx)
            .or_else(|_| {
                cx.throw_type_error(format!(
                    "'ownership' property is required for {} types",
                    type_name
                ))
            })?
            .value(cx);

        ownership
            .parse()
            .map_err(|e: String| cx.throw_type_error::<_, ()>(e).unwrap_err())
    }
}

impl std::fmt::Display for Ownership {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Ownership::Borrowed => write!(f, "borrowed"),
            Ownership::Full => write!(f, "full"),
        }
    }
}

impl std::str::FromStr for Ownership {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "full" => Ok(Ownership::Full),
            "borrowed" => Ok(Ownership::Borrowed),
            other => Err(format!(
                "'ownership' must be 'full' or 'borrowed', got '{}'",
                other
            )),
        }
    }
}

#[derive(Debug, Clone)]
pub enum Type {
    Integer(IntegerType),
    Float(FloatKind),
    String(StringType),
    Null,
    Undefined,
    Boolean,
    GObject(GObjectType),
    Boxed(BoxedType),
    Struct(StructType),
    Fundamental(FundamentalType),
    Array(ArrayType),
    HashTable(HashTableType),
    Callback(CallbackType),
    Ref(RefType),
}

impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Type::Integer(t) => write!(f, "Integer({:?})", t.kind),
            Type::Float(kind) => write!(f, "Float({:?})", kind),
            Type::String(_) => write!(f, "String"),
            Type::Null => write!(f, "Null"),
            Type::Undefined => write!(f, "Undefined"),
            Type::Boolean => write!(f, "Boolean"),
            Type::GObject(_) => write!(f, "GObject"),
            Type::Boxed(t) => write!(f, "Boxed({})", t.type_name),
            Type::Struct(t) => write!(f, "Struct({})", t.type_name),
            Type::Fundamental(t) => write!(f, "Fundamental({})", t.unref_func),
            Type::Array(_) => write!(f, "Array"),
            Type::HashTable(_) => write!(f, "HashTable"),
            Type::Callback(t) => write!(f, "Callback({:?})", t.kind),
            Type::Ref(t) => write!(f, "Ref({})", t.inner_type),
        }
    }
}

impl Type {
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let type_value: Handle<'_, JsValue> = obj.prop(cx, "type").get()?;

        let ty = type_value
            .downcast::<JsString, _>(cx)
            .or_throw(cx)?
            .value(cx);

        match ty.as_str() {
            "int" => Ok(Type::Integer(IntegerType::from_js_value(cx, value)?)),
            "float" => Ok(Type::Float(FloatKind::from_js_value(cx, value)?)),
            "string" => Ok(Type::String(StringType::from_js_value(cx, value)?)),
            "boolean" => Ok(Type::Boolean),
            "null" => Ok(Type::Null),
            "undefined" => Ok(Type::Undefined),
            "gobject" => Ok(Type::GObject(GObjectType::from_js_value(cx, value)?)),
            "boxed" => Ok(Type::Boxed(BoxedType::from_js_value(cx, value)?)),
            "struct" => Ok(Type::Struct(StructType::from_js_value(cx, value)?)),
            "array" => Ok(Type::Array(ArrayType::from_js_value(cx, obj.upcast())?)),
            "hashtable" => Ok(Type::HashTable(HashTableType::from_js_value(cx, value)?)),
            "callback" => Ok(Type::Callback(CallbackType::from_js_value(cx, value)?)),
            "ref" => Ok(Type::Ref(RefType::from_js_value(cx, obj.upcast())?)),
            "fundamental" => Ok(Type::Fundamental(FundamentalType::from_js_value(
                cx, value,
            )?)),
            _ => cx.throw_type_error(format!("Unknown type: {}", ty)),
        }
    }

    pub fn ptr_to_value(&self, ptr: *mut c_void, context: &str) -> anyhow::Result<value::Value> {
        use std::ffi::CStr;
        match self {
            Type::String(_) => {
                if ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                let c_str = unsafe { CStr::from_ptr(ptr as *const c_char) };
                Ok(value::Value::String(c_str.to_string_lossy().into_owned()))
            }
            Type::Integer(int_type) => {
                let number = match int_type.kind {
                    IntegerKind::I32 => ptr as i32 as f64,
                    IntegerKind::U32 => ptr as u32 as f64,
                    IntegerKind::I64 => ptr as i64 as f64,
                    IntegerKind::U64 => ptr as u64 as f64,
                    _ => ptr as isize as f64,
                };
                Ok(value::Value::Number(number))
            }
            Type::GObject(_) => {
                if ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                let object =
                    unsafe { glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject) };
                Ok(value::Value::Object(
                    crate::managed::NativeValue::GObject(object).into(),
                ))
            }
            Type::Boxed(boxed_type) => {
                if ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                let gtype = boxed_type.gtype();
                let boxed = crate::managed::Boxed::from_glib_none(gtype, ptr)?;
                Ok(value::Value::Object(
                    crate::managed::NativeValue::Boxed(boxed).into(),
                ))
            }
            _ => bail!("Unsupported {} type: {:?}", context, self),
        }
    }
}

impl Type {
    pub fn append_ffi_arg_types(&self, types: &mut Vec<libffi::Type>) {
        match self {
            Type::Callback(callback_type) if callback_type.kind != CallbackKind::Closure => {
                types.push(libffi::Type::pointer());
                types.push(libffi::Type::pointer());

                if callback_type.kind == CallbackKind::DrawFunc
                    || callback_type.kind == CallbackKind::ShortcutFunc
                    || callback_type.kind == CallbackKind::TreeListModelCreateFunc
                    || callback_type.kind == CallbackKind::TickCallback
                {
                    types.push(libffi::Type::pointer());
                }
            }
            other => types.push(other.into()),
        }
    }
}

impl From<&Type> for libffi::Type {
    fn from(value: &Type) -> Self {
        match value {
            Type::Integer(ty) => ty.into(),
            Type::Float(ty) => (*ty).into(),
            Type::String(ty) => ty.into(),
            Type::Boolean => libffi::Type::u8(),
            Type::Null => libffi::Type::pointer(),
            Type::GObject(ty) => ty.into(),
            Type::Boxed(ty) => ty.into(),
            Type::Struct(ty) => ty.into(),
            Type::Fundamental(ty) => ty.into(),
            Type::Array(ty) => ty.into(),
            Type::HashTable(ty) => ty.into(),
            Type::Callback(_) => libffi::Type::pointer(),
            Type::Ref(ty) => ty.into(),
            Type::Undefined => libffi::Type::void(),
        }
    }
}

impl ffi::FfiEncode for Type {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        match self {
            Type::Integer(t) => t.encode(value, optional),
            Type::Float(t) => t.encode(value, optional),
            Type::String(t) => t.encode(value, optional),
            Type::Boolean => {
                let boolean = match value {
                    value::Value::Boolean(b) => *b,
                    _ => bail!("Expected a Boolean for boolean type, got {:?}", value),
                };
                Ok(ffi::FfiValue::U8(u8::from(boolean)))
            }
            Type::Null => Ok(ffi::FfiValue::Ptr(std::ptr::null_mut())),
            Type::Undefined => Ok(ffi::FfiValue::Ptr(std::ptr::null_mut())),
            Type::GObject(t) => t.encode(value, optional),
            Type::Boxed(t) => t.encode(value, optional),
            Type::Struct(t) => t.encode(value, optional),
            Type::Fundamental(t) => t.encode(value, optional),
            Type::Array(t) => t.encode(value, optional),
            Type::HashTable(t) => t.encode(value, optional),
            Type::Callback(t) => t.encode(value, optional),
            Type::Ref(t) => t.encode(value, optional),
        }
    }
}

impl ffi::FfiDecode for Type {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        match self {
            Type::Null => Ok(value::Value::Null),
            Type::Undefined => Ok(value::Value::Undefined),
            Type::Integer(t) => t.decode(ffi_value),
            Type::Float(t) => t.decode(ffi_value),
            Type::String(t) => t.decode(ffi_value),
            Type::Boolean => {
                let b = match ffi_value {
                    ffi::FfiValue::U8(v) => *v != 0,
                    _ => bail!("Expected a boolean ffi::FfiValue, got {:?}", ffi_value),
                };
                Ok(value::Value::Boolean(b))
            }
            Type::GObject(t) => t.decode(ffi_value),
            Type::Boxed(t) => t.decode(ffi_value),
            Type::Struct(t) => t.decode(ffi_value),
            Type::Fundamental(t) => t.decode(ffi_value),
            Type::Array(t) => t.decode(ffi_value),
            Type::HashTable(t) => t.decode(ffi_value),
            Type::Callback(_) => bail!("Callbacks cannot be converted from ffi::FfiValue"),
            Type::Ref(t) => t.decode(ffi_value),
        }
    }

    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[crate::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        if let Type::Array(array_type) = self {
            return array_type.decode_with_context(ffi_value, ffi_args, args);
        }
        self.decode(ffi_value)
    }
}
