use anyhow::bail;

use super::prelude::*;
use super::string::str_to_glib_full;
use crate::ffi::codec::Codec;
use crate::ffi::{StashData, StashStorage};

#[derive(Clone, Debug)]
pub enum HashTableEntryCodec {
    String,
    Integer,
    Boolean,
    Float,
    Handle(Box<Codec>),
    PtrArray(Box<Codec>),
}

impl HashTableEntryCodec {
    pub fn from_codec(codec: &Codec) -> Option<Self> {
        if codec.is_handle_backed() {
            return Some(Self::Handle(Box::new(codec.clone())));
        }
        match codec {
            Codec::String(_) => Some(Self::String),
            Codec::Integer(_) => Some(Self::Integer),
            Codec::Boolean(_) => Some(Self::Boolean),
            Codec::Float(_) => Some(Self::Float),
            Codec::Array(array_codec) => array_codec.ptr_array_item().map(Self::PtrArray),
            _ => None,
        }
    }

    pub fn hash_and_equal(&self) -> (glib::ffi::GHashFunc, glib::ffi::GEqualFunc) {
        match self {
            Self::String => (Some(glib::ffi::g_str_hash), Some(glib::ffi::g_str_equal)),
            Self::Float => (
                Some(glib::ffi::g_double_hash),
                Some(glib::ffi::g_double_equal),
            ),
            Self::Integer | Self::Boolean | Self::Handle(_) | Self::PtrArray(_) => (
                Some(glib::ffi::g_direct_hash),
                Some(glib::ffi::g_direct_equal),
            ),
        }
    }

    pub fn free_func(&self) -> anyhow::Result<glib::ffi::GDestroyNotify> {
        match self {
            Self::String | Self::Float => Ok(Some(glib::ffi::g_free)),
            Self::Integer | Self::Boolean => Ok(None),
            Self::Handle(codec) => Self::transferred_entry_destroy(codec),
            Self::PtrArray(_) => Ok(Some(g_ptr_array_unref_wrapper)),
        }
    }

    fn transferred_entry_destroy(codec: &Codec) -> anyhow::Result<glib::ffi::GDestroyNotify> {
        match codec {
            Codec::Object(object) if object.ownership.is_full() => Ok(Some(g_object_unref_wrapper)),
            Codec::Fundamental(fundamental) if fundamental.ownership.is_full() => {
                let (ref_fn, unref_fn) = fundamental.lookup_fns()?;
                if ref_fn.is_none() {
                    return Ok(None);
                }
                unref_fn.map(Some).ok_or_else(|| {
                    anyhow::anyhow!(
                        "Fundamental GHashTable element takes a reference but declares no unref function to release it"
                    )
                })
            }
            Codec::Boxed(boxed) if boxed.ownership.is_full() => bail!(
                "Boxed GHashTable elements with full ownership are unsupported: a GHashTable destroy notify cannot release a boxed copy"
            ),
            _ => Ok(None),
        }
    }

    pub fn encode(&self, value: &value::Value) -> anyhow::Result<*mut c_void> {
        match self {
            Self::String => {
                let value::Value::String(s) = value else {
                    bail!("Expected string in GHashTable, got {value:?}")
                };
                Ok(str_to_glib_full(s)? as *mut c_void)
            }
            Self::Integer => match value {
                value::Value::Number(n) => Ok(*n as isize as *mut c_void),
                _ => bail!("Expected number in GHashTable, got {value:?}"),
            },
            Self::Boolean => match value {
                value::Value::Boolean(b) => Ok(*b as isize as *mut c_void),
                _ => bail!("Expected boolean in GHashTable, got {value:?}"),
            },
            Self::Float => match value {
                value::Value::Number(n) => Ok(unsafe {
                    glib::ffi::g_memdup2(
                        (n as *const f64).cast::<c_void>(),
                        std::mem::size_of::<f64>(),
                    )
                }),
                _ => bail!("Expected number in GHashTable for float, got {value:?}"),
            },
            Self::Handle(_) => value.object_ptr("GHashTable entry"),
            Self::PtrArray(item_codec) => {
                let value::Value::Array(items) = value else {
                    bail!("Expected Array for GPtrArray in GHashTable, got {value:?}")
                };
                let elem_destroy = Self::transferred_entry_destroy(item_codec)?;
                let ptr_array = unsafe { glib::ffi::g_ptr_array_new_with_free_func(elem_destroy) };
                let build: anyhow::Result<()> = (|| {
                    for item in items {
                        let item_ptr = item.object_ptr("GPtrArray element")?;
                        let item_ptr = if item_ptr.is_null() {
                            item_ptr
                        } else {
                            unsafe { item_codec.ref_for_transfer(item_ptr)? }
                        };
                        unsafe { glib::ffi::g_ptr_array_add(ptr_array, item_ptr) };
                    }
                    Ok(())
                })();
                if let Err(err) = build {
                    unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
                    return Err(err);
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

unsafe extern "C" fn g_object_unref_wrapper(ptr: *mut c_void) {
    if ptr.is_null() {
        return;
    }
    unsafe {
        glib::gobject_ffi::g_object_unref(ptr as *mut glib::gobject_ffi::GObject);
    }
}

fn release_transferred(destroy: glib::ffi::GDestroyNotify, ptr: *mut c_void) {
    if let Some(destroy) = destroy
        && !ptr.is_null()
    {
        unsafe { destroy(ptr) };
    }
}

#[derive(Debug, Clone)]
pub struct HashTableCodec {
    pub key_codec: Box<Codec>,
    pub value_codec: Box<Codec>,
    pub ownership: Ownership,
}

impl HashTableCodec {
    fn tuple(value: &value::Value) -> anyhow::Result<(&value::Value, &value::Value)> {
        match value {
            value::Value::Array(arr) if arr.len() == 2 => Ok((&arr[0], &arr[1])),
            _ => bail!("Expected [key, value] tuple in GHashTable, got {value:?}"),
        }
    }

    fn encode_hashtable(
        &self,
        tuples: &[value::Value],
        key_encoder: &HashTableEntryCodec,
        value_encoder: &HashTableEntryCodec,
    ) -> anyhow::Result<ffi::Stash> {
        let key_free = key_encoder.free_func()?;
        let value_free = value_encoder.free_func()?;
        let (hash_func, equal_func) = key_encoder.hash_and_equal();
        let hash_table = unsafe {
            glib::ffi::g_hash_table_new_full(hash_func, equal_func, key_free, value_free)
        };

        let build: anyhow::Result<()> = (|| {
            for tuple in tuples {
                let (key, value) = Self::tuple(tuple)?;

                let key_ptr = key_encoder.encode(key)?;
                let key_ptr = unsafe { self.key_codec.ref_for_transfer(key_ptr)? };

                let value_ptr = match value_encoder.encode(value) {
                    Ok(encoded) => encoded,
                    Err(err) => {
                        release_transferred(key_free, key_ptr);
                        return Err(err);
                    }
                };
                let value_ptr = unsafe { self.value_codec.ref_for_transfer(value_ptr)? };

                unsafe {
                    glib::ffi::g_hash_table_insert(hash_table, key_ptr, value_ptr);
                }
            }
            Ok(())
        })();

        if let Err(err) = build {
            unsafe { glib::ffi::g_hash_table_unref(hash_table) };
            return Err(err);
        }

        let stash = if self.ownership.is_borrowed() {
            ffi::Stash::Storage(StashStorage::new(
                hash_table as *mut c_void,
                StashData::HashTable,
            ))
        } else {
            full_transfer_stash(hash_table as *mut c_void, ffi::ReleaseKind::HashTableUnref)
        };
        Ok(stash)
    }
}

impl Encoder for HashTableCodec {
    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        let tuples = match value {
            value::Value::Array(arr) => arr,
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::Stash::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected an Array of tuples for GHashTable codec, got {value:?}"),
        };

        let key_encoder = HashTableEntryCodec::from_codec(&self.key_codec).ok_or_else(|| {
            anyhow::anyhow!("Unsupported GHashTable key codec: {:?}", self.key_codec)
        })?;
        let value_encoder =
            HashTableEntryCodec::from_codec(&self.value_codec).ok_or_else(|| {
                anyhow::anyhow!("Unsupported GHashTable value codec: {:?}", self.value_codec)
            })?;

        self.encode_hashtable(tuples, &key_encoder, &value_encoder)
    }
}

impl Decoder for HashTableCodec {
    fn decode_call(&self, stash: &ffi::Stash) -> anyhow::Result<value::Value> {
        let Some(hash_ptr) = stash.as_non_null_ptr("GHashTable")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let pairs: anyhow::Result<Vec<value::Value>> = (|| {
            let mut pairs = Vec::new();
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
                    let key_value = self
                        .key_codec
                        .read(ReadSource::Value(key_ptr, "hash table key"))?;
                    let val_value = self
                        .value_codec
                        .read(ReadSource::Value(value_ptr, "hash table value"))?;
                    pairs.push(value::Value::Array(vec![key_value, val_value]));
                }
            }
            Ok(pairs)
        })();

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_hash_table_unref(hash_ptr as *mut glib::ffi::GHashTable) };
        }

        Ok(value::Value::Array(pairs?))
    }

    unsafe fn read_value(&self, ptr: *mut c_void, _context: &str) -> anyhow::Result<value::Value> {
        self.decode_call(&ffi::Stash::Ptr(ptr))
    }
}

impl PtrWriter for HashTableCodec {
    fn write_return_to_ptr(&self, ret: ffi::Slot, value: &std::result::Result<value::Value, ()>) {
        let table = encode_and_leak_container(value, "hashtable vfunc return", |v| self.encode(v));
        unsafe { ret.store(table) };
    }
}
