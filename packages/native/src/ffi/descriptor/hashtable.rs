use anyhow::bail;
use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use super::prelude::*;
use super::string::str_to_glib_full;
use crate::ffi::descriptor::Descriptor;
use crate::ffi::descriptor::array::ArrayKind;
use crate::ffi::{HashTableData, Stash, StashKind};

#[derive(Clone, Debug)]
pub enum HashTableEntryEncoder {
    String,
    Integer,
    Boolean,
    Float,
    Handle(Box<Descriptor>),
    PtrArray(Box<Descriptor>),
}

impl HashTableEntryEncoder {
    #[must_use]
    pub fn from_descriptor(descriptor: &Descriptor) -> Option<Self> {
        match descriptor {
            Descriptor::String(_) => Some(Self::String),
            Descriptor::Integer(_) => Some(Self::Integer),
            Descriptor::Boolean(_) => Some(Self::Boolean),
            Descriptor::Float(_) => Some(Self::Float),
            Descriptor::Object(_)
            | Descriptor::Boxed(_)
            | Descriptor::Struct(_)
            | Descriptor::Fundamental(_) => Some(Self::Handle(Box::new(descriptor.clone()))),
            Descriptor::Array(array_descriptor) if array_descriptor.kind == ArrayKind::GPtrArray => {
                Some(Self::PtrArray(array_descriptor.item_descriptor.clone()))
            }
            _ => None,
        }
    }

    pub fn hash_func(&self) -> glib::ffi::GHashFunc {
        match self {
            Self::String => Some(glib::ffi::g_str_hash),
            Self::Float => Some(glib::ffi::g_double_hash),
            Self::Integer | Self::Boolean | Self::Handle(_) | Self::PtrArray(_) => {
                Some(glib::ffi::g_direct_hash)
            }
        }
    }

    pub fn equal_func(&self) -> glib::ffi::GEqualFunc {
        match self {
            Self::String => Some(glib::ffi::g_str_equal),
            Self::Float => Some(glib::ffi::g_double_equal),
            Self::Integer | Self::Boolean | Self::Handle(_) | Self::PtrArray(_) => {
                Some(glib::ffi::g_direct_equal)
            }
        }
    }

    pub fn free_func(&self) -> anyhow::Result<glib::ffi::GDestroyNotify> {
        match self {
            Self::String | Self::Float => Ok(Some(glib::ffi::g_free)),
            Self::Integer | Self::Boolean => Ok(None),
            Self::Handle(descriptor) => Self::transferred_entry_destroy(descriptor),
            Self::PtrArray(_) => Ok(Some(g_ptr_array_unref_wrapper)),
        }
    }

    fn transferred_entry_destroy(descriptor: &Descriptor) -> anyhow::Result<glib::ffi::GDestroyNotify> {
        match descriptor {
            Descriptor::Object(object) if object.ownership.is_full() => {
                Ok(Some(g_object_unref_wrapper))
            }
            Descriptor::Fundamental(fundamental) if fundamental.ownership.is_full() => {
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
            Descriptor::Boxed(boxed) if boxed.ownership.is_full() => bail!(
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
            Self::Handle(_) => match val {
                value::Value::Object(handle) => Ok(handle.ptr()),
                value::Value::Null | value::Value::Undefined => Ok(std::ptr::null_mut()),
                _ => bail!("Expected native object in GHashTable, got {val:?}"),
            },
            Self::PtrArray(item_descriptor) => {
                let value::Value::Array(items) = val else {
                    bail!("Expected Array for GPtrArray in GHashTable, got {val:?}")
                };
                let elem_destroy = Self::transferred_entry_destroy(item_descriptor)?;
                // SAFETY: `elem_destroy` is the destroy notify matching `item_descriptor`'s ownership;
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
                            unsafe { item_descriptor.ref_for_transfer(item_ptr)? }
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
pub struct HashTableDescriptor {
    pub key_descriptor: Box<Descriptor>,
    pub value_descriptor: Box<Descriptor>,
    pub ownership: Ownership,
}

impl HashTableDescriptor {
    #[allow(clippy::trivially_copy_pass_by_ref)]
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub(crate) fn from_descriptor(env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let key_descriptor_value: Unknown<'_> = obj.get_named_property("keyDescriptor")?;
        let key_descriptor = Descriptor::from_descriptor(env, key_descriptor_value)?;

        let value_descriptor_value: Unknown<'_> = obj.get_named_property("valueDescriptor")?;
        let value_descriptor = Descriptor::from_descriptor(env, value_descriptor_value)?;

        let ownership = Ownership::from_descriptor(obj, "hashtable")?;

        Ok(Self {
            key_descriptor: Box::new(key_descriptor),
            value_descriptor: Box::new(value_descriptor),
            ownership,
        })
    }
}

impl HashTableDescriptor {
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
    ) -> anyhow::Result<ffi::StashedValue> {
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
                let key_ptr = unsafe { self.key_descriptor.ref_for_transfer(key_ptr)? };

                let val_ptr = match value_encoder.encode(val) {
                    Ok(encoded) => encoded,
                    Err(err) => {
                        release_transferred(key_free, key_ptr);
                        return Err(err);
                    }
                };
                // SAFETY: `val_ptr` is the encoded value pointer; `ref_for_transfer` acquires the
                // transfer reference matching `value_free` so the inserted value is freed once.
                let val_ptr = unsafe { self.value_descriptor.ref_for_transfer(val_ptr)? };

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
        let storage = Stash::new(
            hash_table as *mut c_void,
            StashKind::HashTable(HashTableData {
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
        Ok(ffi::StashedValue::Storage(storage))
    }
}

impl FfiEncoder for HashTableDescriptor {
    fn encode(&self, val: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        let tuples = match val {
            value::Value::Array(arr) => arr,
            value::Value::Null | value::Value::Undefined => {
                return Ok(ffi::StashedValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected an Array of tuples for GHashTable descriptor, got {val:?}"),
        };

        let key_encoder =
            HashTableEntryEncoder::from_descriptor(&self.key_descriptor).ok_or_else(|| {
                anyhow::anyhow!("Unsupported GHashTable key descriptor: {:?}", self.key_descriptor)
            })?;
        let value_encoder =
            HashTableEntryEncoder::from_descriptor(&self.value_descriptor).ok_or_else(|| {
                anyhow::anyhow!(
                    "Unsupported GHashTable value descriptor: {:?}",
                    self.value_descriptor
                )
            })?;

        self.encode_hashtable(tuples, &key_encoder, &value_encoder)
    }
}

impl FfiDecoder for HashTableDescriptor {
    unsafe fn read(&self, src: ReadSource<'_>) -> anyhow::Result<value::Value> {
        let stashed_value = match src {
            ReadSource::Call(stashed_value) => stashed_value,
            ReadSource::Value(ptr, _context) => {
                if ptr.is_null() {
                    return Ok(value::Value::Array(vec![]));
                }
                return self.decode(&ffi::StashedValue::Ptr(ptr));
            }
            ReadSource::Slot(ptr, context) => {
                // SAFETY: forwards the caller's slot-validity guarantee to `read_pointer_slot`.
                return unsafe { self.read_pointer_slot(ptr, context) };
            }
        };

        let Some(hash_ptr) = stashed_value.as_non_null_ptr("GHashTable")? else {
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
                        .key_descriptor
                        .read(ReadSource::Value(key_ptr, "hash table key"))?;
                    let val_value = self
                        .value_descriptor
                        .read(ReadSource::Value(value_ptr, "hash table value"))?;
                    pairs.push(value::Value::Array(vec![key_value, val_value]));
                }
            }
            Ok(pairs)
        })();

        let storage_owns_table = matches!(stashed_value, ffi::StashedValue::Storage(_));
        if self.ownership.is_full() && !storage_owns_table {
            // SAFETY: full ownership with no owning storage means `hash_ptr` is the owned
            // GHashTable; releasing its one reference here frees it exactly once.
            unsafe { glib::ffi::g_hash_table_unref(hash_ptr as *mut glib::ffi::GHashTable) };
        }

        Ok(value::Value::Array(pairs?))
    }
}

impl PointerWriter for HashTableDescriptor {
    unsafe fn write_return_to_pointer(
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
