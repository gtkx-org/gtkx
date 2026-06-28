use std::ffi::{CString, c_char};
use std::marker::PhantomData;

use anyhow::bail;

use super::prelude::*;
use super::string::str_to_glib_full;
use crate::ffi::arg::Arg;
use crate::ffi::descriptor::{BigIntKind, Codec, FloatKind, IntegerKind};
use crate::ffi::value::BufferViewKind;
use crate::ffi::{Stash, StashKind};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ArrayKind {
    Array,
    GList,
    GSList,
    GPtrArray,
    GArray,
    GByteArray,
    Sized { size_index: usize },
    Fixed { size: usize },
}

impl std::str::FromStr for ArrayKind {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s {
            "array" => Ok(Self::Array),
            "glist" => Ok(Self::GList),
            "gslist" => Ok(Self::GSList),
            "gptrarray" => Ok(Self::GPtrArray),
            "garray" => Ok(Self::GArray),
            "gbytearray" => Ok(Self::GByteArray),
            "sized" => Ok(Self::Sized { size_index: 0 }),
            "fixed" => Ok(Self::Fixed { size: 0 }),
            _ => Err(format!(
                "'arrayKind' must be 'array', 'glist', 'gslist', 'gptrarray', 'garray', 'gbytearray', 'sized', or 'fixed'; got '{s}'"
            )),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ArrayDescriptor {
    pub item_descriptor: Box<Codec>,
    pub kind: ArrayKind,
    pub ownership: Ownership,
    pub element_size: Option<usize>,
}

impl FfiEncoder for ArrayDescriptor {
    fn encode(&self, val: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let array = match val {
            value::Value::Array(arr) => arr,
            value::Value::BufferView(view) => return self.encode_buffer_view(view),
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::StashedValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected an Array for array descriptor, got {val:?}"),
        };

        if self.kind == ArrayKind::GByteArray {
            return self.encode_gbytearray(array);
        }

        if self.kind == ArrayKind::GArray {
            return self.encode_garray(array);
        }

        let encoder: &dyn ArrayKindEncoder = match &self.kind {
            ArrayKind::GList => &ListEncoder::<ffi::GListFlavor>(PhantomData),
            ArrayKind::GSList => &ListEncoder::<ffi::GSListFlavor>(PhantomData),
            _ => &NullTerminatedArrayEncoder,
        };

        match self.item_codec("array")? {
            ItemCodec::Integer(kind) => {
                Self::encode_integer_array(&Self::extract_numbers(array)?, kind)
            }
            ItemCodec::EnumFlags(kind) => Ok(ffi::StashedValue::Storage(
                kind.to_stash(&Self::extract_numbers(array)?),
            )),
            ItemCodec::BigInt(kind) => Ok(ffi::StashedValue::Storage(kind.to_stash(array)?)),
            ItemCodec::Float(kind) => {
                Self::encode_float_array(&Self::extract_numbers(array)?, kind)
            }
            ItemCodec::Boolean => Ok(Self::encode_boolean_array(&Self::extract_booleans(array)?)),
            ItemCodec::String => {
                let dup_elements =
                    matches!(&*self.item_descriptor, Codec::String(s) if s.ownership.is_full());
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
                    return Ok(ffi::StashedValue::Storage(buffer.into()));
                }

                encoder.encode_handles(&handles, &self.item_descriptor, self.ownership)
            }
        }
    }
}

impl FfiDecoder for ArrayDescriptor {
    fn read_call(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        match &self.kind {
            ArrayKind::GList | ArrayKind::GSList => return self.decode_glist(stashed_value),
            ArrayKind::GArray => return self.decode_garray(stashed_value),
            ArrayKind::GPtrArray => return self.decode_gptrarray(stashed_value),
            ArrayKind::GByteArray => return self.decode_gbytearray(stashed_value),
            ArrayKind::Array | ArrayKind::Sized { .. } | ArrayKind::Fixed { .. } => {}
        }

        if let ffi::StashedValue::Ptr(ptr) = stashed_value {
            if ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            return match self.item_codec("array")? {
                ItemCodec::String => Ok(self.decode_null_terminated_string_array(*ptr)),
                ItemCodec::Pointer => self.decode_null_terminated_ptr_array(*ptr),
                codec @ (ItemCodec::Integer(_)
                | ItemCodec::EnumFlags(_)
                | ItemCodec::BigInt(_)
                | ItemCodec::Float(_)
                | ItemCodec::Boolean) => self.decode_zero_terminated_scalar_array(codec, *ptr),
            };
        }

        let ffi::StashedValue::Storage(storage) = stashed_value else {
            bail!("Expected a Storage ffi::StashedValue for Array, got {stashed_value:?}")
        };

        self.decode_storage(storage)
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }
        match self.kind {
            ArrayKind::GPtrArray => {
                let ptr_array = ptr as *mut glib::ffi::GPtrArray;
                let len = unsafe { (*ptr_array).len as usize };
                let pdata = unsafe { (*ptr_array).pdata };
                let mut values = Vec::with_capacity(len);
                for i in 0..len {
                    let item_ptr = unsafe { *pdata.add(i) };
                    let item_value = unsafe {
                        self.item_descriptor
                            .read(ReadSource::Value(item_ptr, "GPtrArray item"))?
                    };
                    values.push(item_value);
                }
                Ok(value::Value::Array(values))
            }
            ArrayKind::GByteArray => {
                let stashed_value = ffi::StashedValue::Ptr(ptr);
                self.decode_gbytearray(&stashed_value)
            }
            ArrayKind::GArray => {
                let stashed_value = ffi::StashedValue::Ptr(ptr);
                self.decode_garray(&stashed_value)
            }
            ArrayKind::GList | ArrayKind::GSList => {
                let stashed_value = ffi::StashedValue::Ptr(ptr);
                self.decode_glist(&stashed_value)
            }
            ArrayKind::Array | ArrayKind::Sized { .. } | ArrayKind::Fixed { .. } => {
                let stashed_value = ffi::StashedValue::Ptr(ptr);
                self.decode(&stashed_value)
            }
        }
    }

    fn decode_with_context(
        &self,
        stashed_value: &ffi::StashedValue,
        ffi_args: &[ffi::StashedValue],
        args: &[crate::ffi::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        match &self.kind {
            ArrayKind::Sized { size_index } => {
                let length = Self::size_from_args(ffi_args, args, *size_index)?;

                if let ffi::StashedValue::Ptr(ptr) = stashed_value {
                    if ptr.is_null() {
                        return Ok(value::Value::Array(vec![]));
                    }

                    return self.decode_sized_array(*ptr, length);
                }
            }
            ArrayKind::Fixed { size } => {
                if let ffi::StashedValue::Ptr(ptr) = stashed_value {
                    if ptr.is_null() {
                        return Ok(value::Value::Array(vec![]));
                    }

                    return self.decode_sized_array(*ptr, *size);
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

impl PointerWriter for ArrayDescriptor {
    unsafe fn write_return_to_pointer(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
    ) {
        let container = encode_and_leak_container(value, "array vfunc return", |v| self.encode(v));
        unsafe { (ret as *mut *mut c_void).write_unaligned(container) };
    }
}

#[derive(Debug, Clone, Copy)]
enum ItemCodec {
    Integer(IntegerKind),
    EnumFlags(IntegerKind),
    BigInt(BigIntKind),
    Float(FloatKind),
    Boolean,
    Pointer,
    String,
}

impl ItemCodec {
    fn resolve(item_descriptor: &Codec) -> Option<Self> {
        Some(match item_descriptor {
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
                (IntegerKind::I8, BufferViewKind::Int8)
                    | (
                        IntegerKind::U8,
                        BufferViewKind::Uint8 | BufferViewKind::Uint8Clamped
                    )
                    | (IntegerKind::I16, BufferViewKind::Int16)
                    | (IntegerKind::U16, BufferViewKind::Uint16)
                    | (IntegerKind::I32, BufferViewKind::Int32)
                    | (IntegerKind::U32, BufferViewKind::Uint32)
                    | (IntegerKind::I64, BufferViewKind::BigInt64)
                    | (IntegerKind::U64, BufferViewKind::BigUint64)
            ),
            Self::Float(FloatKind::F32) => view_kind == BufferViewKind::Float32,
            Self::Float(FloatKind::F64) => view_kind == BufferViewKind::Float64,
            Self::BigInt(kind) => matches!(
                (kind, view_kind),
                (BigIntKind::I64, BufferViewKind::BigInt64)
                    | (BigIntKind::U64, BufferViewKind::BigUint64)
            ),
            Self::Boolean | Self::Pointer | Self::String => false,
        }
    }

    fn element_size(self) -> usize {
        match self {
            Self::Integer(kind) | Self::EnumFlags(kind) => kind.byte_size(),
            Self::BigInt(kind) => kind.byte_size(),
            Self::Float(FloatKind::F32) => size_of::<f32>(),
            Self::Float(FloatKind::F64) => size_of::<f64>(),
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
    unsafe {
        let bytes = std::mem::size_of_val(ptrs);
        let container = glib::ffi::g_malloc(bytes);
        std::ptr::copy_nonoverlapping(ptrs.as_ptr().cast::<u8>(), container.cast::<u8>(), bytes);
        container
    }
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
        item_descriptor: &Codec,
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
                Ok(ffi::StashedValue::Storage(Stash::new(
                    ptr,
                    StashKind::StrV(strv),
                )))
            }
            (Ownership::Full, true) => {
                let strv = build_strv(array)?;
                let container = strv.into_raw() as *mut c_void;
                Ok(ffi::StashedValue::Storage(
                    Stash::unit(container)
                        .with_pending_transfer(container, ffi::PendingRelease::StrFreeV),
                ))
            }
            (Ownership::Full, false) => {
                let cstrings = ArrayDescriptor::extract_strings(array)?;
                let mut ptrs: Vec<*mut c_void> =
                    cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
                ptrs.push(std::ptr::null_mut());
                let container = leak_container_to_callee(&ptrs);
                Ok(ffi::StashedValue::Storage(
                    Stash::new(container, StashKind::StringArray(cstrings, Vec::new()))
                        .with_pending_transfer(container, ffi::PendingRelease::GFree),
                ))
            }
            (Ownership::Borrowed, true) => {
                let mut ptrs = dup_strings_to_glib(array)?;
                ptrs.push(std::ptr::null_mut());
                let ptr = ptrs.as_mut_ptr() as *mut c_void;
                Ok(ffi::StashedValue::Storage(
                    Stash::new(ptr, StashKind::StringArray(Vec::new(), ptrs))
                        .with_pending_transfer(ptr, ffi::PendingRelease::StringElements),
                ))
            }
        }
    }

    fn encode_handles(
        &self,
        handles: &[crate::handle::Handle],
        item_descriptor: &Codec,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::StashedValue> {
        let (mut ptrs, acquired) = transfer_elements(handles, item_descriptor, "array")?;
        ptrs.push(std::ptr::null_mut());

        if ownership.is_full() {
            let container = leak_container_to_callee(&ptrs);
            let release = group_with_container(acquired, container, ffi::PendingRelease::GFree);
            return Ok(ffi::StashedValue::Storage(
                Stash::new(
                    container,
                    StashKind::ObjectArray(handles.to_vec(), Vec::new()),
                )
                .with_pending_transfer(container, release),
            ));
        }

        let ptr = ptrs.as_mut_ptr() as *mut c_void;
        let storage = Stash::new(ptr, StashKind::ObjectArray(handles.to_vec(), ptrs));
        let storage = if acquired.is_empty() {
            storage
        } else {
            storage.with_pending_transfer(ptr, ffi::PendingRelease::Group(acquired))
        };
        Ok(ffi::StashedValue::Storage(storage))
    }
}

fn string_list_parts(
    array: &[value::Value],
    dup_elements: bool,
) -> anyhow::Result<(Vec<CString>, Vec<*mut c_void>)> {
    if dup_elements {
        Ok((Vec::new(), dup_strings_to_glib(array)?))
    } else {
        let cstrings = ArrayDescriptor::extract_strings(array)?;
        let ptrs = cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
        Ok((cstrings, ptrs))
    }
}

fn release_acquired(acquired: Vec<ffi::PendingTransfer>) {
    for entry in acquired {
        entry.release_now();
    }
}

unsafe extern "C" fn free_garray_string_element(slot: glib::ffi::gpointer) {
    unsafe { glib::ffi::g_free(*(slot as *mut glib::ffi::gpointer)) };
}

fn group_with_container(
    mut acquired: Vec<ffi::PendingTransfer>,
    container: *mut c_void,
    container_release: ffi::PendingRelease,
) -> ffi::PendingRelease {
    if acquired.is_empty() {
        return container_release;
    }
    acquired.push(ffi::PendingTransfer::new(container, container_release));
    ffi::PendingRelease::Group(acquired)
}

fn transfer_elements(
    handles: &[crate::handle::Handle],
    item_descriptor: &Codec,
    container_label: &str,
) -> anyhow::Result<(Vec<*mut c_void>, Vec<ffi::PendingTransfer>)> {
    let mut ptrs = Vec::with_capacity(handles.len() + 1);
    let mut acquired: Vec<ffi::PendingTransfer> = Vec::new();
    for handle in handles {
        let ptr = handle.ptr();
        if ptr.is_null() {
            release_acquired(acquired);
            bail!("GObject in {container_label} has a null pointer");
        }
        let element = match unsafe { item_descriptor.ref_for_transfer(ptr) } {
            Ok(element) => element,
            Err(e) => {
                release_acquired(acquired);
                return Err(e);
            }
        };
        if let Some(release) = item_descriptor.transfer_release() {
            acquired.push(ffi::PendingTransfer::new(element, release));
        }
        ptrs.push(element);
    }
    Ok((ptrs, acquired))
}

fn build_spine<F: ffi::ListFlavor>(ptrs: &[*mut c_void]) -> *mut F::Spine {
    let mut list: *mut F::Spine = std::ptr::null_mut();
    for ptr in ptrs.iter().rev() {
        list = unsafe { F::prepend(list, *ptr) };
    }
    list
}

struct ListEncoder<F: ffi::ListFlavor>(PhantomData<F>);

impl<F: ffi::ListFlavor> ArrayKindEncoder for ListEncoder<F> {
    fn encode_strings(
        &self,
        array: &[value::Value],
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::StashedValue> {
        let should_free = ownership.is_borrowed();
        let (strings, ptrs) = string_list_parts(array, dup_elements)?;
        let list = build_spine::<F>(&ptrs);
        let storage = Stash::new(
            list as *mut c_void,
            F::string_storage(strings, list, should_free, dup_elements),
        );
        let storage = if should_free {
            storage
        } else {
            let acquired: Vec<ffi::PendingTransfer> = if dup_elements {
                ptrs.iter()
                    .map(|p| ffi::PendingTransfer::new(*p, ffi::PendingRelease::GFree))
                    .collect()
            } else {
                Vec::new()
            };
            let release = group_with_container(acquired, list.cast(), F::spine_release());
            storage.with_pending_transfer(list as *mut c_void, release)
        };
        Ok(ffi::StashedValue::Storage(storage))
    }

    fn encode_handles(
        &self,
        handles: &[crate::handle::Handle],
        item_descriptor: &Codec,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::StashedValue> {
        let should_free = ownership.is_borrowed();
        let (ptrs, acquired) = transfer_elements(handles, item_descriptor, F::LABEL)?;
        let list = build_spine::<F>(&ptrs);
        let storage = Stash::new(
            list as *mut c_void,
            F::handle_storage(handles.to_vec(), list, should_free),
        );
        let storage = if should_free {
            if acquired.is_empty() {
                storage
            } else {
                storage.with_pending_transfer(
                    list as *mut c_void,
                    ffi::PendingRelease::Group(acquired),
                )
            }
        } else {
            let release = group_with_container(acquired, list.cast(), F::spine_release());
            storage.with_pending_transfer(list as *mut c_void, release)
        };
        Ok(ffi::StashedValue::Storage(storage))
    }
}

impl ArrayDescriptor {
    fn checked_f32_vec(values: &[f64]) -> anyhow::Result<Vec<f32>> {
        values
            .iter()
            .enumerate()
            .map(|(i, &v)| {
                if v.is_finite() && (v > f32::MAX as f64 || v < -(f32::MAX as f64)) {
                    bail!("Array element {i}: value {v} is out of range for f32");
                }
                Ok(v as f32)
            })
            .collect()
    }

    fn encode_integer_array(
        values: &[f64],
        integer_kind: IntegerKind,
    ) -> anyhow::Result<ffi::StashedValue> {
        Ok(ffi::StashedValue::Storage(
            integer_kind.checked_to_stash(values)?,
        ))
    }

    fn encode_float_array(
        values: &[f64],
        float_kind: FloatKind,
    ) -> anyhow::Result<ffi::StashedValue> {
        match float_kind {
            FloatKind::F32 => Ok(ffi::StashedValue::Storage(
                Self::checked_f32_vec(values)?.into(),
            )),
            FloatKind::F64 => Ok(ffi::StashedValue::Storage(values.to_vec().into())),
        }
    }

    fn encode_boolean_array(values: &[i32]) -> ffi::StashedValue {
        ffi::StashedValue::Storage(values.to_vec().into())
    }

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
        ItemCodec::resolve(&self.item_descriptor).map(ItemCodec::element_size)
    }

    fn item_codec(&self, context: &str) -> anyhow::Result<ItemCodec> {
        ItemCodec::resolve(&self.item_descriptor).ok_or_else(|| {
            anyhow::anyhow!(
                "Unsupported {context} item descriptor: {:?}",
                self.item_descriptor
            )
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
                unsafe { kind.read_slice_checked(data, len, "array element") }?
                    .into_iter()
                    .map(value::Value::Number)
                    .collect()
            }
            ItemCodec::EnumFlags(kind) => unsafe { kind.read_slice(data, len) }
                .into_iter()
                .map(value::Value::Number)
                .collect(),
            ItemCodec::BigInt(kind) => unsafe { kind.read_slice(data, len) },
            ItemCodec::Float(FloatKind::F32) => {
                unsafe { std::slice::from_raw_parts(data.cast::<f32>(), len) }
                    .iter()
                    .map(|&v| value::Value::Number(f64::from(v)))
                    .collect()
            }
            ItemCodec::Float(FloatKind::F64) => {
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
                    .map(|&item_ptr| {
                        self.item_descriptor
                            .decode(&ffi::StashedValue::Ptr(item_ptr))
                    })
                    .collect();
            }
        };
        Ok(values)
    }

    fn encode_buffer_view(&self, view: &value::BufferView) -> anyhow::Result<ffi::StashedValue> {
        anyhow::ensure!(
            !view.is_shared(),
            "SharedArrayBuffer-backed views cannot cross the FFI boundary"
        );
        anyhow::ensure!(
            self.ownership.is_borrowed(),
            "A transfer-full array argument cannot be encoded from an ArrayBufferView: the callee would free the JavaScript buffer"
        );
        match self.kind {
            ArrayKind::Array | ArrayKind::Sized { .. } => {}
            ArrayKind::Fixed { size } => {
                anyhow::ensure!(
                    view.length() == size,
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
            self.item_descriptor
        );
        Ok(ffi::StashedValue::Ptr(view.ptr()))
    }

    fn encode_gbytearray(&self, array: &[value::Value]) -> anyhow::Result<ffi::StashedValue> {
        let bytes: Vec<u8> = array
            .iter()
            .enumerate()
            .map(|(i, v)| match v {
                value::Value::Number(n) => {
                    if !n.is_finite() || n.fract() != 0.0 || *n < 0.0 || *n > 255.0 {
                        bail!("GByteArray element {i}: value {n} is out of range for u8 [0, 255]");
                    }
                    Ok(*n as u8)
                }
                _ => bail!("Expected a Number for GByteArray element, got {v:?}"),
            })
            .collect::<anyhow::Result<Vec<u8>>>()?;

        let byte_array = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(bytes.len() as u32);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), bytes.len() as u32);
            ba
        };

        let owned: Option<glib::ByteArray> = self
            .ownership
            .is_borrowed()
            .then(|| unsafe { glib::translate::from_glib_full(byte_array) });

        let storage = Stash::new(byte_array as *mut c_void, StashKind::GByteArray(owned));
        let storage = if self.ownership.is_full() {
            storage.with_pending_transfer(
                byte_array as *mut c_void,
                ffi::PendingRelease::GByteArrayUnref,
            )
        } else {
            storage
        };
        Ok(ffi::StashedValue::Storage(storage))
    }

    fn append_integer_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        integer_kind: super::IntegerKind,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        let mut buf = [0u8; size_of::<i64>()];
        for n in Self::extract_numbers(array)? {
            unsafe { integer_kind.write_ptr(buf.as_mut_ptr(), n) };
            unsafe {
                glib::ffi::g_array_append_vals(g_array, buf.as_ptr() as *const c_void, 1);
            }
        }
        Ok(())
    }

    fn append_bigint_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        kind: super::BigIntKind,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        let mut buf = [0u8; size_of::<i64>()];
        for v in array {
            unsafe { kind.append_into(buf.as_mut_ptr(), v)? };
            unsafe {
                glib::ffi::g_array_append_vals(g_array, buf.as_ptr() as *const c_void, 1);
            }
        }
        Ok(())
    }

    fn append_float_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        float_kind: super::FloatKind,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        for n in Self::extract_numbers(array)? {
            match float_kind {
                super::FloatKind::F32 => {
                    let v = n as f32;
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &v as *const f32 as *const c_void,
                            1,
                        );
                    }
                }
                super::FloatKind::F64 => unsafe {
                    glib::ffi::g_array_append_vals(g_array, &n as *const f64 as *const c_void, 1);
                },
            }
        }
        Ok(())
    }

    fn append_handle_values_to_garray(
        &self,
        g_array: *mut glib::ffi::GArray,
        array: &[value::Value],
    ) -> anyhow::Result<Vec<ffi::PendingTransfer>> {
        let handles = Self::extract_handles(array)?;
        let (ptrs, acquired) = transfer_elements(&handles, &self.item_descriptor, "GArray")?;
        for ptr in ptrs {
            unsafe {
                glib::ffi::g_array_append_vals(
                    g_array,
                    &ptr as *const *mut c_void as *const c_void,
                    1,
                );
            }
        }
        Ok(acquired)
    }

    fn append_items_to_garray(
        &self,
        g_array: *mut glib::ffi::GArray,
        array: &[value::Value],
    ) -> anyhow::Result<Vec<ffi::PendingTransfer>> {
        match self.item_codec("GArray")? {
            ItemCodec::Integer(kind) | ItemCodec::EnumFlags(kind) => {
                Self::append_integer_values_to_garray(g_array, kind, array).map(|()| Vec::new())
            }
            ItemCodec::BigInt(kind) => {
                Self::append_bigint_values_to_garray(g_array, kind, array).map(|()| Vec::new())
            }
            ItemCodec::Float(kind) => {
                Self::append_float_values_to_garray(g_array, kind, array).map(|()| Vec::new())
            }
            ItemCodec::Boolean => {
                for b in Self::extract_booleans(array)? {
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &b as *const i32 as *const c_void,
                            1,
                        );
                    }
                }
                Ok(Vec::new())
            }
            ItemCodec::Pointer => self.append_handle_values_to_garray(g_array, array),
            ItemCodec::String => {
                let callee_adopts_strings =
                    matches!(&*self.item_descriptor, Codec::String(s) if s.ownership.is_full());
                if !callee_adopts_strings {
                    unsafe {
                        glib::ffi::g_array_set_clear_func(
                            g_array,
                            Some(free_garray_string_element),
                        );
                    }
                }
                let mut acquired = Vec::new();
                for dup in dup_strings_to_glib(array)? {
                    if callee_adopts_strings {
                        acquired.push(ffi::PendingTransfer::new(dup, ffi::PendingRelease::GFree));
                    }
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &dup as *const *mut c_void as *const c_void,
                            1,
                        );
                    }
                }
                Ok(acquired)
            }
        }
    }

    fn encode_garray(&self, array: &[value::Value]) -> anyhow::Result<ffi::StashedValue> {
        let item_size = self.item_element_size();
        let element_size = self.element_size.or(item_size).ok_or_else(|| {
            anyhow::anyhow!(
                "Cannot determine element size for GArray with item descriptor {:?}",
                self.item_descriptor
            )
        })?;

        if let Some(item_size) = item_size
            && element_size != item_size
        {
            bail!(
                "GArray element size override {element_size} does not match the {item_size}-byte layout of item descriptor {:?}",
                self.item_descriptor
            );
        }

        let g_array =
            unsafe { glib::ffi::g_array_sized_new(0, 0, element_size as u32, array.len() as u32) };

        let acquired = match self.append_items_to_garray(g_array, array) {
            Ok(acquired) => acquired,
            Err(err) => {
                unsafe { glib::ffi::g_array_unref(g_array) };
                return Err(err);
            }
        };

        let should_free = self.ownership.is_borrowed();
        let storage = Stash::new(
            g_array as *mut c_void,
            StashKind::GArray(ffi::GArrayData {
                array_ptr: g_array,
                should_free,
            }),
        );
        let storage = if should_free {
            if acquired.is_empty() {
                storage
            } else {
                storage.with_pending_transfer(
                    g_array as *mut c_void,
                    ffi::PendingRelease::Group(acquired),
                )
            }
        } else {
            let release =
                group_with_container(acquired, g_array.cast(), ffi::PendingRelease::GArrayUnref);
            storage.with_pending_transfer(g_array as *mut c_void, release)
        };
        Ok(ffi::StashedValue::Storage(storage))
    }
}

impl ArrayDescriptor {
    pub(crate) fn decode_glist(
        &self,
        stashed_value: &ffi::StashedValue,
    ) -> anyhow::Result<value::Value> {
        let Some(list_ptr) = stashed_value.as_non_null_ptr("GList/GSList")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let values: anyhow::Result<Vec<value::Value>> = (|| {
            let mut values = Vec::new();
            let mut current = list_ptr as *mut glib::ffi::GList;
            while !current.is_null() {
                let data = unsafe { (*current).data };
                let item_ffi = ffi::StashedValue::Ptr(data);
                values.push(self.item_descriptor.decode(&item_ffi)?);
                current = unsafe { (*current).next };
            }
            Ok(values)
        })();

        if self.ownership.is_full() {
            if self.kind == ArrayKind::GSList {
                unsafe { glib::ffi::g_slist_free(list_ptr as *mut glib::ffi::GSList) };
            } else {
                unsafe { glib::ffi::g_list_free(list_ptr as *mut glib::ffi::GList) };
            }
        }

        Ok(value::Value::Array(values?))
    }

    pub(crate) fn decode_garray(
        &self,
        stashed_value: &ffi::StashedValue,
    ) -> anyhow::Result<value::Value> {
        let Some(array_ptr) = stashed_value.as_non_null_ptr("GArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let codec = self.item_codec("GArray")?;
        let g_array = array_ptr as *const glib::ffi::GArray;
        let data = unsafe { (*g_array).data as *const u8 };
        let len = unsafe { (*g_array).len as usize };
        let values = self.decode_contiguous(codec, data, len);

        if self.ownership.is_full() {
            let storage_owns = matches!(stashed_value, ffi::StashedValue::Storage(_));
            if !storage_owns {
                unsafe { glib::ffi::g_array_unref(array_ptr as *mut glib::ffi::GArray) };
            }
        }

        Ok(value::Value::Array(values?))
    }

    fn decode_gptrarray(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = stashed_value.as_non_null_ptr("GPtrArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let ptr_array = ptr as *mut glib::ffi::GPtrArray;
        let len = unsafe { (*ptr_array).len as usize };
        let pdata = unsafe { (*ptr_array).pdata };
        let values: anyhow::Result<Vec<value::Value>> = (0..len)
            .map(|i| {
                let item_ptr = unsafe { *pdata.add(i) };
                self.item_descriptor
                    .decode(&ffi::StashedValue::Ptr(item_ptr))
            })
            .collect();

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
        }

        Ok(value::Value::Array(values?))
    }

    fn decode_gbytearray(&self, stashed_value: &ffi::StashedValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = stashed_value.as_non_null_ptr("GByteArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let byte_array = ptr as *mut glib::ffi::GByteArray;
        let storage_owns = matches!(stashed_value, ffi::StashedValue::Storage(_));
        let adopted: Option<glib::ByteArray> = (self.ownership.is_full() && !storage_owns)
            .then(|| unsafe { glib::translate::from_glib_full(byte_array) });

        let data = unsafe { (*byte_array).data };
        let len = unsafe { (*byte_array).len as usize };

        let values: Vec<value::Value> = if data.is_null() || len == 0 {
            vec![]
        } else if let Some(owned) = &adopted {
            owned
                .iter()
                .map(|&b| value::Value::Number(f64::from(b)))
                .collect()
        } else {
            unsafe { std::slice::from_raw_parts(data, len) }
                .iter()
                .map(|&b| value::Value::Number(b as f64))
                .collect()
        };

        drop(adopted);
        Ok(value::Value::Array(values))
    }

    fn decode_null_terminated_ptr_array(&self, ptr: *mut c_void) -> anyhow::Result<value::Value> {
        let ptr_array = ptr as *const *mut c_void;
        let values: anyhow::Result<Vec<value::Value>> = (|| {
            let mut values = Vec::new();
            let mut i = 0;
            loop {
                let item_ptr = unsafe { *ptr_array.offset(i) };
                if item_ptr.is_null() {
                    break;
                }
                let item_ffi = ffi::StashedValue::Ptr(item_ptr);
                values.push(self.item_descriptor.decode(&item_ffi)?);
                i += 1;
            }
            Ok(values)
        })();

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_free(ptr) };
        }

        Ok(value::Value::Array(values?))
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
        let items_full = matches!(&*self.item_descriptor, Codec::String(string_descriptor) if string_descriptor.ownership.is_full());

        let read_strv = |items: &[glib::GStringPtr]| {
            items
                .iter()
                .map(|item| {
                    value::Value::String(
                        unsafe { glib::GStr::from_ptr_lossy(item.as_ptr()) }.to_string(),
                    )
                })
                .collect::<Vec<_>>()
        };

        let values = if self.ownership.is_full() {
            let strv = if items_full {
                unsafe { glib::StrV::from_glib_full(ptr as *mut *mut c_char) }
            } else {
                unsafe { glib::StrV::from_glib_container(ptr as *mut *const c_char) }
            };
            read_strv(&strv)
        } else {
            let borrowed = unsafe { glib::StrVRef::from_glib_borrow(ptr as *const *const c_char) };
            read_strv(borrowed)
        };

        value::Value::Array(values)
    }

    fn decode_storage(&self, storage: &Stash) -> anyhow::Result<value::Value> {
        let values = match self.item_codec("array")? {
            ItemCodec::Integer(kind) | ItemCodec::EnumFlags(kind) => kind
                .vec_to_f64(storage)?
                .into_iter()
                .map(value::Value::Number)
                .collect(),
            ItemCodec::BigInt(kind) => storage
                .as_bigint_vec(kind)?
                .into_iter()
                .map(value::Value::BigInt)
                .collect(),
            ItemCodec::Float(FloatKind::F32) => storage
                .as_f32_slice()?
                .iter()
                .map(|v| value::Value::Number(f64::from(*v)))
                .collect(),
            ItemCodec::Float(FloatKind::F64) => storage
                .as_f64_slice()?
                .iter()
                .map(|v| value::Value::Number(*v))
                .collect(),
            ItemCodec::Boolean => storage
                .as_bool_slice()?
                .iter()
                .map(|v| value::Value::Boolean(*v != 0))
                .collect(),
            ItemCodec::Pointer => storage
                .as_object_array()?
                .iter()
                .map(|handle| value::Value::Object(handle.clone()))
                .collect(),
            ItemCodec::String => match storage.kind() {
                StashKind::StrV(strv) => strv
                    .iter()
                    .map(|item| {
                        value::Value::String(
                            unsafe { glib::GStr::from_ptr_lossy(item.as_ptr()) }.to_string(),
                        )
                    })
                    .collect(),
                _ => storage
                    .as_cstring_array()?
                    .iter()
                    .map(|cstr| Ok(value::Value::String(cstr.to_str()?.to_string())))
                    .collect::<anyhow::Result<Vec<value::Value>>>()?,
            },
        };

        Ok(value::Value::Array(values))
    }

    fn decode_sized_array(&self, ptr: *mut c_void, length: usize) -> anyhow::Result<value::Value> {
        let codec = self.item_codec("sized array")?;
        let values = self.decode_contiguous(codec, ptr.cast::<u8>(), length)?;
        Ok(value::Value::Array(values))
    }

    pub unsafe fn ptr_to_value_sized(
        &self,
        ptr: *mut c_void,
        length: usize,
    ) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }
        self.decode_sized_array(ptr, length)
    }

    fn validated_size(size: f64, param_index: usize) -> anyhow::Result<usize> {
        if size < 0.0 || !size.is_finite() {
            bail!("Array size parameter at index {param_index} has invalid value: {size}");
        }
        Ok(size as usize)
    }

    fn size_from_args(
        ffi_args: &[ffi::StashedValue],
        args: &[Arg],
        size_index: usize,
    ) -> anyhow::Result<usize> {
        if size_index >= ffi_args.len() {
            bail!(
                "Size parameter index {} is out of bounds (args count: {})",
                size_index,
                ffi_args.len()
            );
        }

        let ffi_arg = &ffi_args[size_index];
        let arg = &args[size_index];

        if let Codec::Ref(ref_descriptor) = &arg.descriptor
            && let Codec::Integer(integer_kind) = &*ref_descriptor.inner_descriptor
        {
            match ffi_arg {
                ffi::StashedValue::Storage(storage) => {
                    let size = unsafe { integer_kind.read_ptr(storage.ptr() as *const u8) };
                    return Self::validated_size(size, size_index);
                }
                ffi::StashedValue::Ptr(ptr) if !ptr.is_null() => {
                    let size = unsafe { integer_kind.read_ptr(*ptr as *const u8) };
                    return Self::validated_size(size, size_index);
                }
                _ => {}
            }
        }

        if let Codec::Integer(_) = &arg.descriptor
            && let Ok(num) = ffi_arg.to_number()
        {
            return Self::validated_size(num, size_index);
        }

        bail!(
            "Could not extract size from parameter at index {}: expected Ref<Integer> or Integer, got type {:?} with ffi value {:?}",
            size_index,
            arg.descriptor,
            ffi_arg
        );
    }
}
