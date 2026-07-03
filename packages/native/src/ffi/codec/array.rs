use std::ffi::CString;

use anyhow::bail;

use super::prelude::*;
use super::string::str_to_glib_full;
use crate::ffi::codec::{Codec, FloatCodec};

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

impl Encoder for ArrayCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        match value {
            value::Value::Array(array) => self.container.encode(self, array),
            value::Value::BufferView(view) => self.container.encode_buffer_view(self, view),
            value::Value::Null | value::Value::Undefined => {
                Ok(ffi::Stash::Ptr(std::ptr::null_mut()))
            }
            _ => bail_expected!("an Array", "array", value),
        }
    }
}

impl Decoder for ArrayCodec {
    fn decode_call(&self, stash: &ffi::Stash) -> anyhow::Result<value::Value> {
        self.container.decode(self, stash)
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }
        self.decode_call(&ffi::Stash::Ptr(ptr))
    }

    fn decode_with_context(
        &self,
        stash: &ffi::Stash,
        ffi_args: &[ffi::Stash],
        arg_codecs: &[Codec],
    ) -> anyhow::Result<value::Value> {
        self.container
            .decode_with_context(self, stash, ffi_args, arg_codecs)
    }
}

impl PtrWriter for ArrayCodec {
    fn write_return_to_ptr(&self, ret: ffi::Slot, value: &std::result::Result<value::Value, ()>) {
        let container = encode_and_leak_container(value, "array vfunc return", |v| self.encode(v));
        unsafe { ret.store(container) };
    }
}

fn dup_strings_to_glib(array: &[value::Value]) -> anyhow::Result<Vec<*mut c_void>> {
    let mut ptrs: Vec<*mut c_void> = Vec::with_capacity(array.len());
    for v in array {
        let duplicated = match v {
            value::Value::String(s) => str_to_glib_full(s),
            _ => Err(anyhow::anyhow!("Expected a String, got {v:?}")),
        };
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
        array: &[value::Value],
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
    fn extract_numbers(array: &[value::Value]) -> anyhow::Result<Vec<f64>> {
        array
            .iter()
            .map(|v| match v {
                value::Value::Number(n) => Ok(*n),
                _ => bail!("Expected a Number, got {v:?}"),
            })
            .collect()
    }

    fn extract_booleans(array: &[value::Value]) -> anyhow::Result<Vec<i32>> {
        array
            .iter()
            .map(|v| match v {
                value::Value::Boolean(b) => Ok(i32::from(*b)),
                _ => bail!("Expected a Boolean, got {v:?}"),
            })
            .collect()
    }

    fn extract_strings(array: &[value::Value]) -> anyhow::Result<Vec<CString>> {
        array
            .iter()
            .map(|v| match v {
                value::Value::String(s) => Ok(CString::new(s.as_bytes())?),
                _ => bail!("Expected a String, got {v:?}"),
            })
            .collect()
    }

    fn extract_handles(array: &[value::Value]) -> anyhow::Result<Vec<crate::handle::Handle>> {
        array
            .iter()
            .map(|v| match v {
                value::Value::Object(handle) => Ok(handle.clone()),
                _ => bail!("Expected an Object, got {v:?}"),
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
        encoder: &dyn ArrayKindEncoder,
        array: &[value::Value],
    ) -> anyhow::Result<ffi::Stash> {
        match self.item_codec("array")? {
            ItemCodec::Integer(kind) => Ok(ffi::Stash::Storage(
                kind.checked_to_stash_storage(&Self::extract_numbers(array)?)?,
            )),
            ItemCodec::EnumFlags(kind) => Ok(ffi::Stash::Storage(
                kind.to_stash_storage(&Self::extract_numbers(array)?),
            )),
            ItemCodec::BigInt(kind) => Ok(ffi::Stash::Storage(kind.to_stash_storage(array)?)),
            ItemCodec::Float(kind) => Ok(ffi::Stash::Storage(
                kind.checked_to_stash_storage(&Self::extract_numbers(array)?)?,
            )),
            ItemCodec::Boolean => Ok(ffi::Stash::Storage(Self::extract_booleans(array)?.into())),
            ItemCodec::String => {
                let dup_items =
                    matches!(&*self.item_codec, Codec::String(s) if s.ownership.is_full());
                encoder.encode_strings(array, dup_items, self.ownership)
            }
            ItemCodec::Pointer => {
                let handles = Self::extract_handles(array)?;

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

    fn decode_contiguous(
        &self,
        codec: ItemCodec,
        data: *const u8,
        len: usize,
    ) -> anyhow::Result<Vec<value::Value>> {
        if len == 0 || data.is_null() {
            return Ok(Vec::new());
        }
        let values = match codec {
            ItemCodec::Integer(kind) => {
                unsafe { kind.checked_read_slice(data, len, "array element") }?
                    .into_iter()
                    .map(value::Value::Number)
                    .collect()
            }
            ItemCodec::EnumFlags(kind) => unsafe { kind.read_slice(data, len) }
                .into_iter()
                .map(value::Value::Number)
                .collect(),
            ItemCodec::BigInt(kind) => unsafe { kind.read_slice(data, len) },
            ItemCodec::Float(FloatCodec::F32) => {
                unsafe { std::slice::from_raw_parts(data.cast::<f32>(), len) }
                    .iter()
                    .map(|&v| value::Value::Number(f64::from(v)))
                    .collect()
            }
            ItemCodec::Float(FloatCodec::F64) => {
                unsafe { std::slice::from_raw_parts(data.cast::<f64>(), len) }
                    .iter()
                    .copied()
                    .map(value::Value::Number)
                    .collect()
            }
            ItemCodec::Boolean => unsafe { std::slice::from_raw_parts(data.cast::<i32>(), len) }
                .iter()
                .map(|&v| value::Value::Boolean(v != 0))
                .collect(),
            ItemCodec::Pointer | ItemCodec::String => {
                let ptrs = unsafe { std::slice::from_raw_parts(data.cast::<*mut c_void>(), len) };
                return ptrs
                    .iter()
                    .map(|&item_ptr| self.item_codec.decode(&ffi::Stash::Ptr(item_ptr)))
                    .collect();
            }
        };
        Ok(values)
    }

    fn buffer_view_passthrough(
        &self,
        view: &value::BufferView,
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

    fn decode_ptr_iter(
        &self,
        mut ptrs: impl Iterator<Item = *mut c_void>,
        release: impl FnOnce(),
    ) -> anyhow::Result<value::Value> {
        let mut values = Vec::with_capacity(ptrs.size_hint().0);
        let result = ptrs.try_for_each(|item_ptr| {
            values.push(self.item_codec.decode(&ffi::Stash::Ptr(item_ptr))?);
            anyhow::Ok(())
        });
        release();
        result?;
        Ok(value::Value::Array(values))
    }
}
