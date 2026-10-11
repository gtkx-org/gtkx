use std::ffi::{CStr, c_char};
use std::rc::Rc;

use anyhow::bail;

use super::prelude::*;
use crate::api::reference::{ReferenceMode, ReferenceStorage};
use crate::ffi::codec::Codec;
use crate::ffi::{StashData, StashStorage};

#[derive(Debug, Clone)]
pub struct RefCodec {
    inner_codec: Box<Codec>,
    inout: bool,
    identity: Rc<()>,
}

impl RefCodec {
    pub fn new(inner_codec: Codec, inout: bool) -> Result<Self> {
        if !Self::supports_inner(&inner_codec) {
            return Err(Error::new(
                Status::InvalidArg,
                format!("'{inner_codec}' cannot be used as a Ref inner codec"),
            ));
        }
        Ok(Self {
            inner_codec: Box::new(inner_codec),
            inout,
            identity: Rc::new(()),
        })
    }

    #[must_use]
    pub fn inner_codec(&self) -> &Codec {
        &self.inner_codec
    }

    #[must_use]
    pub fn is_inout(&self) -> bool {
        self.inout
    }

    fn inout_array_input(&self) -> Option<super::ArrayCodec> {
        let Codec::Array(array) = &*self.inner_codec else {
            return None;
        };
        if !self.inout
            || !array.ownership.is_full()
            || !array.item_codec.transfer().is_full()
            || !(array.is_garray_container() || array.ptr_array_item().is_some())
        {
            return None;
        }
        let mut input = array.clone();
        input.element_ownership = super::array::ElementOwnership::Container;
        Some(input)
    }

    #[must_use]
    pub fn supports_inner(inner: &Codec) -> bool {
        match inner {
            Codec::Callback(_) | Codec::Void(_) | Codec::Buffer(_) | Codec::Ref(_) => false,
            Codec::Integer(_)
            | Codec::BigInt(_)
            | Codec::Float(_)
            | Codec::Bytes(_)
            | Codec::Object(_)
            | Codec::Boxed(_)
            | Codec::Struct(_)
            | Codec::Fundamental(_)
            | Codec::Array(_)
            | Codec::HashTable(_) => true,
        }
    }

    pub(crate) fn identity(&self) -> Rc<()> {
        Rc::clone(&self.identity)
    }

    pub(crate) fn validate_mode(&self, mode: ReferenceMode) -> anyhow::Result<()> {
        if let Codec::Bytes(bytes) = &*self.inner_codec
            && bytes.length.is_some()
        {
            anyhow::ensure!(
                mode == ReferenceMode::FixedBytes,
                "Fixed byte references require fixed byte storage"
            );
            return Ok(());
        }
        if let Codec::Array(array) = &*self.inner_codec
            && array.caller_allocated
        {
            let expected = if array.is_garray_container() {
                ReferenceMode::CallerContainer
            } else {
                ReferenceMode::CallerArray
            };
            anyhow::ensure!(
                !self.inout && mode == expected,
                "Caller-allocated references require matching caller storage"
            );
            return Ok(());
        }
        anyhow::ensure!(
            mode != ReferenceMode::FixedBytes,
            "Fixed byte storage requires a bytes descriptor with an extent"
        );
        match mode {
            ReferenceMode::Inout => {
                anyhow::ensure!(self.inout, "An out reference cannot use inout storage");
            }
            ReferenceMode::Slot => {
                anyhow::ensure!(!self.inout, "An inout reference requires seeded storage");
            }
            ReferenceMode::ArrayBuffer | ReferenceMode::ArraySlot => anyhow::ensure!(
                !self.inout && matches!(&*self.inner_codec, Codec::Array(_)),
                "Array seed storage requires an array output descriptor"
            ),
            ReferenceMode::CallerArray | ReferenceMode::CallerContainer => {
                bail!("Caller-allocated storage requires a caller-allocated array descriptor")
            }
            ReferenceMode::FixedBytes => unreachable!(),
        }
        Ok(())
    }

    pub(crate) fn prepare_storage(
        &self,
        env: &Env,
        seed: Unknown<'_>,
        mode: ReferenceMode,
        capacity: Option<usize>,
        independent: bool,
    ) -> anyhow::Result<ffi::Stash> {
        anyhow::ensure!(
            !self.inner_codec.is_scalar(),
            "Scalar references use allocated ABI storage"
        );
        match mode {
            ReferenceMode::Slot => {
                anyhow::ensure!(!self.inout, "An inout reference requires seeded storage");
                Ok(Self::null_ptr_stash())
            }
            ReferenceMode::Inout => {
                anyhow::ensure!(self.inout, "An out reference cannot use inout storage");
                let input = self.inout_array_input();
                let codec = &*self.inner_codec;
                let encoded = match input {
                    Some(input) if independent => input.encode_owned(env, seed)?,
                    Some(input) => input.encode(env, seed)?,
                    None if independent => codec.encode_owned(env, seed)?,
                    None => codec.encode(env, seed)?,
                };
                Self::indirect_storage(Self::bounded_seed(env, seed, encoded)?)
            }
            ReferenceMode::FixedBytes => {
                let Codec::Bytes(bytes) = &*self.inner_codec else {
                    bail!("Fixed byte storage requires a bytes descriptor")
                };
                let Some(length) = bytes.length else {
                    bail!("Fixed byte storage requires a declared extent")
                };
                Self::encode_fixed_bytes(seed, length)
            }
            ReferenceMode::CallerArray => {
                let Codec::Array(array) = &*self.inner_codec else {
                    bail!("Caller-allocated storage requires an array descriptor")
                };
                anyhow::ensure!(!self.inout, "Caller-allocated array storage is output-only");
                let Some(byte_len) = array.caller_allocation_len(capacity)? else {
                    bail!("Caller-allocated storage requires a bounded caller-allocated array")
                };
                let allocation = ffi::CallerAllocation::zeroed(byte_len);
                Ok(ffi::Stash::Storage(StashStorage::new(
                    allocation.ptr(),
                    StashData::CallerAllocation(allocation),
                )))
            }
            ReferenceMode::CallerContainer => {
                let Codec::Array(array) = &*self.inner_codec else {
                    bail!("Caller-allocated storage requires an array descriptor")
                };
                anyhow::ensure!(
                    !self.inout && array.caller_allocated && array.is_garray_container(),
                    "Caller container storage requires a caller-allocated GArray output"
                );
                let mut allocation = array.clone();
                allocation.ownership = Ownership::Borrowed;
                allocation.caller_allocated = false;
                allocation.encode_owned(env, value::js_array(env, Vec::new())?)
            }
            ReferenceMode::ArrayBuffer | ReferenceMode::ArraySlot => {
                let Codec::Array(array) = &*self.inner_codec else {
                    bail!("Array seed storage requires an array descriptor")
                };
                anyhow::ensure!(
                    !self.inout && !array.caller_allocated,
                    "Array seed storage requires an ordinary array output"
                );
                let encoded = if independent {
                    array.encode_owned(env, seed)?
                } else {
                    array.encode(env, seed)?
                };
                let encoded = Self::bounded_seed(env, seed, encoded)?;
                if mode == ReferenceMode::ArrayBuffer {
                    anyhow::ensure!(
                        array.is_length_bounded(),
                        "Direct array storage requires an extent"
                    );
                    Ok(encoded)
                } else {
                    Self::indirect_storage(encoded)
                }
            }
        }
    }

    fn bounded_seed(
        env: &Env,
        seed: Unknown<'_>,
        encoded: ffi::Stash,
    ) -> anyhow::Result<ffi::Stash> {
        if let ffi::Stash::Ptr(ptr) = encoded
            && let Some(view) = value::TypedView::from_unknown(env, seed)?
        {
            let byte_len = view
                .length()
                .checked_mul(view.kind().element_size())
                .ok_or_else(|| anyhow::anyhow!("Reference view extent overflow"))?;
            return Ok(ffi::Stash::Storage(
                StashStorage::unit(ptr).with_reference_extent(byte_len),
            ));
        }
        Ok(encoded)
    }

    fn indirect_storage(encoded: ffi::Stash) -> anyhow::Result<ffi::Stash> {
        match encoded {
            ffi::Stash::Storage(storage) => Ok(Self::ptr_slot_stash(storage)),
            ffi::Stash::Ptr(ptr) => Ok(Self::slot_stash(ptr, None)),
            _ => bail!("Expected pointer storage for a non-scalar reference"),
        }
    }

    fn encode_fixed_bytes(value: Unknown<'_>, length: usize) -> anyhow::Result<ffi::Stash> {
        let Some(mut buffer) = super::bytes::read_bytes(value)? else {
            return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
        };
        anyhow::ensure!(
            length > 0 && buffer.len() == length,
            "Expected a fixed Ref<Bytes> buffer of {length} bytes"
        );
        CStr::from_bytes_until_nul(&buffer)?;
        let ptr = buffer.as_mut_ptr().cast::<c_void>();
        Ok(ffi::Stash::Storage(StashStorage::new(
            ptr,
            StashData::Buffer(buffer),
        )))
    }

    fn supports_async_output(codec: &Codec) -> bool {
        if !codec.transfer().is_borrowed() {
            return false;
        }
        match codec {
            Codec::Array(array) => Self::supports_async_output(&array.item_codec),
            Codec::HashTable(table) => {
                Self::supports_async_output(&table.key_codec)
                    && Self::supports_async_output(&table.value_codec)
            }
            _ => true,
        }
    }

    fn encode_scalar_storage(
        &self,
        value: Unknown<'_>,
        retain_for_async: bool,
    ) -> anyhow::Result<ffi::Stash> {
        if matches!(value.get_type()?, ValueType::Null | ValueType::Undefined) {
            return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
        }
        let handle: &External<crate::handle::Handle> = value::read_napi(value)?;
        let size = self
            .inner_codec
            .field_size()
            .ok_or_else(|| anyhow::anyhow!("The reference has no declared storage size"))?;
        let ptr = crate::api::handle_memory_range(handle, 0, size, "scalar reference")?;
        let retained = if retain_for_async {
            handle.retain_owned()?
        } else {
            (**handle).clone()
        };

        Ok(ffi::Stash::Storage(StashStorage::new(
            ptr,
            StashData::Handle(retained),
        )))
    }
}

impl Encoder for RefCodec {
    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        if self.inner_codec.is_scalar() {
            return self.encode_scalar_storage(value, false);
        }
        if matches!(value.get_type()?, ValueType::Null | ValueType::Undefined) {
            return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
        }
        let storage: &External<ReferenceStorage> = value::read_napi(value)?;
        storage.take(env, &self.identity, false)
    }

    fn encode_owned(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        if self.inner_codec.is_scalar() {
            self.encode_scalar_storage(value, true)
        } else if matches!(value.get_type()?, ValueType::Null | ValueType::Undefined) {
            Ok(ffi::Stash::Ptr(std::ptr::null_mut()))
        } else {
            anyhow::ensure!(
                Self::supports_async_output(&self.inner_codec),
                "Asynchronous reference outputs must borrow all native resources until completion"
            );
            let storage: &External<ReferenceStorage> = value::read_napi(value)?;
            storage.take(env, &self.identity, true)
        }
    }

    reject_return_codec!("Ref");
}

impl Decoder for RefCodec {
    unsafe fn read<'e>(&self, env: &'e Env, ctx: ReadCtx<'_>) -> anyhow::Result<Unknown<'e>> {
        let storage = match ctx.source {
            ReadSource::Call(stash) => {
                let Some(storage) = stash.as_storage_or_null("Ref")? else {
                    return Ok(value::js_null(env)?);
                };
                storage
            }
            ReadSource::Slot(ptr, _context) => {
                let inner_ptr = unsafe { ptr.cast::<*mut c_void>().read_unaligned() };
                if inner_ptr.is_null() {
                    return Ok(value::js_null(env)?);
                }
                return unsafe {
                    self.inner_codec.read(
                        env,
                        ReadCtx::slot(inner_ptr, "ref inner")
                            .with_transfer(self.inner_codec.transfer()),
                    )
                };
            }
            ReadSource::Value(..) => bail!("This codec cannot be read from pointer"),
        };

        if self.inner_codec.is_handle_backed() {
            let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
            return self.inner_codec.decode(env, &ffi::Stash::Ptr(actual_ptr));
        }

        match &*self.inner_codec {
            Codec::Bytes(bytes_codec) => Self::decode_ref_bytes(env, storage, bytes_codec),
            Codec::HashTable(_) => {
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                self.inner_codec.decode(env, &ffi::Stash::Ptr(actual_ptr))
            }
            Codec::Array(_) => {
                bail!("Ref<Array> requires decode_with_context to get size from another parameter")
            }
            scalar => unsafe {
                scalar.read(
                    env,
                    ReadCtx::slot(storage.ptr(), "Ref inner").with_transfer(scalar.transfer()),
                )
            },
        }
    }

    fn decode_with_context<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
    ) -> anyhow::Result<Unknown<'e>> {
        if let Codec::Array(array_codec) = &*self.inner_codec {
            let Some(storage) = stash.as_storage_or_null("Ref<Array>")? else {
                return Ok(value::js_null(env)?);
            };

            if array_codec.caller_allocated && array_codec.is_garray_container() {
                return array_codec.decode_with_context(env, stash, ffi_args, arg_codecs);
            }

            let actual_ptr = match storage.data() {
                StashData::PtrSlot(_, _) => unsafe { *(storage.ptr() as *const *mut c_void) },
                _ => storage.ptr(),
            };

            if actual_ptr.is_null() {
                return Ok(value::js_null(env)?);
            }

            let backing = match storage.data() {
                StashData::PtrSlot(_, Some(inner)) => Some(&**inner),
                StashData::PtrSlot(_, _) => None,
                _ => Some(storage),
            };
            let remaining = backing.and_then(|backing| {
                let byte_len = backing.byte_len()?;
                let offset = (actual_ptr as usize).checked_sub(backing.ptr() as usize)?;
                byte_len.checked_sub(offset)
            });
            if let Some(byte_len) = remaining
                && let Some(extent) = array_codec.replacement_extent(ffi_args, arg_codecs)?
            {
                let bytes = extent
                    .checked_mul(array_codec.element_stride()?)
                    .ok_or_else(|| anyhow::anyhow!("Reference array extent overflow"))?;
                anyhow::ensure!(
                    bytes <= byte_len,
                    "Reference array output exceeds its capacity: {bytes} bytes requested, {byte_len} available"
                );
            }

            let ptr_stash = ffi::Stash::Ptr(actual_ptr);
            let same_input = matches!(
                storage.data(),
                StashData::PtrSlot(_, Some(inner)) if inner.ptr() == actual_ptr
            );
            let input_codec = same_input.then(|| self.inout_array_input()).flatten();
            let result = input_codec
                .as_ref()
                .unwrap_or(array_codec)
                .decode_with_context(env, &ptr_stash, ffi_args, arg_codecs);

            if matches!(storage.data(), StashData::PtrSlot(_, _))
                && array_codec.ownership.is_full()
                && array_codec.is_length_bounded()
            {
                unsafe { glib::ffi::g_free(actual_ptr) };
            }

            return result;
        }

        self.decode(env, stash)
    }
}

impl PtrWriter for RefCodec {}

impl RefCodec {
    fn null_ptr_stash() -> ffi::Stash {
        Self::slot_stash(std::ptr::null_mut(), None)
    }

    fn ptr_slot_stash(inner: StashStorage) -> ffi::Stash {
        Self::slot_stash(inner.ptr(), Some(Box::new(inner)))
    }

    fn slot_stash(target: *mut c_void, inner: Option<Box<StashStorage>>) -> ffi::Stash {
        let mut slot: Vec<*mut c_void> = vec![target];
        let ptr = slot.as_mut_ptr().cast::<c_void>();
        ffi::Stash::Storage(StashStorage::new(ptr, StashData::PtrSlot(slot, inner)))
    }

    fn decode_ref_bytes<'e>(
        env: &'e Env,
        storage: &StashStorage,
        bytes_codec: &super::BytesCodec,
    ) -> anyhow::Result<Unknown<'e>> {
        if storage.ptr().is_null() {
            return Ok(value::js_null(env)?);
        }

        if let StashData::Buffer(buffer) = storage.data() {
            let source = CStr::from_bytes_until_nul(buffer)?.to_bytes();
            let bytes = unsafe { value::js_byte_array(env, source.as_ptr(), source.len()) };
            Ok(bytes?)
        } else {
            let str_ptr = unsafe { *(storage.ptr() as *const *const c_char) };
            if str_ptr.is_null() {
                return Ok(value::js_null(env)?);
            }
            let source = unsafe { CStr::from_ptr(str_ptr) }.to_bytes();
            let bytes = unsafe { value::js_byte_array(env, source.as_ptr(), source.len()) };

            if bytes_codec.ownership.is_full() {
                unsafe { glib::ffi::g_free(str_ptr as *mut c_void) };
            }

            Ok(bytes?)
        }
    }
}
