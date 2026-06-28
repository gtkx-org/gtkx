use std::ffi::c_void;

use crate::ffi::{self, value};
use anyhow::bail;
use enum_dispatch::enum_dispatch;
use libffi::middle as libffi;

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
mod wire;

pub use array::ArrayDescriptor;
pub use array::ArrayKind;
pub use bigint::BigIntKind;
pub use boolean::BooleanDescriptor;
pub use boxed::{BoxedDescriptor, BoxedFreeFn};
pub use buffer::BufferDescriptor;
pub use callback::CallbackDescriptor;
pub use callback::CallbackScope;
pub use fundamental::FundamentalDescriptor;
pub use hashtable::HashTableDescriptor;
pub use hashtable::HashTableEntryEncoder;
pub use numeric::{EnumFlagsDescriptor, EnumFlagsKind, FloatKind, IntegerKind};
pub use object::ObjectDescriptor;
pub use r#ref::RefDescriptor;
pub use string::{StringDescriptor, str_to_glib_full};
pub use r#struct::StructDescriptor;
pub use unichar::UnicharDescriptor;
pub use void::VoidDescriptor;
pub use wire::{Descriptor, DescriptorRef};

pub(crate) use numeric::lossless_f64;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum Ownership {
    #[default]
    Borrowed,
    Full,
}

impl Ownership {
    #[inline]
    pub fn is_full(self) -> bool {
        matches!(self, Self::Full)
    }

    #[inline]
    pub fn is_borrowed(self) -> bool {
        matches!(self, Self::Borrowed)
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
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let ptr = value.object_ptr(self.object_ptr_context())?;
        let transferred = unsafe { self.ref_for_transfer(ptr)? };
        match self.transfer_release() {
            Some(release) if !transferred.is_null() => {
                Ok(pointer::full_transfer_storage(transferred, release))
            }
            _ => Ok(ffi::StashedValue::Ptr(transferred)),
        }
    }

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
        Ok(ffi::StashedValue::Ptr(unsafe {
            cif.call::<*mut c_void>(ptr, args)
        }))
    }

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
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(stashed_value) => self.read_call(stashed_value),
            ReadSource::Value(ptr, context) => unsafe { self.read_value(ptr, context) },
            ReadSource::Slot(ptr, context) => unsafe { self.read_pointer_slot(ptr, context) },
        }
    }

    fn read_call(&self, _stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        bail!("This type cannot be decoded from StashedValue")
    }

    unsafe fn read_value(&self, _ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        bail!("This type cannot be read from pointer")
    }

    fn decode(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
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

    unsafe fn read_pointer_slot(
        &self,
        ptr: *const c_void,
        context: &str,
    ) -> anyhow::Result<value::Value> {
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        unsafe { self.read(ReadSource::Value(inner_ptr, context)) }
    }

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
    unsafe fn write_return_to_pointer(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
    ) {
        let _ = value;
        unsafe { *(ret as *mut *mut c_void) = std::ptr::null_mut() };
    }

    unsafe fn write_value_to_pointer(
        &self,
        ptr: *mut c_void,
        value: &value::Value,
    ) -> anyhow::Result<()> {
        let _ = (ptr, value);
        bail!("This type cannot be written to a raw pointer")
    }

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
pub enum Codec {
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

impl std::fmt::Display for Codec {
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

impl Codec {
    pub fn can_be_return(&self) -> bool {
        !matches!(self, Self::Callback(_) | Self::Ref(_) | Self::Buffer(_))
    }

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
        assert!(Codec::Void(VoidDescriptor).can_be_return());
        assert!(Codec::Integer(IntegerKind::I32).can_be_return());
        assert!(Codec::Boolean(BooleanDescriptor).can_be_return());
    }

    #[test]
    fn callback_cannot_be_return() {
        let callback = CallbackDescriptor {
            arg_descriptors: Vec::new(),
            return_descriptor: Box::new(Codec::Void(VoidDescriptor)),
            has_destroy: false,
            user_data_index: None,
            scope: CallbackScope::Call,
        };
        assert!(!Codec::Callback(callback).can_be_return());
    }

    #[test]
    fn ref_cannot_be_return() {
        let ref_type = RefDescriptor::new(Codec::Integer(IntegerKind::I32))
            .expect("Integer is a valid Ref inner");
        assert!(!Codec::Ref(ref_type).can_be_return());
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
