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
            Codec::Struct(struct_codec) if struct_codec.ownership.is_full() => {
                if struct_codec.size.is_none() {
                    bail!(
                        "Cannot transfer ownership of struct GHashTable elements: their size is unknown, so no copy can be made for the table"
                    );
                }
                Ok(Some(glib::ffi::g_free))
            }
            _ => Ok(None),
        }
    }

    pub fn encode(&self, value: Unknown<'_>) -> anyhow::Result<*mut c_void> {
        match self {
            Self::String => {
                let ValueType::String = value.get_type()? else {
                    bail!("Expected string in GHashTable")
                };
                Ok(str_to_glib_full(&value::read_napi::<String>(value)?)?.cast::<c_void>())
            }
            Self::Integer => match value.get_type()? {
                ValueType::Number => Ok(direct_pointer(value::read_napi::<f64>(value)?)),
                _ => bail!("Expected number in GHashTable"),
            },
            Self::Boolean => match value.get_type()? {
                ValueType::Boolean => {
                    Ok(isize::from(value::read_napi::<bool>(value)?) as *mut c_void)
                }
                _ => bail!("Expected boolean in GHashTable"),
            },
            Self::Float => match value.get_type()? {
                ValueType::Number => {
                    let n = value::read_napi::<f64>(value)?;
                    Ok(unsafe {
                        glib::ffi::g_memdup2((&raw const n).cast::<c_void>(), size_of::<f64>())
                    })
                }
                _ => bail!("Expected number in GHashTable for float"),
            },
            Self::Handle(codec) => {
                let ptr = value::handle_ptr(value, "GHashTable entry")?;
                unsafe { codec.ref_for_transfer(ptr) }
            }
            Self::PtrArray(item_codec) => {
                anyhow::ensure!(
                    value.is_array()?,
                    "Expected Array for GPtrArray in GHashTable"
                );
                let items: Array<'_> = value::read_napi(value)?;
                let elem_destroy = Self::transferred_entry_destroy(item_codec)?;
                let ptr_array = unsafe { glib::ffi::g_ptr_array_new_with_free_func(elem_destroy) };
                let build: anyhow::Result<()> = (|| {
                    for i in 0..items.len() {
                        let item: Unknown<'_> = items
                            .get(i)?
                            .ok_or_else(|| anyhow::anyhow!("GPtrArray element {i} is missing"))?;
                        let item_ptr = value::handle_ptr(item, "GPtrArray element")?;
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
                Ok(ptr_array.cast::<c_void>())
            }
        }
    }
}

unsafe extern "C" fn g_ptr_array_unref_wrapper(ptr: *mut c_void) {
    unsafe {
        glib::ffi::g_ptr_array_unref(ptr.cast::<glib::ffi::GPtrArray>());
    }
}

unsafe extern "C" fn g_object_unref_wrapper(ptr: *mut c_void) {
    if ptr.is_null() {
        return;
    }
    unsafe {
        glib::gobject_ffi::g_object_unref(ptr.cast::<glib::gobject_ffi::GObject>());
    }
}

#[allow(clippy::cast_possible_truncation)]
fn direct_pointer(value: f64) -> *mut c_void {
    value as isize as *mut c_void
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
    fn tuple(value: Unknown<'_>) -> anyhow::Result<(Unknown<'_>, Unknown<'_>)> {
        anyhow::ensure!(
            value.is_array()?,
            "Expected [key, value] tuple in GHashTable"
        );
        let array: Array<'_> = value::read_napi(value)?;
        if array.len() != 2 {
            bail!("Expected [key, value] tuple in GHashTable");
        }
        let key = array
            .get(0)?
            .ok_or_else(|| anyhow::anyhow!("GHashTable tuple key is missing"))?;
        let val = array
            .get(1)?
            .ok_or_else(|| anyhow::anyhow!("GHashTable tuple value is missing"))?;
        Ok((key, val))
    }

    fn encode_hashtable(
        &self,
        tuples: &[Unknown<'_>],
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
            for &tuple in tuples {
                let (key, value) = Self::tuple(tuple)?;

                let key_ptr = key_encoder.encode(key)?;

                let value_ptr = match value_encoder.encode(value) {
                    Ok(encoded) => encoded,
                    Err(err) => {
                        release_transferred(key_free, key_ptr);
                        return Err(err);
                    }
                };

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
                hash_table.cast::<c_void>(),
                StashData::HashTable,
            ))
        } else {
            full_transfer_stash(
                hash_table.cast::<c_void>(),
                ffi::ReleaseKind::HashTableUnref,
            )
        };
        Ok(stash)
    }
}

impl Encoder for HashTableCodec {
    fn encode(&self, _env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        if !value.is_array()? {
            return match value.get_type()? {
                ValueType::Null | ValueType::Undefined => Ok(ffi::Stash::Ptr(std::ptr::null_mut())),
                _ => bail!("Expected an Array of tuples for GHashTable codec"),
            };
        }

        let array: Array<'_> = value::read_napi(value)?;
        let mut tuples = Vec::with_capacity(array.len() as usize);
        for i in 0..array.len() {
            let tuple: Unknown<'_> = array
                .get(i)?
                .ok_or_else(|| anyhow::anyhow!("GHashTable tuple {i} is missing"))?;
            tuples.push(tuple);
        }

        let key_encoder = HashTableEntryCodec::from_codec(&self.key_codec).ok_or_else(|| {
            anyhow::anyhow!("Unsupported GHashTable key codec: {:?}", self.key_codec)
        })?;
        let value_encoder =
            HashTableEntryCodec::from_codec(&self.value_codec).ok_or_else(|| {
                anyhow::anyhow!("Unsupported GHashTable value codec: {:?}", self.value_codec)
            })?;

        self.encode_hashtable(&tuples, &key_encoder, &value_encoder)
    }
}

impl Decoder for HashTableCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        let Some(hash_ptr) = stash.as_non_null_ptr("GHashTable")? else {
            return value::js_array(env, Vec::new()).map_err(Into::into);
        };

        let pairs: anyhow::Result<Vec<Unknown<'e>>> = (|| {
            let mut pairs = Vec::new();
            unsafe {
                let mut iter = std::mem::MaybeUninit::<glib::ffi::GHashTableIter>::uninit();
                glib::ffi::g_hash_table_iter_init(
                    iter.as_mut_ptr(),
                    hash_ptr.cast::<glib::ffi::GHashTable>(),
                );

                let mut key_ptr: *mut c_void = std::ptr::null_mut();
                let mut value_ptr: *mut c_void = std::ptr::null_mut();

                while glib::ffi::g_hash_table_iter_next(
                    iter.as_mut_ptr(),
                    &raw mut key_ptr,
                    &raw mut value_ptr,
                ) != 0
                {
                    let key_value = self
                        .key_codec
                        .read(env, ReadSource::Value(key_ptr, "hash table key"))?;
                    let val_value = self
                        .value_codec
                        .read(env, ReadSource::Value(value_ptr, "hash table value"))?;
                    pairs.push(value::js_array(env, vec![key_value, val_value])?);
                }
            }
            Ok(pairs)
        })();

        if self.ownership.is_full() {
            unsafe { glib::ffi::g_hash_table_unref(hash_ptr.cast::<glib::ffi::GHashTable>()) };
        }

        Ok(value::js_array(env, pairs?)?)
    }

    unsafe fn read_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode_call(env, &ffi::Stash::Ptr(ptr))
    }
}

impl PtrWriter for HashTableCodec {
    fn write_return_to_ptr(
        &self,
        env: &Env,
        ret: ffi::Slot,
        value: &std::result::Result<Unknown<'_>, ()>,
    ) {
        let table =
            encode_and_leak_container(value, "hashtable vfunc return", |v| self.encode(env, v));
        unsafe { ret.store(table) };
    }
}
