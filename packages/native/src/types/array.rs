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
pub enum ListType {
    Array,
    GList,
    GSList,
    GPtrArray,
    GArray,
    Sized { length_index: usize },
    Fixed { size: usize },
}

impl std::str::FromStr for ListType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "array" => Ok(ListType::Array),
            "glist" => Ok(ListType::GList),
            "gslist" => Ok(ListType::GSList),
            "gptrarray" => Ok(ListType::GPtrArray),
            "garray" => Ok(ListType::GArray),
            "sized" => Ok(ListType::Sized { length_index: 0 }),
            "fixed" => Ok(ListType::Fixed { size: 0 }),
            _ => Err(format!(
                "'listType' must be 'array', 'glist', 'gslist', 'gptrarray', 'garray', 'sized', or 'fixed'; got '{}'",
                s
            )),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ArrayType {
    pub item_type: Box<Type>,
    pub list_type: ListType,
    pub ownership: Ownership,
    pub element_size: Option<usize>,
}

impl ArrayType {
    pub fn new(item_type: Type, list_type: ListType, ownership: Ownership) -> Self {
        ArrayType {
            item_type: Box::new(item_type),
            list_type,
            ownership,
            element_size: None,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let item_type_value: Handle<'_, JsValue> = obj.prop(cx, "itemType").get()?;
        let item_type = Type::from_js_value(cx, item_type_value)?;

        let list_type_prop: Handle<'_, JsValue> = obj.prop(cx, "listType").get()?;
        let list_type_str = list_type_prop
            .downcast::<JsString, _>(cx)
            .or_else(|_| cx.throw_type_error("'listType' property is required for array types"))?
            .value(cx);

        let list_type: ListType = list_type_str
            .parse()
            .map_err(|e: String| cx.throw_type_error::<_, ()>(e).unwrap_err())?;

        let list_type = match list_type {
            ListType::Sized { .. } => {
                let length_index: Handle<JsNumber> =
                    obj.get_opt(cx, "lengthParamIndex")?.ok_or_else(|| {
                        cx.throw_type_error::<_, ()>(
                            "'lengthParamIndex' is required for sized arrays",
                        )
                        .unwrap_err()
                    })?;
                ListType::Sized {
                    length_index: length_index.value(cx) as usize,
                }
            }
            ListType::Fixed { .. } => {
                let fixed_size: Handle<JsNumber> =
                    obj.get_opt(cx, "fixedSize")?.ok_or_else(|| {
                        cx.throw_type_error::<_, ()>("'fixedSize' is required for fixed arrays")
                            .unwrap_err()
                    })?;
                ListType::Fixed {
                    size: fixed_size.value(cx) as usize,
                }
            }
            other => other,
        };

        let element_size: Option<usize> = if list_type == ListType::GArray {
            let size_prop: Option<Handle<JsNumber>> = obj.get_opt(cx, "elementSize")?;
            size_prop.map(|n| n.value(cx) as usize)
        } else {
            None
        };

        let ownership = Ownership::from_js_value(cx, obj, "array")?;

        Ok(ArrayType {
            item_type: Box::new(item_type),
            list_type,
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

struct GListGuard {
    ptr: *mut glib::ffi::GList,
    should_free: bool,
}

impl GListGuard {
    fn new(ptr: *mut c_void, should_free: bool) -> Self {
        Self {
            ptr: ptr as *mut glib::ffi::GList,
            should_free,
        }
    }
}

impl Drop for GListGuard {
    fn drop(&mut self) {
        if self.should_free && !self.ptr.is_null() {
            unsafe { glib::ffi::g_list_free(self.ptr) };
        }
    }
}

impl ffi::FfiEncode for ArrayType {
    fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let array = match val {
            value::Value::Array(arr) => arr,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected an Array for array type, got {:?}", val),
        };

        match *self.item_type {
            Type::Integer(ref int_type) => {
                let mut values = Vec::new();

                for value in array {
                    match value {
                        value::Value::Number(n) => values.push(*n),
                        _ => bail!("Expected a Number for integer item type, got {:?}", value),
                    }
                }

                Ok(ffi::FfiValue::Storage(
                    int_type.kind.to_ffi_storage(&values),
                ))
            }
            Type::Float(ref float_kind) => {
                let mut values = Vec::new();

                for value in array {
                    match value {
                        value::Value::Number(n) => values.push(n),
                        _ => bail!("Expected a Number for float item type, got {:?}", value),
                    }
                }

                match float_kind {
                    FloatKind::F32 => {
                        let values: Vec<f32> = values.iter().map(|&v| *v as f32).collect();
                        Ok(ffi::FfiValue::Storage(values.into()))
                    }
                    FloatKind::F64 => {
                        let values: Vec<f64> = values.iter().map(|&v| *v).collect();
                        Ok(ffi::FfiValue::Storage(values.into()))
                    }
                }
            }
            Type::String(_) => {
                let mut cstrings = Vec::new();

                for v in array {
                    match v {
                        value::Value::String(s) => {
                            cstrings.push(CString::new(s.as_bytes())?);
                        }
                        _ => bail!("Expected a String for string item type, got {:?}", v),
                    }
                }

                let mut ptrs: Vec<*mut c_void> =
                    cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();

                ptrs.push(std::ptr::null_mut());

                let ptr = ptrs.as_ptr() as *mut c_void;

                Ok(ffi::FfiValue::Storage(FfiStorage::new(
                    ptr,
                    FfiStorageKind::StringArray(cstrings, ptrs),
                )))
            }
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
                let mut ids = Vec::new();

                for value in array {
                    match value {
                        value::Value::Object(id) => ids.push(*id),
                        _ => bail!("Expected an Object for gobject item type, got {:?}", value),
                    }
                }

                let mut ptrs: Vec<*mut c_void> = Vec::with_capacity(ids.len());
                for id in &ids {
                    match id.get_ptr() {
                        Some(ptr) => ptrs.push(ptr),
                        None => bail!("GObject in array has been garbage collected"),
                    }
                }
                let ptr = ptrs.as_ptr() as *mut c_void;

                Ok(ffi::FfiValue::Storage(FfiStorage::new(
                    ptr,
                    FfiStorageKind::ObjectArray(ids, ptrs),
                )))
            }
            Type::Boolean => {
                let mut values = Vec::new();

                for value in array {
                    match value {
                        value::Value::Boolean(b) => values.push(u8::from(*b)),
                        _ => bail!("Expected a Boolean for boolean item type, got {:?}", value),
                    }
                }

                Ok(ffi::FfiValue::Storage(values.into()))
            }
            _ => bail!("Unsupported array item type: {:?}", self.item_type),
        }
    }
}

impl ffi::FfiDecode for ArrayType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        if self.list_type == ListType::GList || self.list_type == ListType::GSList {
            return self.decode_glist(ffi_value);
        }

        if let ffi::FfiValue::Ptr(ptr) = ffi_value {
            if ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            if matches!(&*self.item_type, Type::String(_)) {
                return self.decode_null_terminated_string_array(*ptr);
            }

            bail!(
                "Unsupported null-terminated array item type: {:?}",
                self.item_type
            );
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

    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
    ) -> anyhow::Result<value::Value> {
        match &self.list_type {
            ListType::Sized { length_index } => {
                let length = self.length_from_args(ffi_args, args, *length_index)?;

                if let ffi::FfiValue::Ptr(ptr) = ffi_value {
                    if ptr.is_null() {
                        return Ok(value::Value::Array(vec![]));
                    }

                    if let Type::Integer(int_type) = &*self.item_type {
                        return Self::decode_sized_byte_array(*ptr, length, &int_type.kind);
                    }

                    bail!(
                        "Sized arrays are only supported for integer types, got: {:?}",
                        self.item_type
                    );
                }
            }
            ListType::Fixed { size } => {
                if let ffi::FfiValue::Ptr(ptr) = ffi_value {
                    if ptr.is_null() {
                        return Ok(value::Value::Array(vec![]));
                    }

                    if let Type::Integer(int_type) = &*self.item_type {
                        return Self::decode_sized_byte_array(*ptr, *size, &int_type.kind);
                    }

                    bail!(
                        "Fixed-size arrays are only supported for integer types, got: {:?}",
                        self.item_type
                    );
                }
            }
            _ => {}
        }

        self.decode(ffi_value)
    }
}

impl ArrayType {
    fn decode_glist(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(list_ptr) = ffi_value.as_non_null_ptr("GList/GSList")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let list_guard = GListGuard::new(list_ptr, self.ownership.is_full());

        let mut values = Vec::new();
        let mut current = list_ptr as *mut glib::ffi::GList;

        while !current.is_null() {
            let data = unsafe { (*current).data };
            let item_value = self.item_type.ptr_to_value(data, "GList item")?;
            values.push(item_value);
            current = unsafe { (*current).next };
        }

        drop(list_guard);
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
                let f64_vec = int_type.kind.vec_to_f64(storage)?;
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
                let ids = storage.as_object_array()?;
                ids.iter().map(|id| value::Value::Object(*id)).collect()
            }
            _ => bail!(
                "Unsupported array item type for ffi value conversion: {:?}",
                self.item_type
            ),
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

    fn length_from_args(
        &self,
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
        length_index: usize,
    ) -> anyhow::Result<usize> {
        if length_index >= ffi_args.len() {
            bail!(
                "Length parameter index {} is out of bounds (args count: {})",
                length_index,
                ffi_args.len()
            );
        }

        let ffi_arg = &ffi_args[length_index];
        let arg = &args[length_index];

        if let Type::Ref(ref_type) = &arg.ty
            && let Type::Integer(int_type) = &*ref_type.inner_type
        {
            match ffi_arg {
                ffi::FfiValue::Storage(storage) => {
                    let length = int_type.kind.read_ptr(storage.ptr() as *const u8);
                    return Ok(length as usize);
                }
                ffi::FfiValue::Ptr(ptr) => {
                    if !ptr.is_null() {
                        let length = int_type.kind.read_ptr(*ptr as *const u8);
                        return Ok(length as usize);
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
            "Could not extract length from parameter at index {}: expected Ref<Integer> or Integer, got type {:?} with ffi value {:?}",
            length_index,
            arg.ty,
            ffi_arg
        );
    }
}
