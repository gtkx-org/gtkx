use std::ffi::CString;

use anyhow::bail;
pub use container::{ArrayBounds, ArrayKind};
use container::{ArrayContainer, ArrayContainerCodec, ViewEncoding};
use item::ItemCodec;

use super::prelude::*;
use super::string::str_to_glib_full;
use crate::ffi::codec::{Codec, FloatCodec, lossless_f64};
use crate::value::TypedView;

mod byte_array;
mod container;
mod cursor;
mod fixed;
mod garray;
mod item;
mod list;
mod null_terminated;
mod ptr_array;
mod sized;

#[derive(Debug, Clone)]
pub struct ArrayCodec {
    pub item_codec: Box<Codec>,
    pub ownership: Ownership,
    pub element_size: Option<usize>,
    pub(crate) is_bytes: bool,
    pub(crate) null_decoding: NullArrayDecoding,
    pub(crate) caller_allocated: bool,
    pub(crate) zero_terminated: bool,
    pub(crate) container: ArrayContainerCodec,
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum NullArrayDecoding {
    Empty,
    Null,
}

impl ArrayCodec {
    pub fn new(
        item_codec: Box<Codec>,
        kind: ArrayKind,
        ownership: Ownership,
        bounds: ArrayBounds,
        element_size: Option<usize>,
        is_bytes: bool,
        preserve_null: bool,
    ) -> anyhow::Result<Self> {
        anyhow::ensure!(
            !is_bytes || ItemCodec::from_codec(&item_codec).is_some_and(ItemCodec::is_byte),
            "A byte array descriptor needs a u8 item codec, got {item_codec:?}"
        );

        Ok(Self {
            item_codec,
            ownership,
            element_size,
            is_bytes,
            null_decoding: if preserve_null {
                NullArrayDecoding::Null
            } else {
                NullArrayDecoding::Empty
            },
            caller_allocated: false,
            zero_terminated: false,
            container: ArrayContainerCodec::from_kind(kind, bounds)?,
        })
    }

    /// Marks a length-bounded array whose GIR also declares `zero-terminated=1`. The callee takes
    /// its count from the length argument but may still walk to the terminating zero element, so
    /// the encoded buffer carries one zero element past the declared length.
    #[must_use]
    pub fn zero_terminated(mut self) -> Self {
        self.zero_terminated = true;
        self
    }

    /// Marks the array as a caller-allocated out parameter: the runtime allocates the buffer the
    /// callee fills in, sized as the element stride times the fixed element count.
    pub fn caller_allocated(mut self) -> anyhow::Result<Self> {
        anyhow::ensure!(
            self.container.fixed_extent().is_some(),
            "A caller-allocated array descriptor needs a fixed size"
        );
        self.element_stride()?;
        self.caller_allocated = true;
        Ok(self)
    }

    pub(crate) fn caller_allocation_len(&self) -> anyhow::Result<Option<usize>> {
        if !self.caller_allocated {
            return Ok(None);
        }
        let Some(extent) = self.container.fixed_extent() else {
            bail!("A caller-allocated array descriptor needs a fixed size");
        };
        let slots = extent + usize::from(self.zero_terminated);
        Ok(Some(self.element_stride()? * slots))
    }

    pub(crate) fn is_length_bounded(&self) -> bool {
        self.container.is_length_bounded()
    }

    pub(crate) fn ptr_array_item(&self) -> Option<Box<Codec>> {
        matches!(self.container, ArrayContainerCodec::PtrArray(_)).then(|| self.item_codec.clone())
    }

    fn container_release(&self) -> ffi::ReleaseKind {
        match &*self.item_codec {
            Codec::String(item) if item.ownership.is_full() => ffi::ReleaseKind::StrFreeV,
            _ => ffi::ReleaseKind::GFree,
        }
    }
}

pub(super) fn build_js_array<'e>(
    env: &'e Env,
    items: Vec<Unknown<'e>>,
) -> anyhow::Result<Unknown<'e>> {
    Ok(value::js_array(env, items)?)
}

pub(super) fn read_string_item(value: Unknown<'_>) -> anyhow::Result<String> {
    match value.get_type()? {
        ValueType::String => Ok(value::read_napi::<String>(value)?),
        other => bail!("Expected a String, got {other:?}"),
    }
}

impl Encoder for ArrayCodec {
    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        if value.is_array()? {
            let array: Array<'_> = value::read_napi(value)?;
            let len = array.len();
            let mut items = Vec::with_capacity(len as usize);
            for i in 0..len {
                let item: Unknown<'_> = array
                    .get(i)?
                    .ok_or_else(|| anyhow::anyhow!("array element {i} is missing"))?;
                items.push(item);
            }
            return self.container.encode(self, *env, &items);
        }
        if let Some(view) = TypedView::from_unknown(env, value)? {
            return self
                .container
                .encode_buffer_view(self, &view, ViewEncoding::Passthrough);
        }
        match value.get_type()? {
            ValueType::Null | ValueType::Undefined => Ok(ffi::Stash::Ptr(std::ptr::null_mut())),
            _ => bail_expected!("an Array", "array"),
        }
    }

    fn encode_owned(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        match TypedView::from_unknown(env, value)? {
            Some(view) => self
                .container
                .encode_buffer_view(self, &view, ViewEncoding::Copy),
            None => self.encode(env, value),
        }
    }
}

impl Decoder for ArrayCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.container.decode(self, env, stash, self.ownership)
    }

    unsafe fn read_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        _context: &str,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        if ptr.is_null() {
            return self.decode_null(env);
        }
        self.container
            .decode(self, env, &ffi::Stash::Ptr(ptr), transfer)
    }

    fn decode_with_context<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
    ) -> anyhow::Result<Unknown<'e>> {
        self.container
            .decode_with_context(self, env, stash, ffi_args, arg_codecs, self.ownership)
    }
}

impl PtrWriter for ArrayCodec {
    fn write_return_to_ptr(
        &self,
        env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        let container =
            encode_and_leak_container(value, "array vfunc return", |v| self.encode(env, v));
        unsafe { ret.store(container) };
    }

    write_container_value_to_ptr!("array", "array pointer write", Self::container_release);
}

pub(super) fn dup_strings_to_glib(array: &[Unknown<'_>]) -> anyhow::Result<Vec<*mut c_void>> {
    let mut ptrs: Vec<*mut c_void> = Vec::with_capacity(array.len());
    for &v in array {
        let duplicated = read_string_item(v).and_then(|s| str_to_glib_full(&s));
        match duplicated {
            Ok(ptr) => ptrs.push(ptr.cast::<c_void>()),
            Err(err) => {
                for ptr in ptrs {
                    unsafe { glib::ffi::g_free(ptr) };
                }
                return Err(err);
            }
        }
    }
    Ok(ptrs)
}

trait ArrayKindEncoder {
    fn encode_strings(
        &self,
        array: &[Unknown<'_>],
        dup_items: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash>;

    fn encode_handles(
        &self,
        handles: Vec<crate::handle::Handle>,
        item_codec: &Codec,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash>;

    /// Whether this container holds one pointer per slot, so that a whole-number element is
    /// packed into the slot itself rather than into a contiguous buffer of its own width.
    fn holds_pointer_slots(&self) -> bool {
        false
    }

    /// Packs the elements into the container's own pointer-sized slots, and is only called
    /// when `holds_pointer_slots` reports that the container has them.
    fn encode_pointer_words(
        &self,
        _words: Vec<*mut c_void>,
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash> {
        unreachable!("a container without pointer slots is never asked to fill them")
    }
}

/// Packs a whole number into a pointer-sized slot the way `GINT_TO_POINTER` does, keeping the
/// sign so that a negative element survives the round trip through a `GList` node.
#[allow(clippy::cast_possible_truncation)]
fn pointer_word(value: f64) -> *mut c_void {
    value as isize as *mut c_void
}

fn release_transfers(transfers: Vec<ffi::PendingTransfer>) {
    for transfer in transfers {
        transfer.release_now();
    }
}

fn transfer_items(
    handles: &[crate::handle::Handle],
    item_codec: &Codec,
    context: &str,
) -> anyhow::Result<(Vec<*mut c_void>, Vec<ffi::PendingTransfer>)> {
    let mut ptrs = Vec::with_capacity(handles.len() + 1);
    let mut acquired: Vec<ffi::PendingTransfer> = Vec::new();
    for handle in handles {
        let ptr = handle.as_ptr();
        if ptr.is_null() {
            release_transfers(acquired);
            bail!("GObject in {context} has a null pointer");
        }
        let element = match unsafe { item_codec.ref_for_transfer(ptr) } {
            Ok(element) => element,
            Err(err) => {
                release_transfers(acquired);
                return Err(err);
            }
        };
        if let Some(release) = item_codec.transfer_release() {
            acquired.push(ffi::PendingTransfer::new(element, release));
        }
        ptrs.push(element);
    }
    Ok((ptrs, acquired))
}

impl ArrayCodec {
    fn extract_numbers(array: &[Unknown<'_>]) -> anyhow::Result<Vec<f64>> {
        array
            .iter()
            .map(|&v| match v.get_type()? {
                ValueType::Number => Ok(value::read_napi::<f64>(v)?),
                other => bail!("Expected a Number, got {other:?}"),
            })
            .collect()
    }

    fn extract_codepoints(array: &[Unknown<'_>]) -> anyhow::Result<Vec<u32>> {
        array
            .iter()
            .map(|&v| super::unichar::codepoint_from_value(v))
            .collect()
    }

    fn extract_booleans(array: &[Unknown<'_>]) -> anyhow::Result<Vec<i32>> {
        array
            .iter()
            .map(|&v| match v.get_type()? {
                ValueType::Boolean => Ok(i32::from(value::read_napi::<bool>(v)?)),
                other => bail!("Expected a Boolean, got {other:?}"),
            })
            .collect()
    }

    fn extract_strings(array: &[Unknown<'_>]) -> anyhow::Result<Vec<CString>> {
        array
            .iter()
            .map(|&v| Ok(CString::new(read_string_item(v)?.as_bytes())?))
            .collect()
    }

    fn extract_handles(array: &[Unknown<'_>]) -> anyhow::Result<Vec<crate::handle::Handle>> {
        array
            .iter()
            .map(|&v| {
                let ptr = value::handle_ptr(v, "array element")?;
                Ok(crate::handle::Handle::from_glib_borrow(ptr))
            })
            .collect()
    }

    fn item_element_size(&self) -> Option<usize> {
        ItemCodec::from_codec(&self.item_codec).map(ItemCodec::element_size)
    }

    pub(super) fn inline_element_size(&self) -> Option<usize> {
        if !self.item_codec.is_handle_backed() {
            return None;
        }

        self.element_size
    }

    pub(super) fn element_stride(&self) -> anyhow::Result<usize> {
        self.inline_element_size()
            .or_else(|| self.item_element_size())
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "Unsupported item codec for a stride-based array: {:?}",
                    self.item_codec
                )
            })
    }

    pub(super) fn inline_element_buffer(
        stride: usize,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<Vec<u8>> {
        let handles = Self::extract_handles(array)?;
        let mut buffer = vec![0u8; handles.len() * stride];
        for (index, handle) in handles.iter().enumerate() {
            let ptr = handle.as_ptr();
            if ptr.is_null() {
                bail!("An inline array element has a null pointer");
            }
            unsafe {
                std::ptr::copy_nonoverlapping(
                    ptr.cast::<u8>().cast_const(),
                    buffer.as_mut_ptr().add(index * stride),
                    stride,
                );
            }
        }

        Ok(buffer)
    }

    pub(super) fn decode_inline<'e>(
        &self,
        env: &'e Env,
        stride: usize,
        data: *const u8,
        len: usize,
    ) -> anyhow::Result<Vec<Unknown<'e>>> {
        value::checked_array_length(len)?;

        (0..len)
            .map(|index| unsafe {
                self.item_codec.read(
                    env,
                    ReadCtx::value(data.add(index * stride).cast_mut().cast(), "array element"),
                )
            })
            .collect()
    }

    pub(crate) fn decode_empty_sequence<'e>(&self, env: &'e Env) -> anyhow::Result<Unknown<'e>> {
        if self.is_bytes {
            return Ok(unsafe { value::js_byte_array(env, std::ptr::null(), 0) }?);
        }

        build_js_array(env, Vec::new())
    }

    pub(crate) fn decode_null<'e>(&self, env: &'e Env) -> anyhow::Result<Unknown<'e>> {
        if matches!(self.null_decoding, NullArrayDecoding::Null) {
            return Ok(value::js_null(env)?);
        }

        self.decode_empty_sequence(env)
    }

    pub(crate) fn decode_bytes_or_items<'e>(
        &self,
        env: &'e Env,
        data: *const u8,
        len: usize,
        context: &str,
    ) -> anyhow::Result<Unknown<'e>> {
        if self.is_bytes {
            return Ok(unsafe { value::js_byte_array(env, data, len) }?);
        }

        let values = self.decode_contiguous(env, self.item_codec(context)?, data, len)?;

        build_js_array(env, values)
    }

    fn item_codec(&self, context: &str) -> anyhow::Result<ItemCodec> {
        ItemCodec::from_codec(&self.item_codec).ok_or_else(|| {
            anyhow::anyhow!("Unsupported {context} item codec: {:?}", self.item_codec)
        })
    }

    fn encode_items(
        &self,
        env: Env,
        encoder: &dyn ArrayKindEncoder,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        self.encode_items_with_terminator(env, encoder, array, self.zero_terminated)
    }

    fn encode_zero_terminated_items(
        &self,
        env: Env,
        encoder: &dyn ArrayKindEncoder,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        self.encode_items_with_terminator(env, encoder, array, true)
    }

    fn extract_terminated_numbers(
        array: &[Unknown<'_>],
        zero_terminated: bool,
    ) -> anyhow::Result<Vec<f64>> {
        let mut numbers = Self::extract_numbers(array)?;
        if zero_terminated {
            numbers.push(0.0);
        }
        Ok(numbers)
    }

    fn finish_scalars<T>(
        &self,
        encoder: &dyn ArrayKindEncoder,
        items: Vec<T>,
        word: impl Fn(&T) -> *mut c_void,
        storage: impl FnOnce(Vec<T>) -> anyhow::Result<ffi::StashStorage>,
    ) -> anyhow::Result<ffi::Stash> {
        if encoder.holds_pointer_slots() {
            let words = items.iter().map(word).collect();

            return encoder.encode_pointer_words(words, self.ownership);
        }

        self.finish_scalar_storage(storage(items)?)
    }

    fn finish_scalar_storage(&self, storage: ffi::StashStorage) -> anyhow::Result<ffi::Stash> {
        if self.ownership.is_borrowed() {
            return Ok(ffi::Stash::Storage(storage));
        }
        let byte_len = storage
            .byte_len()
            .ok_or_else(|| anyhow::anyhow!("Scalar array storage has no measurable byte length"))?;
        let container = unsafe { glib::ffi::g_memdup2(storage.ptr().cast_const(), byte_len) };
        Ok(full_transfer_stash(container, ffi::ReleaseKind::GFree))
    }

    fn encode_items_with_terminator(
        &self,
        env: Env,
        encoder: &dyn ArrayKindEncoder,
        array: &[Unknown<'_>],
        zero_terminated: bool,
    ) -> anyhow::Result<ffi::Stash> {
        match self.item_codec("array")? {
            ItemCodec::Integer(kind) => {
                let numbers = Self::extract_terminated_numbers(array, zero_terminated)?;
                for (i, &value) in numbers.iter().enumerate() {
                    kind.checked_to_stash(value)
                        .map_err(|e| anyhow::anyhow!("Array element {i}: {e}"))?;
                }

                self.finish_scalars(
                    encoder,
                    numbers,
                    |&value| pointer_word(value),
                    |numbers| kind.checked_to_stash_storage(&numbers),
                )
            }
            ItemCodec::EnumFlags(kind) => {
                let numbers = Self::extract_terminated_numbers(array, zero_terminated)?;

                self.finish_scalars(
                    encoder,
                    numbers,
                    |&value| pointer_word(value),
                    |numbers| Ok(kind.to_stash_storage(&numbers)),
                )
            }
            ItemCodec::BigInt(kind) => {
                if encoder.holds_pointer_slots() {
                    return encoder
                        .encode_pointer_words(kind.to_pointer_words(array)?, self.ownership);
                }

                let storage = if zero_terminated {
                    let mut items = array.to_vec();
                    items.push(0f64.into_unknown(&env)?);
                    kind.to_stash_storage(&items)?
                } else {
                    kind.to_stash_storage(array)?
                };
                self.finish_scalar_storage(storage)
            }
            ItemCodec::Float(kind) => self.finish_scalar_storage(kind.checked_to_stash_storage(
                &Self::extract_terminated_numbers(array, zero_terminated)?,
            )?),
            ItemCodec::Boolean => {
                let mut booleans = Self::extract_booleans(array)?;
                if zero_terminated {
                    booleans.push(0);
                }

                self.finish_scalars(
                    encoder,
                    booleans,
                    |&value| pointer_word(f64::from(value)),
                    |booleans| Ok(booleans.into()),
                )
            }
            ItemCodec::Unichar => {
                let mut codepoints = Self::extract_codepoints(array)?;
                if zero_terminated {
                    codepoints.push(0);
                }

                self.finish_scalars(
                    encoder,
                    codepoints,
                    |&value| pointer_word(f64::from(value)),
                    |codepoints| Ok(codepoints.into()),
                )
            }
            ItemCodec::String => {
                let dup_items =
                    matches!(&*self.item_codec, Codec::String(s) if s.ownership.is_full());
                encoder.encode_strings(array, dup_items, self.ownership)
            }
            ItemCodec::Pointer => {
                if let Some(element_size) = self.inline_element_size() {
                    let buffer = Self::inline_element_buffer(element_size, array)?;
                    return self.finish_scalar_storage(buffer.into());
                }

                encoder.encode_handles(
                    Self::extract_handles(array)?,
                    &self.item_codec,
                    self.ownership,
                )
            }
        }
    }

    #[allow(clippy::cast_ptr_alignment)]
    fn decode_contiguous<'e>(
        &self,
        env: &'e Env,
        codec: ItemCodec,
        data: *const u8,
        len: usize,
    ) -> anyhow::Result<Vec<Unknown<'e>>> {
        if len == 0 || data.is_null() {
            return Ok(Vec::new());
        }
        if let Some(stride) = self.inline_element_size() {
            return self.decode_inline(env, stride, data, len);
        }
        value::checked_array_length(len)?;

        let numbers_to_unknowns = |numbers: Vec<f64>| -> anyhow::Result<Vec<Unknown<'e>>> {
            numbers
                .into_iter()
                .map(|n| Ok(n.into_unknown(env)?))
                .collect()
        };
        match codec {
            ItemCodec::Integer(kind) => {
                numbers_to_unknowns(unsafe { kind.checked_read_slice(data, len, "array element") }?)
            }
            ItemCodec::EnumFlags(kind) => {
                numbers_to_unknowns(unsafe { kind.read_slice(data, len) })
            }
            ItemCodec::BigInt(kind) => unsafe { kind.read_slice(data, len) }
                .into_iter()
                .map(|v| super::bigint::bigint_to_unknown(env, v))
                .collect(),
            ItemCodec::Float(FloatCodec::F32) => {
                unsafe { std::slice::from_raw_parts(data.cast::<f32>(), len) }
                    .iter()
                    .map(|&v| Ok(f64::from(v).into_unknown(env)?))
                    .collect()
            }
            ItemCodec::Float(FloatCodec::F64) => {
                unsafe { std::slice::from_raw_parts(data.cast::<f64>(), len) }
                    .iter()
                    .map(|&v| Ok(v.into_unknown(env)?))
                    .collect()
            }
            ItemCodec::Boolean => unsafe { std::slice::from_raw_parts(data.cast::<i32>(), len) }
                .iter()
                .map(|&v| Ok((v != 0).into_unknown(env)?))
                .collect(),
            ItemCodec::Unichar => (0..len)
                .map(|index| unsafe {
                    self.item_codec.read(
                        env,
                        ReadCtx::slot(
                            data.add(index * size_of::<u32>()).cast::<c_void>(),
                            "array element",
                        ),
                    )
                })
                .collect(),
            ItemCodec::Pointer | ItemCodec::String => {
                let ptrs = unsafe { std::slice::from_raw_parts(data.cast::<*mut c_void>(), len) };
                ptrs.iter()
                    .map(|&item_ptr| self.item_codec.decode(env, &ffi::Stash::Ptr(item_ptr)))
                    .collect()
            }
        }
    }

    fn buffer_view_stash(
        &self,
        view: &TypedView,
        expected_length: Option<usize>,
        encoding: ViewEncoding,
    ) -> anyhow::Result<ffi::Stash> {
        anyhow::ensure!(
            self.ownership.is_borrowed(),
            "A transfer-full array argument cannot be encoded from an ArrayBufferView: the callee would free the JavaScript buffer"
        );
        if let Some(length) = expected_length {
            anyhow::ensure!(
                view.length() == length,
                "Expected a view of exactly {length} elements for a fixed-size array, got {}",
                view.length()
            );
        }
        let codec = self.item_codec("array")?;
        anyhow::ensure!(
            codec.accepts_buffer_view(view.kind()),
            "A {} cannot supply {} array elements",
            view.kind(),
            self.item_codec
        );
        if self.zero_terminated {
            // The terminator cannot be written into the JavaScript buffer, so a zero-terminated
            // array always hands the callee a copy carrying one zero element past the view.
            return Ok(ffi::Stash::Storage(terminated_view_storage(view)));
        }
        Ok(match encoding {
            ViewEncoding::Passthrough => ffi::Stash::Ptr(view.ptr()),
            ViewEncoding::Copy => ffi::Stash::Storage(owned_view_storage(view)),
        })
    }

    fn decode_ptr_item<'e>(
        &self,
        env: &'e Env,
        item_ptr: *mut c_void,
    ) -> anyhow::Result<Unknown<'e>> {
        if matches!(&*self.item_codec, Codec::BigInt(_)) {
            return unsafe {
                self.item_codec
                    .read(env, ReadCtx::value(item_ptr, "pointer array element"))
            };
        }

        // A container whose nodes hold one pointer each stores a whole-number element in the
        // slot itself, the way `GPOINTER_TO_INT` reads it back, rather than pointing at it.
        if let Some(stash) = self.pointer_word_stash(item_ptr)? {
            return self.item_codec.decode(env, &stash);
        }

        self.item_codec.decode(env, &ffi::Stash::Ptr(item_ptr))
    }

    fn pointer_word_stash(&self, item_ptr: *mut c_void) -> anyhow::Result<Option<ffi::Stash>> {
        let word = item_ptr as isize;

        Ok(match ItemCodec::from_codec(&self.item_codec) {
            Some(ItemCodec::Integer(kind) | ItemCodec::EnumFlags(kind)) => {
                Some(kind.checked_to_stash(lossless_f64(word as i128, "list element")?)?)
            }
            Some(ItemCodec::Boolean) => Some(ffi::Stash::I32(i32::from(word != 0))),
            Some(ItemCodec::Unichar) => {
                Some(ffi::Stash::U32(u32::try_from(word).map_err(|_| {
                    anyhow::anyhow!("List element {word} is not a valid Unicode code point")
                })?))
            }
            _ => None,
        })
    }

    fn decode_ptr_iter<'e>(
        &self,
        env: &'e Env,
        ptrs: impl Iterator<Item = *mut c_void>,
        release: impl FnOnce(),
    ) -> anyhow::Result<Unknown<'e>> {
        let mut values = Vec::with_capacity(ptrs.size_hint().0);
        let result = ptrs.into_iter().try_for_each(|item_ptr| {
            values.push(self.decode_ptr_item(env, item_ptr)?);
            anyhow::Ok(())
        });
        release();
        result?;
        build_js_array(env, values)
    }
}
