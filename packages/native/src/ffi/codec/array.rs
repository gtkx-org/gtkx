use std::ffi::CString;

use anyhow::bail;

use super::prelude::*;
use super::string::str_to_glib_full;
use crate::ffi::codec::{Codec, FloatCodec};
use crate::ffi::value::TypedView;

pub use container::ArrayKind;

use container::{ArrayContainer, ArrayContainerCodec};
use item::ItemCodec;

mod byte_array;
mod container;
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
    pub(crate) container: ArrayContainerCodec,
}

impl ArrayCodec {
    pub fn new(
        item_codec: Box<Codec>,
        kind: ArrayKind,
        ownership: Ownership,
        size_param_index: Option<u32>,
        fixed_size: Option<u32>,
        element_size: Option<usize>,
    ) -> anyhow::Result<Self> {
        Ok(Self {
            item_codec,
            ownership,
            element_size,
            container: ArrayContainerCodec::from_kind(kind, size_param_index, fixed_size)?,
        })
    }

    pub(crate) fn is_length_bounded(&self) -> bool {
        self.container.is_length_bounded()
    }

    pub(crate) fn ptr_array_item(&self) -> Option<Box<Codec>> {
        matches!(self.container, ArrayContainerCodec::PtrArray(_)).then(|| self.item_codec.clone())
    }
}

pub(super) fn build_js_array<'e>(
    env: &'e Env,
    items: Vec<Unknown<'e>>,
) -> anyhow::Result<Unknown<'e>> {
    Ok(value::js_array(env, items)?)
}

pub(super) fn read_string_item(env: &Env, value: Unknown<'_>) -> anyhow::Result<String> {
    match value.get_type()? {
        ValueType::String => Ok(value::read_napi::<String>(env, value)?),
        other => bail!("Expected a String, got {other:?}"),
    }
}

impl Encoder for ArrayCodec {
    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        if value.is_array()? {
            let array: Array = value::read_napi(env, value)?;
            let len = array.len();
            let mut items = Vec::with_capacity(len as usize);
            for i in 0..len {
                let item: Unknown = array
                    .get(i)?
                    .ok_or_else(|| anyhow::anyhow!("array element {i} is missing"))?;
                items.push(item);
            }
            return self.container.encode(self, env, &items);
        }
        if let Some(view) = TypedView::from_unknown(env, value)? {
            return self.container.encode_buffer_view(self, &view);
        }
        match value.get_type()? {
            ValueType::Null | ValueType::Undefined => Ok(ffi::Stash::Ptr(std::ptr::null_mut())),
            _ => bail_expected!("an Array", "array"),
        }
    }
}

impl Decoder for ArrayCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.container.decode(self, env, stash)
    }

    unsafe fn read_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<Unknown<'e>> {
        if ptr.is_null() {
            return build_js_array(env, Vec::new());
        }
        self.decode_call(env, &ffi::Stash::Ptr(ptr))
    }

    fn decode_with_context<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
    ) -> anyhow::Result<Unknown<'e>> {
        self.container
            .decode_with_context(self, env, stash, ffi_args, arg_codecs)
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
}

pub(super) fn dup_strings_to_glib(
    env: &Env,
    array: &[Unknown<'_>],
) -> anyhow::Result<Vec<*mut c_void>> {
    let mut ptrs: Vec<*mut c_void> = Vec::with_capacity(array.len());
    for &v in array {
        let duplicated = read_string_item(env, v).and_then(|s| str_to_glib_full(&s));
        match duplicated {
            Ok(ptr) => ptrs.push(ptr as *mut c_void),
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
        env: &Env,
        array: &[Unknown<'_>],
        dup_items: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash>;

    fn encode_handles(
        &self,
        handles: &[crate::handle::Handle],
        item_codec: &Codec,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::Stash>;
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
    fn extract_numbers(env: &Env, array: &[Unknown<'_>]) -> anyhow::Result<Vec<f64>> {
        array
            .iter()
            .map(|&v| match v.get_type()? {
                ValueType::Number => Ok(value::read_napi::<f64>(env, v)?),
                other => bail!("Expected a Number, got {other:?}"),
            })
            .collect()
    }

    fn extract_booleans(env: &Env, array: &[Unknown<'_>]) -> anyhow::Result<Vec<i32>> {
        array
            .iter()
            .map(|&v| match v.get_type()? {
                ValueType::Boolean => Ok(i32::from(value::read_napi::<bool>(env, v)?)),
                other => bail!("Expected a Boolean, got {other:?}"),
            })
            .collect()
    }

    fn extract_strings(env: &Env, array: &[Unknown<'_>]) -> anyhow::Result<Vec<CString>> {
        array
            .iter()
            .map(|&v| Ok(CString::new(read_string_item(env, v)?.as_bytes())?))
            .collect()
    }

    fn extract_handles(
        env: &Env,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<Vec<crate::handle::Handle>> {
        array
            .iter()
            .map(|&v| {
                let ptr = value::handle_ptr(env, v, "array element")?;
                Ok(crate::handle::Handle::from_glib_borrow(ptr))
            })
            .collect()
    }

    fn item_element_size(&self) -> Option<usize> {
        ItemCodec::from_codec(&self.item_codec).map(ItemCodec::element_size)
    }

    fn item_codec(&self, context: &str) -> anyhow::Result<ItemCodec> {
        ItemCodec::from_codec(&self.item_codec).ok_or_else(|| {
            anyhow::anyhow!("Unsupported {context} item codec: {:?}", self.item_codec)
        })
    }

    fn encode_items(
        &self,
        env: &Env,
        encoder: &dyn ArrayKindEncoder,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        self.encode_items_with_terminator(env, encoder, array, false)
    }

    fn encode_zero_terminated_items(
        &self,
        env: &Env,
        encoder: &dyn ArrayKindEncoder,
        array: &[Unknown<'_>],
    ) -> anyhow::Result<ffi::Stash> {
        self.encode_items_with_terminator(env, encoder, array, true)
    }

    fn extract_terminated_numbers(
        env: &Env,
        array: &[Unknown<'_>],
        zero_terminated: bool,
    ) -> anyhow::Result<Vec<f64>> {
        let mut numbers = Self::extract_numbers(env, array)?;
        if zero_terminated {
            numbers.push(0.0);
        }
        Ok(numbers)
    }

    fn encode_items_with_terminator(
        &self,
        env: &Env,
        encoder: &dyn ArrayKindEncoder,
        array: &[Unknown<'_>],
        zero_terminated: bool,
    ) -> anyhow::Result<ffi::Stash> {
        match self.item_codec("array")? {
            ItemCodec::Integer(kind) => Ok(ffi::Stash::Storage(kind.checked_to_stash_storage(
                &Self::extract_terminated_numbers(env, array, zero_terminated)?,
            )?)),
            ItemCodec::EnumFlags(kind) => Ok(ffi::Stash::Storage(kind.to_stash_storage(
                &Self::extract_terminated_numbers(env, array, zero_terminated)?,
            ))),
            ItemCodec::BigInt(kind) => {
                let storage = if zero_terminated {
                    let mut items = array.to_vec();
                    items.push(0f64.into_unknown(env)?);
                    kind.to_stash_storage(env, &items)?
                } else {
                    kind.to_stash_storage(env, array)?
                };
                Ok(ffi::Stash::Storage(storage))
            }
            ItemCodec::Float(kind) => Ok(ffi::Stash::Storage(kind.checked_to_stash_storage(
                &Self::extract_terminated_numbers(env, array, zero_terminated)?,
            )?)),
            ItemCodec::Boolean => {
                let mut booleans = Self::extract_booleans(env, array)?;
                if zero_terminated {
                    booleans.push(0);
                }
                Ok(ffi::Stash::Storage(booleans.into()))
            }
            ItemCodec::String => {
                let dup_items =
                    matches!(&*self.item_codec, Codec::String(s) if s.ownership.is_full());
                encoder.encode_strings(env, array, dup_items, self.ownership)
            }
            ItemCodec::Pointer => {
                let handles = Self::extract_handles(env, array)?;

                if let Some(element_size) = self.element_size {
                    let mut buffer = vec![0u8; handles.len() * element_size];
                    for (i, handle) in handles.iter().enumerate() {
                        let ptr = handle.as_ptr();
                        if ptr.is_null() {
                            bail!("GObject in array has a null pointer");
                        }
                        let offset = i * element_size;
                        unsafe {
                            std::ptr::copy_nonoverlapping(
                                ptr as *const u8,
                                buffer.as_mut_ptr().add(offset),
                                element_size,
                            );
                        }
                    }
                    return Ok(ffi::Stash::Storage(buffer.into()));
                }

                encoder.encode_handles(&handles, &self.item_codec, self.ownership)
            }
        }
    }

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
            ItemCodec::Pointer | ItemCodec::String => {
                let ptrs = unsafe { std::slice::from_raw_parts(data.cast::<*mut c_void>(), len) };
                ptrs.iter()
                    .map(|&item_ptr| self.item_codec.decode(env, &ffi::Stash::Ptr(item_ptr)))
                    .collect()
            }
        }
    }

    fn buffer_view_passthrough(
        &self,
        view: &TypedView,
        expected_length: Option<usize>,
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
        Ok(ffi::Stash::Ptr(view.ptr()))
    }

    fn decode_ptr_iter<'e>(
        &self,
        env: &'e Env,
        ptrs: impl Iterator<Item = *mut c_void>,
        release: impl FnOnce(),
    ) -> anyhow::Result<Unknown<'e>> {
        let mut values = Vec::with_capacity(ptrs.size_hint().0);
        let result = ptrs.into_iter().try_for_each(|item_ptr| {
            values.push(self.item_codec.decode(env, &ffi::Stash::Ptr(item_ptr))?);
            anyhow::Ok(())
        });
        release();
        result?;
        build_js_array(env, values)
    }
}
