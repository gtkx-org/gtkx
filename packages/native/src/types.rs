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
use enum_dispatch::enum_dispatch;
use gtk4::glib;
use libffi::middle as libffi;
use neon::prelude::*;

use crate::{ffi, value};

mod sealed {
    pub trait Sealed {}
    impl Sealed for neon::prelude::FunctionContext<'_> {}
}

pub(crate) trait NeonContextExt: sealed::Sealed {
    fn throw_str_error(&mut self, msg: String) -> neon::result::Throw;
}

impl NeonContextExt for FunctionContext<'_> {
    fn throw_str_error(&mut self, msg: String) -> neon::result::Throw {
        self.throw_type_error::<_, ()>(msg).unwrap_err()
    }
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
pub use numeric::{EnumType, FlagsType, FloatKind, IntegerKind, TaggedType};
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

        ownership.parse().map_err(|e: String| cx.throw_str_error(e))
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

#[enum_dispatch]
#[allow(clippy::wrong_self_convention)]
pub trait FfiCodec {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue>;

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let _ = ffi_value;
        bail!("This type cannot be decoded from FfiValue")
    }

    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let _ = gvalue;
        bail!("This type does not support GLib value conversion")
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::pointer()
    }

    fn append_ffi_arg_types(&self, types: &mut Vec<libffi::Type>) {
        types.push(self.libffi_type());
    }

    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        _ffi_args: &[ffi::FfiValue],
        _args: &[crate::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        self.decode(ffi_value)
    }

    /// Call a native function via libffi and return the raw result.
    ///
    /// The caller must ensure `cif`, `ptr`, and `args` are valid and match
    /// the function's signature.
    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Ptr(unsafe {
            cif.call::<*mut c_void>(ptr, args)
        }))
    }

    /// Read a value from a raw pointer (e.g. from a trampoline argument or out-parameter).
    ///
    /// For scalar types, the pointer points directly to the value.
    /// For pointer types, the pointer points to a `*mut c_void` that must be dereferenced.
    ///
    /// The caller must ensure `ptr` is valid for the type being read.
    fn read_from_raw_ptr(&self, ptr: *const c_void, context: &str) -> anyhow::Result<value::Value> {
        let _ = (ptr, context);
        bail!("This type cannot be read from a raw pointer")
    }

    /// Write a return value to a raw pointer buffer (e.g. a trampoline return slot).
    ///
    /// The caller must ensure `ret` points to a writable buffer of appropriate size.
    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let _ = value;
        unsafe { *(ret as *mut *mut c_void) = std::ptr::null_mut() };
    }

    /// Add a reference for ownership transfer (e.g. when passing a full-ownership
    /// value that the callee will free).
    ///
    /// The caller must ensure `ptr` is null or points to a valid instance.
    fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        Ok(ptr)
    }

    /// Convert a raw pointer to a Value (for reading decoded results, hash table entries, etc.).
    ///
    /// The caller must ensure `ptr` is null or points to a valid instance.
    fn ptr_to_value(&self, ptr: *mut c_void, context: &str) -> anyhow::Result<value::Value> {
        let _ = (ptr, context);
        bail!("This type cannot be read from pointer")
    }
}

#[derive(Debug, Clone, Copy)]
pub struct BooleanType;

impl FfiCodec for BooleanType {
    fn encode(&self, value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let boolean = match value {
            value::Value::Boolean(b) => *b,
            _ => bail!("Expected a Boolean for boolean type, got {:?}", value),
        };
        Ok(ffi::FfiValue::I32(i32::from(boolean)))
    }

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let b = match ffi_value {
            ffi::FfiValue::I32(v) => *v != 0,
            _ => bail!("Expected a boolean ffi::FfiValue, got {:?}", ffi_value),
        };
        Ok(value::Value::Boolean(b))
    }

    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let boolean: bool = gvalue
            .get()
            .map_err(|e| anyhow::anyhow!("Failed to get bool from GValue: {}", e))?;
        Ok(value::Value::Boolean(boolean))
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::i32()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::I32(unsafe { cif.call::<i32>(ptr, args) }))
    }

    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        Ok(value::Value::Boolean(ptr as isize != 0))
    }

    fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        let val = unsafe { *(ptr as *const i32) };
        Ok(value::Value::Boolean(val != 0))
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let val = matches!(value, Ok(value::Value::Boolean(true)));
        unsafe { *(ret as *mut i32) = val as i32 };
    }
}

#[derive(Debug, Clone, Copy)]
pub struct VoidType;

impl FfiCodec for VoidType {
    fn encode(&self, _value: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()))
    }

    fn decode(&self, _ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        Ok(value::Value::Undefined)
    }

    fn from_glib_value(&self, _gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        Ok(value::Value::Null)
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::void()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        unsafe { cif.call::<()>(ptr, args) };
        Ok(ffi::FfiValue::Void)
    }

    fn ptr_to_value(&self, _ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        Ok(value::Value::Undefined)
    }

    fn read_from_raw_ptr(
        &self,
        _ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        Ok(value::Value::Undefined)
    }

    fn write_return_to_raw_ptr(&self, _ret: *mut c_void, _value: &Result<value::Value, ()>) {}
}

#[derive(Debug, Clone, Copy)]
pub struct UnicharType;

impl FfiCodec for UnicharType {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let cp = match value {
            value::Value::String(s) => s.chars().next().map(|c| c as u32).unwrap_or(0),
            value::Value::Number(n) => *n as u32,
            value::Value::Null | value::Value::Undefined if optional => 0,
            _ => bail!("Expected a string for unichar type, got {:?}", value),
        };
        Ok(ffi::FfiValue::U32(cp))
    }

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let cp = match ffi_value {
            ffi::FfiValue::U32(v) => *v,
            _ => bail!("Expected FfiValue::U32 for unichar, got {:?}", ffi_value),
        };
        let ch = char::from_u32(cp)
            .ok_or_else(|| anyhow::anyhow!("Invalid Unicode codepoint: 0x{:X}", cp))?;
        Ok(value::Value::String(ch.to_string()))
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::u32()
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        IntegerKind::U32.call_cif(cif, ptr, args)
    }

    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        let cp = ptr as usize as u32;
        let ch = char::from_u32(cp).unwrap_or('\u{FFFD}');
        Ok(value::Value::String(ch.to_string()))
    }

    fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        let val = unsafe { *(ptr as *const u32) };
        let ch = char::from_u32(val).unwrap_or('\u{FFFD}');
        Ok(value::Value::String(ch.to_string()))
    }

    fn write_return_to_raw_ptr(&self, ret: *mut c_void, value: &Result<value::Value, ()>) {
        let val = match value {
            Ok(value::Value::String(s)) => s.chars().next().map(|c| c as u32).unwrap_or(0),
            Ok(value::Value::Number(n)) => *n as u32,
            _ => 0,
        };
        unsafe { *(ret as *mut u32) = val };
    }
}

#[enum_dispatch(FfiCodec)]
#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum Type {
    Integer(IntegerKind),
    Float(FloatKind),
    Enum(EnumType),
    Flags(FlagsType),
    String(StringType),
    Void(VoidType),
    Boolean(BooleanType),
    GObject(GObjectType),
    Boxed(BoxedType),
    Struct(StructType),
    Fundamental(FundamentalType),
    Array(ArrayType),
    HashTable(HashTableType),
    Callback(CallbackType),
    Trampoline(TrampolineType),
    Ref(RefType),
    Unichar(UnicharType),
}

impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Type::Integer(kind) => write!(f, "Integer({:?})", kind),
            Type::Float(kind) => write!(f, "Float({:?})", kind),
            Type::Enum(t) => write!(f, "Enum({})", t.tagged.get_type_fn),
            Type::Flags(t) => write!(f, "Flags({})", t.tagged.get_type_fn),
            Type::String(_) => write!(f, "String"),
            Type::Void(_) => write!(f, "Void"),
            Type::Boolean(_) => write!(f, "Boolean"),
            Type::GObject(_) => write!(f, "GObject"),
            Type::Boxed(t) => write!(f, "Boxed({})", t.type_name),
            Type::Struct(t) => write!(f, "Struct({})", t.type_name),
            Type::Fundamental(t) => write!(f, "Fundamental({})", t.unref_func),
            Type::Array(_) => write!(f, "Array"),
            Type::HashTable(_) => write!(f, "HashTable"),
            Type::Callback(_) => write!(f, "Callback"),
            Type::Trampoline(_) => write!(f, "Trampoline"),
            Type::Ref(t) => write!(f, "Ref({})", t.inner_type),
            Type::Unichar(_) => write!(f, "Unichar"),
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
            "enum" => Ok(Type::Enum(EnumType::from_js_value(cx, value)?)),
            "flags" => Ok(Type::Flags(FlagsType::from_js_value(cx, value)?)),
            "string" => Ok(Type::String(StringType::from_js_value(cx, value)?)),
            "boolean" => Ok(Type::Boolean(BooleanType)),
            "void" => Ok(Type::Void(VoidType)),
            "gobject" => Ok(Type::GObject(GObjectType::from_js_value(cx, value)?)),
            "boxed" => Ok(Type::Boxed(BoxedType::from_js_value(cx, value)?)),
            "struct" => Ok(Type::Struct(StructType::from_js_value(cx, value)?)),
            "array" => Ok(Type::Array(ArrayType::from_js_value(cx, obj.upcast())?)),
            "hashtable" => Ok(Type::HashTable(HashTableType::from_js_value(cx, value)?)),
            "callback" => Ok(Type::Callback(CallbackType::from_js_value(cx, value)?)),
            "trampoline" => Ok(Type::Trampoline(TrampolineType::from_js_value(cx, value)?)),
            "ref" => Ok(Type::Ref(RefType::from_js_value(cx, obj.upcast())?)),
            "unichar" => Ok(Type::Unichar(UnicharType)),
            "fundamental" => Ok(Type::Fundamental(FundamentalType::from_js_value(
                cx, value,
            )?)),
            _ => cx.throw_type_error(format!("Unknown type: {}", ty)),
        }
    }
}
