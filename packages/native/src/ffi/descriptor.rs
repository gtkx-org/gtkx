use std::ffi::c_void;

use anyhow::bail;
use enum_dispatch::enum_dispatch;
use libffi::middle as libffi;
use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use crate::ffi::{self, value};

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
) -> napi::Result<(Vec<Descriptor>, Box<Descriptor>)> {
    let arg_descriptors_prop: Unknown<'_> = obj.get_named_property("argDescriptors")?;
    if !arg_descriptors_prop.is_array()? {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("'argDescriptors' property is required for {kind} types"),
        ));
    }
    // SAFETY: `arg_descriptors_prop` was verified to be an array above, and its raw napi value is valid
    // for the current `env`, so reconstructing an `Array` from the pair is sound.
    let arg_descriptors_arr: Array =
        unsafe { Array::from_napi_value(env.raw(), arg_descriptors_prop.raw())? };
    let arg_descriptors =
        crate::ffi::value::map_js_array(env, &arg_descriptors_arr, Descriptor::from_descriptor)?;

    let return_descriptor_prop: Unknown<'_> = obj.get_named_property("returnDescriptor")?;
    if matches!(
        return_descriptor_prop.get_type()?,
        napi::ValueType::Undefined | napi::ValueType::Null
    ) {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("'returnDescriptor' property is required for {kind} types"),
        ));
    }
    let return_descriptor = Box::new(Descriptor::from_descriptor(env, return_descriptor_prop)?);

    Ok((arg_descriptors, return_descriptor))
}

mod array;
mod bigint;
mod boolean;
mod boxed;
mod buffer;
mod callback;
mod fundamental;
mod hashtable;
mod numeric;
mod object;
mod pointer;
mod prelude;
mod r#ref;
mod string;
mod r#struct;
mod unichar;
mod void;

pub use array::ArrayDescriptor;
pub use array::ArrayKind;
pub use bigint::BigIntKind;
pub use boolean::BooleanDescriptor;
pub use boxed::{BoxedDescriptor, BoxedFreeFn};
pub use buffer::BufferDescriptor;
pub use callback::CallbackDescriptor;
#[cfg(debug_assertions)]
pub use callback::CallbackScope;
pub use fundamental::FundamentalDescriptor;
pub use hashtable::HashTableDescriptor;
#[cfg(debug_assertions)]
pub use hashtable::HashTableEntryEncoder;
pub use numeric::{EnumFlagsDescriptor, EnumFlagsKind, FloatKind, IntegerKind};
pub use object::ObjectDescriptor;
pub use r#ref::RefDescriptor;
pub use string::{StringDescriptor, str_to_glib_full};
pub use r#struct::StructDescriptor;
pub use unichar::UnicharDescriptor;
pub use void::VoidDescriptor;

pub(crate) use numeric::lossless_f64;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
#[non_exhaustive]
pub enum Ownership {
    /// Corresponds to glib's 'transfer none': the pointer is borrowed and the callee takes no
    /// ownership of it.
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
    pub fn from_descriptor(obj: &JsObject, type_name: &str) -> napi::Result<Self> {
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
    /// Encodes the JS-side value into an [`ffi::StashedValue`] ready to be passed to a C call.
    ///
    /// The default implementation models the one-method-per-ownership-mode contract that
    /// glib uses for `to_glib_none`/`to_glib_full`: it reads the object pointer, acquires a
    /// transfer reference via [`FfiEncoder::ref_for_transfer`], and, when the type owns the
    /// transfer ([`FfiEncoder::transfer_release`] returns `Some`) and the acquired pointer is
    /// non-null, wraps it in storage carrying the matching pending release so the callee's
    /// transfer-out is balanced by exactly one free. Borrowed transfers (no release) yield a
    /// bare pointer that the caller does not own.
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let ptr = value.object_ptr(self.object_ptr_context())?;
        // SAFETY: `ptr` originates from `value.object_ptr`, which only yields a valid object
        // pointer (or null) for the live wrapper; `ref_for_transfer` is invoked on the
        // gtkx-glib thread that owns the object and tolerates null.
        let transferred = unsafe { self.ref_for_transfer(ptr)? };
        match self.transfer_release() {
            Some(release) if !transferred.is_null() => {
                Ok(pointer::full_transfer_storage(transferred, release))
            }
            _ => Ok(ffi::StashedValue::Ptr(transferred)),
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
    ) -> anyhow::Result<ffi::StashedValue> {
        // SAFETY: `cif` was built to describe the pointer-returning C function at `ptr` with arg
        // types matching `args`, so invoking it with the `*mut c_void` return shape is sound; this
        // runs on the gtkx-glib thread that performs all FFI calls.
        Ok(ffi::StashedValue::Ptr(unsafe {
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
    Call(&'a ffi::StashedValue),
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
            ReadSource::Call(stashed_value) => self.read_call(stashed_value),
            // SAFETY: the caller's `read` contract guarantees `ptr` is a live value pointer for
            // this decoder's type when the source is `Value`.
            ReadSource::Value(ptr, context) => unsafe { self.read_value(ptr, context) },
            // SAFETY: the caller's `read` contract guarantees `ptr` is a readable pointer-sized
            // slot when the source is `Slot`.
            ReadSource::Slot(ptr, context) => unsafe { self.read_pointer_slot(ptr, context) },
        }
    }

    fn read_call(&self, _stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        bail!("This type cannot be decoded from StashedValue")
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

    fn decode(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        // SAFETY: `ReadSource::Call` carries an `StashedValue`, not a raw pointer, so no pointer
        // precondition applies; `read` only dispatches to `read_call`.
        unsafe { self.read(ReadSource::Call(stashed_value)) }
    }

    fn decode_with_context(
        &self,
        stashed_value: &ffi::StashedValue,
        _ffi_args: &[ffi::StashedValue],
        _args: &[crate::ffi::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        self.decode(stashed_value)
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
pub trait PointerWriter {
    /// Writes a vfunc/callback return value into the C return slot `ret`. The default writes a
    /// null pointer.
    ///
    /// # Safety
    ///
    /// `ret` must point to a writable, pointer-sized return slot supplied by the FFI layer, and
    /// the call must run on the gtkx-glib thread.
    unsafe fn write_return_to_pointer(
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
    unsafe fn write_value_to_pointer(
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
        pointer::write_return_object_ptr(ret, value, |ptr| {
            if ownership.is_borrowed() {
                ptr
            } else {
                acquire(ptr)
            }
        });
    }
}

#[enum_dispatch(FfiEncoder, FfiDecoder, PointerWriter)]
#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum Descriptor {
    Integer(IntegerKind),
    BigInt(BigIntKind),
    Float(FloatKind),
    EnumFlags(EnumFlagsDescriptor),
    String(StringDescriptor),
    Void(VoidDescriptor),
    Boolean(BooleanDescriptor),
    Object(ObjectDescriptor),
    Boxed(BoxedDescriptor),
    Struct(StructDescriptor),
    Fundamental(FundamentalDescriptor),
    Array(ArrayDescriptor),
    Buffer(BufferDescriptor),
    HashTable(HashTableDescriptor),
    Callback(CallbackDescriptor),
    Ref(RefDescriptor),
    Unichar(UnicharDescriptor),
}

impl std::fmt::Display for Descriptor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Integer(kind) => write!(f, "Integer({kind:?})"),
            Self::BigInt(kind) => write!(f, "BigInt({kind:?})"),
            Self::Float(kind) => write!(f, "Float({kind:?})"),
            Self::EnumFlags(t) => match t.kind {
                EnumFlagsKind::Enum => write!(f, "Enum({})", t.get_type_fn),
                EnumFlagsKind::Flags => write!(f, "Flags({})", t.get_type_fn),
            },
            Self::String(_) => write!(f, "String"),
            Self::Void(_) => write!(f, "Void"),
            Self::Boolean(_) => write!(f, "Boolean"),
            Self::Object(_) => write!(f, "Object"),
            Self::Boxed(t) => write!(f, "Boxed({})", t.type_name),
            Self::Struct(t) => write!(f, "Struct({})", t.ownership),
            Self::Fundamental(t) => write!(f, "Fundamental({})", t.unref_func),
            Self::Array(_) => write!(f, "Array"),
            Self::Buffer(_) => write!(f, "Buffer"),
            Self::HashTable(_) => write!(f, "HashTable"),
            Self::Callback(_) => write!(f, "Callback"),
            Self::Ref(t) => write!(f, "Ref({})", t.inner_descriptor),
            Self::Unichar(_) => write!(f, "Unichar"),
        }
    }
}

impl Descriptor {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_descriptor(env: &Env, value: Unknown<'_>) -> napi::Result<Self> {
        let obj: JsObject = crate::ffi::value::unknown_as_object(env, &value)?;
        let descriptor: String = obj.get_named_property("kind")?;

        match descriptor.as_str() {
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
            "enum" => Ok(Self::EnumFlags(EnumFlagsDescriptor::from_descriptor(
                env,
                &obj,
                EnumFlagsKind::Enum,
            )?)),
            "flags" => Ok(Self::EnumFlags(EnumFlagsDescriptor::from_descriptor(
                env,
                &obj,
                EnumFlagsKind::Flags,
            )?)),
            "string" => Ok(Self::String(StringDescriptor::from_descriptor(env, &obj)?)),
            "boolean" => Ok(Self::Boolean(BooleanDescriptor)),
            "void" => Ok(Self::Void(VoidDescriptor)),
            "object" => Ok(Self::Object(ObjectDescriptor::from_descriptor(
                env, &obj,
            )?)),
            "boxed" => Ok(Self::Boxed(BoxedDescriptor::from_descriptor(env, &obj)?)),
            "struct" => Ok(Self::Struct(StructDescriptor::from_descriptor(env, &obj)?)),
            "array" => Ok(Self::Array(ArrayDescriptor::from_descriptor(env, &obj)?)),
            "buffer" => Ok(Self::Buffer(BufferDescriptor)),
            "hashtable" => Ok(Self::HashTable(HashTableDescriptor::from_descriptor(
                env, &obj,
            )?)),
            "callback" => Ok(Self::Callback(CallbackDescriptor::from_descriptor(
                env, &obj,
            )?)),
            "ref" => Ok(Self::Ref(RefDescriptor::from_descriptor(env, &obj)?)),
            "unichar" => Ok(Self::Unichar(UnicharDescriptor)),
            "fundamental" => Ok(Self::Fundamental(FundamentalDescriptor::from_descriptor(
                env, &obj,
            )?)),
            other => Err(napi::Error::new(
                napi::Status::InvalidArg,
                format!("Unknown type: {other}"),
            )),
        }
    }

    #[must_use]
    pub fn can_be_return(&self) -> bool {
        !matches!(self, Self::Callback(_) | Self::Ref(_) | Self::Buffer(_))
    }

    #[must_use]
    pub fn can_be_argument(&self) -> bool {
        !matches!(self, Self::Void(_))
    }
}

#[cfg(test)]
mod tests {
    use super::array::ArrayKind;
    use super::callback::CallbackScope;
    use super::*;

    #[test]
    fn scalar_and_pointer_types_can_be_return() {
        assert!(Descriptor::Void(VoidDescriptor).can_be_return());
        assert!(Descriptor::Integer(IntegerKind::I32).can_be_return());
        assert!(Descriptor::Boolean(BooleanDescriptor).can_be_return());
    }

    #[test]
    fn callback_cannot_be_return() {
        let callback = CallbackDescriptor {
            arg_descriptors: Vec::new(),
            return_descriptor: Box::new(Descriptor::Void(VoidDescriptor)),
            has_destroy: false,
            user_data_index: None,
            scope: CallbackScope::Call,
        };
        assert!(!Descriptor::Callback(callback).can_be_return());
    }

    #[test]
    fn ref_cannot_be_return() {
        let ref_type = RefDescriptor::new(Descriptor::Integer(IntegerKind::I32))
            .expect("Integer is a valid Ref inner");
        assert!(!Descriptor::Ref(ref_type).can_be_return());
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
