use std::ffi::{CStr, CString, c_char, c_void};

use anyhow::bail;
use gtk4::glib;
use libffi::middle as libffi;
use neon::object::Object as _;
use neon::prelude::*;

use super::Ownership;
use crate::arg::Arg;
use crate::ffi::{FfiStorage, FfiStorageKind};
use crate::types::{FloatKind, Type};
use crate::{ffi, value};

#[derive(Debug, Clone, PartialEq, Eq)]
#[non_exhaustive]
pub enum ArrayKind {
    Array,
    GList,
    GSList,
    GPtrArray,
    GArray,
    Sized { size_index: usize },
    Fixed { size: usize },
}

impl std::str::FromStr for ArrayKind {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "array" => Ok(ArrayKind::Array),
            "glist" => Ok(ArrayKind::GList),
            "gslist" => Ok(ArrayKind::GSList),
            "gptrarray" => Ok(ArrayKind::GPtrArray),
            "garray" => Ok(ArrayKind::GArray),
            "sized" => Ok(ArrayKind::Sized { size_index: 0 }),
            "fixed" => Ok(ArrayKind::Fixed { size: 0 }),
            _ => Err(format!(
                "'kind' must be 'array', 'glist', 'gslist', 'gptrarray', 'garray', 'sized', or 'fixed'; got '{}'",
                s
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
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let item_type_value: Handle<'_, JsValue> = obj.prop(cx, "itemType").get()?;
        let item_type = Type::from_js_value(cx, item_type_value)?;

        let kind_prop: Handle<'_, JsValue> = obj.prop(cx, "kind").get()?;
        let kind_str = kind_prop
            .downcast::<JsString, _>(cx)
            .or_else(|_| cx.throw_type_error("'kind' property is required for array types"))?
            .value(cx);

        let kind: ArrayKind = kind_str
            .parse()
            .map_err(|e: String| super::throw_str_error(cx, e))?;

        let kind = match kind {
            ArrayKind::Sized { .. } => {
                let size_index: Handle<JsNumber> =
                    obj.get_opt(cx, "sizeParamIndex")?.ok_or_else(|| {
                        super::throw_str_error(
                            cx,
                            "'sizeParamIndex' is required for sized arrays".into(),
                        )
                    })?;
                ArrayKind::Sized {
                    size_index: size_index.value(cx) as usize,
                }
            }
            ArrayKind::Fixed { .. } => {
                let fixed_size: Handle<JsNumber> =
                    obj.get_opt(cx, "fixedSize")?.ok_or_else(|| {
                        super::throw_str_error(
                            cx,
                            "'fixedSize' is required for fixed arrays".into(),
                        )
                    })?;
                ArrayKind::Fixed {
                    size: fixed_size.value(cx) as usize,
                }
            }
            other => other,
        };

        let element_size: Option<usize> = {
            let size_prop: Option<Handle<JsNumber>> = obj.get_opt(cx, "elementSize")?;
            size_prop.map(|n| n.value(cx) as usize)
        };

        let ownership = Ownership::from_js_value(cx, obj, "array")?;

        Ok(ArrayType {
            item_type: Box::new(item_type),
            kind,
            ownership,
            element_size,
        })
    }
}

impl From<&ArrayType> for libffi::Type {
    fn from(_: &ArrayType) -> Self {
        libffi::Type::pointer()
    }
}

fn extract_numbers(array: &[value::Value]) -> anyhow::Result<Vec<f64>> {
    array
        .iter()
        .map(|v| match v {
            value::Value::Number(n) => Ok(*n),
            _ => bail!("Expected a Number, got {:?}", v),
        })
        .collect()
}

fn extract_booleans(array: &[value::Value]) -> anyhow::Result<Vec<i32>> {
    array
        .iter()
        .map(|v| match v {
            value::Value::Boolean(b) => Ok(i32::from(*b)),
            _ => bail!("Expected a Boolean, got {:?}", v),
        })
        .collect()
}

fn extract_strings(array: &[value::Value]) -> anyhow::Result<Vec<CString>> {
    array
        .iter()
        .map(|v| match v {
            value::Value::String(s) => Ok(CString::new(s.as_bytes())?),
            _ => bail!("Expected a String, got {:?}", v),
        })
        .collect()
}

fn extract_handles(array: &[value::Value]) -> anyhow::Result<Vec<crate::managed::NativeHandle>> {
    array
        .iter()
        .map(|v| match v {
            value::Value::Object(handle) => Ok(*handle),
            _ => bail!("Expected an Object, got {:?}", v),
        })
        .collect()
}

impl ArrayType {
    fn item_element_size(&self) -> Option<usize> {
        match &*self.item_type {
            Type::Integer(int_type) => Some(int_type.byte_size()),
            Type::Float(super::FloatKind::F32) => Some(4),
            Type::Float(super::FloatKind::F64) => Some(8),
            Type::Boolean => Some(size_of::<i32>()),
            Type::GObject(_)
            | Type::Boxed(_)
            | Type::Struct(_)
            | Type::Fundamental(_)
            | Type::String(_) => Some(std::mem::size_of::<*mut c_void>()),
            Type::Enum(_)
            | Type::Flags(_)
            | Type::Void
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar => None,
        }
    }

    pub fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let array = match val {
            value::Value::Array(arr) => arr,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected an Array for array type, got {:?}", val),
        };

        if self.kind == ArrayKind::GArray {
            return self.encode_garray(array);
        }

        match *self.item_type {
            Type::Integer(ref int_type) => {
                let values = extract_numbers(array)?;
                Ok(ffi::FfiValue::Storage(int_type.to_ffi_storage(&values)))
            }
            Type::Float(ref float_kind) => {
                let values = extract_numbers(array)?;
                match float_kind {
                    FloatKind::F32 => {
                        let values: Vec<f32> = values.iter().map(|&v| v as f32).collect();
                        Ok(ffi::FfiValue::Storage(values.into()))
                    }
                    FloatKind::F64 => Ok(ffi::FfiValue::Storage(values.into())),
                }
            }
            Type::String(_) => {
                let cstrings = extract_strings(array)?;
                let should_free = self.ownership.is_borrowed();
                let dup_strings =
                    matches!(&*self.item_type, Type::String(s) if s.ownership.is_full());

                match self.kind {
                    ArrayKind::GList => {
                        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
                        for s in &cstrings {
                            let ptr = if dup_strings {
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
                            }),
                        )))
                    }
                    ArrayKind::GSList => {
                        let mut list: *mut glib::ffi::GSList = std::ptr::null_mut();
                        for s in cstrings.iter().rev() {
                            let ptr = if dup_strings {
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
                            }),
                        )))
                    }
                    ArrayKind::Array
                    | ArrayKind::GPtrArray
                    | ArrayKind::GArray
                    | ArrayKind::Sized { .. }
                    | ArrayKind::Fixed { .. } => {
                        let mut ptrs: Vec<*mut c_void> =
                            cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();

                        ptrs.push(std::ptr::null_mut());

                        let ptr = ptrs.as_ptr() as *mut c_void;

                        Ok(ffi::FfiValue::Storage(FfiStorage::new(
                            ptr,
                            FfiStorageKind::StringArray(cstrings, ptrs),
                        )))
                    }
                }
            }
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
                let handles = extract_handles(array)?;

                if let Some(element_size) = self.element_size {
                    let mut buffer = vec![0u8; handles.len() * element_size];
                    for (i, handle) in handles.iter().enumerate() {
                        match handle.get_ptr() {
                            Some(ptr) => {
                                let offset = i * element_size;
                                unsafe {
                                    std::ptr::copy_nonoverlapping(
                                        ptr as *const u8,
                                        buffer.as_mut_ptr().add(offset),
                                        element_size,
                                    );
                                }
                            }
                            None => bail!("GObject in array has been garbage collected"),
                        }
                    }
                    return Ok(ffi::FfiValue::Storage(buffer.into()));
                }

                let should_free = self.ownership.is_borrowed();

                match self.kind {
                    ArrayKind::GList => {
                        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
                        for handle in &handles {
                            match handle.get_ptr() {
                                Some(ptr) => {
                                    let ptr = unsafe { self.item_type.ref_for_transfer(ptr)? };
                                    list = unsafe { glib::ffi::g_list_append(list, ptr) };
                                }
                                None => bail!("GObject in GList has been garbage collected"),
                            }
                        }
                        Ok(ffi::FfiValue::Storage(FfiStorage::new(
                            list as *mut c_void,
                            FfiStorageKind::GList(ffi::GListData {
                                handles,
                                list_ptr: list,
                                should_free,
                            }),
                        )))
                    }
                    ArrayKind::GSList => {
                        let mut list: *mut glib::ffi::GSList = std::ptr::null_mut();
                        for handle in handles.iter().rev() {
                            match handle.get_ptr() {
                                Some(ptr) => {
                                    let ptr = unsafe { self.item_type.ref_for_transfer(ptr)? };
                                    list = unsafe { glib::ffi::g_slist_prepend(list, ptr) };
                                }
                                None => bail!("GObject in GSList has been garbage collected"),
                            }
                        }
                        Ok(ffi::FfiValue::Storage(FfiStorage::new(
                            list as *mut c_void,
                            FfiStorageKind::GSList(ffi::GSListData {
                                handles,
                                list_ptr: list,
                                should_free,
                            }),
                        )))
                    }
                    ArrayKind::Array
                    | ArrayKind::GPtrArray
                    | ArrayKind::GArray
                    | ArrayKind::Sized { .. }
                    | ArrayKind::Fixed { .. } => {
                        let mut ptrs: Vec<*mut c_void> = Vec::with_capacity(handles.len());
                        for handle in &handles {
                            match handle.get_ptr() {
                                Some(ptr) => {
                                    ptrs.push(unsafe { self.item_type.ref_for_transfer(ptr)? });
                                }
                                None => bail!("GObject in array has been garbage collected"),
                            }
                        }
                        let ptr = ptrs.as_ptr() as *mut c_void;

                        Ok(ffi::FfiValue::Storage(FfiStorage::new(
                            ptr,
                            FfiStorageKind::ObjectArray(handles, ptrs),
                        )))
                    }
                }
            }
            Type::Boolean => {
                let values = extract_booleans(array)?;
                Ok(ffi::FfiValue::Storage(values.into()))
            }
            Type::Enum(_)
            | Type::Flags(_)
            | Type::Void
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar => bail!("Unsupported array item type: {:?}", self.item_type),
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

        match &*self.item_type {
            Type::Integer(int_type) => {
                for n in extract_numbers(array)? {
                    let mut buf = vec![0u8; int_type.byte_size()];
                    int_type.write_ptr(buf.as_mut_ptr(), n);
                    unsafe {
                        glib::ffi::g_array_append_vals(g_array, buf.as_ptr() as *const c_void, 1);
                    }
                }
            }
            Type::Float(float_kind) => {
                for n in extract_numbers(array)? {
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
                            glib::ffi::g_array_append_vals(
                                g_array,
                                &n as *const f64 as *const c_void,
                                1,
                            );
                        },
                    }
                }
            }
            Type::Boolean => {
                for b in extract_booleans(array)? {
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &b as *const i32 as *const c_void,
                            1,
                        );
                    }
                }
            }
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
                for handle in extract_handles(array)? {
                    let ptr = handle.get_ptr().ok_or_else(|| {
                        anyhow::anyhow!("Object in GArray has been garbage collected")
                    })?;
                    let ptr = unsafe { self.item_type.ref_for_transfer(ptr)? };
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &ptr as *const *mut c_void as *const c_void,
                            1,
                        );
                    }
                }
            }
            Type::String(_) => {
                for cstr in extract_strings(array)? {
                    let dup = unsafe { glib::ffi::g_strdup(cstr.as_ptr()) };
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &dup as *const *mut c_char as *const c_void,
                            1,
                        );
                    }
                }
            }
            Type::Enum(_)
            | Type::Flags(_)
            | Type::Void
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar => {
                unsafe { glib::ffi::g_array_unref(g_array) };
                bail!("Unsupported GArray item type: {:?}", self.item_type);
            }
        }

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
            ArrayKind::Array | ArrayKind::Sized { .. } | ArrayKind::Fixed { .. } => {}
        }

        if let ffi::FfiValue::Ptr(ptr) = ffi_value {
            if ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            if matches!(&*self.item_type, Type::String(_)) {
                return self.decode_null_terminated_string_array(*ptr);
            }

            return self.decode_null_terminated_ptr_array(*ptr);
        }

        let storage = match ffi_value {
            ffi::FfiValue::Storage(s) => s,
            _ => bail!(
                "Expected a Storage ffi::FfiValue for Array, got {:?}",
                ffi_value
            ),
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
                let length = self.size_from_args(ffi_args, args, *size_index)?;

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
            | ArrayKind::GArray => {}
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
            let item_value = unsafe { self.item_type.ptr_to_value(data, "GList item")? };
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
            Type::Boolean => unsafe {
                std::slice::from_raw_parts(data as *const i32, len)
                    .iter()
                    .map(|&v| value::Value::Boolean(v != 0))
                    .collect()
            },
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
                let ptrs = unsafe { std::slice::from_raw_parts(data as *const *mut c_void, len) };
                let mut values = Vec::with_capacity(len);
                for &item_ptr in ptrs {
                    values.push(unsafe { self.item_type.ptr_to_value(item_ptr, "GArray item")? });
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
            Type::Enum(_)
            | Type::Flags(_)
            | Type::Void
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar => bail!("Unsupported GArray item type: {:?}", self.item_type),
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
            let item_value = unsafe { self.item_type.ptr_to_value(item_ptr, "GPtrArray item")? };
            values.push(item_value);
        }

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
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
            values.push(unsafe {
                self.item_type
                    .ptr_to_value(item_ptr, "null-terminated array item")?
            });
            i += 1;
        }

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_free(ptr) };
        }

        Ok(value::Value::Array(values))
    }

    fn decode_null_terminated_string_array(
        &self,
        ptr: *mut c_void,
    ) -> anyhow::Result<value::Value> {
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

        Ok(value::Value::Array(values))
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
            Type::Boolean => {
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
                    .map(|handle| value::Value::Object(*handle))
                    .collect()
            }
            Type::Enum(_)
            | Type::Flags(_)
            | Type::Void
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar => bail!(
                "Unsupported array item type for ffi value conversion: {:?}",
                self.item_type
            ),
        };

        Ok(value::Value::Array(values))
    }

    fn decode_sized_array(&self, ptr: *mut c_void, length: usize) -> anyhow::Result<value::Value> {
        match &*self.item_type {
            Type::Integer(int_type) => Self::decode_sized_byte_array(ptr, length, int_type),
            Type::Float(float_kind) => Self::decode_sized_float_array(ptr, length, *float_kind),
            Type::Boolean => Self::decode_sized_bool_array(ptr, length),
            Type::GObject(_)
            | Type::Boxed(_)
            | Type::Struct(_)
            | Type::String(_)
            | Type::Fundamental(_) => self.decode_sized_ptr_array(ptr, length),
            Type::Enum(_)
            | Type::Flags(_)
            | Type::Void
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Callback(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar => bail!(
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
            values.push(unsafe { self.item_type.ptr_to_value(item_ptr, "sized array item")? });
        }
        Ok(value::Value::Array(values))
    }

    fn decode_sized_float_array(
        ptr: *mut c_void,
        length: usize,
        float_kind: super::FloatKind,
    ) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
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

        Ok(value::Value::Array(values))
    }

    fn decode_sized_bool_array(ptr: *mut c_void, length: usize) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }

        let values = unsafe {
            std::slice::from_raw_parts(ptr as *const i32, length)
                .iter()
                .map(|&v| value::Value::Boolean(v != 0))
                .collect()
        };

        Ok(value::Value::Array(values))
    }

    fn decode_sized_byte_array(
        ptr: *mut c_void,
        length: usize,
        int_kind: &super::IntegerKind,
    ) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }

        let f64_values = int_kind.read_slice(ptr as *const u8, length);
        let values = f64_values.into_iter().map(value::Value::Number).collect();

        Ok(value::Value::Array(values))
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
                    let item_value =
                        unsafe { self.item_type.ptr_to_value(item_ptr, "GPtrArray item")? };
                    values.push(item_value);
                }
                Ok(value::Value::Array(values))
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

    fn size_from_args(
        &self,
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
                    return Ok(size as usize);
                }
                ffi::FfiValue::Ptr(ptr) => {
                    if !ptr.is_null() {
                        let size = int_type.read_ptr(*ptr as *const u8);
                        return Ok(size as usize);
                    }
                }
                _ => {}
            }
        }

        if let Type::Integer(_) = &arg.ty
            && let Ok(num) = ffi_arg.to_number()
        {
            return Ok(num as usize);
        }

        bail!(
            "Could not extract size from parameter at index {}: expected Ref<Integer> or Integer, got type {:?} with ffi value {:?}",
            size_index,
            arg.ty,
            ffi_arg
        );
    }
}
