//! FFI type system for describing GTK and `GLib` types.
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
//! ├── Tagged(TaggedType)      - Enums and flags (GType-tagged integers)
//! ├── String(StringType)      - UTF-8 strings (owned or borrowed)
//! ├── Void(VoidType)          - Void return / no value
//! ├── Boolean(BooleanType)    - Boolean values
//! ├── GObject(GObjectType)    - GObject instances
//! ├── Boxed(BoxedType)        - GObject boxed types (e.g., GdkRGBA)
//! ├── Struct(StructType)      - Plain C structs passed by pointer
//! ├── Fundamental(FundamentalType) - Fundamental types (GVariant, GParamSpec, etc.)
//! ├── Array(ArrayType)        - Arrays, GLists, GSLists
//! ├── HashTable(HashTableType) - GHashTables
//! ├── Trampoline(TrampolineType) - JavaScript callbacks invoked from native
//! ├── Ref(RefType)            - Pointers to values (out parameters)
//! └── Unichar(UnicharType)    - Unicode code points
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
use libffi::middle as libffi;
use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use crate::{ffi, value};

/// Reads an optional descriptor property, distinguishing an absent property
/// (`Ok(None)`) from a present-but-malformed one, which surfaces as an
/// `InvalidArg` error naming the property instead of silently defaulting.
#[cfg_attr(coverage_nightly, coverage(off))]
pub(crate) fn optional_descriptor_property<T: FromNapiValue + ValidateNapiValue>(
    obj: &JsObject,
    name: &str,
) -> napi::Result<Option<T>> {
    obj.get_named_property::<Option<T>>(name).map_err(|e| {
        napi::Error::new(
            napi::Status::InvalidArg,
            format!("invalid '{name}' descriptor property: {e}"),
        )
    })
}

/// Parses the `argTypes` and `returnType` properties of a [`TrampolineType`]
/// descriptor. Returns the parsed argument types and return type. An absent
/// `returnType` is reported as required; a present-but-malformed one
/// propagates its own parse error.
#[cfg_attr(coverage_nightly, coverage(off))]
pub(crate) fn parse_trampoline_arg_and_return_types(
    env: &Env,
    obj: &JsObject,
    kind: &str,
) -> napi::Result<(Vec<Type>, Box<Type>)> {
    let arg_types_prop: Unknown<'_> = obj.get_named_property("argTypes")?;
    if !arg_types_prop.is_array()? {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("'argTypes' property is required for {kind} types"),
        ));
    }
    // SAFETY: `arg_types_prop` is a live JS value from the current
    // callback's `env`, verified to be an array just above.
    let arg_types_arr: Array = unsafe { Array::from_napi_value(env.raw(), arg_types_prop.raw())? };
    let arg_types = crate::value::map_js_array(env, &arg_types_arr, Type::from_js_value)?;

    let return_type_prop: Unknown<'_> = obj.get_named_property("returnType")?;
    if matches!(
        return_type_prop.get_type()?,
        napi::ValueType::Undefined | napi::ValueType::Null
    ) {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("'returnType' property is required for {kind} types"),
        ));
    }
    let return_type = Box::new(Type::from_js_value(env, return_type_prop)?);

    Ok((arg_types, return_type))
}

mod array;
mod boolean;
mod boxed;
mod fundamental;
mod gobject;
mod hashtable;
mod numeric;
mod prelude;
mod raw_ptr;
mod ref_type;
mod string;
mod trampoline;
mod unichar;
mod void;

pub use array::ArrayKind;
pub use array::ArrayType;
pub use boolean::BooleanType;
pub use boxed::{BoxedFreeFn, BoxedType, StructType};
pub use fundamental::FundamentalType;
pub use gobject::GObjectType;
pub use hashtable::{HashTableEntryEncoder, HashTableType};
pub use numeric::{FloatKind, IntegerKind, TaggedKind, TaggedType};
pub use ref_type::RefType;
pub use string::{StringType, str_to_glib_full};
pub use trampoline::{TrampolineScope, TrampolineType};
pub use unichar::UnicharType;
pub use void::VoidType;

/// Lifecycle of a value crossing the FFI boundary.
///
/// One of two ownership modes:
///
/// - [`Self::Full`] — caller takes ownership of the original pointer
///   (GIR `transfer full`). On drop the type-specific destructor releases it.
/// - [`Self::Borrowed`] — the underlying value's lifetime is uncertain, so
///   the codec makes a defensive copy / reference (`g_boxed_copy`,
///   `g_object_ref`, `g_strdup`) and owns the copy.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
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
        matches!(self, Self::Full)
    }

    #[inline]
    #[must_use]
    pub fn is_borrowed(self) -> bool {
        matches!(self, Self::Borrowed)
    }
}

impl Ownership {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(obj: &JsObject, type_name: &str) -> napi::Result<Self> {
        let missing = || {
            napi::Error::new(
                napi::Status::InvalidArg,
                format!("'ownership' property is required for {type_name} types"),
            )
        };

        let ownership =
            optional_descriptor_property::<String>(obj, "ownership")?.ok_or_else(missing)?;

        ownership
            .parse()
            .map_err(|e: String| napi::Error::new(napi::Status::InvalidArg, e))
    }
}

impl std::fmt::Display for Ownership {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Borrowed => write!(f, "borrowed"),
            Self::Full => write!(f, "full"),
        }
    }
}

impl std::str::FromStr for Ownership {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s {
            "full" => Ok(Self::Full),
            "borrowed" => Ok(Self::Borrowed),
            other => Err(format!(
                "'ownership' must be 'full' or 'borrowed', got '{other}'"
            )),
        }
    }
}

#[enum_dispatch]
pub trait FfiEncoder {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue>;

    /// The release pairing the ownership one [`Self::ref_for_transfer`] call
    /// acquires for a non-null pointer, or `None` for an identity hand-over
    /// with nothing to release. Container encoders use it to unwind or arm
    /// the per-element ownership they acquire.
    fn transfer_release(&self) -> Option<ffi::PendingRelease> {
        None
    }

    fn libffi_type(&self) -> libffi::Type {
        libffi::Type::pointer()
    }

    fn append_ffi_arg_types(&self, types: &mut Vec<libffi::Type>) {
        types.push(self.libffi_type());
    }

    fn call_cif(
        &self,
        cif: &libffi::Cif,
        ptr: libffi::CodePtr,
        args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        // SAFETY: The dispatch site built `cif` and `args` from this
        // descriptor's own types and resolved `ptr` from a loaded library
        // symbol, so the call matches the native signature.
        Ok(ffi::FfiValue::Ptr(unsafe {
            cif.call::<*mut c_void>(ptr, args)
        }))
    }

    /// Acquires the ownership a transfer-full slot takes over `ptr` (a ref, a
    /// boxed copy, …), returning the pointer the callee will adopt.
    ///
    /// # Safety
    ///
    /// `ptr` must be null or a pointer to a live instance of this codec's
    /// type.
    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        Ok(ptr)
    }
}

#[enum_dispatch]
pub trait FfiDecoder {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let _ = ffi_value;
        bail!("This type cannot be decoded from FfiValue")
    }

    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        _ffi_args: &[ffi::FfiValue],
        _args: &[crate::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        self.decode(ffi_value)
    }
}

#[enum_dispatch]
pub trait RawPtrCodec {
    /// Reads a value from a `*const T**` (a pointer-to-pointer location), by
    /// dereferencing once and delegating to [`ptr_to_value`]. Pointer-typed
    /// codecs (string/gobject/boxed/struct/fundamental) inherit this default;
    /// scalar codecs override with a direct read.
    ///
    /// # Safety
    ///
    /// `ptr` must be valid for a read of this codec's slot representation (a
    /// pointer-sized slot for the default implementation).
    unsafe fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        context: &str,
    ) -> anyhow::Result<value::Value> {
        // SAFETY: The caller guarantees `ptr` is a readable pointer-sized
        // slot.
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        // SAFETY: The dereferenced pointer is the value the slot carries for
        // this codec, satisfying `ptr_to_value`'s validity requirement.
        unsafe { self.ptr_to_value(inner_ptr, context) }
    }

    /// Writes a trampoline return value into the libffi closure return slot.
    ///
    /// # Safety
    ///
    /// `ret` must be valid for this codec's write at its return-slot
    /// representation size.
    unsafe fn write_return_to_raw_ptr(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
    ) {
        let _ = value;
        // SAFETY: The caller guarantees `ret` is a writable pointer-sized
        // return slot.
        unsafe { *(ret as *mut *mut c_void) = std::ptr::null_mut() };
    }

    /// Decodes the value `ptr` represents — a dereference for pointer-typed
    /// codecs, a reinterpretation of the pointer value itself for scalars.
    ///
    /// # Safety
    ///
    /// `ptr` must be null or valid for this codec's read at its
    /// representation size.
    unsafe fn ptr_to_value(&self, ptr: *mut c_void, context: &str) -> anyhow::Result<value::Value> {
        let _ = (ptr, context);
        bail!("This type cannot be read from pointer")
    }

    /// Writes `value` into the slot at `ptr` using this codec's
    /// representation.
    ///
    /// # Safety
    ///
    /// `ptr` must be valid for this codec's write at its representation
    /// size.
    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let _ = (ptr, value);
        bail!("This type cannot be written to a raw pointer")
    }
}

pub trait FfiCodec: FfiEncoder + FfiDecoder + RawPtrCodec {}
impl<T: FfiEncoder + FfiDecoder + RawPtrCodec> FfiCodec for T {}

#[enum_dispatch(FfiEncoder, FfiDecoder, RawPtrCodec)]
#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum Type {
    Integer(IntegerKind),
    Float(FloatKind),
    Tagged(TaggedType),
    String(StringType),
    Void(VoidType),
    Boolean(BooleanType),
    GObject(GObjectType),
    Boxed(BoxedType),
    Struct(StructType),
    Fundamental(FundamentalType),
    Array(ArrayType),
    HashTable(HashTableType),
    Trampoline(TrampolineType),
    Ref(RefType),
    Unichar(UnicharType),
}

impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Integer(kind) => write!(f, "Integer({kind:?})"),
            Self::Float(kind) => write!(f, "Float({kind:?})"),
            Self::Tagged(t) => match t.kind {
                TaggedKind::Enum => write!(f, "Enum({})", t.get_type_fn),
                TaggedKind::Flags => write!(f, "Flags({})", t.get_type_fn),
            },
            Self::String(_) => write!(f, "String"),
            Self::Void(_) => write!(f, "Void"),
            Self::Boolean(_) => write!(f, "Boolean"),
            Self::GObject(_) => write!(f, "GObject"),
            Self::Boxed(t) => write!(f, "Boxed({})", t.type_name),
            Self::Struct(t) => write!(f, "Struct({})", t.ownership),
            Self::Fundamental(t) => write!(f, "Fundamental({})", t.unref_func),
            Self::Array(_) => write!(f, "Array"),
            Self::HashTable(_) => write!(f, "HashTable"),
            Self::Trampoline(_) => write!(f, "Trampoline"),
            Self::Ref(t) => write!(f, "Ref({})", t.inner_type),
            Self::Unichar(_) => write!(f, "Unichar"),
        }
    }
}

impl Type {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        let obj: JsObject = crate::value::unknown_as_object(env, &value)?;
        let ty: String = obj.get_named_property("type")?;

        match ty.as_str() {
            "int8" => Ok(Self::Integer(IntegerKind::I8)),
            "uint8" => Ok(Self::Integer(IntegerKind::U8)),
            "int16" => Ok(Self::Integer(IntegerKind::I16)),
            "uint16" => Ok(Self::Integer(IntegerKind::U16)),
            "int32" => Ok(Self::Integer(IntegerKind::I32)),
            "uint32" => Ok(Self::Integer(IntegerKind::U32)),
            "int64" => Ok(Self::Integer(IntegerKind::I64)),
            "uint64" => Ok(Self::Integer(IntegerKind::U64)),
            "float32" => Ok(Self::Float(FloatKind::F32)),
            "float64" => Ok(Self::Float(FloatKind::F64)),
            "enum" => Ok(Self::Tagged(TaggedType::from_js_value(
                env,
                &obj,
                TaggedKind::Enum,
            )?)),
            "flags" => Ok(Self::Tagged(TaggedType::from_js_value(
                env,
                &obj,
                TaggedKind::Flags,
            )?)),
            "string" => Ok(Self::String(StringType::from_js_value(env, &obj)?)),
            "boolean" => Ok(Self::Boolean(BooleanType)),
            "void" => Ok(Self::Void(VoidType)),
            "gobject" => Ok(Self::GObject(GObjectType::from_js_value(env, &obj)?)),
            "boxed" => Ok(Self::Boxed(BoxedType::from_js_value(env, &obj)?)),
            "struct" => Ok(Self::Struct(StructType::from_js_value(env, &obj)?)),
            "array" => Ok(Self::Array(ArrayType::from_js_value(env, &obj)?)),
            "hashtable" => Ok(Self::HashTable(HashTableType::from_js_value(env, &obj)?)),
            "trampoline" => Ok(Self::Trampoline(TrampolineType::from_js_value(env, &obj)?)),
            "ref" => Ok(Self::Ref(RefType::from_js_value(env, &obj)?)),
            "unichar" => Ok(Self::Unichar(UnicharType)),
            "fundamental" => Ok(Self::Fundamental(FundamentalType::from_js_value(
                env, &obj,
            )?)),
            other => Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("Unknown type: {other}"),
            )),
        }
    }

    /// Whether this type may occupy a function's return slot.
    ///
    /// `Trampoline` and `Ref` describe argument-only shapes — a callback
    /// handler or an out-parameter — and have no return-slot codec (their
    /// [`FfiEncoder::call_cif`] implementations bail). Callers consult this at
    /// the descriptor-parsing boundary to reject a malformed return type with a
    /// precise `InvalidArg` error.
    #[must_use]
    pub fn can_be_return_type(&self) -> bool {
        !matches!(self, Self::Trampoline(_) | Self::Ref(_))
    }

    /// Whether this type may describe a function or callback argument.
    ///
    /// `Void` describes the absence of a value: it has no argument encoding,
    /// and a `void` entry in a libffi argument list is outside libffi's API
    /// contract, corrupting the call frame classification of every following
    /// parameter. Callers consult this at the descriptor-parsing boundary to
    /// reject a malformed argument type with a precise `InvalidArg` error.
    #[must_use]
    pub fn can_be_argument_type(&self) -> bool {
        !matches!(self, Self::Void(_))
    }
}

#[cfg(test)]
mod tests {
    use super::trampoline::TrampolineScope;
    use super::*;

    #[test]
    fn scalar_and_pointer_types_can_be_return_types() {
        assert!(Type::Void(VoidType).can_be_return_type());
        assert!(Type::Integer(IntegerKind::I32).can_be_return_type());
        assert!(Type::Boolean(BooleanType).can_be_return_type());
    }

    #[test]
    fn trampoline_cannot_be_return_type() {
        let trampoline = TrampolineType {
            arg_types: Vec::new(),
            return_type: Box::new(Type::Void(VoidType)),
            has_destroy: false,
            user_data_index: None,
            scope: TrampolineScope::Call,
        };
        assert!(!Type::Trampoline(trampoline).can_be_return_type());
    }

    #[test]
    fn ref_cannot_be_return_type() {
        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        assert!(!Type::Ref(ref_type).can_be_return_type());
    }
}
