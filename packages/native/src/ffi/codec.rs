use std::ffi::c_void;

use crate::ffi::{self, value};
use anyhow::bail;
use enum_dispatch::enum_dispatch;
use libffi::middle as libffi;
use napi_derive::napi;

mod array;
mod bigint;
mod boolean;
mod boxed;
mod buffer;
mod callback;
mod enum_flags;
mod fundamental;
mod hashtable;
mod numeric;
mod object;
mod prelude;
mod r#ref;
mod string;
mod r#struct;
mod unichar;
mod void;

pub use array::ArrayCodec;
pub use array::ArrayKind;
pub use bigint::BigIntCodec;
pub use boolean::BooleanCodec;
pub use boxed::BoxedCodec;
pub use buffer::BufferCodec;
pub use callback::CallbackCodec;
pub use callback::CallbackScope;
pub use enum_flags::{EnumFlagsCodec, EnumFlagsKind};
pub use fundamental::FundamentalCodec;
pub use hashtable::HashTableCodec;
pub use hashtable::HashTableEntryCodec;
pub use numeric::{FloatCodec, IntegerCodec, lossless_f64};
pub use object::ObjectCodec;
pub use r#ref::RefCodec;
pub use string::{StringCodec, str_to_glib_full};
pub use r#struct::StructCodec;
pub use unichar::UnicharCodec;
pub use void::VoidCodec;

macro_rules! forward_ffi_encoder {
    () => {
        fn libffi_type(&self) -> ::libffi::middle::Type {
            $crate::ffi::codec::Encoder::libffi_type(&self.ffi_codec())
        }

        fn call_cif(
            &self,
            cif: &::libffi::middle::Cif,
            ptr: ::libffi::middle::CodePtr,
            args: &[::libffi::middle::Arg],
        ) -> ::anyhow::Result<$crate::ffi::Stash> {
            $crate::ffi::codec::Encoder::call_cif(&self.ffi_codec(), cif, ptr, args)
        }
    };
}
pub(crate) use forward_ffi_encoder;

#[napi(string_enum = "lowercase")]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum Ownership {
    #[default]
    Borrowed,
    Full,
}

impl std::fmt::Display for Ownership {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Borrowed => "borrowed",
            Self::Full => "full",
        })
    }
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

#[derive(Debug)]
pub enum ReadSource<'a> {
    Call(&'a ffi::Stash),
    Slot(*const c_void, &'a str),
    Value(*mut c_void, &'a str),
}

#[enum_dispatch]
pub trait Encoder {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        let ptr = value.object_ptr(self.object_ptr_context())?;
        let transferred = unsafe { self.ref_for_transfer(ptr)? };
        match self.transfer_release() {
            Some(release) if !transferred.is_null() => {
                Ok(prelude::full_transfer_stash(transferred, release))
            }
            _ => Ok(ffi::Stash::Ptr(transferred)),
        }
    }

    fn object_ptr_context(&self) -> &'static str {
        "object"
    }

    fn transfer_release(&self) -> Option<ffi::ReleaseKind> {
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
    ) -> anyhow::Result<ffi::Stash> {
        Ok(ffi::Stash::Ptr(unsafe {
            cif.call::<*mut c_void>(ptr, args)
        }))
    }

    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        Ok(ptr)
    }
}

#[enum_dispatch]
pub trait Decoder {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        match src {
            ReadSource::Call(stash) => self.decode_call(stash),
            ReadSource::Value(ptr, context) => unsafe { self.read_value(ptr, context) },
            ReadSource::Slot(ptr, context) => unsafe { self.read_pointer_slot(ptr, context) },
        }
    }

    fn decode_call(&self, _stash: &ffi::Stash) -> anyhow::Result<value::Value> {
        bail!("This type cannot be decoded from Stash")
    }

    unsafe fn read_value(&self, _ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        bail!("This type cannot be read from pointer")
    }

    fn decode(&self, stash: &ffi::Stash) -> anyhow::Result<value::Value> {
        unsafe { self.read(ReadSource::Call(stash)) }
    }

    fn decode_with_context(
        &self,
        stash: &ffi::Stash,
        _ffi_args: &[ffi::Stash],
        _arg_codecs: &[Codec],
    ) -> anyhow::Result<value::Value> {
        self.decode(stash)
    }

    unsafe fn read_pointer_slot(
        &self,
        ptr: *const c_void,
        context: &str,
    ) -> anyhow::Result<value::Value> {
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        unsafe { self.read(ReadSource::Value(inner_ptr, context)) }
    }

    fn decode_non_null<F>(&self, ptr: *mut c_void, decode: F) -> anyhow::Result<value::Value>
    where
        F: FnOnce(*mut c_void) -> anyhow::Result<value::Value>,
    {
        if ptr.is_null() {
            return Ok(value::Value::Null);
        }
        decode(ptr)
    }

    fn decode_call_non_null<F>(
        &self,
        stash: &ffi::Stash,
        label: &str,
        decode: F,
    ) -> anyhow::Result<value::Value>
    where
        F: FnOnce(*mut c_void) -> anyhow::Result<value::Value>,
    {
        match stash.as_non_null_ptr(label)? {
            Some(ptr) => decode(ptr),
            None => Ok(value::Value::Null),
        }
    }
}

#[enum_dispatch]
pub trait PtrWriter {
    fn write_return_to_ptr(&self, ret: ffi::Slot, value: &std::result::Result<value::Value, ()>) {
        let _ = value;
        unsafe { ret.store(std::ptr::null_mut()) };
    }

    fn write_value_to_ptr(&self, slot: ffi::Slot, value: &value::Value) -> anyhow::Result<()> {
        let _ = (slot, value);
        bail!("This type cannot be written to a raw pointer")
    }

    fn write_return_with_ownership<F>(
        &self,
        ret: ffi::Slot,
        value: &std::result::Result<value::Value, ()>,
        ownership: Ownership,
        acquire: F,
    ) where
        F: FnOnce(*mut c_void) -> *mut c_void,
    {
        prelude::write_return_object_ptr(ret, value, |ptr| {
            if ownership.is_borrowed() {
                ptr
            } else {
                acquire(ptr)
            }
        });
    }
}

#[enum_dispatch(Encoder, Decoder, PtrWriter)]
#[derive(Debug, Clone)]
pub enum Codec {
    Integer(IntegerCodec),
    BigInt(BigIntCodec),
    Float(FloatCodec),
    EnumFlags(EnumFlagsCodec),
    String(StringCodec),
    Void(VoidCodec),
    Boolean(BooleanCodec),
    Object(ObjectCodec),
    Boxed(BoxedCodec),
    Struct(StructCodec),
    Fundamental(FundamentalCodec),
    Array(ArrayCodec),
    Buffer(BufferCodec),
    HashTable(HashTableCodec),
    Callback(CallbackCodec),
    Ref(RefCodec),
    Unichar(UnicharCodec),
}

impl Codec {
    pub fn is_handle_backed(&self) -> bool {
        match self {
            Codec::Object(_) | Codec::Boxed(_) | Codec::Struct(_) | Codec::Fundamental(_) => true,
            Codec::Integer(_)
            | Codec::BigInt(_)
            | Codec::Float(_)
            | Codec::EnumFlags(_)
            | Codec::String(_)
            | Codec::Void(_)
            | Codec::Boolean(_)
            | Codec::Array(_)
            | Codec::Buffer(_)
            | Codec::HashTable(_)
            | Codec::Callback(_)
            | Codec::Ref(_)
            | Codec::Unichar(_) => false,
        }
    }
}

impl std::fmt::Display for Codec {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Integer(kind) => write!(f, "Integer({kind:?})"),
            Self::BigInt(kind) => write!(f, "BigInt({kind:?})"),
            Self::Float(kind) => write!(f, "Float({kind:?})"),
            Self::EnumFlags(t) => match t.kind {
                EnumFlagsKind::Enum => write!(f, "Enum({})", t.get_type_fn_name),
                EnumFlagsKind::Flags => write!(f, "Flags({})", t.get_type_fn_name),
            },
            Self::String(_) => write!(f, "String"),
            Self::Void(_) => write!(f, "Void"),
            Self::Boolean(_) => write!(f, "Boolean"),
            Self::Object(_) => write!(f, "Object"),
            Self::Boxed(t) => write!(f, "Boxed({})", t.type_name),
            Self::Struct(t) => write!(f, "Struct({})", t.ownership),
            Self::Fundamental(t) => write!(f, "Fundamental({})", t.unref_fn_name),
            Self::Array(_) => write!(f, "Array"),
            Self::Buffer(_) => write!(f, "Buffer"),
            Self::HashTable(_) => write!(f, "HashTable"),
            Self::Callback(_) => write!(f, "Callback"),
            Self::Ref(t) => write!(f, "Ref({})", t.inner_codec),
            Self::Unichar(_) => write!(f, "Unichar"),
        }
    }
}
