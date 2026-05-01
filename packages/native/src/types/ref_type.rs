use std::ffi::{CStr, c_char, c_void};

use anyhow::bail;
use gtk4::glib::{
    self,
    translate::{FromGlibPtrFull as _, FromGlibPtrNone as _, ToGlibPtr as _},
};
use libffi::middle as libffi;
use neon::object::Object as _;
use neon::prelude::*;

use crate::arg::Arg;
use crate::ffi::{FfiStorage, FfiStorageKind};
use crate::managed::{Boxed, Fundamental, NativeValue};
use crate::{
    ffi,
    types::{ArrayKind, FfiDecoder, FfiEncoder, GlibValueCodec, IntegerKind, RawPtrCodec, Type},
    value,
};

#[derive(Debug, Clone)]
pub struct RefType {
    pub inner_type: Box<Type>,
}

impl RefType {
    #[must_use]
    pub fn new(inner_type: Type) -> Self {
        Self {
            inner_type: Box::new(inner_type),
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let inner_type_value: Handle<'_, JsValue> = obj.prop(cx, "innerType").get()?;
        let inner_type = Type::from_js_value(cx, inner_type_value)?;

        Ok(Self::new(inner_type))
    }
}

impl FfiEncoder for RefType {
    fn encode(&self, val: &value::Value, _optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let ref_val = match val {
            value::Value::Ref(r) => r,
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected a Ref for ref type, got {val:?}"),
        };

        match &*self.inner_type {
            Type::Boxed(_) | Type::Struct(_) | Type::GObject(_) | Type::Fundamental(_) => {
                match &*ref_val.value {
                    value::Value::Null | value::Value::Undefined => {
                        let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
                        let ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
                        Ok(ffi::FfiValue::Storage(FfiStorage::new(
                            ptr,
                            FfiStorageKind::PtrStorage(ptr_storage),
                        )))
                    }
                    _ => bail!(
                        "Expected Null for Ref<Boxed/Struct/GObject/Fundamental>, got {:?}",
                        ref_val.value
                    ),
                }
            }
            Type::Array(array_type) => match &*ref_val.value {
                value::Value::Array(arr) if !arr.is_empty() => {
                    let encoded = array_type.encode(&ref_val.value, false)?;
                    match encoded {
                        ffi::FfiValue::Storage(storage) => Ok(ffi::FfiValue::Storage(storage)),
                        _ => bail!("Expected Storage from array encode for Ref<Array>"),
                    }
                }
                value::Value::Null | value::Value::Undefined | value::Value::Array(_) => {
                    let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
                    let ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
                    Ok(ffi::FfiValue::Storage(FfiStorage::new(
                        ptr,
                        FfiStorageKind::PtrStorage(ptr_storage),
                    )))
                }
                _ => bail!(
                    "Expected Array, Null, or Undefined for Ref<Array>, got {:?}",
                    ref_val.value
                ),
            },
            Type::String(string_type) => {
                let (buffer_size, initial_content) = match (&string_type.length, &*ref_val.value) {
                    (Some(len), value::Value::String(s)) => (*len, Some(s.as_bytes())),
                    (Some(len), value::Value::Null | value::Value::Undefined) => (*len, None),
                    (None, value::Value::String(s)) => (s.len() + 1, Some(s.as_bytes())),
                    (None, value::Value::Null | value::Value::Undefined) => {
                        let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
                        let ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
                        return Ok(ffi::FfiValue::Storage(FfiStorage::new(
                            ptr,
                            FfiStorageKind::PtrStorage(ptr_storage),
                        )));
                    }
                    _ => bail!(
                        "Expected a String, Null, or length for Ref<String>, got {:?}",
                        ref_val.value
                    ),
                };

                let mut buffer: Vec<u8> = vec![0u8; buffer_size];

                if let Some(content) = initial_content {
                    let copy_len = content.len().min(buffer_size.saturating_sub(1));
                    buffer[..copy_len].copy_from_slice(&content[..copy_len]);
                }

                let ptr = buffer.as_mut_ptr() as *mut c_void;
                Ok(ffi::FfiValue::Storage(FfiStorage::new(
                    ptr,
                    FfiStorageKind::Buffer(buffer),
                )))
            }
            _ => {
                let ref_arg = Arg::new(*self.inner_type.clone(), *ref_val.value.clone());
                let ref_value = Box::new(ffi::FfiValue::try_from(ref_arg)?);
                let ref_ptr = ref_value.as_raw_ptr();

                Ok(ffi::FfiValue::Storage(FfiStorage::new(
                    ref_ptr,
                    FfiStorageKind::BoxedValue(ref_value),
                )))
            }
        }
    }

    fn call_cif(
        &self,
        _cif: &libffi::Cif,
        _ptr: libffi::CodePtr,
        _args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        bail!("Ref types cannot be return types")
    }
}

impl FfiDecoder for RefType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let storage = match ffi_value {
            ffi::FfiValue::Storage(s) => s,
            ffi::FfiValue::Ptr(ptr) if ptr.is_null() => return Ok(value::Value::Null),
            _ => bail!("Expected a Storage ffi::FfiValue for Ref, got {ffi_value:?}"),
        };

        match &*self.inner_type {
            Type::GObject(gobject_type) => {
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                if actual_ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                let object = if gobject_type.ownership.is_full() {
                    unsafe {
                        glib::Object::from_glib_full(actual_ptr as *mut glib::gobject_ffi::GObject)
                    }
                } else {
                    unsafe {
                        glib::Object::from_glib_none(actual_ptr as *mut glib::gobject_ffi::GObject)
                    }
                };
                Ok(value::Value::Object(NativeValue::GObject(object).into()))
            }
            Type::Boxed(boxed_type) => {
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                if actual_ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                let gtype = boxed_type.gtype();
                let boxed = if boxed_type.ownership.is_full() {
                    Boxed::from_glib_full(gtype, actual_ptr)
                } else {
                    Boxed::from_glib_none(gtype, actual_ptr)?
                };
                Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
            }
            Type::Fundamental(fundamental_type) => {
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                if actual_ptr.is_null() {
                    return Ok(value::Value::Null);
                }

                let (ref_fn, unref_fn) = fundamental_type.lookup_fns()?;
                let fundamental = if fundamental_type.ownership.is_full() {
                    Fundamental::from_glib_full(actual_ptr, ref_fn, unref_fn)
                } else {
                    unsafe { Fundamental::from_glib_none(actual_ptr, ref_fn, unref_fn) }
                };
                Ok(value::Value::Object(
                    NativeValue::Fundamental(fundamental).into(),
                ))
            }
            Type::Struct(struct_type) => {
                let actual_ptr = unsafe { *(storage.ptr() as *const *mut c_void) };
                if actual_ptr.is_null() {
                    return Ok(value::Value::Null);
                }
                let boxed = if struct_type.ownership.is_full() {
                    Boxed::from_glib_full(None, actual_ptr)
                } else {
                    match struct_type.size {
                        Some(_) => Boxed::from_glib_none_with_size(
                            None,
                            actual_ptr,
                            struct_type.size,
                            Some(&struct_type.type_name),
                        )?,
                        None => Boxed::from_ptr_unowned(actual_ptr),
                    }
                };
                Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
            }
            Type::Integer(int_type) => {
                let number = int_type.read_ptr(storage.ptr() as *const u8);
                Ok(value::Value::Number(number))
            }
            Type::Enum(_) => {
                let number = IntegerKind::I32.read_ptr(storage.ptr() as *const u8);
                Ok(value::Value::Number(number))
            }
            Type::Flags(_) => {
                let number = IntegerKind::U32.read_ptr(storage.ptr() as *const u8);
                Ok(value::Value::Number(number))
            }
            Type::Float(float_kind) => {
                let number = float_kind.read_ptr(storage.ptr() as *const u8);
                Ok(value::Value::Number(number))
            }
            Type::String(string_type) => Ok(Self::decode_ref_string(storage, string_type)),
            Type::Array(_) => {
                bail!("Ref<Array> requires decode_with_context to get size from another parameter")
            }
            _ => bail!(
                "Unsupported ref inner type for reading: {:?}",
                self.inner_type
            ),
        }
    }

    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
    ) -> anyhow::Result<value::Value> {
        Self::decode_with_context(self, ffi_value, ffi_args, args)
    }
}

impl RawPtrCodec for RefType {
    fn read_from_raw_ptr(
        &self,
        ptr: *const c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        let inner_ptr = unsafe { *(ptr as *const *mut c_void) };
        if inner_ptr.is_null() {
            return Ok(value::Value::Null);
        }
        self.inner_type.read_from_raw_ptr(inner_ptr, "ref inner")
    }
}

impl GlibValueCodec for RefType {
    fn from_glib_value(&self, gvalue: &glib::Value) -> anyhow::Result<value::Value> {
        let ptr =
            unsafe { glib::gobject_ffi::g_value_get_pointer(gvalue.to_glib_none().0 as *const _) };
        if ptr.is_null() {
            return Ok(value::Value::Null);
        }
        match &*self.inner_type {
            Type::Float(float_kind) => {
                let val = float_kind.read_ptr(ptr as *const u8);
                Ok(value::Value::Number(val))
            }
            Type::Integer(int_kind) => {
                let val = int_kind.read_ptr(ptr as *const u8);
                Ok(value::Value::Number(val))
            }
            Type::Enum(_) => {
                let val = IntegerKind::I32.read_ptr(ptr as *const u8);
                Ok(value::Value::Number(val))
            }
            Type::Flags(_) => {
                let val = IntegerKind::U32.read_ptr(ptr as *const u8);
                Ok(value::Value::Number(val))
            }
            Type::Boolean(_) => {
                let val = unsafe { *(ptr as *const i32) };
                Ok(value::Value::Boolean(val != 0))
            }
            _ => bail!(
                "Unsupported Ref inner type for GValue conversion: {:?}",
                self.inner_type
            ),
        }
    }
}

impl RefType {
    pub fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
    ) -> anyhow::Result<value::Value> {
        if let Type::Array(array_type) = &*self.inner_type {
            let storage = match ffi_value {
                ffi::FfiValue::Storage(s) => s,
                ffi::FfiValue::Ptr(ptr) if ptr.is_null() => return Ok(value::Value::Null),
                _ => bail!("Expected a Storage ffi::FfiValue for Ref<Array>, got {ffi_value:?}"),
            };

            let actual_ptr = match storage.kind() {
                FfiStorageKind::PtrStorage(_) => unsafe { *(storage.ptr() as *const *mut c_void) },
                _ => storage.ptr(),
            };

            if actual_ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            let ptr_ffi_value = ffi::FfiValue::Ptr(actual_ptr);
            let result = array_type.decode_with_context(&ptr_ffi_value, ffi_args, args)?;

            if matches!(storage.kind(), FfiStorageKind::PtrStorage(_))
                && array_type.ownership.is_full()
            {
                let freed_by_decode =
                    matches!(array_type.kind, ArrayKind::GList | ArrayKind::GSList)
                        || (array_type.kind == ArrayKind::Array
                            && matches!(&*array_type.item_type, Type::String(_)));

                if !freed_by_decode {
                    unsafe { glib::ffi::g_free(actual_ptr) };
                }
            }

            return Ok(result);
        }

        self.decode(ffi_value)
    }

    fn decode_ref_string(storage: &FfiStorage, string_type: &super::StringType) -> value::Value {
        if storage.ptr().is_null() {
            return value::Value::Null;
        }

        if let FfiStorageKind::Buffer(_) = storage.kind() {
            let c_str = unsafe { CStr::from_ptr(storage.ptr() as *const c_char) };
            let string = c_str.to_string_lossy().into_owned();
            value::Value::String(string)
        } else {
            let str_ptr = unsafe { *(storage.ptr() as *const *const c_char) };
            if str_ptr.is_null() {
                return value::Value::Null;
            }
            let c_str = unsafe { CStr::from_ptr(str_ptr) };
            let string = c_str.to_string_lossy().into_owned();

            if string_type.ownership.is_full() {
                unsafe { glib::ffi::g_free(str_ptr as *mut c_void) };
            }

            value::Value::String(string)
        }
    }
}
