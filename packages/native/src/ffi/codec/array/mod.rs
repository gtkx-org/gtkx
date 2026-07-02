use std::ffi::{CString, c_char};

use anyhow::bail;
use napi_derive::napi;

use super::prelude::*;
use super::string::str_to_glib_full;
use crate::ffi::codec::{BigIntCodec, Codec, FloatCodec, IntegerCodec};
use crate::ffi::value::BufferViewKind;
use crate::ffi::{Stash, StashStorage};

mod garray;
mod size;

fn gstring_ptrs_to_string_values(items: &[glib::GStringPtr]) -> Vec<value::Value> {
    items
        .iter()
        .map(|item| value::Value::String(unsafe { lossy_c_string(item.as_ptr()) }))
        .collect()
}

#[napi(string_enum = "lowercase")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArrayKind {
    Array,
    GList,
    GSList,
    GPtrArray,
    GArray,
    GByteArray,
    Sized,
    Fixed,
}

#[derive(Debug, Clone)]
pub struct ArrayCodec {
    pub item_codec: Box<Codec>,
    pub kind: ArrayKind,
    pub ownership: Ownership,
    pub size_param_index: Option<u32>,
    pub fixed_size: Option<u32>,
    pub element_size: Option<usize>,
}

impl Encoder for ArrayCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let array = match value {
            value::Value::Array(arr) => arr,
            value::Value::BufferView(view) => return self.encode_buffer_view(view),
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::StashedValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail_expected!("an Array", "array", value),
        };

        if self.kind == ArrayKind::GByteArray {
            return self.encode_gbytearray(array);
        }

        if self.kind == ArrayKind::GArray {
            return self.encode_garray(array);
        }

        let encoder: &dyn ArrayKindEncoder = match &self.kind {
            ArrayKind::GList => &ListEncoder(&ffi::GLIST_OPS),
            ArrayKind::GSList => &ListEncoder(&ffi::GSLIST_OPS),
            _ => &NullTerminatedArrayEncoder,
        };

        match self.item_codec("array")? {
            ItemCodec::Integer(kind) => Ok(ffi::StashedValue::Stashed(
                kind.checked_to_stash(&Self::extract_numbers(array)?)?,
            )),
            ItemCodec::EnumFlags(kind) => Ok(ffi::StashedValue::Stashed(
                kind.to_stash(&Self::extract_numbers(array)?),
            )),
            ItemCodec::BigInt(kind) => Ok(ffi::StashedValue::Stashed(kind.to_stash(array)?)),
            ItemCodec::Float(kind) => Ok(ffi::StashedValue::Stashed(
                kind.checked_to_stash(&Self::extract_numbers(array)?)?,
            )),
            ItemCodec::Boolean => Ok(ffi::StashedValue::Stashed(
                Self::extract_booleans(array)?.into(),
            )),
            ItemCodec::String => {
                let dup_elements =
                    matches!(&*self.item_codec, Codec::String(s) if s.ownership.is_full());
                encoder.encode_strings(array, dup_elements, self.ownership)
            }
            ItemCodec::Pointer => {
                let handles = Self::extract_handles(array)?;

                if let Some(element_size) = self.element_size {
                    let mut buffer = vec![0u8; handles.len() * element_size];
                    for (i, handle) in handles.iter().enumerate() {
                        let ptr = handle.ptr();
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
                    return Ok(ffi::StashedValue::Stashed(buffer.into()));
                }

                encoder.encode_handles(&handles, &self.item_codec, self.ownership)
            }
        }
    }
}

impl Decoder for ArrayCodec {
    fn read_call(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        match &self.kind {
            ArrayKind::GList | ArrayKind::GSList => return self.decode_glist(stashed_value),
            ArrayKind::GArray => return self.decode_garray(stashed_value),
            ArrayKind::GPtrArray => return self.decode_gptrarray(stashed_value),
            ArrayKind::GByteArray => return self.decode_gbytearray(stashed_value),
            ArrayKind::Array | ArrayKind::Sized | ArrayKind::Fixed => {}
        }

        let ffi::StashedValue::Ptr(ptr) = stashed_value else {
            bail!("Array of kind {:?} can only be decoded from a raw pointer", self.kind)
        };
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }

        match self.item_codec("array")? {
            ItemCodec::String => Ok(self.decode_null_terminated_string_array(*ptr)),
            ItemCodec::Pointer => self.decode_null_terminated_ptr_array(*ptr),
            codec @ (ItemCodec::Integer(_)
            | ItemCodec::EnumFlags(_)
            | ItemCodec::BigInt(_)
            | ItemCodec::Float(_)
            | ItemCodec::Boolean) => self.decode_zero_terminated_scalar_array(codec, *ptr),
        }
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }
        self.read_call(&ffi::StashedValue::Ptr(ptr))
    }

    fn decode_with_context(
        &self,
        stashed_value: &ffi::StashedValue,
        ffi_args: &[ffi::StashedValue],
        arg_codecs: &[Codec],
    ) -> anyhow::Result<value::Value> {
        match self.kind {
            ArrayKind::Sized => {
                let size_param_index = self
                    .size_param_index
                    .ok_or_else(|| anyhow::anyhow!("A sized array requires a sizeParamIndex"))?;
                let length = Self::size_from_args(ffi_args, arg_codecs, size_param_index as usize)?;

                if let ffi::StashedValue::Ptr(ptr) = stashed_value {
                    if ptr.is_null() {
                        return Ok(value::Value::Array(vec![]));
                    }

                    return self.decode_sized_array(*ptr, length);
                }
            }
            ArrayKind::Fixed => {
                let size = self
                    .fixed_size
                    .ok_or_else(|| anyhow::anyhow!("A fixed array requires a fixedSize"))?;

                if let ffi::StashedValue::Ptr(ptr) = stashed_value {
                    if ptr.is_null() {
                        return Ok(value::Value::Array(vec![]));
                    }

                    return self.decode_sized_array(*ptr, size as usize);
                }
            }
            ArrayKind::Array
            | ArrayKind::GList
            | ArrayKind::GSList
            | ArrayKind::GPtrArray
            | ArrayKind::GArray
            | ArrayKind::GByteArray => {}
        }

        self.decode(stashed_value)
    }
}

impl PtrWriter for ArrayCodec {
    unsafe fn write_return_to_ptr(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
    ) {
        let container = encode_and_leak_container(value, "array vfunc return", |v| self.encode(v));
        unsafe { ffi::Slot::new(ret).store(container) };
    }
}

#[derive(Debug, Clone, Copy)]
enum ItemCodec {
    Integer(IntegerCodec),
    EnumFlags(IntegerCodec),
    BigInt(BigIntCodec),
    Float(FloatCodec),
    Boolean,
    Pointer,
    String,
}

impl ItemCodec {
    fn resolve(item_codec: &Codec) -> Option<Self> {
        Some(match item_codec {
            Codec::Integer(kind) => Self::Integer(*kind),
            Codec::EnumFlags(enum_flags) => Self::EnumFlags(enum_flags.storage),
            Codec::BigInt(kind) => Self::BigInt(*kind),
            Codec::Float(kind) => Self::Float(*kind),
            Codec::Boolean(_) => Self::Boolean,
            Codec::Object(_) | Codec::Boxed(_) | Codec::Struct(_) | Codec::Fundamental(_) => {
                Self::Pointer
            }
            Codec::String(_) => Self::String,
            Codec::Void(_)
            | Codec::Array(_)
            | Codec::Buffer(_)
            | Codec::HashTable(_)
            | Codec::Callback(_)
            | Codec::Ref(_)
            | Codec::Unichar(_) => return None,
        })
    }

    fn accepts_buffer_view(self, view_kind: BufferViewKind) -> bool {
        match self {
            Self::Integer(kind) | Self::EnumFlags(kind) => matches!(
                (kind, view_kind),
                (IntegerCodec::I8, BufferViewKind::Int8)
                    | (
                        IntegerCodec::U8,
                        BufferViewKind::Uint8 | BufferViewKind::Uint8Clamped
                    )
                    | (IntegerCodec::I16, BufferViewKind::Int16)
                    | (IntegerCodec::U16, BufferViewKind::Uint16)
                    | (IntegerCodec::I32, BufferViewKind::Int32)
                    | (IntegerCodec::U32, BufferViewKind::Uint32)
                    | (IntegerCodec::I64, BufferViewKind::BigInt64)
                    | (IntegerCodec::U64, BufferViewKind::BigUint64)
            ),
            Self::Float(FloatCodec::F32) => view_kind == BufferViewKind::Float32,
            Self::Float(FloatCodec::F64) => view_kind == BufferViewKind::Float64,
            Self::BigInt(kind) => matches!(
                (kind, view_kind),
                (BigIntCodec::I64, BufferViewKind::BigInt64)
                    | (BigIntCodec::U64, BufferViewKind::BigUint64)
            ),
            Self::Boolean | Self::Pointer | Self::String => false,
        }
    }

    fn element_size(self) -> usize {
        match self {
            Self::Integer(kind) | Self::EnumFlags(kind) => kind.byte_size(),
            Self::BigInt(kind) => kind.byte_size(),
            Self::Float(FloatCodec::F32) => size_of::<f32>(),
            Self::Float(FloatCodec::F64) => size_of::<f64>(),
            Self::Boolean => size_of::<i32>(),
            Self::Pointer | Self::String => size_of::<*mut c_void>(),
        }
    }
}

fn build_strv(array: &[value::Value]) -> anyhow::Result<glib::StrV> {
    let mut strv = glib::StrV::with_capacity(array.len());
    for v in array {
        let value::Value::String(s) = v else {
            bail!("Expected a String, got {v:?}");
        };
        let gstring = glib::GString::from_string_checked(s.clone())
            .map_err(|_| anyhow::anyhow!("String contains an interior NUL byte"))?;
        strv.push(gstring);
    }
    Ok(strv)
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

fn leak_container_to_callee(ptrs: &[*mut c_void]) -> *mut c_void {
    unsafe { ffi::dup_to_glib_heap(ptrs.as_ptr().cast::<u8>(), std::mem::size_of_val(ptrs)) }
}

trait ArrayKindEncoder {
    fn encode_strings(
        &self,
        array: &[value::Value],
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::StashedValue>;

    fn encode_handles(
        &self,
        handles: &[crate::handle::Handle],
        item_codec: &Codec,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::StashedValue>;
}

struct NullTerminatedArrayEncoder;

impl ArrayKindEncoder for NullTerminatedArrayEncoder {
    fn encode_strings(
        &self,
        array: &[value::Value],
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::StashedValue> {
        match (ownership, dup_elements) {
            (Ownership::Borrowed, false) => {
                let strv = build_strv(array)?;
                let ptr = strv.as_ptr() as *mut c_void;
                Ok(ffi::StashedValue::Stashed(Stash::new(
                    ptr,
                    StashStorage::StrV(strv),
                )))
            }
            (Ownership::Full, true) => {
                let strv = build_strv(array)?;
                let container = strv.into_raw() as *mut c_void;
                Ok(full_transfer_stashed(
                    container,
                    ffi::PendingRelease::StrFreeV,
                ))
            }
            (Ownership::Full, false) => {
                let cstrings = ArrayCodec::extract_strings(array)?;
                let mut ptrs: Vec<*mut c_void> =
                    cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
                ptrs.push(std::ptr::null_mut());
                let container = leak_container_to_callee(&ptrs);
                Ok(ffi::StashedValue::Stashed(
                    Stash::new(container, StashStorage::StringArray(cstrings, Vec::new()))
                        .with_pending_transfer(container, ffi::PendingRelease::GFree),
                ))
            }
            (Ownership::Borrowed, true) => {
                let mut ptrs = dup_strings_to_glib(array)?;
                ptrs.push(std::ptr::null_mut());
                let ptr = ptrs.as_mut_ptr() as *mut c_void;
                Ok(ffi::StashedValue::Stashed(
                    Stash::new(ptr, StashStorage::StringArray(Vec::new(), ptrs))
                        .with_pending_transfer(ptr, ffi::PendingRelease::StringElements),
                ))
            }
        }
    }

    fn encode_handles(
        &self,
        handles: &[crate::handle::Handle],
        item_codec: &Codec,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::StashedValue> {
        let (mut ptrs, acquired) = transfer_elements(handles, item_codec, "array")?;
        ptrs.push(std::ptr::null_mut());

        let should_free = ownership.is_borrowed();
        let storage = if should_free {
            let ptr = ptrs.as_mut_ptr() as *mut c_void;
            Stash::new(ptr, StashStorage::ObjectArray(handles.to_vec(), ptrs))
        } else {
            let container = leak_container_to_callee(&ptrs);
            Stash::new(
                container,
                StashStorage::ObjectArray(handles.to_vec(), Vec::new()),
            )
        };
        Ok(finalize_container_stash(
            storage,
            should_free,
            acquired,
            ffi::PendingRelease::GFree,
        ))
    }
}

fn string_list_parts(
    array: &[value::Value],
    dup_elements: bool,
) -> anyhow::Result<(Vec<CString>, Vec<*mut c_void>)> {
    if dup_elements {
        Ok((Vec::new(), dup_strings_to_glib(array)?))
    } else {
        let cstrings = ArrayCodec::extract_strings(array)?;
        let ptrs = cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
        Ok((cstrings, ptrs))
    }
}

fn release_transfers(transfers: Vec<ffi::PendingTransfer>) {
    for transfer in transfers {
        transfer.release_now();
    }
}

fn transfer_elements(
    handles: &[crate::handle::Handle],
    item_codec: &Codec,
    container_label: &str,
) -> anyhow::Result<(Vec<*mut c_void>, Vec<ffi::PendingTransfer>)> {
    let mut ptrs = Vec::with_capacity(handles.len() + 1);
    let mut acquired: Vec<ffi::PendingTransfer> = Vec::new();
    for handle in handles {
        let ptr = handle.ptr();
        if ptr.is_null() {
            release_transfers(acquired);
            bail!("GObject in {container_label} has a null pointer");
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

struct ListEncoder(&'static ffi::ListOps);

impl ArrayKindEncoder for ListEncoder {
    fn encode_strings(
        &self,
        array: &[value::Value],
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::StashedValue> {
        let should_free = ownership.is_borrowed();
        let (strings, ptrs) = string_list_parts(array, dup_elements)?;
        let list = ffi::build_list(self.0, &ptrs);
        let storage = Stash::new(
            list,
            StashStorage::List(ffi::ListData {
                ops: self.0,
                list_ptr: list,
                should_free,
                payload: ffi::ListPayload::Strings {
                    strings,
                    elements_duped: dup_elements,
                },
            }),
        );
        let acquired: Vec<ffi::PendingTransfer> = if !should_free && dup_elements {
            ptrs.iter()
                .map(|p| ffi::PendingTransfer::new(*p, ffi::PendingRelease::GFree))
                .collect()
        } else {
            Vec::new()
        };
        Ok(finalize_container_stash(
            storage,
            should_free,
            acquired,
            self.0.pending,
        ))
    }

    fn encode_handles(
        &self,
        handles: &[crate::handle::Handle],
        item_codec: &Codec,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::StashedValue> {
        let should_free = ownership.is_borrowed();
        let (ptrs, acquired) = transfer_elements(handles, item_codec, self.0.label)?;
        let list = ffi::build_list(self.0, &ptrs);
        let storage = Stash::new(
            list,
            StashStorage::List(ffi::ListData {
                ops: self.0,
                list_ptr: list,
                should_free,
                payload: ffi::ListPayload::Handles(handles.to_vec()),
            }),
        );
        Ok(finalize_container_stash(
            storage,
            should_free,
            acquired,
            self.0.pending,
        ))
    }
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
        ItemCodec::resolve(&self.item_codec).map(ItemCodec::element_size)
    }

    fn item_codec(&self, context: &str) -> anyhow::Result<ItemCodec> {
        ItemCodec::resolve(&self.item_codec).ok_or_else(|| {
            anyhow::anyhow!("Unsupported {context} item codec: {:?}", self.item_codec)
        })
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
                    .map(|&item_ptr| self.item_codec.decode(&ffi::StashedValue::Ptr(item_ptr)))
                    .collect();
            }
        };
        Ok(values)
    }

    fn encode_buffer_view(&self, view: &value::BufferView) -> anyhow::Result<ffi::StashedValue> {
        anyhow::ensure!(
            self.ownership.is_borrowed(),
            "A transfer-full array argument cannot be encoded from an ArrayBufferView: the callee would free the JavaScript buffer"
        );
        match self.kind {
            ArrayKind::Array | ArrayKind::Sized => {}
            ArrayKind::Fixed => {
                let size = self
                    .fixed_size
                    .ok_or_else(|| anyhow::anyhow!("A fixed array requires a fixedSize"))?;
                anyhow::ensure!(
                    view.length() == size as usize,
                    "Expected a view of exactly {size} elements for a fixed-size array, got {}",
                    view.length()
                );
            }
            ArrayKind::GList
            | ArrayKind::GSList
            | ArrayKind::GPtrArray
            | ArrayKind::GArray
            | ArrayKind::GByteArray => {
                bail!(
                    "{:?} arrays cannot be encoded from an ArrayBufferView; only contiguous arrays support zero-copy passthrough",
                    self.kind
                );
            }
        }
        let codec = self.item_codec("array")?;
        anyhow::ensure!(
            codec.accepts_buffer_view(view.kind()),
            "A {} cannot supply {} array elements",
            view.kind(),
            self.item_codec
        );
        Ok(ffi::StashedValue::Ptr(view.ptr()))
    }
}

impl ArrayCodec {
    fn decode_ptr_iter(
        &self,
        mut ptrs: impl Iterator<Item = *mut c_void>,
        release: impl FnOnce(),
    ) -> anyhow::Result<value::Value> {
        let mut values = Vec::with_capacity(ptrs.size_hint().0);
        let outcome = ptrs.try_for_each(|item_ptr| {
            values.push(self.item_codec.decode(&ffi::StashedValue::Ptr(item_ptr))?);
            anyhow::Ok(())
        });
        release();
        outcome?;
        Ok(value::Value::Array(values))
    }

    pub(crate) fn decode_glist(
        &self,
        stashed_value: &ffi::StashedValue,
    ) -> anyhow::Result<value::Value> {
        let Some(list_ptr) = stashed_value.as_non_null_ptr("GList/GSList")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let mut current = list_ptr as *mut glib::ffi::GList;
        let nodes = std::iter::from_fn(move || {
            if current.is_null() {
                return None;
            }
            let data = unsafe { (*current).data };
            current = unsafe { (*current).next };
            Some(data)
        });

        let is_full = self.ownership.is_full();
        let ops: &'static ffi::ListOps = if self.kind == ArrayKind::GSList {
            &ffi::GSLIST_OPS
        } else {
            &ffi::GLIST_OPS
        };
        self.decode_ptr_iter(nodes, move || {
            if is_full {
                unsafe { (ops.free)(list_ptr) };
            }
        })
    }

    fn decode_gptrarray(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = stashed_value.as_non_null_ptr("GPtrArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let ptr_array = ptr as *mut glib::ffi::GPtrArray;
        let len = unsafe { (*ptr_array).len as usize };
        let pdata = unsafe { (*ptr_array).pdata };
        let items = (0..len).map(move |i| unsafe { *pdata.add(i) });

        let is_full = self.ownership.is_full();
        self.decode_ptr_iter(items, move || {
            if is_full {
                unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
            }
        })
    }

    fn decode_null_terminated_ptr_array(&self, ptr: *mut c_void) -> anyhow::Result<value::Value> {
        let ptr_array = ptr as *const *mut c_void;
        let mut i = 0isize;
        let items = std::iter::from_fn(move || {
            let item_ptr = unsafe { *ptr_array.offset(i) };
            if item_ptr.is_null() {
                return None;
            }
            i += 1;
            Some(item_ptr)
        });

        let is_full = self.ownership.is_full();
        self.decode_ptr_iter(items, move || {
            if is_full {
                unsafe { glib::ffi::g_free(ptr) };
            }
        })
    }

    fn decode_zero_terminated_scalar_array(
        &self,
        codec: ItemCodec,
        ptr: *mut c_void,
    ) -> anyhow::Result<value::Value> {
        let stride = codec.element_size();
        let base = ptr as *const u8;
        let mut len = 0usize;
        loop {
            let element = unsafe { std::slice::from_raw_parts(base.add(len * stride), stride) };
            if element.iter().all(|&byte| byte == 0) {
                break;
            }
            len += 1;
        }

        let values = self.decode_contiguous(codec, base, len);

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_free(ptr) };
        }

        Ok(value::Value::Array(values?))
    }

    fn decode_null_terminated_string_array(&self, ptr: *mut c_void) -> value::Value {
        let items_full = matches!(&*self.item_codec, Codec::String(string_codec) if string_codec.ownership.is_full());

        let values = if self.ownership.is_full() {
            let strv = if items_full {
                unsafe { glib::StrV::from_glib_full(ptr as *mut *mut c_char) }
            } else {
                unsafe { glib::StrV::from_glib_container(ptr as *mut *const c_char) }
            };
            gstring_ptrs_to_string_values(&strv)
        } else {
            let borrowed = unsafe { glib::StrVRef::from_glib_borrow(ptr as *const *const c_char) };
            gstring_ptrs_to_string_values(borrowed)
        };

        value::Value::Array(values)
    }

    fn decode_sized_array(&self, ptr: *mut c_void, length: usize) -> anyhow::Result<value::Value> {
        let codec = self.item_codec("sized array")?;
        let values = self.decode_contiguous(codec, ptr.cast::<u8>(), length)?;
        Ok(value::Value::Array(values))
    }
}
