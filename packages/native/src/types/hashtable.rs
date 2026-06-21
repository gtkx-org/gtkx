use anyhow::bail;
use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use super::prelude::*;
use super::string::str_to_glib_full;
use crate::ffi::{FfiStorage, FfiStorageKind, HashTableData};
use crate::types::Type;
use crate::types::array::ArrayKind;

#[derive(Clone, Debug)]
pub enum HashTableEntryEncoder {
    String,
    Integer,
    Boolean,
    Float,
    NativeHandle(Box<Type>),
    PtrArray(Box<Type>),
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
                Some(Self::NativeHandle(Box::new(ty.clone())))
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
            Self::Integer | Self::Boolean | Self::NativeHandle(_) | Self::PtrArray(_) => {
                Some(glib::ffi::g_direct_hash)
            }
        }
    }

    pub fn equal_func(&self) -> glib::ffi::GEqualFunc {
        match self {
            Self::String => Some(glib::ffi::g_str_equal),
            Self::Float => Some(glib::ffi::g_double_equal),
            Self::Integer | Self::Boolean | Self::NativeHandle(_) | Self::PtrArray(_) => {
                Some(glib::ffi::g_direct_equal)
            }
        }
    }

    pub fn free_func(&self) -> anyhow::Result<glib::ffi::GDestroyNotify> {
        match self {
            Self::String | Self::Float => Ok(Some(glib::ffi::g_free)),
            Self::Integer | Self::Boolean => Ok(None),
            Self::NativeHandle(ty) => Self::transferred_entry_destroy(ty),
            Self::PtrArray(_) => Ok(Some(g_ptr_array_unref_wrapper)),
        }
    }

    fn transferred_entry_destroy(ty: &Type) -> anyhow::Result<glib::ffi::GDestroyNotify> {
        match ty {
            Type::GObject(gobject) if gobject.ownership.is_full() => {
                Ok(Some(g_object_unref_wrapper))
            }
            Type::Fundamental(fundamental) if fundamental.ownership.is_full() => {
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
            Type::Boxed(boxed) if boxed.ownership.is_full() => bail!(
                "Boxed GHashTable elements with full ownership are unsupported: a GHashTable destroy notify cannot release a boxed copy"
            ),
            _ => Ok(None),
        }
    }

    pub fn encode(&self, val: &value::Value) -> anyhow::Result<*mut c_void> {
        match self {
            Self::String => {
                let value::Value::String(s) = val else {
                    bail!("Expected string in GHashTable, got {val:?}")
                };
                Ok(str_to_glib_full(s)? as *mut c_void)
            }
            Self::Integer => match val {
                value::Value::Number(n) => Ok(*n as isize as *mut c_void),
                _ => bail!("Expected number in GHashTable, got {val:?}"),
            },
            Self::Boolean => match val {
                value::Value::Boolean(b) => Ok(*b as isize as *mut c_void),
                _ => bail!("Expected boolean in GHashTable, got {val:?}"),
            },
            Self::Float => match val {
                value::Value::Number(n) => {
                    // SAFETY: `g_malloc(size_of::<f64>())` returns a non-null, suitably aligned and
                    // sized allocation (it aborts on failure), so storing `*n` into it and handing
                    // the pointer to the GHashTable (whose value-free is `g_free`) is sound.
                    let ptr = unsafe {
                        let mem = glib::ffi::g_malloc(std::mem::size_of::<f64>()) as *mut f64;
                        *mem = *n;
                        mem as *mut c_void
                    };
                    Ok(ptr)
                }
                _ => bail!("Expected number in GHashTable for float, got {val:?}"),
            },
            Self::NativeHandle(_) => match val {
                value::Value::Object(handle) => Ok(handle.ptr()),
                value::Value::Null | value::Value::Undefined => Ok(std::ptr::null_mut()),
                _ => bail!("Expected native object in GHashTable, got {val:?}"),
            },
            Self::PtrArray(item_type) => {
                let value::Value::Array(items) = val else {
                    bail!("Expected Array for GPtrArray in GHashTable, got {val:?}")
                };
                let elem_destroy = Self::transferred_entry_destroy(item_type)?;
                // SAFETY: `elem_destroy` is the destroy notify matching `item_type`'s ownership;
                // `g_ptr_array_new_with_free_func` returns a fresh, owned GPtrArray.
                let ptr_array = unsafe { glib::ffi::g_ptr_array_new_with_free_func(elem_destroy) };
                let build: anyhow::Result<()> = (|| {
                    for item in items {
                        let item_ptr = match item {
                            value::Value::Object(handle) => handle.ptr(),
                            value::Value::Null | value::Value::Undefined => std::ptr::null_mut(),
                            _ => bail!("Expected Object in GPtrArray, got {item:?}"),
                        };
                        let item_ptr = if item_ptr.is_null() {
                            item_ptr
                        } else {
                            // SAFETY: `item_ptr` is the non-null live object pointer of a wrapper;
                            // `ref_for_transfer` acquires the transfer reference matching the array's
                            // `elem_destroy` so each stored element is freed exactly once.
                            unsafe { item_type.ref_for_transfer(item_ptr)? }
                        };
                        // SAFETY: `ptr_array` is the owned GPtrArray created above; `g_ptr_array_add`
                        // appends `item_ptr`, transferring its reference into the array.
                        unsafe { glib::ffi::g_ptr_array_add(ptr_array, item_ptr) };
                    }
                    Ok(())
                })();
                if let Err(err) = build {
                    // SAFETY: `ptr_array` is the owned GPtrArray; on the error path it is released
                    // once here, freeing every element added so far via its `elem_destroy`.
                    unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
                    return Err(err);
                }
                Ok(ptr_array as *mut c_void)
            }
        }
    }
}

/// `GDestroyNotify` that releases a `GPtrArray` stored as a `GHashTable` element.
///
/// # Safety
///
/// Invoked by `GLib` as a destroy notify. `ptr` must be a `GPtrArray` owned by the hash table;
/// this releases one reference on it.
unsafe extern "C" fn g_ptr_array_unref_wrapper(ptr: *mut c_void) {
    // SAFETY: GLib passes the owned GPtrArray element pointer; `g_ptr_array_unref` releases the
    // one reference the hash table held.
    unsafe {
        glib::ffi::g_ptr_array_unref(ptr as *mut glib::ffi::GPtrArray);
    }
}

/// `GDestroyNotify` that releases a `GObject` stored as a `GHashTable` element.
///
/// # Safety
///
/// Invoked by `GLib` as a destroy notify. `ptr` must be null or a `GObject` owned by the hash
/// table; this releases one reference on it.
unsafe extern "C" fn g_object_unref_wrapper(ptr: *mut c_void) {
    if ptr.is_null() {
        return;
    }
    // SAFETY: `ptr` is non-null (checked above) and the GObject element the hash table owned;
    // `g_object_unref` releases the one reference held for it.
    unsafe {
        glib::gobject_ffi::g_object_unref(ptr as *mut glib::gobject_ffi::GObject);
    }
}

fn release_transferred(destroy: glib::ffi::GDestroyNotify, ptr: *mut c_void) {
    if let Some(destroy) = destroy
        && !ptr.is_null()
    {
        // SAFETY: `destroy` is the destroy notify chosen for this entry's type and `ptr` is the
        // non-null transferred entry it owns; invoking it releases that entry exactly once.
        unsafe { destroy(ptr) };
    }
}

#[derive(Debug, Clone)]
pub struct HashTableType {
    pub key_type: Box<Type>,
    pub value_type: Box<Type>,
    pub ownership: Ownership,
}

impl FromDescriptor for HashTableType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn from_descriptor(env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let key_type_value: Unknown<'_> = obj.get_named_property("keyType")?;
        let key_type = Type::from_js_value(env, key_type_value)?;

        let value_type_value: Unknown<'_> = obj.get_named_property("valueType")?;
        let value_type = Type::from_js_value(env, value_type_value)?;

        let ownership = Ownership::from_js_value(obj, "hashtable")?;

        Ok(Self {
            key_type: Box::new(key_type),
            value_type: Box::new(value_type),
            ownership,
        })
    }
}

impl HashTableType {
    fn tuple(value: &value::Value) -> anyhow::Result<(&value::Value, &value::Value)> {
        match value {
            value::Value::Array(arr) if arr.len() == 2 => Ok((&arr[0], &arr[1])),
            _ => bail!("Expected [key, value] tuple in GHashTable, got {value:?}"),
        }
    }

    fn encode_hashtable(
        &self,
        tuples: &[value::Value],
        key_encoder: &HashTableEntryEncoder,
        value_encoder: &HashTableEntryEncoder,
    ) -> anyhow::Result<ffi::FfiValue> {
        let key_free = key_encoder.free_func()?;
        let value_free = value_encoder.free_func()?;
        // SAFETY: the hash/equal/free function pointers come from the encoders and match the key
        // and value representations; `g_hash_table_new_full` returns a fresh, owned GHashTable.
        let hash_table = unsafe {
            glib::ffi::g_hash_table_new_full(
                key_encoder.hash_func(),
                key_encoder.equal_func(),
                key_free,
                value_free,
            )
        };

        let build: anyhow::Result<()> = (|| {
            for tuple in tuples {
                let (key, val) = Self::tuple(tuple)?;

                let key_ptr = key_encoder.encode(key)?;
                // SAFETY: `key_ptr` is the encoded key pointer; `ref_for_transfer` acquires the
                // transfer reference matching `key_free` so the inserted key is freed exactly once.
                let key_ptr = unsafe { self.key_type.ref_for_transfer(key_ptr)? };

                let val_ptr = match value_encoder.encode(val) {
                    Ok(encoded) => encoded,
                    Err(err) => {
                        release_transferred(key_free, key_ptr);
                        return Err(err);
                    }
                };
                // SAFETY: `val_ptr` is the encoded value pointer; `ref_for_transfer` acquires the
                // transfer reference matching `value_free` so the inserted value is freed once.
                let val_ptr = unsafe { self.value_type.ref_for_transfer(val_ptr)? };

                // SAFETY: `hash_table` is the owned table created above; `g_hash_table_insert`
                // moves ownership of `key_ptr`/`val_ptr` into it under its key/value free funcs.
                unsafe {
                    glib::ffi::g_hash_table_insert(hash_table, key_ptr, val_ptr);
                }
            }
            Ok(())
        })();

        if let Err(err) = build {
            // SAFETY: `hash_table` is the owned table; on the error path it is released once here,
            // freeing every key/value inserted so far via the registered destroy notifies.
            unsafe { glib::ffi::g_hash_table_unref(hash_table) };
            return Err(err);
        }

        let should_free = self.ownership.is_borrowed();
        let storage = FfiStorage::new(
            hash_table as *mut c_void,
            FfiStorageKind::HashTable(HashTableData {
                handle: hash_table,
                should_free,
            }),
        );
        let storage = if should_free {
            storage
        } else {
            storage.with_pending_transfer(
                hash_table as *mut c_void,
                ffi::PendingRelease::HashTableUnref,
            )
        };
        Ok(ffi::FfiValue::Storage(storage))
    }
}

impl FfiEncoder for HashTableType {
    fn encode(&self, val: &value::Value) -> anyhow::Result<ffi::FfiValue> {
        let tuples = match val {
            value::Value::Array(arr) => arr,
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected an Array of tuples for GHashTable type, got {val:?}"),
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
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        let ffi_value = match src {
            ReadSource::Call(ffi_value) => ffi_value,
            ReadSource::Value(ptr, _context) => {
                if ptr.is_null() {
                    return Ok(value::Value::Array(vec![]));
                }
                return self.decode(&ffi::FfiValue::Ptr(ptr));
            }
            ReadSource::Slot(ptr, context) => {
                // SAFETY: forwards the caller's slot-validity guarantee to `read_pointer_slot`.
                return unsafe { self.read_pointer_slot(ptr, context) };
            }
        };

        let Some(hash_ptr) = ffi_value.as_non_null_ptr("GHashTable")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let pairs: anyhow::Result<Vec<value::Value>> = (|| {
            let mut pairs = Vec::new();
            // SAFETY: `hash_ptr` is the non-null GHashTable returned by the C call; the iterator is
            // initialized into `iter` before use, and `g_hash_table_iter_next` fills `key_ptr`/
            // `value_ptr` with borrowed element pointers each iteration until it returns false. The
            // per-element reads only borrow, so iteration does not invalidate the table.
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
                        .key_type
                        .read(ReadSource::Value(key_ptr, "hash table key"))?;
                    let val_value = self
                        .value_type
                        .read(ReadSource::Value(value_ptr, "hash table value"))?;
                    pairs.push(value::Value::Array(vec![key_value, val_value]));
                }
            }
            Ok(pairs)
        })();

        let storage_owns_table = matches!(ffi_value, ffi::FfiValue::Storage(_));
        if self.ownership.is_full() && !storage_owns_table {
            // SAFETY: full ownership was transferred to us and no `FfiStorage` will free the table,
            // so `hash_ptr` is the owned GHashTable; releasing its one reference here frees it once.
            unsafe { glib::ffi::g_hash_table_unref(hash_ptr as *mut glib::ffi::GHashTable) };
        }

        Ok(value::Value::Array(pairs?))
    }
}

impl RawPtrCodec for HashTableType {
    unsafe fn write_return_to_raw_ptr(
        &self,
        ret: *mut c_void,
        value: &std::result::Result<value::Value, ()>,
    ) {
        let table = encode_and_leak_container(value, "hashtable vfunc return", |v| self.encode(v));
        // SAFETY: `ret` is a marshalling-provided return slot guaranteed to address a pointer-sized
        // writable region; `write_unaligned` stores the leaked (or null) GHashTable pointer there.
        unsafe { (ret as *mut *mut c_void).write_unaligned(table) };
    }
}
