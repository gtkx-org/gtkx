use std::ffi::{CStr, CString, c_char, c_void};

use anyhow::bail;
use gtk4::glib;
use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use super::{FfiDecoder, FfiEncoder, GlibValueCodec, Ownership, RawPtrCodec};
use crate::arg::Arg;
use crate::ffi::{FfiStorage, FfiStorageKind};
use crate::types::{FloatKind, IntegerKind, Type};
use crate::{ffi, value};

#[derive(Debug, Clone, PartialEq, Eq)]
#[non_exhaustive]
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
                "'kind' must be 'array', 'glist', 'gslist', 'gptrarray', 'garray', 'gbytearray', 'sized', or 'fixed'; got '{s}'"
            )),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ArrayType {
    pub item_type: Box<Type>,
    pub kind: ArrayKind,
    pub ownership: Ownership,
    pub element_size: Option<usize>,
}

impl ArrayType {
    pub fn from_js_value(env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let item_type_value: Unknown<'_> = obj.get_named_property("itemType")?;
        let item_type = Type::from_js_value(env, item_type_value)?;

        let kind_str: String = obj.get_named_property("kind").map_err(|_| {
            napi::Error::new(
                napi::Status::InvalidArg,
                "'kind' property is required for array types",
            )
        })?;

        let kind: ArrayKind = kind_str
            .parse()
            .map_err(|e: String| napi::Error::new(napi::Status::InvalidArg, e))?;

        let kind = match kind {
            ArrayKind::Sized { .. } => {
                let size_index: f64 = obj
                    .get_named_property::<Option<f64>>("sizeParamIndex")
                    .ok()
                    .flatten()
                    .ok_or_else(|| {
                        napi::Error::new(
                            napi::Status::InvalidArg,
                            "'sizeParamIndex' is required for sized arrays",
                        )
                    })?;
                ArrayKind::Sized {
                    size_index: size_index as usize,
                }
            }
            ArrayKind::Fixed { .. } => {
                let fixed_size: f64 = obj
                    .get_named_property::<Option<f64>>("fixedSize")
                    .ok()
                    .flatten()
                    .ok_or_else(|| {
                        napi::Error::new(
                            napi::Status::InvalidArg,
                            "'fixedSize' is required for fixed arrays",
                        )
                    })?;
                ArrayKind::Fixed {
                    size: fixed_size as usize,
                }
            }
            other => other,
        };

        let element_size: Option<usize> = obj
            .get_named_property::<Option<f64>>("elementSize")
            .ok()
            .flatten()
            .map(|n| n as usize);

        let ownership = Ownership::from_js_value(obj, "array")?;

        Ok(Self {
            item_type: Box::new(item_type),
            kind,
            ownership,
            element_size,
        })
    }
}

impl FfiEncoder for ArrayType {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        Self::encode(self, value, optional)
    }
}

impl FfiDecoder for ArrayType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        Self::decode(self, ffi_value)
    }

    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[crate::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        Self::decode_with_context(self, ffi_value, ffi_args, args)
    }
}

impl RawPtrCodec for ArrayType {
    #[allow(clippy::not_unsafe_ptr_arg_deref)]
    fn ptr_to_value(
        &self,
        ptr: *mut std::ffi::c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        unsafe { Self::ptr_to_value(self, ptr) }
    }
}

impl GlibValueCodec for ArrayType {}

trait ArrayKindEncoder {
    fn encode_integers(
        &self,
        values: &[f64],
        int_type: IntegerKind,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue>;

    fn encode_floats(
        &self,
        values: &[f64],
        float_kind: FloatKind,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue>;

    fn encode_booleans(
        &self,
        values: &[i32],
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue>;

    fn encode_strings(
        &self,
        cstrings: Vec<CString>,
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue>;

    fn encode_handles(
        &self,
        handles: &[crate::managed::NativeHandle],
        item_type: &Type,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue>;
}

struct NullTerminatedArrayEncoder;

impl ArrayKindEncoder for NullTerminatedArrayEncoder {
    fn encode_integers(
        &self,
        values: &[f64],
        int_type: IntegerKind,
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Storage(
            int_type.checked_to_ffi_storage(values)?,
        ))
    }

    fn encode_floats(
        &self,
        values: &[f64],
        float_kind: FloatKind,
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        match float_kind {
            FloatKind::F32 => {
                let values: Vec<f32> = values
                    .iter()
                    .enumerate()
                    .map(|(i, &v)| {
                        if v.is_finite() && (v > f32::MAX as f64 || v < -(f32::MAX as f64)) {
                            bail!("Array element {i}: value {v} is out of range for f32");
                        }
                        Ok(v as f32)
                    })
                    .collect::<anyhow::Result<Vec<f32>>>()?;
                Ok(ffi::FfiValue::Storage(values.into()))
            }
            FloatKind::F64 => Ok(ffi::FfiValue::Storage(values.to_vec().into())),
        }
    }

    fn encode_booleans(
        &self,
        values: &[i32],
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Storage(values.to_vec().into()))
    }

    fn encode_strings(
        &self,
        cstrings: Vec<CString>,
        dup_elements: bool,
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let mut ptrs: Vec<*mut c_void> = cstrings
            .iter()
            .map(|s| {
                if dup_elements {
                    unsafe { glib::ffi::g_strdup(s.as_ptr()) as *mut c_void }
                } else {
                    s.as_ptr() as *mut c_void
                }
            })
            .collect();

        ptrs.push(std::ptr::null_mut());

        let ptr = ptrs.as_ptr() as *mut c_void;

        Ok(ffi::FfiValue::Storage(FfiStorage::new(
            ptr,
            FfiStorageKind::StringArray(cstrings, ptrs),
        )))
    }

    fn encode_handles(
        &self,
        handles: &[crate::managed::NativeHandle],
        item_type: &Type,
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let mut ptrs: Vec<*mut c_void> = Vec::with_capacity(handles.len());
        for handle in handles {
            let ptr = handle.ptr();
            if ptr.is_null() {
                bail!("GObject in array has a null pointer");
            }
            ptrs.push(item_type.ref_for_transfer(ptr)?);
        }
        let ptr = ptrs.as_ptr() as *mut c_void;

        Ok(ffi::FfiValue::Storage(FfiStorage::new(
            ptr,
            FfiStorageKind::ObjectArray(handles.to_vec(), ptrs),
        )))
    }
}

struct GListEncoder;

impl ArrayKindEncoder for GListEncoder {
    fn encode_integers(
        &self,
        values: &[f64],
        int_type: IntegerKind,
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Storage(
            int_type.checked_to_ffi_storage(values)?,
        ))
    }

    fn encode_floats(
        &self,
        values: &[f64],
        float_kind: FloatKind,
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        match float_kind {
            FloatKind::F32 => {
                let values: Vec<f32> = values
                    .iter()
                    .enumerate()
                    .map(|(i, &v)| {
                        if v.is_finite() && (v > f32::MAX as f64 || v < -(f32::MAX as f64)) {
                            bail!("Array element {i}: value {v} is out of range for f32");
                        }
                        Ok(v as f32)
                    })
                    .collect::<anyhow::Result<Vec<f32>>>()?;
                Ok(ffi::FfiValue::Storage(values.into()))
            }
            FloatKind::F64 => Ok(ffi::FfiValue::Storage(values.to_vec().into())),
        }
    }

    fn encode_booleans(
        &self,
        values: &[i32],
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Storage(values.to_vec().into()))
    }

    fn encode_strings(
        &self,
        cstrings: Vec<CString>,
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let should_free = ownership.is_borrowed();
        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
        for s in &cstrings {
            let ptr = if dup_elements {
                unsafe { glib::ffi::g_strdup(s.as_ptr()) as *mut c_void }
            } else {
                s.as_ptr() as *mut c_void
            };
            list = unsafe { glib::ffi::g_list_append(list, ptr) };
        }
        Ok(ffi::FfiValue::Storage(FfiStorage::new(
            list as *mut c_void,
            FfiStorageKind::StringGList(ffi::StringGListData {
                strings: cstrings,
                list_ptr: list,
                should_free,
                elements_duped: dup_elements,
            }),
        )))
    }

    fn encode_handles(
        &self,
        handles: &[crate::managed::NativeHandle],
        item_type: &Type,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let should_free = ownership.is_borrowed();
        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
        for handle in handles {
            let ptr = handle.ptr();
            if ptr.is_null() {
                bail!("GObject in GList has a null pointer");
            }
            let ptr = item_type.ref_for_transfer(ptr)?;
            list = unsafe { glib::ffi::g_list_append(list, ptr) };
        }
        Ok(ffi::FfiValue::Storage(FfiStorage::new(
            list as *mut c_void,
            FfiStorageKind::GList(ffi::GListData {
                handles: handles.to_vec(),
                list_ptr: list,
                should_free,
            }),
        )))
    }
}

struct GSListEncoder;

impl ArrayKindEncoder for GSListEncoder {
    fn encode_integers(
        &self,
        values: &[f64],
        int_type: IntegerKind,
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Storage(
            int_type.checked_to_ffi_storage(values)?,
        ))
    }

    fn encode_floats(
        &self,
        values: &[f64],
        float_kind: FloatKind,
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        match float_kind {
            FloatKind::F32 => {
                let values: Vec<f32> = values
                    .iter()
                    .enumerate()
                    .map(|(i, &v)| {
                        if v.is_finite() && (v > f32::MAX as f64 || v < -(f32::MAX as f64)) {
                            bail!("Array element {i}: value {v} is out of range for f32");
                        }
                        Ok(v as f32)
                    })
                    .collect::<anyhow::Result<Vec<f32>>>()?;
                Ok(ffi::FfiValue::Storage(values.into()))
            }
            FloatKind::F64 => Ok(ffi::FfiValue::Storage(values.to_vec().into())),
        }
    }

    fn encode_booleans(
        &self,
        values: &[i32],
        _ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Storage(values.to_vec().into()))
    }

    fn encode_strings(
        &self,
        cstrings: Vec<CString>,
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let should_free = ownership.is_borrowed();
        let mut list: *mut glib::ffi::GSList = std::ptr::null_mut();
        for s in cstrings.iter().rev() {
            let ptr = if dup_elements {
                unsafe { glib::ffi::g_strdup(s.as_ptr()) as *mut c_void }
            } else {
                s.as_ptr() as *mut c_void
            };
            list = unsafe { glib::ffi::g_slist_prepend(list, ptr) };
        }
        Ok(ffi::FfiValue::Storage(FfiStorage::new(
            list as *mut c_void,
            FfiStorageKind::StringGSList(ffi::StringGSListData {
                strings: cstrings,
                list_ptr: list,
                should_free,
                elements_duped: dup_elements,
            }),
        )))
    }

    fn encode_handles(
        &self,
        handles: &[crate::managed::NativeHandle],
        item_type: &Type,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let should_free = ownership.is_borrowed();
        let mut list: *mut glib::ffi::GSList = std::ptr::null_mut();
        for handle in handles.iter().rev() {
            let ptr = handle.ptr();
            if ptr.is_null() {
                bail!("GObject in GSList has a null pointer");
            }
            let ptr = item_type.ref_for_transfer(ptr)?;
            list = unsafe { glib::ffi::g_slist_prepend(list, ptr) };
        }
        Ok(ffi::FfiValue::Storage(FfiStorage::new(
            list as *mut c_void,
            FfiStorageKind::GSList(ffi::GSListData {
                handles: handles.to_vec(),
                list_ptr: list,
                should_free,
            }),
        )))
    }
}

impl ArrayType {
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

    fn extract_handles(
        array: &[value::Value],
    ) -> anyhow::Result<Vec<crate::managed::NativeHandle>> {
        array
            .iter()
            .map(|v| match v {
                value::Value::Object(handle) => Ok(handle.clone()),
                _ => bail!("Expected an Object, got {v:?}"),
            })
            .collect()
    }

    fn item_element_size(&self) -> Option<usize> {
        match &*self.item_type {
            Type::Integer(int_type) => Some(int_type.byte_size()),
            Type::Float(super::FloatKind::F32) => Some(4),
            Type::Float(super::FloatKind::F64) => Some(8),
            Type::Boolean(_) => Some(size_of::<i32>()),
            Type::GObject(_)
            | Type::Boxed(_)
            | Type::Struct(_)
            | Type::Fundamental(_)
            | Type::String(_) => Some(std::mem::size_of::<*mut c_void>()),
            Type::Enum(e) => Some(e.storage.byte_size()),
            Type::Flags(f) => Some(f.storage.byte_size()),
            Type::Void(_)
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar(_) => None,
        }
    }

    pub fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let array = match val {
            value::Value::Array(arr) => arr,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected an Array for array type, got {val:?}"),
        };

        if self.kind == ArrayKind::GByteArray {
            return self.encode_gbytearray(array);
        }

        if self.kind == ArrayKind::GArray {
            return self.encode_garray(array);
        }

        let encoder: &dyn ArrayKindEncoder = match &self.kind {
            ArrayKind::GList => &GListEncoder,
            ArrayKind::GSList => &GSListEncoder,
            ArrayKind::Array
            | ArrayKind::GPtrArray
            | ArrayKind::Sized { .. }
            | ArrayKind::Fixed { .. } => &NullTerminatedArrayEncoder,
            ArrayKind::GArray | ArrayKind::GByteArray => unreachable!(),
        };

        match &*self.item_type {
            Type::Integer(int_type) => {
                let values = Self::extract_numbers(array)?;
                encoder.encode_integers(&values, *int_type, self.ownership)
            }
            Type::Float(float_kind) => {
                let values = Self::extract_numbers(array)?;
                encoder.encode_floats(&values, *float_kind, self.ownership)
            }
            Type::Boolean(_) => {
                let values = Self::extract_booleans(array)?;
                encoder.encode_booleans(&values, self.ownership)
            }
            Type::String(_) => {
                let cstrings = Self::extract_strings(array)?;
                let dup_elements =
                    matches!(&*self.item_type, Type::String(s) if s.ownership.is_full());
                encoder.encode_strings(cstrings, dup_elements, self.ownership)
            }
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
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
                    return Ok(ffi::FfiValue::Storage(buffer.into()));
                }

                encoder.encode_handles(&handles, &self.item_type, self.ownership)
            }
            Type::Enum(e) => {
                let values = Self::extract_numbers(array)?;
                Ok(ffi::FfiValue::Storage(e.storage.to_ffi_storage(&values)))
            }
            Type::Flags(f) => {
                let values = Self::extract_numbers(array)?;
                Ok(ffi::FfiValue::Storage(f.storage.to_ffi_storage(&values)))
            }
            Type::Void(_)
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar(_) => bail!("Unsupported array item type: {:?}", self.item_type),
        }
    }

    fn encode_gbytearray(&self, array: &[value::Value]) -> anyhow::Result<ffi::FfiValue> {
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

        let should_free = self.ownership.is_borrowed();
        Ok(ffi::FfiValue::Storage(FfiStorage::new(
            byte_array as *mut c_void,
            FfiStorageKind::GByteArray(ffi::GByteArrayData {
                array_ptr: byte_array,
                should_free,
            }),
        )))
    }

    fn append_integer_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        int_type: &super::IntegerKind,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        for n in Self::extract_numbers(array)? {
            let mut buf = vec![0u8; int_type.byte_size()];
            int_type.write_ptr(buf.as_mut_ptr(), n);
            unsafe {
                glib::ffi::g_array_append_vals(g_array, buf.as_ptr() as *const c_void, 1);
            }
        }
        Ok(())
    }

    fn append_float_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        float_kind: &super::FloatKind,
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
    ) -> anyhow::Result<()> {
        for handle in Self::extract_handles(array)? {
            let ptr = handle.ptr();
            if ptr.is_null() {
                anyhow::bail!("Object in GArray has a null pointer");
            }
            let ptr = self.item_type.ref_for_transfer(ptr)?;
            unsafe {
                glib::ffi::g_array_append_vals(
                    g_array,
                    &ptr as *const *mut c_void as *const c_void,
                    1,
                );
            }
        }
        Ok(())
    }

    fn append_enum_like_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        storage: &super::IntegerKind,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        for n in Self::extract_numbers(array)? {
            let mut buf = vec![0u8; storage.byte_size()];
            storage.write_ptr(buf.as_mut_ptr(), n);
            unsafe {
                glib::ffi::g_array_append_vals(g_array, buf.as_ptr() as *const c_void, 1);
            }
        }
        Ok(())
    }

    fn append_items_to_garray(
        &self,
        g_array: *mut glib::ffi::GArray,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        match &*self.item_type {
            Type::Integer(int_type) => {
                Self::append_integer_values_to_garray(g_array, int_type, array)
            }
            Type::Float(float_kind) => {
                Self::append_float_values_to_garray(g_array, float_kind, array)
            }
            Type::Boolean(_) => {
                for b in Self::extract_booleans(array)? {
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &b as *const i32 as *const c_void,
                            1,
                        );
                    }
                }
                Ok(())
            }
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
                self.append_handle_values_to_garray(g_array, array)
            }
            Type::String(_) => {
                for cstr in Self::extract_strings(array)? {
                    let dup = unsafe { glib::ffi::g_strdup(cstr.as_ptr()) };
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &dup as *const *mut c_char as *const c_void,
                            1,
                        );
                    }
                }
                Ok(())
            }
            Type::Enum(e) => Self::append_enum_like_values_to_garray(g_array, &e.storage, array),
            Type::Flags(f) => Self::append_enum_like_values_to_garray(g_array, &f.storage, array),
            Type::Void(_)
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar(_) => {
                unsafe { glib::ffi::g_array_unref(g_array) };
                bail!("Unsupported GArray item type: {:?}", self.item_type);
            }
        }
    }

    fn encode_garray(&self, array: &[value::Value]) -> anyhow::Result<ffi::FfiValue> {
        let element_size = self
            .element_size
            .or_else(|| self.item_element_size())
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "Cannot determine element size for GArray with item type {:?}",
                    self.item_type
                )
            })?;

        let g_array =
            unsafe { glib::ffi::g_array_sized_new(0, 0, element_size as u32, array.len() as u32) };

        self.append_items_to_garray(g_array, array)?;

        let should_free = self.ownership.is_borrowed();
        Ok(ffi::FfiValue::Storage(FfiStorage::new(
            g_array as *mut c_void,
            FfiStorageKind::GArray(ffi::GArrayData {
                array_ptr: g_array,
                should_free,
            }),
        )))
    }

    pub fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        match &self.kind {
            ArrayKind::GList | ArrayKind::GSList => return self.decode_glist(ffi_value),
            ArrayKind::GArray => return self.decode_garray(ffi_value),
            ArrayKind::GPtrArray => return self.decode_gptrarray(ffi_value),
            ArrayKind::GByteArray => return self.decode_gbytearray(ffi_value),
            ArrayKind::Array | ArrayKind::Sized { .. } | ArrayKind::Fixed { .. } => {}
        }

        if let ffi::FfiValue::Ptr(ptr) = ffi_value {
            if ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            if matches!(&*self.item_type, Type::String(_)) {
                return Ok(self.decode_null_terminated_string_array(*ptr));
            }

            return self.decode_null_terminated_ptr_array(*ptr);
        }

        let ffi::FfiValue::Storage(storage) = ffi_value else {
            bail!("Expected a Storage ffi::FfiValue for Array, got {ffi_value:?}")
        };

        self.decode_storage(storage)
    }

    pub fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
    ) -> anyhow::Result<value::Value> {
        match &self.kind {
            ArrayKind::Sized { size_index } => {
                let length = Self::size_from_args(ffi_args, args, *size_index)?;

                if let ffi::FfiValue::Ptr(ptr) = ffi_value {
                    if ptr.is_null() {
                        return Ok(value::Value::Array(vec![]));
                    }

                    return self.decode_sized_array(*ptr, length);
                }
            }
            ArrayKind::Fixed { size } => {
                if let ffi::FfiValue::Ptr(ptr) = ffi_value {
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

        self.decode(ffi_value)
    }
}

impl ArrayType {
    pub(crate) fn decode_glist(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(list_ptr) = ffi_value.as_non_null_ptr("GList/GSList")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let mut values = Vec::new();
        let mut current = list_ptr as *mut glib::ffi::GList;

        while !current.is_null() {
            let data = unsafe { (*current).data };
            let item_ffi = ffi::FfiValue::Ptr(data);
            let item_value = self.item_type.decode(&item_ffi)?;
            values.push(item_value);
            current = unsafe { (*current).next };
        }

        if self.ownership.is_full() {
            if self.kind == ArrayKind::GSList {
                unsafe { glib::ffi::g_slist_free(list_ptr as *mut glib::ffi::GSList) };
            } else {
                unsafe { glib::ffi::g_list_free(list_ptr as *mut glib::ffi::GList) };
            }
        }

        Ok(value::Value::Array(values))
    }

    pub(crate) fn decode_garray(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(array_ptr) = ffi_value.as_non_null_ptr("GArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let g_array = array_ptr as *const glib::ffi::GArray;
        let data = unsafe { (*g_array).data as *const u8 };
        let len = unsafe { (*g_array).len as usize };

        let values = match &*self.item_type {
            Type::Integer(int_type) => {
                let f64_values = int_type.read_slice(data, len);
                f64_values.into_iter().map(value::Value::Number).collect()
            }
            Type::Float(float_kind) => match float_kind {
                super::FloatKind::F32 => unsafe {
                    std::slice::from_raw_parts(data as *const f32, len)
                        .iter()
                        .map(|&v| value::Value::Number(v as f64))
                        .collect()
                },
                super::FloatKind::F64 => unsafe {
                    std::slice::from_raw_parts(data as *const f64, len)
                        .iter()
                        .map(|&v| value::Value::Number(v))
                        .collect()
                },
            },
            Type::Boolean(_) => unsafe {
                std::slice::from_raw_parts(data as *const i32, len)
                    .iter()
                    .map(|&v| value::Value::Boolean(v != 0))
                    .collect()
            },
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
                let ptrs = unsafe { std::slice::from_raw_parts(data as *const *mut c_void, len) };
                let mut values = Vec::with_capacity(len);
                for &item_ptr in ptrs {
                    let item_ffi = ffi::FfiValue::Ptr(item_ptr);
                    values.push(self.item_type.decode(&item_ffi)?);
                }
                values
            }
            Type::String(_) => {
                let ptrs = unsafe { std::slice::from_raw_parts(data as *const *const c_char, len) };
                let mut values = Vec::with_capacity(len);
                for &str_ptr in ptrs {
                    if str_ptr.is_null() {
                        values.push(value::Value::Null);
                    } else {
                        let c_str = unsafe { CStr::from_ptr(str_ptr) };
                        values.push(value::Value::String(c_str.to_string_lossy().into_owned()));
                    }
                }
                values
            }
            Type::Enum(e) => {
                let f64_values = e.storage.read_slice(data, len);
                f64_values.into_iter().map(value::Value::Number).collect()
            }
            Type::Flags(f) => {
                let f64_values = f.storage.read_slice(data, len);
                f64_values.into_iter().map(value::Value::Number).collect()
            }
            Type::Void(_)
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar(_) => bail!("Unsupported GArray item type: {:?}", self.item_type),
        };

        if self.ownership.is_full() {
            let storage_owns = matches!(ffi_value, ffi::FfiValue::Storage(_));
            if !storage_owns {
                unsafe { glib::ffi::g_array_unref(array_ptr as *mut glib::ffi::GArray) };
            }
        }

        Ok(value::Value::Array(values))
    }

    fn decode_gptrarray(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = ffi_value.as_non_null_ptr("GPtrArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let ptr_array = ptr as *mut glib::ffi::GPtrArray;
        let len = unsafe { (*ptr_array).len as usize };
        let pdata = unsafe { (*ptr_array).pdata };
        let mut values = Vec::with_capacity(len);
        for i in 0..len {
            let item_ptr = unsafe { *pdata.add(i) };
            let item_ffi = ffi::FfiValue::Ptr(item_ptr);
            let item_value = self.item_type.decode(&item_ffi)?;
            values.push(item_value);
        }

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
        }

        Ok(value::Value::Array(values))
    }

    fn decode_gbytearray(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = ffi_value.as_non_null_ptr("GByteArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let byte_array = ptr as *const glib::ffi::GByteArray;
        let data = unsafe { (*byte_array).data };
        let len = unsafe { (*byte_array).len as usize };

        let values: Vec<value::Value> = if data.is_null() || len == 0 {
            vec![]
        } else {
            unsafe { std::slice::from_raw_parts(data, len) }
                .iter()
                .map(|&b| value::Value::Number(b as f64))
                .collect()
        };

        let storage_owns = matches!(ffi_value, ffi::FfiValue::Storage(_));
        if self.ownership.is_full() && !storage_owns {
            unsafe { glib::ffi::g_byte_array_unref(ptr as *mut glib::ffi::GByteArray) };
        }

        Ok(value::Value::Array(values))
    }

    fn decode_null_terminated_ptr_array(&self, ptr: *mut c_void) -> anyhow::Result<value::Value> {
        let ptr_array = ptr as *const *mut c_void;
        let mut values = Vec::new();
        let mut i = 0;
        loop {
            let item_ptr = unsafe { *ptr_array.offset(i) };
            if item_ptr.is_null() {
                break;
            }
            let item_ffi = ffi::FfiValue::Ptr(item_ptr);
            values.push(self.item_type.decode(&item_ffi)?);
            i += 1;
        }

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_free(ptr) };
        }

        Ok(value::Value::Array(values))
    }

    fn decode_null_terminated_string_array(&self, ptr: *mut c_void) -> value::Value {
        let mut values = Vec::new();
        let str_array = ptr as *const *const c_char;
        let mut i = 0;
        loop {
            let str_ptr = unsafe { *str_array.offset(i) };
            if str_ptr.is_null() {
                break;
            }
            let c_str = unsafe { CStr::from_ptr(str_ptr) };
            values.push(value::Value::String(c_str.to_string_lossy().into_owned()));
            i += 1;
        }

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_strfreev(ptr as *mut *mut c_char) };
        }

        value::Value::Array(values)
    }

    fn decode_storage(&self, storage: &FfiStorage) -> anyhow::Result<value::Value> {
        let values = match &*self.item_type {
            Type::Integer(int_type) => {
                let f64_vec = int_type.vec_to_f64(storage)?;
                f64_vec.into_iter().map(value::Value::Number).collect()
            }
            Type::Float(float_kind) => match float_kind {
                FloatKind::F32 => {
                    let f32_vec = storage.as_f32_slice()?;
                    f32_vec
                        .iter()
                        .map(|v| value::Value::Number(*v as f64))
                        .collect()
                }
                FloatKind::F64 => {
                    let f64_vec = storage.as_f64_slice()?;
                    f64_vec.iter().map(|v| value::Value::Number(*v)).collect()
                }
            },
            Type::String(_) => {
                let cstrings = storage.as_cstring_array()?;
                cstrings
                    .iter()
                    .map(|cstr| Ok(value::Value::String(cstr.to_str()?.to_string())))
                    .collect::<anyhow::Result<Vec<value::Value>>>()?
            }
            Type::Boolean(_) => {
                let bool_vec = storage.as_bool_slice()?;
                bool_vec
                    .iter()
                    .map(|v| value::Value::Boolean(*v != 0))
                    .collect()
            }
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
                let handles = storage.as_object_array()?;
                handles
                    .iter()
                    .map(|handle| value::Value::Object(handle.clone()))
                    .collect()
            }
            Type::Enum(e) => {
                let f64_vec = e.storage.vec_to_f64(storage)?;
                f64_vec.into_iter().map(value::Value::Number).collect()
            }
            Type::Flags(f) => {
                let f64_vec = f.storage.vec_to_f64(storage)?;
                f64_vec.into_iter().map(value::Value::Number).collect()
            }
            Type::Void(_)
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar(_) => bail!(
                "Unsupported array item type for ffi value conversion: {:?}",
                self.item_type
            ),
        };

        Ok(value::Value::Array(values))
    }

    fn decode_sized_array(&self, ptr: *mut c_void, length: usize) -> anyhow::Result<value::Value> {
        match &*self.item_type {
            Type::Integer(int_type) => Ok(Self::decode_sized_byte_array(ptr, length, int_type)),
            Type::Float(float_kind) => Ok(Self::decode_sized_float_array(ptr, length, *float_kind)),
            Type::Boolean(_) => Ok(Self::decode_sized_bool_array(ptr, length)),
            Type::GObject(_)
            | Type::Boxed(_)
            | Type::Struct(_)
            | Type::String(_)
            | Type::Fundamental(_) => self.decode_sized_ptr_array(ptr, length),
            Type::Enum(e) => Ok(Self::decode_sized_byte_array(ptr, length, &e.storage)),
            Type::Flags(f) => Ok(Self::decode_sized_byte_array(ptr, length, &f.storage)),
            Type::Void(_)
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar(_) => bail!(
                "Unsupported item type for sized array: {:?}",
                self.item_type
            ),
        }
    }

    fn decode_sized_ptr_array(
        &self,
        ptr: *mut c_void,
        length: usize,
    ) -> anyhow::Result<value::Value> {
        let ptr_array = ptr as *const *mut c_void;
        let mut values = Vec::with_capacity(length);
        for i in 0..length {
            let item_ptr = unsafe { *ptr_array.add(i) };
            let item_ffi = ffi::FfiValue::Ptr(item_ptr);
            values.push(self.item_type.decode(&item_ffi)?);
        }
        Ok(value::Value::Array(values))
    }

    fn decode_sized_float_array(
        ptr: *mut c_void,
        length: usize,
        float_kind: super::FloatKind,
    ) -> value::Value {
        if ptr.is_null() {
            return value::Value::Array(vec![]);
        }

        let values = match float_kind {
            super::FloatKind::F32 => unsafe {
                std::slice::from_raw_parts(ptr as *const f32, length)
                    .iter()
                    .map(|&v| value::Value::Number(v as f64))
                    .collect()
            },
            super::FloatKind::F64 => unsafe {
                std::slice::from_raw_parts(ptr as *const f64, length)
                    .iter()
                    .map(|&v| value::Value::Number(v))
                    .collect()
            },
        };

        value::Value::Array(values)
    }

    fn decode_sized_bool_array(ptr: *mut c_void, length: usize) -> value::Value {
        if ptr.is_null() {
            return value::Value::Array(vec![]);
        }

        let values = unsafe {
            std::slice::from_raw_parts(ptr as *const i32, length)
                .iter()
                .map(|&v| value::Value::Boolean(v != 0))
                .collect()
        };

        value::Value::Array(values)
    }

    fn decode_sized_byte_array(
        ptr: *mut c_void,
        length: usize,
        int_kind: &super::IntegerKind,
    ) -> value::Value {
        if ptr.is_null() {
            return value::Value::Array(vec![]);
        }

        let f64_values = int_kind.read_slice(ptr as *const u8, length);
        let values = f64_values.into_iter().map(value::Value::Number).collect();

        value::Value::Array(values)
    }

    /// # Safety
    /// `ptr` must be null or point to a valid array of the kind described by `self`.
    pub unsafe fn ptr_to_value(&self, ptr: *mut c_void) -> anyhow::Result<value::Value> {
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
                    let item_value = self.item_type.ptr_to_value(item_ptr, "GPtrArray item")?;
                    values.push(item_value);
                }
                Ok(value::Value::Array(values))
            }
            ArrayKind::GByteArray => {
                let ffi_value = ffi::FfiValue::Ptr(ptr);
                self.decode_gbytearray(&ffi_value)
            }
            ArrayKind::GArray => {
                let ffi_value = ffi::FfiValue::Ptr(ptr);
                self.decode_garray(&ffi_value)
            }
            ArrayKind::GList | ArrayKind::GSList => {
                let ffi_value = ffi::FfiValue::Ptr(ptr);
                self.decode_glist(&ffi_value)
            }
            ArrayKind::Array | ArrayKind::Sized { .. } | ArrayKind::Fixed { .. } => {
                let ffi_value = ffi::FfiValue::Ptr(ptr);
                self.decode(&ffi_value)
            }
        }
    }

    fn validated_size(size: f64, param_index: usize) -> anyhow::Result<usize> {
        if size < 0.0 || !size.is_finite() {
            bail!("Array size parameter at index {param_index} has invalid value: {size}");
        }
        Ok(size as usize)
    }

    fn size_from_args(
        ffi_args: &[ffi::FfiValue],
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

        if let Type::Ref(ref_type) = &arg.ty
            && let Type::Integer(int_type) = &*ref_type.inner_type
        {
            match ffi_arg {
                ffi::FfiValue::Storage(storage) => {
                    let size = int_type.read_ptr(storage.ptr() as *const u8);
                    return Self::validated_size(size, size_index);
                }
                ffi::FfiValue::Ptr(ptr) if !ptr.is_null() => {
                    let size = int_type.read_ptr(*ptr as *const u8);
                    return Self::validated_size(size, size_index);
                }
                _ => {}
            }
        }

        if let Type::Integer(_) = &arg.ty
            && let Ok(num) = ffi_arg.to_number()
        {
            return Self::validated_size(num, size_index);
        }

        bail!(
            "Could not extract size from parameter at index {}: expected Ref<Integer> or Integer, got type {:?} with ffi value {:?}",
            size_index,
            arg.ty,
            ffi_arg
        );
    }
}
