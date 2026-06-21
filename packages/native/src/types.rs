use std::ffi::c_void;

use anyhow::bail;
use enum_dispatch::enum_dispatch;
use libffi::middle as libffi;
use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use crate::{ffi, value};

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
    // SAFETY: `arg_types_prop` was verified to be an array above, and its raw napi value is valid
    // for the current `env`, so reconstructing an `Array` from the pair is sound.
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
pub use callback::CallbackType;
#[cfg(feature = "test-support")]
pub use callback::CallbackScope;
pub use fundamental::FundamentalType;
pub use gobject::GObjectType;
pub use hashtable::HashTableType;
#[cfg(feature = "test-support")]
pub use hashtable::HashTableEntryEncoder;
pub use numeric::{FloatKind, IntegerKind, TaggedKind, TaggedType};
pub use ref_type::RefType;
pub use string::{StringType, str_to_glib_full};
pub use unichar::UnicharType;
pub use void::VoidType;

pub(crate) use numeric::lossless_f64;

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
    /// Encodes the JS-side value into an [`ffi::FfiValue`] ready to be passed to a C call.
    ///
    /// The default implementation models the one-method-per-ownership-mode contract that
    /// glib uses for `to_glib_none`/`to_glib_full`: it reads the object pointer, acquires a
    /// transfer reference via [`FfiEncoder::ref_for_transfer`], and, when the type owns the
    /// transfer ([`FfiEncoder::transfer_release`] returns `Some`) and the acquired pointer is
    /// non-null, wraps it in storage carrying the matching pending release so the callee's
    /// transfer-out is balanced by exactly one free. Borrowed transfers (no release) yield a
    /// bare pointer that the caller does not own.
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let ptr = value.object_ptr(self.object_ptr_context())?;
        // SAFETY: `ptr` originates from `value.object_ptr`, which only yields a valid object
        // pointer (or null) for the live wrapper; `ref_for_transfer` is invoked on the
        // gtkx-glib thread that owns the object and tolerates null.
        let transferred = unsafe { self.ref_for_transfer(ptr)? };
        match self.transfer_release() {
            Some(release) if !transferred.is_null() => {
                Ok(raw_ptr::full_transfer_storage(transferred, release))
            }
            _ => Ok(ffi::FfiValue::Ptr(transferred)),
        }
    }

    /// Context label describing this encoder's pointer payload, used in error messages when
    /// [`value::Value::object_ptr`] cannot extract a pointer.
    fn object_ptr_context(&self) -> &'static str {
        "object"
    }

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
        // SAFETY: `cif` was built to describe the pointer-returning C function at `ptr` with arg
        // types matching `args`, so invoking it with the `*mut c_void` return shape is sound; this
        // runs on the gtkx-glib thread that performs all FFI calls.
        Ok(ffi::FfiValue::Ptr(unsafe {
            cif.call::<*mut c_void>(ptr, args)
        }))
    }

    /// Acquires a transfer reference on `ptr` for a full-ownership argument, returning a pointer
    /// the callee will own. The default borrows: it returns `ptr` unchanged.
    ///
    /// # Safety
    ///
    /// `ptr` must be null or a pointer to a live value of this encoder's type, owned by the
    /// gtkx-glib thread. An overriding implementation may take a new reference/copy that the
    /// caller becomes responsible for releasing.
    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        Ok(ptr)
    }
}

#[derive(Debug)]
pub enum ReadSource<'a> {
    Call(&'a ffi::FfiValue),
    Slot(*const c_void, &'a str),
    Value(*mut c_void, &'a str),
}

#[enum_dispatch]
pub trait FfiDecoder {
    /// Decodes a value from the requested [`ReadSource`].
    ///
    /// # Safety
    ///
    /// For [`ReadSource::Value`]/[`ReadSource::Slot`] the contained pointer must satisfy the
    /// preconditions of [`FfiDecoder::read_value`]/[`FfiDecoder::read_pointer_slot`] respectively
    /// (a live value pointer, or a readable pointer-sized slot). The call must run on the
    /// gtkx-glib thread.
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(ffi_value) => self.read_call(ffi_value),
            // SAFETY: the caller's `read` contract guarantees `ptr` is a live value pointer for
            // this decoder's type when the source is `Value`.
            ReadSource::Value(ptr, context) => unsafe { self.read_value(ptr, context) },
            // SAFETY: the caller's `read` contract guarantees `ptr` is a readable pointer-sized
            // slot when the source is `Slot`.
            ReadSource::Slot(ptr, context) => unsafe { self.read_pointer_slot(ptr, context) },
        }
    }

    fn read_call(&self, _ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        bail!("This type cannot be decoded from FfiValue")
    }

    /// Reads a value directly from a pointer to a live instance of this decoder's type.
    ///
    /// # Safety
    ///
    /// `_ptr` must be null or point to a live value of this decoder's type owned by the
    /// gtkx-glib thread; null yields [`value::Value::Null`] where supported.
    unsafe fn read_value(&self, _ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        bail!("This type cannot be read from pointer")
    }

    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        // SAFETY: `ReadSource::Call` carries an `FfiValue`, not a raw pointer, so no pointer
        // precondition applies; `read` only dispatches to `read_call`.
        unsafe { self.read(ReadSource::Call(ffi_value)) }
    }

    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        _ffi_args: &[ffi::FfiValue],
        _args: &[crate::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        self.decode(ffi_value)
    }

    /// Reads a value through a pointer-sized slot that stores a pointer to the instance.
    ///
    /// # Safety
    ///
    /// `ptr` must point to a readable, pointer-sized slot whose stored pointer is null or a live
    /// value of this decoder's type owned by the gtkx-glib thread.
    unsafe fn read_pointer_slot(
        &self,
        ptr: *const c_void,
        context: &str,
    ) -> anyhow::Result<value::Value> {
        // SAFETY: `ptr` is a readable pointer-sized slot per the contract; this loads the stored
        // inner pointer.
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        // SAFETY: `inner_ptr` is the slot's stored value (null or a live value of this type), the
        // precondition `read`/`read_value` require for a `Value` source.
        unsafe { self.read(ReadSource::Value(inner_ptr, context)) }
    }

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
    /// Writes a vfunc/callback return value into the C return slot `ret`. The default writes a
    /// null pointer.
    ///
    /// # Safety
    ///
    /// `ret` must point to a writable, pointer-sized return slot supplied by the FFI layer, and
    /// the call must run on the gtkx-glib thread.
    unsafe fn write_return_to_raw_ptr(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
    ) {
        let _ = value;
        // SAFETY: `ret` is a writable, pointer-sized return slot per the contract; the default
        // stores a null pointer for types that have no meaningful raw return.
        unsafe { *(ret as *mut *mut c_void) = std::ptr::null_mut() };
    }

    /// Writes `value` into a C field/out slot at `ptr`. The default rejects the operation.
    ///
    /// # Safety
    ///
    /// `ptr` must point to a writable slot of the appropriate size/layout for this type, owned by
    /// the gtkx-glib thread; overriding implementations may take or release ownership to keep the
    /// slot's reference count balanced.
    unsafe fn write_value_to_raw_ptr(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let _ = (ptr, value);
        bail!("This type cannot be written to a raw pointer")
    }

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

#[cfg(feature = "test-support")]
pub trait FfiCodec: FfiEncoder + FfiDecoder + RawPtrCodec {}
#[cfg(feature = "test-support")]
impl<T: FfiEncoder + FfiDecoder + RawPtrCodec> FfiCodec for T {}

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

    #[must_use]
    pub fn can_be_return_type(&self) -> bool {
        !matches!(self, Self::Callback(_) | Self::Ref(_) | Self::Blob(_))
    }

    #[must_use]
    pub fn can_be_argument_type(&self) -> bool {
        !matches!(self, Self::Void(_))
    }
}

#[cfg(test)]
mod tests {
    use super::array::ArrayKind;
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

    #[test]
    fn ownership_parses_full_and_borrowed_only() {
        assert!(matches!("full".parse::<Ownership>(), Ok(Ownership::Full)));
        assert!(matches!(
            "borrowed".parse::<Ownership>(),
            Ok(Ownership::Borrowed)
        ));
        assert!("none".parse::<Ownership>().is_err());
        assert!("nonsense".parse::<Ownership>().is_err());
    }

    #[test]
    fn array_kind_parses_every_variant() {
        assert!(matches!("array".parse::<ArrayKind>(), Ok(ArrayKind::Array)));
        assert!(matches!("glist".parse::<ArrayKind>(), Ok(ArrayKind::GList)));
        assert!(matches!(
            "gslist".parse::<ArrayKind>(),
            Ok(ArrayKind::GSList)
        ));
        assert!(matches!(
            "gptrarray".parse::<ArrayKind>(),
            Ok(ArrayKind::GPtrArray)
        ));
        assert!(matches!(
            "garray".parse::<ArrayKind>(),
            Ok(ArrayKind::GArray)
        ));
        assert!(matches!(
            "gbytearray".parse::<ArrayKind>(),
            Ok(ArrayKind::GByteArray)
        ));
        assert!(matches!(
            "sized".parse::<ArrayKind>(),
            Ok(ArrayKind::Sized { .. })
        ));
        assert!(matches!(
            "fixed".parse::<ArrayKind>(),
            Ok(ArrayKind::Fixed { .. })
        ));
        assert!("listish".parse::<ArrayKind>().is_err());
    }

    #[test]
    fn callback_scope_parses_every_variant() {
        assert!(matches!(
            "call".parse::<CallbackScope>(),
            Ok(CallbackScope::Call)
        ));
        assert!(matches!(
            "notified".parse::<CallbackScope>(),
            Ok(CallbackScope::Notified)
        ));
        assert!(matches!(
            "async".parse::<CallbackScope>(),
            Ok(CallbackScope::Async)
        ));
        assert!(matches!(
            "forever".parse::<CallbackScope>(),
            Ok(CallbackScope::Forever)
        ));
        assert!("whenever".parse::<CallbackScope>().is_err());
    }
}
