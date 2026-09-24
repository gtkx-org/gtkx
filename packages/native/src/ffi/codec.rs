use std::ffi::c_void;

use anyhow::bail;
use enum_dispatch::enum_dispatch;
use libffi::middle as libffi;
use napi::Env;
use napi::bindgen_prelude::Unknown;
use napi_derive::napi;

use crate::handle::Handle;
use crate::{ffi, value};

mod admission;
mod array;
mod bigint;
mod boxed;
mod buffer;
mod bytes;
mod callback;
mod fundamental;
mod hashtable;
mod numeric;
mod object;
mod prelude;
mod r#ref;
mod r#struct;
mod void;

pub(crate) use admission::{validate_call_signature, validate_callback_signature};
pub use array::{ArrayBounds, ArrayCodec, ArrayKind, ElementOwnership};
pub use bigint::BigIntCodec;
pub use boxed::BoxedCodec;
pub use buffer::BufferCodec;
pub use bytes::{BytesCodec, bytes_to_glib_full, read_bytes};
pub use callback::{CallbackCodec, CallbackScope, DestroyNotifyKind};
pub(crate) use callback::{CallbackReleasePolicy, validate_callback_outputs};
pub use fundamental::FundamentalCodec;
pub use hashtable::{HashTableCodec, HashTableEntryCodec};
pub use numeric::{FloatCodec, IntegerCodec, lossless_f64};
pub use object::ObjectCodec;
pub(crate) use object::{
    acquire_construction_ref, release_construction_ref, tracked_gobject_value,
};
pub use r#ref::RefCodec;
pub use r#struct::StructCodec;
pub use void::VoidCodec;

pub(crate) trait IntegerBacked {
    fn ffi_codec(&self) -> IntegerCodec;
}

macro_rules! forward_ffi_encoder {
    () => {
        fn libffi_type(&self) -> ::libffi::middle::Type {
            $crate::ffi::codec::Encoder::libffi_type(&$crate::ffi::codec::IntegerBacked::ffi_codec(
                self,
            ))
        }

        fn call_cif(
            &self,
            cif: &::libffi::middle::Cif,
            ptr: ::libffi::middle::CodePtr,
            args: &[::libffi::middle::Arg<'_>],
        ) -> ::anyhow::Result<$crate::ffi::Stash> {
            $crate::ffi::codec::Encoder::call_cif(
                &$crate::ffi::codec::IntegerBacked::ffi_codec(self),
                cif,
                ptr,
                args,
            )
        }
    };
}
pub(crate) use forward_ffi_encoder;

/// Ownership transfer mode for a marshalled value: `borrowed` leaves the native side owning it,
/// `full` transfers ownership (and the responsibility to free it) across the FFI boundary.
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

#[derive(Debug, Clone, Copy)]
pub enum ReadSource<'a> {
    Call(&'a ffi::Stash),
    Slot(*const c_void, &'a str),
    Value(*mut c_void, &'a str),
}

#[derive(Debug, Clone, Copy)]
pub struct ReadCtx<'a> {
    pub source: ReadSource<'a>,
    pub transfer: Ownership,
    pub lent: bool,
}

impl<'a> ReadCtx<'a> {
    #[must_use]
    pub fn call(stash: &'a ffi::Stash) -> Self {
        Self {
            source: ReadSource::Call(stash),
            transfer: Ownership::Borrowed,
            lent: false,
        }
    }

    #[must_use]
    pub fn slot(ptr: *const c_void, context: &'a str) -> Self {
        Self {
            source: ReadSource::Slot(ptr, context),
            transfer: Ownership::Borrowed,
            lent: false,
        }
    }

    #[must_use]
    pub fn value(ptr: *mut c_void, context: &'a str) -> Self {
        Self {
            source: ReadSource::Value(ptr, context),
            transfer: Ownership::Borrowed,
            lent: false,
        }
    }

    #[must_use]
    pub fn with_transfer(self, transfer: Ownership) -> Self {
        Self { transfer, ..self }
    }

    /// Marks the memory as lent by the caller for the length of a single call, the way a C caller
    /// passes an argument to a callback. A codec that can hand JavaScript the caller's own instance
    /// rather than a copy does so for a lent read, so that writes reach what the caller reads back.
    #[must_use]
    pub fn lent(self) -> Self {
        Self { lent: true, ..self }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SlotInit {
    Initialized,
    Uninitialized,
}

impl SlotInit {
    #[inline]
    #[must_use]
    pub fn is_initialized(self) -> bool {
        matches!(self, Self::Initialized)
    }
}

#[enum_dispatch]
pub trait Encoder {
    fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let ptr = self.checked_handle_ptr(value, self.object_ptr_context(), |_| Ok(()))?;
        if ptr.is_null() {
            return Ok(ffi::Stash::Ptr(ptr));
        }
        let release = self.transfer_release()?;
        let transferred = unsafe { self.ref_for_transfer(ptr)? };
        match release {
            Some(release) if !transferred.is_null() => {
                Ok(prelude::full_transfer_stash(transferred, release))
            }
            _ => Ok(ffi::Stash::Ptr(transferred)),
        }
    }

    fn encode_owned(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        self.encode(env, value)
    }

    fn object_ptr_context(&self) -> &'static str {
        "object"
    }

    /// Rejects a handle that does not reference an instance of the type this codec marshals. The
    /// default accepts anything, for a codec whose value carries no type of its own.
    fn check_instance(&self, _handle: &Handle) -> anyhow::Result<()> {
        Ok(())
    }

    fn checked_handle_ptr<C>(
        &self,
        value: Unknown<'_>,
        context: &str,
        check: C,
    ) -> anyhow::Result<*mut c_void>
    where
        C: FnOnce(&Handle) -> anyhow::Result<()>,
    {
        value::handle_ptr_checked(value, context, |handle| {
            self.check_instance(handle)?;
            check(handle)
        })
    }

    fn owned_release(&self) -> anyhow::Result<Option<ffi::ReleaseKind>> {
        Ok(None)
    }

    fn transfer_release(&self) -> anyhow::Result<Option<ffi::ReleaseKind>> {
        self.owned_release()
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
        args: &[libffi::Arg<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        Ok(ffi::Stash::Ptr(unsafe {
            cif.call::<*mut c_void>(ptr, args)
        }))
    }

    /// # Safety
    ///
    /// `ptr` must be null or a live pointer to an instance of the type this codec describes, so
    /// that the reference/copy operation the concrete codec performs (`g_object_ref`,
    /// `g_boxed_copy`, a fundamental `ref` function, ...) is the correct one for it. The returned
    /// pointer carries full ownership and must be released with the matching free function.
    unsafe fn ref_for_transfer(&self, ptr: *mut c_void) -> anyhow::Result<*mut c_void> {
        Ok(ptr)
    }
}

#[enum_dispatch]
pub trait Decoder {
    /// # Safety
    ///
    /// Any pointer carried by `src` must be null or a live pointer to an instance of the type
    /// this codec describes, and must stay valid for the duration of the call. For
    /// `ReadSource::Slot` the pointer must additionally point at an initialized machine word.
    /// `env` must be the environment of the thread currently running the JavaScript main loop.
    unsafe fn read<'e>(&self, env: &'e Env, ctx: ReadCtx<'_>) -> anyhow::Result<Unknown<'e>> {
        match ctx.source {
            ReadSource::Call(stash) => self.decode_call(env, stash),
            ReadSource::Value(ptr, context) if ctx.lent => unsafe {
                self.read_lent_value(env, ptr, context, ctx.transfer)
            },
            ReadSource::Value(ptr, context) => unsafe {
                self.read_value(env, ptr, context, ctx.transfer)
            },
            ReadSource::Slot(ptr, context) => unsafe {
                self.read_pointer_slot(env, ptr, context, ctx.transfer, ctx.lent)
            },
        }
    }

    fn decode_call<'e>(&self, env: &'e Env, _stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        let _ = env;
        bail!("This type cannot be decoded from Stash")
    }

    /// Whether the value this codec describes is stored inside its owner rather than behind a
    /// pointer, which is how a struct field that embeds another struct is laid out.
    fn is_inline(&self) -> bool {
        false
    }

    /// # Safety
    ///
    /// `_ptr` must be null or a live pointer to an instance of the type this codec describes,
    /// valid for reads for the duration of the call. Ownership is not taken unless the concrete
    /// codec documents otherwise. `env` must belong to the thread running the JavaScript main
    /// loop.
    unsafe fn read_value<'e>(
        &self,
        env: &'e Env,
        _ptr: *mut c_void,
        _context: &str,
        _transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        let _ = env;
        bail!("This type cannot be read from pointer")
    }

    /// Reads an instance the caller lends for the length of a single call. The default copies it
    /// the way any other read would; a codec that can lend the caller's own instance to JavaScript
    /// overrides this, so that a callback writing through the value reaches what the caller reads
    /// back once the callback returns.
    ///
    /// # Safety
    ///
    /// Same as [`Decoder::read_value`], and `ptr` must additionally stay valid for no longer than
    /// the call that lends it, which is what the surrounding [`crate::handle::BorrowScope`] ends.
    unsafe fn read_lent_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        context: &str,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        unsafe { self.read_value(env, ptr, context, transfer) }
    }

    fn decode<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        unsafe { self.read(env, ReadCtx::call(stash)) }
    }

    fn decode_with_context<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        _ffi_args: &[ffi::Stash],
        _arg_codecs: &[Codec],
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode(env, stash)
    }

    /// # Safety
    ///
    /// `ptr` must point at an initialized, readable machine word holding a pointer to an instance
    /// of the type this codec describes (a C out-parameter slot). The word itself need not be
    /// aligned; it is read unaligned. `env` must belong to the thread running the JavaScript main
    /// loop.
    unsafe fn read_pointer_slot<'e>(
        &self,
        env: &'e Env,
        ptr: *const c_void,
        context: &str,
        transfer: Ownership,
        lent: bool,
    ) -> anyhow::Result<Unknown<'e>> {
        if self.is_inline() {
            bail!(
                "{context}: a value stored inline has no pointer slot to read, it can only be decoded as a field of the instance that holds it"
            );
        }

        let inner_ptr = unsafe { ptr.cast::<*mut c_void>().read_unaligned() };
        let ctx = ReadCtx::value(inner_ptr, context).with_transfer(transfer);

        unsafe { self.read(env, if lent { ctx.lent() } else { ctx }) }
    }

    fn decode_non_null<'e, F>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        decode: F,
    ) -> anyhow::Result<Unknown<'e>>
    where
        F: FnOnce(*mut c_void) -> anyhow::Result<Unknown<'e>>,
    {
        if ptr.is_null() {
            return Ok(value::js_null(env)?);
        }
        decode(ptr)
    }

    fn decode_call_non_null<'e, F>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        label: &str,
        decode: F,
    ) -> anyhow::Result<Unknown<'e>>
    where
        F: FnOnce(*mut c_void) -> anyhow::Result<Unknown<'e>>,
    {
        match stash.as_non_null_ptr(label)? {
            Some(ptr) => decode(ptr),
            None => Ok(value::js_null(env)?),
        }
    }
}

#[enum_dispatch]
pub trait PtrWriter {
    fn write_return_to_ptr(&self, env: &Env, ret: ffi::Slot, value: &Result<Unknown<'_>, ()>) {
        let _ = (env, value);
        unsafe { ret.store(std::ptr::null_mut()) };
    }

    fn write_value_to_ptr(
        &self,
        env: &Env,
        slot: ffi::Slot,
        value: Unknown<'_>,
        init: SlotInit,
    ) -> anyhow::Result<Option<ffi::PendingTransfer>> {
        let _ = (env, slot, value, init);
        bail!("This type cannot be written to a raw pointer")
    }

    fn write_return_with_ownership<F>(
        &self,
        _env: &Env,
        ret: ffi::Slot,
        value: &Result<Unknown<'_>, ()>,
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
    Bytes(BytesCodec),
    Void(VoidCodec),
    Object(ObjectCodec),
    Boxed(BoxedCodec),
    Struct(StructCodec),
    Fundamental(FundamentalCodec),
    Array(ArrayCodec),
    Buffer(BufferCodec),
    HashTable(HashTableCodec),
    Callback(CallbackCodec),
    Ref(RefCodec),
}

impl Codec {
    pub(crate) fn validate_outbound_hash_tables(&self) -> anyhow::Result<()> {
        match self {
            Self::HashTable(table) => table.validate_outbound_hash_tables(),
            Self::Array(array) => array.item_codec.validate_outbound_hash_tables(),
            Self::Ref(reference) => reference.inner_codec().validate_outbound_hash_tables(),
            Self::Callback(callback) => {
                validate_callback_outputs(&callback.arg_codecs, &callback.return_codec)
            }
            _ => Ok(()),
        }
    }

    pub(crate) fn field_size(&self) -> Option<usize> {
        match self {
            Self::Struct(codec) if codec.inline => codec.size,
            Self::Boxed(codec) if codec.inline => codec.size,
            Self::Fundamental(codec) if codec.inline => None,
            Self::Void(_) => Some(0),
            _ => Some(unsafe { (*self.libffi_type().as_raw_ptr()).size }),
        }
    }

    #[must_use]
    pub fn transfer(&self) -> Ownership {
        match self {
            Self::Object(codec) => codec.ownership,
            Self::Boxed(codec) => codec.ownership,
            Self::Struct(codec) => codec.ownership,
            Self::Bytes(codec) => codec.ownership,
            Self::Array(codec) => codec.ownership,
            Self::HashTable(codec) => codec.ownership,
            Self::Fundamental(codec) => codec.ownership,
            Self::Ref(codec) => codec.inner_codec().transfer(),
            Self::Integer(_)
            | Self::BigInt(_)
            | Self::Float(_)
            | Self::Void(_)
            | Self::Buffer(_)
            | Self::Callback(_) => Ownership::Borrowed,
        }
    }

    #[must_use]
    pub fn is_handle_backed(&self) -> bool {
        matches!(
            self,
            Codec::Object(_) | Codec::Boxed(_) | Codec::Struct(_) | Codec::Fundamental(_)
        )
    }

    #[must_use]
    pub fn is_scalar(&self) -> bool {
        matches!(self, Codec::Integer(_) | Codec::BigInt(_) | Codec::Float(_))
    }
}

impl std::fmt::Display for Codec {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Integer(kind) => write!(f, "Integer({kind:?})"),
            Self::BigInt(kind) => write!(f, "BigInt({kind:?})"),
            Self::Float(kind) => write!(f, "Float({kind:?})"),
            Self::Bytes(_) => write!(f, "Bytes"),
            Self::Void(_) => write!(f, "Void"),
            Self::Object(_) => write!(f, "Object"),
            Self::Boxed(t) => write!(f, "Boxed({})", t.type_name),
            Self::Struct(t) => write!(f, "Struct({})", t.ownership),
            Self::Fundamental(t) => write!(f, "Fundamental({})", t.unref_fn_name),
            Self::Array(_) => write!(f, "Array"),
            Self::Buffer(_) => write!(f, "Buffer"),
            Self::HashTable(_) => write!(f, "HashTable"),
            Self::Callback(_) => write!(f, "Callback"),
            Self::Ref(t) => write!(f, "Ref({})", t.inner_codec()),
        }
    }
}
