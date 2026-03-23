use std::ffi::{CString, c_void};

use anyhow::bail;
use gtk4::glib;
use neon::prelude::*;

use super::{FfiDecoder, FfiEncoder, GlibValueCodec, Ownership, RawPtrCodec};
use crate::ffi::{FfiStorage, FfiStorageKind, HashTableData};
use crate::types::Type;
use crate::types::array::ArrayKind;
use crate::{ffi, value};

#[derive(Clone, Debug)]
pub enum HashTableEntryEncoder {
    String,
    Integer,
    Boolean,
    Float,
    NativeHandle,
    PtrArray(Box<Type>),
}

impl PartialEq for HashTableEntryEncoder {
    fn eq(&self, other: &Self) -> bool {
        std::mem::discriminant(self) == std::mem::discriminant(other)
    }
}

impl HashTableEntryEncoder {
    #[must_use]
    pub fn from_type(ty: &Type) -> Option<Self> {
        match ty {
            Type::String(_) => Some(Self::String),
            Type::Integer(_) => Some(Self::Integer),
            Type::Boolean(_) => Some(Self::Boolean),
            Type::Float(_) => Some(Self::Float),
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
                Some(Self::NativeHandle)
            }
            Type::Array(array_type) if array_type.kind == ArrayKind::GPtrArray => {
                Some(Self::PtrArray(array_type.item_type.clone()))
            }
            _ => None,
        }
    }

    pub fn hash_func(&self) -> glib::ffi::GHashFunc {
        match self {
            Self::String => Some(glib::ffi::g_str_hash),
            Self::Float => Some(glib::ffi::g_double_hash),
            Self::Integer | Self::Boolean | Self::NativeHandle | Self::PtrArray(_) => {
                Some(glib::ffi::g_direct_hash)
            }
        }
    }

    pub fn equal_func(&self) -> glib::ffi::GEqualFunc {
        match self {
            Self::String => Some(glib::ffi::g_str_equal),
            Self::Float => Some(glib::ffi::g_double_equal),
            Self::Integer | Self::Boolean | Self::NativeHandle | Self::PtrArray(_) => {
                Some(glib::ffi::g_direct_equal)
            }
        }
    }

    pub fn free_func(&self) -> glib::ffi::GDestroyNotify {
        match self {
            Self::String | Self::Float => Some(glib::ffi::g_free),
            Self::Integer | Self::Boolean | Self::NativeHandle => None,
            Self::PtrArray(_) => Some(g_ptr_array_unref_wrapper),
        }
    }

    pub fn encode(&self, val: &value::Value) -> anyhow::Result<*mut c_void> {
        match self {
            Self::String => {
                let s = match val {
                    value::Value::String(s) => s,
                    _ => bail!("Expected string in GHashTable, got {:?}", val),
                };
                let cstr = CString::new(s.as_bytes())?;
                let ptr = unsafe { glib::ffi::g_strdup(cstr.as_ptr()) };
                Ok(ptr as *mut c_void)
            }
            Self::Integer => match val {
                value::Value::Number(n) => Ok(*n as isize as *mut c_void),
                _ => bail!("Expected number in GHashTable, got {:?}", val),
            },
            Self::Boolean => match val {
                value::Value::Boolean(b) => Ok(*b as isize as *mut c_void),
                _ => bail!("Expected boolean in GHashTable, got {:?}", val),
            },
            Self::Float => match val {
                value::Value::Number(n) => {
                    let ptr = unsafe {
                        let mem = glib::ffi::g_malloc(std::mem::size_of::<f64>()) as *mut f64;
                        *mem = *n;
                        mem as *mut c_void
                    };
                    Ok(ptr)
                }
                _ => bail!("Expected number in GHashTable for float, got {:?}", val),
            },
            Self::NativeHandle => match val {
                value::Value::Object(handle) => {
                    let ptr = handle.get_ptr().ok_or_else(|| {
                        anyhow::anyhow!("Native object in GHashTable has been garbage collected")
                    })?;
                    Ok(ptr)
                }
                value::Value::Null | value::Value::Undefined => Ok(std::ptr::null_mut()),
                _ => bail!("Expected native object in GHashTable, got {:?}", val),
            },
            Self::PtrArray(_item_type) => {
                let items = match val {
                    value::Value::Array(arr) => arr,
                    _ => bail!("Expected Array for GPtrArray in GHashTable, got {:?}", val),
                };
                let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
                for item in items {
                    let item_ptr = match item {
                        value::Value::Object(handle) => handle.get_ptr().ok_or_else(|| {
                            anyhow::anyhow!("Native object in GPtrArray has been garbage collected")
                        })?,
                        value::Value::Null | value::Value::Undefined => std::ptr::null_mut(),
                        _ => bail!("Expected Object in GPtrArray, got {:?}", item),
                    };
                    unsafe { glib::ffi::g_ptr_array_add(ptr_array, item_ptr) };
                }
                Ok(ptr_array as *mut c_void)
            }
        }
    }
}

unsafe extern "C" fn g_ptr_array_unref_wrapper(ptr: *mut c_void) {
    unsafe {
        glib::ffi::g_ptr_array_unref(ptr as *mut glib::ffi::GPtrArray);
    }
}

#[derive(Debug, Clone)]
pub struct HashTableType {
    pub key_type: Box<Type>,
    pub value_type: Box<Type>,
    pub ownership: Ownership,
}

impl HashTableType {
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
        &self,
        tuples: &[value::Value],
        key_encoder: &HashTableEntryEncoder,
        value_encoder: &HashTableEntryEncoder,
    ) -> anyhow::Result<ffi::FfiValue> {
        let hash_table = unsafe {
            glib::ffi::g_hash_table_new_full(
                key_encoder.hash_func(),
                key_encoder.equal_func(),
                key_encoder.free_func(),
                value_encoder.free_func(),
            )
        };

        for tuple in tuples {
            let (key, val) = Self::tuple(tuple)?;
            let key_ptr = key_encoder.encode(key)?;
            let val_ptr = value_encoder.encode(val)?;

            let key_ptr = self.key_type.ref_for_transfer(key_ptr)?;
            let val_ptr = self.value_type.ref_for_transfer(val_ptr)?;

            unsafe {
                glib::ffi::g_hash_table_insert(hash_table, key_ptr, val_ptr);
            }
        }

        Ok(ffi::FfiValue::Storage(FfiStorage::new(
            hash_table as *mut c_void,
            FfiStorageKind::HashTable(HashTableData {
                handle: hash_table,
                should_free: self.ownership.is_borrowed(),
            }),
        )))
    }
}

impl FfiEncoder for HashTableType {
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
        let value_encoder =
            HashTableEntryEncoder::from_type(&self.value_type).ok_or_else(|| {
                anyhow::anyhow!("Unsupported GHashTable value type: {:?}", self.value_type)
            })?;

        self.encode_hashtable(tuples, &key_encoder, &value_encoder)
    }
}

impl FfiDecoder for HashTableType {
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

        let storage_owns_table = matches!(ffi_value, ffi::FfiValue::Storage(_));
        if self.ownership.is_full() && !storage_owns_table {
            unsafe { glib::ffi::g_hash_table_unref(hash_ptr as *mut glib::ffi::GHashTable) };
        }

        Ok(value::Value::Array(pairs))
    }
}

impl RawPtrCodec for HashTableType {
    fn ptr_to_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }
        self.decode(&ffi::FfiValue::Ptr(ptr))
    }
}

impl GlibValueCodec for HashTableType {}
