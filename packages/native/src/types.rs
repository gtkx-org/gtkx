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

use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{self, translate::IntoGlib as _, translate::ToGlibPtr as _};
use libffi::middle as libffi;
use neon::prelude::*;

use crate::{ffi, value};

pub(crate) fn throw_str_error(cx: &mut FunctionContext, msg: String) -> neon::result::Throw {
    cx.throw_type_error::<_, ()>(msg).unwrap_err()
}

mod array;
mod boxed;
mod callback;
mod fundamental;
mod gobject;
mod hashtable;
mod numeric;
mod ref_type;
mod string;
mod trampoline;

pub use array::ArrayKind;
pub use array::ArrayType;
pub use boxed::{BoxedType, StructType};
pub use callback::CallbackType;
pub use fundamental::FundamentalType;
pub use gobject::GObjectType;
pub use hashtable::{HashTableEntryEncoder, HashTableType};
pub use numeric::{FloatKind, IntegerKind, TaggedType};
pub use ref_type::RefType;
pub use string::StringType;
pub use trampoline::TrampolineType;

#[derive(Debug, Clone, Copy, Default)]
#[non_exhaustive]
pub enum Ownership {
    #[default]
    Borrowed,
    Full,
}

impl Ownership {
    #[inline]
    #[must_use]
    pub fn is_full(self) -> bool {
        matches!(self, Ownership::Full)
    }

    #[inline]
    #[must_use]
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
            .map_err(|e: String| throw_str_error(cx, e))
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
#[non_exhaustive]
pub enum Type {
    Integer(IntegerKind),
    Float(FloatKind),
    Enum(TaggedType),
    Flags(TaggedType),
    String(StringType),
    Void,
    Boolean,
    GObject(GObjectType),
    Boxed(BoxedType),
    Struct(StructType),
    Fundamental(FundamentalType),
    Array(ArrayType),
    HashTable(HashTableType),
    Callback(CallbackType),
    Trampoline(TrampolineType),
    Ref(RefType),
    Unichar,
}

impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Type::Integer(kind) => write!(f, "Integer({:?})", kind),
            Type::Float(kind) => write!(f, "Float({:?})", kind),
            Type::Enum(t) => write!(f, "Enum({})", t.get_type_fn),
            Type::Flags(t) => write!(f, "Flags({})", t.get_type_fn),
            Type::String(_) => write!(f, "String"),
            Type::Void => write!(f, "Void"),
            Type::Boolean => write!(f, "Boolean"),
            Type::GObject(_) => write!(f, "GObject"),
            Type::Boxed(t) => write!(f, "Boxed({})", t.type_name),
            Type::Struct(t) => write!(f, "Struct({})", t.type_name),
            Type::Fundamental(t) => write!(f, "Fundamental({})", t.unref_func),
            Type::Array(_) => write!(f, "Array"),
            Type::HashTable(_) => write!(f, "HashTable"),
            Type::Callback(_) => write!(f, "Callback"),
            Type::Trampoline(_) => write!(f, "Trampoline"),
            Type::Ref(t) => write!(f, "Ref({})", t.inner_type),
            Type::Unichar => write!(f, "Unichar"),
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
            "int8" => Ok(Type::Integer(IntegerKind::I8)),
            "uint8" => Ok(Type::Integer(IntegerKind::U8)),
            "int16" => Ok(Type::Integer(IntegerKind::I16)),
            "uint16" => Ok(Type::Integer(IntegerKind::U16)),
            "int32" => Ok(Type::Integer(IntegerKind::I32)),
            "uint32" => Ok(Type::Integer(IntegerKind::U32)),
            "int64" => Ok(Type::Integer(IntegerKind::I64)),
            "uint64" => Ok(Type::Integer(IntegerKind::U64)),
            "float32" => Ok(Type::Float(FloatKind::F32)),
            "float64" => Ok(Type::Float(FloatKind::F64)),
            "enum" => Ok(Type::Enum(TaggedType::from_js_value(cx, value)?)),
            "flags" => Ok(Type::Flags(TaggedType::from_js_value(cx, value)?)),
            "string" => Ok(Type::String(StringType::from_js_value(cx, value)?)),
            "boolean" => Ok(Type::Boolean),
            "void" => Ok(Type::Void),
            "gobject" => Ok(Type::GObject(GObjectType::from_js_value(cx, value)?)),
            "boxed" => Ok(Type::Boxed(BoxedType::from_js_value(cx, value)?)),
            "struct" => Ok(Type::Struct(StructType::from_js_value(cx, value)?)),
            "array" => Ok(Type::Array(ArrayType::from_js_value(cx, obj.upcast())?)),
            "hashtable" => Ok(Type::HashTable(HashTableType::from_js_value(cx, value)?)),
            "callback" => Ok(Type::Callback(CallbackType::from_js_value(cx, value)?)),
            "trampoline" => Ok(Type::Trampoline(TrampolineType::from_js_value(cx, value)?)),
            "ref" => Ok(Type::Ref(RefType::from_js_value(cx, obj.upcast())?)),
            "unichar" => Ok(Type::Unichar),
            "fundamental" => Ok(Type::Fundamental(FundamentalType::from_js_value(
                cx, value,
            )?)),
            _ => cx.throw_type_error(format!("Unknown type: {}", ty)),
        }
    }

    /// # Safety
    /// `ptr` must be null or point to a valid instance of the type described by `self`.
    pub unsafe fn ptr_to_value(
        &self,
        ptr: *mut c_void,
        context: &str,
    ) -> anyhow::Result<value::Value> {
        match self {
            Type::String(_) => Ok(unsafe { StringType::ptr_to_value(ptr) }),
            Type::Integer(kind) => Ok(kind.ptr_to_value(ptr)),
            Type::Enum(_) => Ok(IntegerKind::I32.ptr_to_value(ptr)),
            Type::Flags(_) => Ok(IntegerKind::U32.ptr_to_value(ptr)),
            Type::GObject(_) => Ok(unsafe { GObjectType::ptr_to_value(ptr) }),
            Type::Boxed(t) => unsafe { t.ptr_to_value(ptr) },
            Type::Boolean => Ok(value::Value::Boolean(ptr as isize != 0)),
            Type::Float(kind) => Ok(unsafe { kind.ptr_to_value(ptr) }),
            Type::Struct(t) => unsafe { t.ptr_to_value(ptr) },
            Type::Fundamental(t) => unsafe { t.ptr_to_value(ptr) },
            Type::Array(t) => unsafe { t.ptr_to_value(ptr) },
            Type::HashTable(t) => {
                if ptr.is_null() {
                    return Ok(value::Value::Array(vec![]));
                }
                t.decode(&ffi::FfiValue::Ptr(ptr))
            }
            Type::Unichar => {
                let cp = ptr as u32;
                let ch = char::from_u32(cp).unwrap_or('\u{FFFD}');
                Ok(value::Value::String(ch.to_string()))
            }
            Type::Void => Ok(value::Value::Undefined),
            Type::Callback(_) | Type::Trampoline(_) | Type::Ref(_) => {
                bail!("Type {} cannot be read from pointer in {}", self, context)
            }
        }
    }
}

impl Type {
    /// # Safety
    /// `ptr` must be null or point to a valid instance of the type described by `self`.
    pub unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        if ptr.is_null() {
            return Ok(ptr);
        }
        match self {
            Type::GObject(t) if t.ownership.is_full() => {
                unsafe { glib::gobject_ffi::g_object_ref(ptr as *mut _) };
                Ok(ptr)
            }
            Type::Boxed(t) if t.ownership.is_full() => match t.gtype() {
                Some(gtype) => Ok(unsafe {
                    glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _)
                }),
                None => Ok(ptr),
            },
            Type::Fundamental(t) if t.ownership.is_full() => {
                let (ref_fn, _) = t.lookup_fns()?;
                match ref_fn {
                    Some(ref_fn) => Ok(unsafe { ref_fn(ptr) }),
                    None => Ok(ptr),
                }
            }
            Type::Integer(_)
            | Type::Float(_)
            | Type::Enum(_)
            | Type::Flags(_)
            | Type::String(_)
            | Type::Boolean
            | Type::Void
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar
            | Type::Struct(_)
            | Type::GObject(_)
            | Type::Boxed(_)
            | Type::Fundamental(_) => Ok(ptr),
        }
    }
}

impl Type {
    pub fn append_ffi_arg_types(&self, types: &mut Vec<libffi::Type>) {
        match self {
            Type::Trampoline(trampoline_type) => {
                types.push(libffi::Type::pointer());
                types.push(libffi::Type::pointer());

                if trampoline_type.has_destroy {
                    types.push(libffi::Type::pointer());
                }
            }
            Type::Integer(_)
            | Type::Float(_)
            | Type::Enum(_)
            | Type::Flags(_)
            | Type::String(_)
            | Type::Boolean
            | Type::Void
            | Type::GObject(_)
            | Type::Boxed(_)
            | Type::Struct(_)
            | Type::Fundamental(_)
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Ref(_)
            | Type::Unichar => types.push(self.into()),
        }
    }
}

impl From<&Type> for libffi::Type {
    fn from(value: &Type) -> Self {
        match value {
            Type::Integer(kind) => (*kind).into(),
            Type::Float(kind) => (*kind).into(),
            Type::Enum(_) => libffi::Type::i32(),
            Type::Flags(_) => libffi::Type::u32(),
            Type::String(ty) => ty.into(),
            Type::Boolean => libffi::Type::i32(),
            Type::GObject(ty) => ty.into(),
            Type::Boxed(ty) => ty.into(),
            Type::Struct(ty) => ty.into(),
            Type::Fundamental(ty) => ty.into(),
            Type::Array(ty) => ty.into(),
            Type::HashTable(ty) => ty.into(),
            Type::Callback(_) => libffi::Type::pointer(),
            Type::Trampoline(_) => libffi::Type::pointer(),
            Type::Ref(ty) => ty.into(),
            Type::Unichar => libffi::Type::u32(),
            Type::Void => libffi::Type::void(),
        }
    }
}

impl Type {
    pub fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        match self {
            Type::Integer(kind) => kind.encode(value, optional),
            Type::Float(kind) => kind.encode(value, optional),
            Type::Enum(_) => IntegerKind::I32.encode(value, optional),
            Type::Flags(_) => IntegerKind::U32.encode(value, optional),
            Type::String(t) => t.encode(value, optional),
            Type::Boolean => {
                let boolean = match value {
                    value::Value::Boolean(b) => *b,
                    _ => bail!("Expected a Boolean for boolean type, got {:?}", value),
                };
                Ok(ffi::FfiValue::I32(i32::from(boolean)))
            }
            Type::Void => Ok(ffi::FfiValue::Ptr(std::ptr::null_mut())),
            Type::GObject(t) => t.encode(value, optional),
            Type::Boxed(t) => t.encode(value, optional),
            Type::Struct(t) => t.encode(value, optional),
            Type::Fundamental(t) => t.encode(value, optional),
            Type::Array(t) => t.encode(value, optional),
            Type::HashTable(t) => t.encode(value, optional),
            Type::Callback(t) => t.encode(value, optional),
            Type::Trampoline(t) => t.encode(value, optional),
            Type::Ref(t) => t.encode(value, optional),
            Type::Unichar => {
                let cp = match value {
                    value::Value::String(s) => s.chars().next().map(|c| c as u32).unwrap_or(0),
                    value::Value::Number(n) => *n as u32,
                    value::Value::Null | value::Value::Undefined if optional => 0,
                    _ => bail!("Expected a string for unichar type, got {:?}", value),
                };
                Ok(ffi::FfiValue::U32(cp))
            }
        }
    }

    pub fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        match self {
            Type::Void => Ok(value::Value::Undefined),
            Type::Integer(kind) => kind.decode(ffi_value),
            Type::Float(kind) => kind.decode(ffi_value),
            Type::Enum(_) => IntegerKind::I32.decode(ffi_value),
            Type::Flags(_) => IntegerKind::U32.decode(ffi_value),
            Type::String(t) => t.decode(ffi_value),
            Type::Boolean => {
                let b = match ffi_value {
                    ffi::FfiValue::I32(v) => *v != 0,
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
            Type::Trampoline(_) => bail!("Trampolines cannot be converted from ffi::FfiValue"),
            Type::Ref(t) => t.decode(ffi_value),
            Type::Unichar => {
                let cp = match ffi_value {
                    ffi::FfiValue::U32(v) => *v,
                    _ => bail!("Expected FfiValue::U32 for unichar, got {:?}", ffi_value),
                };
                let ch = char::from_u32(cp).unwrap_or('\u{FFFD}');
                Ok(value::Value::String(ch.to_string()))
            }
        }
    }

    pub fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[crate::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        match self {
            Type::Array(array_type) => array_type.decode_with_context(ffi_value, ffi_args, args),
            Type::Ref(ref_type) => ref_type.decode_with_context(ffi_value, ffi_args, args),
            Type::Integer(_)
            | Type::Float(_)
            | Type::Enum(_)
            | Type::Flags(_)
            | Type::String(_)
            | Type::Boolean
            | Type::Void
            | Type::GObject(_)
            | Type::Boxed(_)
            | Type::Struct(_)
            | Type::Fundamental(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Unichar => self.decode(ffi_value),
        }
    }

    pub fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        match self {
            Type::Integer(kind) => kind.from_glib_value(gvalue),
            Type::Float(kind) => kind.from_glib_value(gvalue),
            Type::Enum(_) => {
                let v = unsafe {
                    glib::gobject_ffi::g_value_get_enum(gvalue.to_glib_none().0 as *const _)
                };
                Ok(value::Value::Number(v as f64))
            }
            Type::Flags(_) => {
                let v = unsafe {
                    glib::gobject_ffi::g_value_get_flags(gvalue.to_glib_none().0 as *const _)
                };
                Ok(value::Value::Number(v as f64))
            }
            Type::String(_) => StringType::from_glib_value(gvalue),
            Type::Boolean => {
                let boolean: bool = gvalue
                    .get()
                    .map_err(|e| anyhow::anyhow!("Failed to get bool from GValue: {}", e))?;
                Ok(value::Value::Boolean(boolean))
            }
            Type::GObject(_) => GObjectType::from_glib_value(gvalue),
            Type::Boxed(t) => t.from_glib_value(gvalue),
            Type::Struct(t) => t.from_glib_value(gvalue),
            Type::Fundamental(t) => t.from_glib_value(gvalue),
            Type::Ref(t) => t.from_glib_value(gvalue),
            Type::Void => Ok(value::Value::Null),
            Type::Unichar => {
                let val = unsafe {
                    glib::gobject_ffi::g_value_get_uint(gvalue.to_glib_none().0 as *const _)
                };
                let ch = char::from_u32(val).unwrap_or('\u{FFFD}');
                Ok(value::Value::String(ch.to_string()))
            }
            Type::Array(_) | Type::HashTable(_) | Type::Callback(_) | Type::Trampoline(_) => {
                bail!("Type {:?} should not appear in glib value conversion", self)
            }
        }
    }
}
