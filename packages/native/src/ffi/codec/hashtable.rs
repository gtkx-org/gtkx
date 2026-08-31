use anyhow::bail;

use super::prelude::*;
use super::string::str_to_glib_full;
use crate::ffi::codec::{BigIntCodec, Codec, EnumFlagsCodec, FloatCodec, IntegerCodec};
use crate::ffi::{HashTableData, StashData, StashStorage};

type CVoidPtr = *mut c_void;

/// Whether a hash table entry codec takes ownership of what it encodes, so that the callee is
/// the one left to release it.
fn entry_ownership_is_full(codec: &Codec) -> bool {
    match codec {
        Codec::String(string) => string.ownership.is_full(),
        Codec::Object(object) => object.ownership.is_full(),
        Codec::Boxed(boxed) => boxed.ownership.is_full(),
        Codec::Fundamental(fundamental) => fundamental.ownership.is_full(),
        Codec::Array(array) => array.ownership.is_full(),
        _ => false,
    }
}

#[derive(Clone, Debug)]
pub enum HashTableEntryCodec {
    String,
    Integer(IntegerCodec),
    EnumFlags(EnumFlagsCodec),
    Boolean,
    Float(FloatCodec),
    BigInt(BigIntCodec),
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
            Codec::Integer(integer) => Some(Self::Integer(*integer)),
            Codec::EnumFlags(enum_flags) => Some(Self::EnumFlags(enum_flags.clone())),
            Codec::Boolean(_) => Some(Self::Boolean),
            Codec::Float(float) => Some(Self::Float(*float)),
            Codec::BigInt(bigint) => Some(Self::BigInt(*bigint)),
            Codec::Array(array_codec) => array_codec.ptr_array_item().map(Self::PtrArray),
            _ => None,
        }
    }

    /// Whether the element is too wide, or too fractional, for the table's pointer slot, so that
    /// it is held behind a `g_malloc`ed copy the table's destroy notify frees.
    fn is_boxed(&self) -> bool {
        matches!(self, Self::Float(_) | Self::BigInt(_))
    }

    pub fn hash_and_equal(&self) -> anyhow::Result<(glib::ffi::GHashFunc, glib::ffi::GEqualFunc)> {
        match self {
            Self::String => Ok((Some(glib::ffi::g_str_hash), Some(glib::ffi::g_str_equal))),
            Self::Float(FloatCodec::F64) => Ok((
                Some(glib::ffi::g_double_hash),
                Some(glib::ffi::g_double_equal),
            )),
            Self::Float(FloatCodec::F32) => bail!(
                "A 32-bit float cannot be a GHashTable key: GLib has no hash function that reads a gfloat"
            ),
            Self::BigInt(_) => bail!(
                "A 64-bit integer cannot be a GHashTable key: g_int64_hash dereferences every key the table is handed, including the ones the callee passes beside it, and only the entries encoded here are boxed"
            ),
            Self::Integer(_)
            | Self::EnumFlags(_)
            | Self::Boolean
            | Self::Handle(_)
            | Self::PtrArray(_) => Ok((
                Some(glib::ffi::g_direct_hash),
                Some(glib::ffi::g_direct_equal),
            )),
        }
    }

    pub fn free_func(&self) -> anyhow::Result<glib::ffi::GDestroyNotify> {
        match self {
            Self::String | Self::Float(_) | Self::BigInt(_) => Ok(Some(glib::ffi::g_free)),
            Self::Integer(_) | Self::EnumFlags(_) | Self::Boolean => Ok(None),
            Self::Handle(codec) => Self::transferred_entry_destroy(codec),
            Self::PtrArray(_) => Ok(Some(g_ptr_array_unref_wrapper)),
        }
    }

    /// Packs a whole-number element into the table's pointer slot the way `GINT_TO_POINTER` does,
    /// after the same range check a scalar argument of that width gets.
    fn pointer_word(codec: IntegerCodec, value: Unknown<'_>) -> anyhow::Result<*mut c_void> {
        let ValueType::Number = value.get_type()? else {
            bail!("Expected number in GHashTable")
        };
        let n = value::read_napi::<f64>(value)?;
        codec.check_range(n)?;

        Ok(direct_pointer(codec, n))
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

    pub fn encode(&self, value: Unknown<'_>) -> anyhow::Result<*mut c_void> {
        match self {
            Self::String => {
                let ValueType::String = value.get_type()? else {
                    bail!("Expected string in GHashTable")
                };
                Ok(str_to_glib_full(&value::read_napi::<String>(value)?)?.cast::<c_void>())
            }
            Self::Integer(integer) => Self::pointer_word(*integer, value),
            Self::EnumFlags(enum_flags) => {
                enum_flags.validate(value)?;

                Self::pointer_word(enum_flags.storage, value)
            }
            Self::Boolean => match value.get_type()? {
                ValueType::Boolean => {
                    Ok(isize::from(value::read_napi::<bool>(value)?) as *mut c_void)
                }
                _ => bail!("Expected boolean in GHashTable"),
            },
            Self::Float(float) => {
                let ValueType::Number = value.get_type()? else {
                    bail!("Expected number in GHashTable for float")
                };

                boxed_entry(&float.checked_to_stash(value::read_napi::<f64>(value)?)?)
            }
            Self::BigInt(bigint) => boxed_entry(&bigint.entry_stash(value)?),
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

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn direct_pointer(codec: IntegerCodec, value: f64) -> *mut c_void {
    match codec {
        IntegerCodec::I8 | IntegerCodec::I16 | IntegerCodec::I32 | IntegerCodec::I64 => {
            value as i64 as isize as *mut c_void
        }
        IntegerCodec::U8 | IntegerCodec::U16 | IntegerCodec::U32 | IntegerCodec::U64 => {
            value as u64 as usize as *mut c_void
        }
    }
}

/// Copies a scalar that does not fit the table's pointer slot onto the heap, which is where the
/// C side reads it back from through a `gfloat *`, `gdouble *`, `gint64 *` or `guint64 *`.
fn boxed_entry(stash: &ffi::Stash) -> anyhow::Result<*mut c_void> {
    match stash {
        ffi::Stash::F32(v) => Ok(memdup(&v.to_ne_bytes())),
        ffi::Stash::F64(v) => Ok(memdup(&v.to_ne_bytes())),
        ffi::Stash::I64(v) => Ok(memdup(&v.to_ne_bytes())),
        ffi::Stash::U64(v) => Ok(memdup(&v.to_ne_bytes())),
        other => bail!("Expected a scalar Stash for a GHashTable element, got {other:?}"),
    }
}

fn memdup(bytes: &[u8]) -> *mut c_void {
    unsafe { glib::ffi::g_memdup2(bytes.as_ptr().cast::<c_void>(), bytes.len()) }
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

    fn fill_hashtable(
        hash_table: *mut glib::ffi::GHashTable,
        tuples: &[Unknown<'_>],
        encoders: (&HashTableEntryCodec, &HashTableEntryCodec),
        retains: (bool, bool),
        key_free: glib::ffi::GDestroyNotify,
        retained_entries: &mut Vec<CVoidPtr>,
    ) -> anyhow::Result<()> {
        let (key_encoder, value_encoder) = encoders;
        let (retains_keys, retains_values) = retains;

        for &tuple in tuples {
            let (key, value) = Self::tuple(tuple)?;
            let key_ptr = key_encoder.encode(key)?;
            let value_ptr = value_encoder.encode(value).inspect_err(|_| {
                release_transferred(key_free, key_ptr);
            })?;

            if retains_keys {
                retained_entries.push(key_ptr);
            }
            if retains_values {
                retained_entries.push(value_ptr);
            }

            unsafe {
                glib::ffi::g_hash_table_insert(hash_table, key_ptr, value_ptr);
            }
        }

        Ok(())
    }

    fn encode_hashtable(
        &self,
        tuples: &[Unknown<'_>],
        key_encoder: &HashTableEntryCodec,
        value_encoder: &HashTableEntryCodec,
    ) -> anyhow::Result<ffi::Stash> {
        let key_free = key_encoder.free_func()?;
        let value_free = value_encoder.free_func()?;
        let retains_keys = self.retains_entries(key_encoder, &self.key_codec);
        let retains_values = self.retains_entries(value_encoder, &self.value_codec);
        let (hash_func, equal_func) = key_encoder.hash_and_equal()?;
        let hash_table = unsafe {
            glib::ffi::g_hash_table_new_full(
                hash_func,
                equal_func,
                if retains_keys { None } else { key_free },
                if retains_values { None } else { value_free },
            )
        };
        let mut retained_entries: Vec<CVoidPtr> = Vec::new();

        let build = Self::fill_hashtable(
            hash_table,
            tuples,
            (key_encoder, value_encoder),
            (retains_keys, retains_values),
            key_free,
            &mut retained_entries,
        );

        if let Err(err) = build {
            for entry in retained_entries {
                release_transferred(Some(glib::ffi::g_free), entry);
            }
            unsafe { glib::ffi::g_hash_table_unref(hash_table) };
            return Err(err);
        }

        let owns_table = self.ownership.is_borrowed();
        let storage = StashStorage::new(
            hash_table.cast::<c_void>(),
            StashData::HashTable(HashTableData {
                owns_table,
                retained_entries,
            }),
        );

        Ok(if owns_table {
            ffi::Stash::Storage(storage)
        } else {
            ffi::Stash::Storage(storage.with_pending_transfer(
                hash_table.cast::<c_void>(),
                ffi::ReleaseKind::HashTableUnref,
            ))
        })
    }

    /// Whether the entries this side allocates stay this side's to free: a callee that takes the
    /// table without taking its contents steals them out of it, leaving nothing else to release
    /// them. Only the entry kinds that allocate at all can be retained; a key packed into the
    /// pointer itself owns no memory.
    fn retains_entries(&self, encoder: &HashTableEntryCodec, codec: &Codec) -> bool {
        self.ownership.is_full()
            && (matches!(encoder, HashTableEntryCodec::String) || encoder.is_boxed())
            && !entry_ownership_is_full(codec)
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

impl HashTableCodec {
    fn decode_table<'e>(
        &self,
        env: &'e Env,
        stash: &ffi::Stash,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        let Some(hash_ptr) = stash.as_non_null_ptr("GHashTable")? else {
            return Ok(value::js_null(env)?);
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
                        .read(env, ReadCtx::value(key_ptr, "hash table key"))?;
                    let val_value = self
                        .value_codec
                        .read(env, ReadCtx::value(value_ptr, "hash table value"))?;
                    pairs.push(value::js_array(env, vec![key_value, val_value])?);
                }
            }
            Ok(pairs)
        })();

        if transfer.is_full() {
            unsafe { glib::ffi::g_hash_table_unref(hash_ptr.cast::<glib::ffi::GHashTable>()) };
        }

        Ok(value::js_array(env, pairs?)?)
    }
}

impl Decoder for HashTableCodec {
    fn decode_call<'e>(&self, env: &'e Env, stash: &ffi::Stash) -> anyhow::Result<Unknown<'e>> {
        self.decode_table(env, stash, self.ownership)
    }

    unsafe fn read_value<'e>(
        &self,
        env: &'e Env,
        ptr: *mut c_void,
        _context: &str,
        transfer: Ownership,
    ) -> anyhow::Result<Unknown<'e>> {
        self.decode_table(env, &ffi::Stash::Ptr(ptr), transfer)
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

    write_container_value_to_ptr!("hash table", "hashtable pointer write", |_| {
        ffi::ReleaseKind::HashTableUnref
    });
}
