//! FFI type system for describing GTK and `GLib` types.
//!
//! This module defines the [`Type`] enum and associated types that describe
//! all values that can flow through the FFI boundary. Types are parsed from
//! JavaScript objects and converted to libffi types for native calls.
//!
//! Many types carry an `ownership` field ([`Ownership`]), which governs memory
//! management across the boundary: `Full` means the caller takes ownership and
//! must free, `Borrowed` means the caller receives a reference and must not.
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

/// Parses the `argTypes` and `returnType` properties of a [`CallbackType`]
/// descriptor. Returns the parsed argument types and return type. An absent
/// `returnType` is reported as required; a present-but-malformed one
/// propagates its own parse error.
#[cfg_attr(coverage_nightly, coverage(off))]
pub(crate) fn parse_callback_arg_and_return_types(
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
mod bigint;
mod blob;
mod boolean;
mod boxed;
mod callback;
mod fundamental;
mod gobject;
mod hashtable;
mod numeric;
mod prelude;
mod raw_ptr;
mod ref_type;
mod string;
mod unichar;
mod void;

pub use array::ArrayKind;
pub use array::ArrayType;
pub use bigint::BigIntKind;
pub use blob::BlobType;
pub use boolean::BooleanType;
pub use boxed::{BoxedFreeFn, BoxedType, StructType};
pub use callback::{CallbackScope, CallbackType};
pub use fundamental::FundamentalType;
pub use gobject::GObjectType;
pub use hashtable::{HashTableEntryEncoder, HashTableType};
pub use numeric::{FloatKind, IntegerKind, TaggedKind, TaggedType};
pub use ref_type::RefType;
pub use string::{StringType, str_to_glib_full};
pub use unichar::UnicharType;
pub use void::VoidType;

pub(crate) use numeric::lossless_f64;

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
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue>;

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

/// One of the three sources [`FfiDecoder::read`] decodes a value from.
///
/// The variant a caller picks carries the transfer semantics: `Call` honors the
/// codec's declared ownership (a transfer-aware call return), while `Slot` and
/// `Value` are borrowed reads of memory the caller still owns.
#[derive(Debug)]
pub enum ReadSource<'a> {
    /// A typed value returned across the call boundary; transfer-mode aware.
    Call(&'a ffi::FfiValue),
    /// A pointer to the slot holding the value: dereferenced once for
    /// pointer-typed codecs, read at its width for scalar codecs.
    Slot(*const c_void, &'a str),
    /// The value pointer itself, already dereferenced — a borrowed read.
    Value(*mut c_void, &'a str),
}

#[enum_dispatch]
pub trait FfiDecoder {
    /// Reads a value from one of the three [`ReadSource`]s.
    ///
    /// `Call` decodes a call return honoring this codec's transfer mode; `Slot`
    /// reads through a pointer-to-slot; `Value` decodes an already-dereferenced
    /// pointer as a borrowed value. A pointer-typed codec implements the `Call`
    /// and `Value` arms and inherits `Slot` through [`Self::read_pointer_slot`];
    /// a scalar codec implements all three. The default implementation derefs a
    /// `Slot` and otherwise reports the type as unreadable.
    ///
    /// # Safety
    ///
    /// For `Slot`/`Value`, the pointer must be null or valid for this codec's
    /// read at its representation size. `Call` never dereferences a pointer.
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            // SAFETY: forwarded from this method's safety contract.
            ReadSource::Slot(ptr, context) => unsafe { self.read_pointer_slot(ptr, context) },
            ReadSource::Call(_) => bail!("This type cannot be decoded from FfiValue"),
            ReadSource::Value(..) => bail!("This type cannot be read from pointer"),
        }
    }

    /// Decodes a call-return [`ffi::FfiValue`] honoring this codec's transfer
    /// mode — the safe `Call` entry into [`Self::read`], which never
    /// dereferences a pointer.
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        // SAFETY: a `Call` source carries an `FfiValue` and is never dereferenced.
        unsafe { self.read(ReadSource::Call(ffi_value)) }
    }

    /// Decodes a call return that needs its sibling arguments — a C array whose
    /// length lives in another parameter. Defaults to the context-free
    /// [`Self::decode`].
    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        _ffi_args: &[ffi::FfiValue],
        _args: &[crate::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        self.decode(ffi_value)
    }

    /// Dereferences a pointer-to-slot once and reads the inner pointer as a
    /// [`ReadSource::Value`] — the shared `Slot` behavior of pointer-typed
    /// codecs (string/gobject/boxed/struct/fundamental).
    ///
    /// # Safety
    ///
    /// `ptr` must be a readable pointer-sized slot.
    unsafe fn read_pointer_slot(
        &self,
        ptr: *const c_void,
        context: &str,
    ) -> anyhow::Result<value::Value> {
        // SAFETY: the caller guarantees `ptr` is a readable pointer-sized slot.
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        // SAFETY: the dereferenced pointer is the value the slot carries for
        // this codec, satisfying the `Value` read's validity requirement.
        unsafe { self.read(ReadSource::Value(inner_ptr, context)) }
    }

    /// Decodes `ptr` to a [`value::Value`], short-circuiting a null pointer to
    /// [`value::Value::Null`].
    ///
    /// `decode` runs only for a non-null pointer and receives it unchanged.
    /// This is the shared prologue of the pointer-typed `Value` reads.
    #[allow(clippy::unused_self)]
    fn null_guarded<F>(&self, ptr: *mut c_void, decode: F) -> anyhow::Result<value::Value>
    where
        F: FnOnce(*mut c_void) -> anyhow::Result<value::Value>,
    {
        if ptr.is_null() {
            return Ok(value::Value::Null);
        }
        decode(ptr)
    }
}

#[enum_dispatch]
pub trait RawPtrCodec {
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

    /// Writes a return pointer honoring the declared transfer mode: a borrowed
    /// (transfer-none) return writes the wrapper-held pointer unchanged, while a
    /// full transfer passes it through `acquire`, which produces the caller's
    /// own reference or copy.
    #[allow(clippy::unused_self)]
    fn write_return_with_ownership<F>(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
        ownership: Ownership,
        acquire: F,
    ) where
        F: FnOnce(*mut c_void) -> *mut c_void,
    {
        raw_ptr::write_return_object_ptr(ret, value, |ptr| {
            if ownership.is_borrowed() {
                ptr
            } else {
                acquire(ptr)
            }
        });
    }
}

pub trait FfiCodec: FfiEncoder + FfiDecoder + RawPtrCodec {}
impl<T: FfiEncoder + FfiDecoder + RawPtrCodec> FfiCodec for T {}

/// Parses a codec descriptor — a `{ type, … }` JavaScript object — into its
/// FFI codec.
///
/// Every pointer, container, and string codec the [`Type::from_js_value`]
/// dispatch constructs implements this, so each codec owns its descriptor
/// parsing in one place behind a shared protocol. [`TaggedType`] is the one
/// exception: it needs an extra [`TaggedKind`] discriminant and keeps a bespoke
/// constructor.
pub(crate) trait FromDescriptor: Sized {
    #[allow(clippy::trivially_copy_pass_by_ref)]
    fn from_descriptor(env: &Env, obj: &JsObject) -> napi::Result<Self>;
}

#[enum_dispatch(FfiEncoder, FfiDecoder, RawPtrCodec)]
#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum Type {
    Integer(IntegerKind),
    BigInt(BigIntKind),
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
    Blob(BlobType),
    HashTable(HashTableType),
    Callback(CallbackType),
    Ref(RefType),
    Unichar(UnicharType),
}

impl std::fmt::Display for Type {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Integer(kind) => write!(f, "Integer({kind:?})"),
            Self::BigInt(kind) => write!(f, "BigInt({kind:?})"),
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
            Self::Blob(_) => write!(f, "Blob"),
            Self::HashTable(_) => write!(f, "HashTable"),
            Self::Callback(_) => write!(f, "Callback"),
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
            "bigint64" => Ok(Self::BigInt(BigIntKind::I64)),
            "biguint64" => Ok(Self::BigInt(BigIntKind::U64)),
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
            "string" => Ok(Self::String(StringType::from_descriptor(env, &obj)?)),
            "boolean" => Ok(Self::Boolean(BooleanType)),
            "void" => Ok(Self::Void(VoidType)),
            "gobject" => Ok(Self::GObject(GObjectType::from_descriptor(env, &obj)?)),
            "boxed" => Ok(Self::Boxed(BoxedType::from_descriptor(env, &obj)?)),
            "struct" => Ok(Self::Struct(StructType::from_descriptor(env, &obj)?)),
            "array" => Ok(Self::Array(ArrayType::from_descriptor(env, &obj)?)),
            "blob" => Ok(Self::Blob(BlobType)),
            "hashtable" => Ok(Self::HashTable(HashTableType::from_descriptor(env, &obj)?)),
            "callback" => Ok(Self::Callback(CallbackType::from_descriptor(env, &obj)?)),
            "ref" => Ok(Self::Ref(RefType::from_descriptor(env, &obj)?)),
            "unichar" => Ok(Self::Unichar(UnicharType)),
            "fundamental" => Ok(Self::Fundamental(FundamentalType::from_descriptor(
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
    /// `Callback`, `Ref`, and `Blob` describe argument-only shapes — a
    /// callback handler, an out-parameter, or a raw memory argument — and have
    /// no return-slot codec (their [`FfiEncoder::call_cif`] implementations
    /// bail). Callers consult this at the descriptor-parsing boundary to
    /// reject a malformed return type with a precise `InvalidArg` error.
    #[must_use]
    pub fn can_be_return_type(&self) -> bool {
        !matches!(self, Self::Callback(_) | Self::Ref(_) | Self::Blob(_))
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
    use super::callback::CallbackScope;
    use super::*;

    #[test]
    fn scalar_and_pointer_types_can_be_return_types() {
        assert!(Type::Void(VoidType).can_be_return_type());
        assert!(Type::Integer(IntegerKind::I32).can_be_return_type());
        assert!(Type::Boolean(BooleanType).can_be_return_type());
    }

    #[test]
    fn callback_cannot_be_return_type() {
        let callback = CallbackType {
            arg_types: Vec::new(),
            return_type: Box::new(Type::Void(VoidType)),
            has_destroy: false,
            user_data_index: None,
            scope: CallbackScope::Call,
        };
        assert!(!Type::Callback(callback).can_be_return_type());
    }

    #[test]
    fn ref_cannot_be_return_type() {
        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        assert!(!Type::Ref(ref_type).can_be_return_type());
    }
}
