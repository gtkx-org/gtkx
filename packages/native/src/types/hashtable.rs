use anyhow::bail;
use gtk4::glib;
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

    /// The destroy notify the table installs for this entry shape — the
    /// release exactly matching what [`Self::encode`] plus `ref_for_transfer`
    /// acquire. Fails for element shapes whose acquired ownership cannot be
    /// released by a context-free notify (full-ownership boxed copies).
    pub fn free_func(&self) -> anyhow::Result<glib::ffi::GDestroyNotify> {
        match self {
            Self::String | Self::Float => Ok(Some(glib::ffi::g_free)),
            Self::Integer | Self::Boolean => Ok(None),
            Self::NativeHandle(ty) => Self::transferred_entry_destroy(ty),
            Self::PtrArray(_) => Ok(Some(g_ptr_array_unref_wrapper)),
        }
    }

    /// Resolves the destroy notify that releases the ownership
    /// `ref_for_transfer` takes for a handle-shaped element. Borrowed elements
    /// take no ownership and need no release. Full-ownership boxed elements
    /// are rejected: releasing a boxed copy requires its `GType`, which a
    /// context-free `GDestroyNotify` cannot carry.
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

    /// Releases an encode-stage allocation for an entry that never reached
    /// `ref_for_transfer` — the duplicated string, the malloc'd float box, or
    /// the built pointer array.
    fn release_unowned(&self, ptr: *mut c_void) {
        if ptr.is_null() {
            return;
        }
        match self {
            // SAFETY: For these shapes `encode` produced one g_malloc'd
            // allocation that nothing else owns yet.
            Self::String | Self::Float => unsafe { glib::ffi::g_free(ptr) },
            // SAFETY: `encode` produced the GPtrArray with one reference
            // that nothing else owns yet.
            Self::PtrArray(_) => unsafe {
                glib::ffi::g_ptr_array_unref(ptr as *mut glib::ffi::GPtrArray);
            },
            Self::Integer | Self::Boolean | Self::NativeHandle(_) => {}
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
                    // SAFETY: g_malloc aborts on failure, so `mem` is a
                    // valid f64-sized allocation for the write.
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
                // SAFETY: Creating a GPtrArray with a destroy notify has no
                // pointer preconditions.
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
                            // SAFETY: `item_ptr` came from a NativeHandle
                            // wrapping a live instance of the item type.
                            unsafe { item_type.ref_for_transfer(item_ptr)? }
                        };
                        // SAFETY: `ptr_array` is the live array
                        // created above.
                        unsafe { glib::ffi::g_ptr_array_add(ptr_array, item_ptr) };
                    }
                    Ok(())
                })();
                if let Err(err) = build {
                    // SAFETY: `ptr_array` holds the one reference created
                    // above; releasing it also frees appended elements.
                    unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
                    return Err(err);
                }
                Ok(ptr_array as *mut c_void)
            }
        }
    }
}

unsafe extern "C" fn g_ptr_array_unref_wrapper(ptr: *mut c_void) {
    // SAFETY: GHashTable invokes this destroy notify with the GPtrArray
    // entry it owns, exactly once.
    unsafe {
        glib::ffi::g_ptr_array_unref(ptr as *mut glib::ffi::GPtrArray);
    }
}

unsafe extern "C" fn g_object_unref_wrapper(ptr: *mut c_void) {
    if ptr.is_null() {
        return;
    }
    // SAFETY: GHashTable invokes this destroy notify with the GObject
    // entry whose reference `ref_for_transfer` took, exactly once.
    unsafe {
        glib::gobject_ffi::g_object_unref(ptr as *mut glib::gobject_ffi::GObject);
    }
}

/// Invokes the table's destroy notify on a fully prepared entry that was
/// never inserted, releasing whatever ownership its preparation acquired.
fn release_transferred(destroy: glib::ffi::GDestroyNotify, ptr: *mut c_void) {
    if let Some(destroy) = destroy
        && !ptr.is_null()
    {
        // SAFETY: `destroy` is the notify matched to this entry's shape,
        // and `ptr` is the fully prepared entry it expects, never
        // inserted, so this is its only release.
        unsafe { destroy(ptr) };
    }
}

#[derive(Debug, Clone)]
pub struct HashTableType {
    pub key_type: Box<Type>,
    pub value_type: Box<Type>,
    pub ownership: Ownership,
}

impl HashTableType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(env: &Env, obj: &JsObject) -> napi::Result<Self> {
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
        // SAFETY: Creating a GHashTable from hash/equal/destroy function
        // pointers has no pointer preconditions.
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
                // SAFETY: `key_ptr` was just produced by the entry encoder,
                // so it is null, a packed scalar, or a live allocation of
                // the key type.
                let key_ptr = match unsafe { self.key_type.ref_for_transfer(key_ptr) } {
                    Ok(transferred) => transferred,
                    Err(err) => {
                        key_encoder.release_unowned(key_ptr);
                        return Err(err);
                    }
                };

                let val_ptr = match value_encoder.encode(val) {
                    Ok(encoded) => encoded,
                    Err(err) => {
                        release_transferred(key_free, key_ptr);
                        return Err(err);
                    }
                };
                // SAFETY: `val_ptr` was just produced by the entry encoder,
                // so it is null, a packed scalar, or a live allocation of
                // the value type.
                let val_ptr = match unsafe { self.value_type.ref_for_transfer(val_ptr) } {
                    Ok(transferred) => transferred,
                    Err(err) => {
                        value_encoder.release_unowned(val_ptr);
                        release_transferred(key_free, key_ptr);
                        return Err(err);
                    }
                };

                // SAFETY: `hash_table` is the live table created above,
                // and the entry pointers carry the ownership its destroy
                // notifies release.
                unsafe {
                    glib::ffi::g_hash_table_insert(hash_table, key_ptr, val_ptr);
                }
            }
            Ok(())
        })();

        if let Err(err) = build {
            // SAFETY: `hash_table` holds the one reference created above;
            // releasing it also frees inserted entries.
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
    fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let tuples = match val {
            value::Value::Array(arr) => arr,
            value::Value::Null | value::Value::Undefined if optional => {
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
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(hash_ptr) = ffi_value.as_non_null_ptr("GHashTable")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let pairs: anyhow::Result<Vec<value::Value>> = (|| {
            let mut pairs = Vec::new();
            // SAFETY: `hash_ptr` is the live GHashTable the caller decoded,
            // and each key/value pointer the iterator yields is a live entry
            // of the declared key/value type for the iteration's duration.
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
            Ok(pairs)
        })();

        let storage_owns_table = matches!(ffi_value, ffi::FfiValue::Storage(_));
        if self.ownership.is_full() && !storage_owns_table {
            // SAFETY: A transfer-full return hands this decode the one
            // owned reference, released here exactly once after copying.
            unsafe { glib::ffi::g_hash_table_unref(hash_ptr as *mut glib::ffi::GHashTable) };
        }

        Ok(value::Value::Array(pairs?))
    }
}

impl RawPtrCodec for HashTableType {
    unsafe fn ptr_to_value(
        &self,
        ptr: *mut c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }
        self.decode(&ffi::FfiValue::Ptr(ptr))
    }
}
