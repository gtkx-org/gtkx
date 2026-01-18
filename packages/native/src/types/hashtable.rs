use std::ffi::{CString, c_void};

use anyhow::bail;
use gtk4::glib;
use libffi::middle as libffi;
use neon::prelude::*;

use super::Ownership;
use crate::ffi::{FfiStorage, FfiStorageKind, HashTableData, HashTableStorage};
use crate::types::Type;
use crate::{ffi, value};

#[derive(Clone, Copy)]
pub enum HashTableEntryEncoder {
    String,
    Integer,
    NativeHandle,
}

impl HashTableEntryEncoder {
    pub fn from_type(ty: &Type) -> Option<Self> {
        match ty {
            Type::String(_) => Some(Self::String),
            Type::Integer(_) => Some(Self::Integer),
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
                Some(Self::NativeHandle)
            }
            _ => None,
        }
    }

    pub fn hash_func(&self) -> glib::ffi::GHashFunc {
        match self {
            Self::String => Some(glib::ffi::g_str_hash),
            Self::Integer | Self::NativeHandle => Some(glib::ffi::g_direct_hash),
        }
    }

    pub fn equal_func(&self) -> glib::ffi::GEqualFunc {
        match self {
            Self::String => Some(glib::ffi::g_str_equal),
            Self::Integer | Self::NativeHandle => Some(glib::ffi::g_direct_equal),
        }
    }

    pub fn free_func(&self) -> glib::ffi::GDestroyNotify {
        match self {
            Self::String => Some(glib::ffi::g_free),
            Self::Integer | Self::NativeHandle => None,
        }
    }

    pub fn encode(&self, val: &value::Value) -> anyhow::Result<(*mut c_void, HashTableStorage)> {
        match self {
            Self::String => {
                let s = match val {
                    value::Value::String(s) => s,
                    _ => bail!("Expected string in GHashTable, got {:?}", val),
                };
                let cstr = CString::new(s.as_bytes())?;
                let ptr = unsafe { glib::ffi::g_strdup(cstr.as_ptr()) };
                Ok((ptr as *mut c_void, HashTableStorage::Strings(vec![cstr])))
            }
            Self::Integer => match val {
                value::Value::Number(n) => {
                    Ok((*n as isize as *mut c_void, HashTableStorage::Integers))
                }
                _ => bail!("Expected number in GHashTable, got {:?}", val),
            },
            Self::NativeHandle => match val {
                value::Value::Object(handle) => {
                    let ptr = handle.get_ptr().ok_or_else(|| {
                        anyhow::anyhow!("Native object in GHashTable has been garbage collected")
                    })?;
                    Ok((ptr, HashTableStorage::NativeHandles))
                }
                value::Value::Null | value::Value::Undefined => {
                    Ok((std::ptr::null_mut(), HashTableStorage::NativeHandles))
                }
                _ => bail!("Expected native object in GHashTable, got {:?}", val),
            },
        }
    }
}

#[derive(Debug, Clone)]
pub struct HashTableType {
    pub key_type: Box<Type>,
    pub value_type: Box<Type>,
    pub ownership: Ownership,
}

impl HashTableType {
    pub fn new(key_type: Type, value_type: Type, ownership: Ownership) -> Self {
        HashTableType {
            key_type: Box::new(key_type),
            value_type: Box::new(value_type),
            ownership,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;

        let key_type_value: Handle<'_, JsValue> = obj.prop(cx, "keyType").get()?;
        let key_type = Type::from_js_value(cx, key_type_value)?;

        let value_type_value: Handle<'_, JsValue> = obj.prop(cx, "valueType").get()?;
        let value_type = Type::from_js_value(cx, value_type_value)?;

        let ownership = Ownership::from_js_value(cx, obj, "hashtable")?;

        Ok(HashTableType {
            key_type: Box::new(key_type),
            value_type: Box::new(value_type),
            ownership,
        })
    }

    fn tuple(value: &value::Value) -> anyhow::Result<(&value::Value, &value::Value)> {
        match value {
            value::Value::Array(arr) if arr.len() == 2 => Ok((&arr[0], &arr[1])),
            _ => bail!("Expected [key, value] tuple in GHashTable, got {:?}", value),
        }
    }

    fn encode_hashtable(
        tuples: &[value::Value],
        key_encoder: HashTableEntryEncoder,
        value_encoder: HashTableEntryEncoder,
    ) -> anyhow::Result<ffi::FfiValue> {
        let hash_table = unsafe {
            glib::ffi::g_hash_table_new_full(
                key_encoder.hash_func(),
                key_encoder.equal_func(),
                key_encoder.free_func(),
                value_encoder.free_func(),
            )
        };

        let mut key_storage = HashTableStorage::Integers;
        let mut val_storage = HashTableStorage::Integers;

        for tuple in tuples {
            let (key, val) = Self::tuple(tuple)?;
            let (key_ptr, ks) = key_encoder.encode(key)?;
            let (val_ptr, vs) = value_encoder.encode(val)?;
            key_storage = ks;
            val_storage = vs;

            unsafe {
                glib::ffi::g_hash_table_insert(hash_table, key_ptr, val_ptr);
            }
        }

        Ok(ffi::FfiValue::Storage(FfiStorage::new(
            hash_table as *mut c_void,
            FfiStorageKind::HashTable(HashTableData {
                handle: hash_table,
                keys: key_storage,
                values: val_storage,
            }),
        )))
    }
}

impl From<&HashTableType> for libffi::Type {
    fn from(_value: &HashTableType) -> Self {
        libffi::Type::pointer()
    }
}

impl ffi::FfiEncode for HashTableType {
    fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let tuples = match val {
            value::Value::Array(arr) => arr,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!(
                "Expected an Array of tuples for GHashTable type, got {:?}",
                val
            ),
        };

        let key_encoder = HashTableEntryEncoder::from_type(&self.key_type).ok_or_else(|| {
            anyhow::anyhow!("Unsupported GHashTable key type: {:?}", self.key_type)
        })?;
        let value_encoder = HashTableEntryEncoder::from_type(&self.value_type).ok_or_else(|| {
            anyhow::anyhow!("Unsupported GHashTable value type: {:?}", self.value_type)
        })?;

        Self::encode_hashtable(tuples, key_encoder, value_encoder)
    }
}

impl ffi::FfiDecode for HashTableType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(hash_ptr) = ffi_value.as_non_null_ptr("GHashTable")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let mut pairs: Vec<value::Value> = Vec::new();

        unsafe {
            let mut iter = std::mem::MaybeUninit::<glib::ffi::GHashTableIter>::uninit();
            glib::ffi::g_hash_table_iter_init(
                iter.as_mut_ptr(),
                hash_ptr as *mut glib::ffi::GHashTable,
            );

            let mut key_ptr: *mut c_void = std::ptr::null_mut();
            let mut value_ptr: *mut c_void = std::ptr::null_mut();

            while glib::ffi::g_hash_table_iter_next(
                iter.as_mut_ptr(),
                &mut key_ptr as *mut _,
                &mut value_ptr as *mut _,
            ) != 0
            {
                let key_value = self.key_type.ptr_to_value(key_ptr, "hash table key")?;
                let val_value = self
                    .value_type
                    .ptr_to_value(value_ptr, "hash table value")?;
                pairs.push(value::Value::Array(vec![key_value, val_value]));
            }
        }

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_hash_table_unref(hash_ptr as *mut glib::ffi::GHashTable) };
        }

        Ok(value::Value::Array(pairs))
    }
}
