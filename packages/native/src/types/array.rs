use std::ffi::{CString, c_char};

use anyhow::bail;
use gtk4::glib;
use napi::bindgen_prelude::*;
use napi::{Env, JsObject};

use super::prelude::*;
use super::string::str_to_glib_full;
use crate::arg::Arg;
use crate::ffi::{FfiStorage, FfiStorageKind};
use crate::types::{FloatKind, IntegerKind, Type};

#[derive(Debug, Clone, PartialEq, Eq)]
#[non_exhaustive]
pub enum ArrayKind {
    Array,
    GList,
    GSList,
    GPtrArray,
    GArray,
    GByteArray,
    Sized { size_index: usize },
    Fixed { size: usize },
}

impl std::str::FromStr for ArrayKind {
    type Err = String;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s {
            "array" => Ok(Self::Array),
            "glist" => Ok(Self::GList),
            "gslist" => Ok(Self::GSList),
            "gptrarray" => Ok(Self::GPtrArray),
            "garray" => Ok(Self::GArray),
            "gbytearray" => Ok(Self::GByteArray),
            "sized" => Ok(Self::Sized { size_index: 0 }),
            "fixed" => Ok(Self::Fixed { size: 0 }),
            _ => Err(format!(
                "'kind' must be 'array', 'glist', 'gslist', 'gptrarray', 'garray', 'gbytearray', 'sized', or 'fixed'; got '{s}'"
            )),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ArrayType {
    pub item_type: Box<Type>,
    pub kind: ArrayKind,
    pub ownership: Ownership,
    pub element_size: Option<usize>,
}

impl ArrayType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let item_type_value: Unknown<'_> = obj.get_named_property("itemType")?;
        let item_type = Type::from_js_value(env, item_type_value)?;

        let kind_str: String = obj.get_named_property("kind").map_err(|_| {
            napi::Error::new(
                napi::Status::InvalidArg,
                "'kind' property is required for array types",
            )
        })?;

        let kind: ArrayKind = kind_str
            .parse()
            .map_err(|e: String| napi::Error::new(napi::Status::InvalidArg, e))?;

        let kind = match kind {
            ArrayKind::Sized { .. } => {
                let size_index: f64 = super::optional_descriptor_property(obj, "sizeParamIndex")?
                    .ok_or_else(|| {
                    napi::Error::new(
                        napi::Status::InvalidArg,
                        "'sizeParamIndex' is required for sized arrays",
                    )
                })?;
                ArrayKind::Sized {
                    size_index: size_index as usize,
                }
            }
            ArrayKind::Fixed { .. } => {
                let fixed_size: f64 = super::optional_descriptor_property(obj, "fixedSize")?
                    .ok_or_else(|| {
                        napi::Error::new(
                            napi::Status::InvalidArg,
                            "'fixedSize' is required for fixed arrays",
                        )
                    })?;
                ArrayKind::Fixed {
                    size: fixed_size as usize,
                }
            }
            other => other,
        };

        let element_size: Option<usize> =
            super::optional_descriptor_property::<f64>(obj, "elementSize")?.map(|n| n as usize);

        let ownership = Ownership::from_js_value(obj, "array")?;

        Ok(Self {
            item_type: Box::new(item_type),
            kind,
            ownership,
            element_size,
        })
    }
}

impl FfiEncoder for ArrayType {
    fn encode(&self, value: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        Self::encode(self, value, optional)
    }
}

impl FfiDecoder for ArrayType {
    fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        Self::decode(self, ffi_value)
    }

    fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[crate::arg::Arg],
    ) -> anyhow::Result<value::Value> {
        Self::decode_with_context(self, ffi_value, ffi_args, args)
    }
}

impl RawPtrCodec for ArrayType {
    unsafe fn ptr_to_value(
        &self,
        ptr: *mut std::ffi::c_void,
        _context: &str,
    ) -> anyhow::Result<value::Value> {
        // SAFETY: The caller guarantees `ptr` is null or a live array of
        // this descriptor's kind, exactly the inherent method's contract.
        unsafe { Self::ptr_to_value(self, ptr) }
    }
}

/// The native representation of one array element, resolved once from an
/// [`ArrayType`]'s `item_type`.
///
/// [`ItemCodec::resolve`] is the single classifier that maps a [`Type`] to its
/// array representation, or rejects it as unsupported. Sizing, encoding, and
/// decoding then each match this closed set exhaustively, so the compiler flags
/// any element kind a new operation forgets to handle.
#[derive(Debug, Clone, Copy)]
enum ItemCodec {
    /// `Type::Integer`: a fixed-width integer encoded with range checking.
    Integer(IntegerKind),
    /// `Type::Tagged`: an integer-storage element encoded without range
    /// checking, since the tag already constrains its value range.
    Tagged(IntegerKind),
    /// `Type::Float`.
    Float(FloatKind),
    /// `Type::Boolean`, stored as a C `int`.
    Boolean,
    /// A pointer-sized handle element: `GObject`/`Boxed`/`Struct`/`Fundamental`.
    Pointer,
    /// A null-terminated C string element.
    String,
}

impl ItemCodec {
    /// Resolves the array representation of `item_type`, or `None` when the
    /// type cannot appear as an array element.
    fn resolve(item_type: &Type) -> Option<Self> {
        Some(match item_type {
            Type::Integer(kind) => Self::Integer(*kind),
            Type::Tagged(tagged) => Self::Tagged(tagged.storage),
            Type::Float(kind) => Self::Float(*kind),
            Type::Boolean(_) => Self::Boolean,
            Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
                Self::Pointer
            }
            Type::String(_) => Self::String,
            Type::Void(_)
            | Type::Array(_)
            | Type::HashTable(_)
            | Type::Trampoline(_)
            | Type::Ref(_)
            | Type::Unichar(_) => return None,
        })
    }

    /// The size in bytes of one element in a contiguous buffer.
    fn element_size(self) -> usize {
        match self {
            Self::Integer(kind) | Self::Tagged(kind) => kind.byte_size(),
            Self::Float(FloatKind::F32) => size_of::<f32>(),
            Self::Float(FloatKind::F64) => size_of::<f64>(),
            Self::Boolean => size_of::<i32>(),
            Self::Pointer | Self::String => size_of::<*mut c_void>(),
        }
    }
}

/// Builds an owned [`glib::StrV`] from JS string values, validating each
/// element for interior NUL bytes. The resulting array owns one GLib-allocated
/// duplicate per element and is guaranteed NULL-terminated.
fn build_strv(array: &[value::Value]) -> anyhow::Result<glib::StrV> {
    let mut strv = glib::StrV::with_capacity(array.len());
    for v in array {
        let value::Value::String(s) = v else {
            bail!("Expected a String, got {v:?}");
        };
        let gstring = glib::GString::from_string_checked(s.clone())
            .map_err(|_| anyhow::anyhow!("String contains an interior NUL byte"))?;
        strv.push(gstring);
    }
    Ok(strv)
}

/// Duplicates each JS string into a GLib-allocated C string, returning the
/// pointers the callee will adopt. One allocation per element. A mid-iteration
/// failure releases the duplicates already made so none are stranded.
fn dup_strings_to_glib(array: &[value::Value]) -> anyhow::Result<Vec<*mut c_void>> {
    let mut ptrs: Vec<*mut c_void> = Vec::with_capacity(array.len());
    for v in array {
        let duplicated = match v {
            value::Value::String(s) => str_to_glib_full(s),
            _ => Err(anyhow::anyhow!("Expected a String, got {v:?}")),
        };
        match duplicated {
            Ok(ptr) => ptrs.push(ptr as *mut c_void),
            Err(err) => {
                for ptr in ptrs {
                    // SAFETY: Each pointer is a duplicate this function
                    // just allocated and still owns.
                    unsafe { glib::ffi::g_free(ptr) };
                }
                return Err(err);
            }
        }
    }
    Ok(ptrs)
}

/// Copies a NULL-terminated pointer slice into a `g_malloc`-owned container a
/// transfer-full callee can release with `g_free`/`g_strfreev`. The returned
/// container is deliberately untracked: ownership rests with the callee.
fn leak_container_to_callee(ptrs: &[*mut c_void]) -> *mut c_void {
    // SAFETY: g_malloc aborts on failure, so the container holds exactly
    // `bytes` writable bytes for the copy from the live source slice.
    unsafe {
        let bytes = std::mem::size_of_val(ptrs);
        let container = glib::ffi::g_malloc(bytes);
        std::ptr::copy_nonoverlapping(ptrs.as_ptr().cast::<u8>(), container.cast::<u8>(), bytes);
        container
    }
}

/// Encodes JS array elements into the layout of a specific [`ArrayKind`].
///
/// Only string and GObject-like elements vary by kind; scalar elements share
/// one contiguous representation and are encoded by `ArrayType`'s
/// `encode_*_array` associated functions instead.
trait ArrayKindEncoder {
    fn encode_strings(
        &self,
        array: &[value::Value],
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue>;

    fn encode_handles(
        &self,
        handles: &[crate::managed::NativeHandle],
        item_type: &Type,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue>;
}

struct NullTerminatedArrayEncoder;

impl ArrayKindEncoder for NullTerminatedArrayEncoder {
    /// Encodes a NULL-terminated string array honoring both transfer modes.
    ///
    /// The four arms are keyed on (container ownership, element ownership):
    /// a fully borrowed array stays caller-owned through an [`glib::StrV`];
    /// a fully transferred array is leaked to the callee via
    /// [`glib::StrV::into_raw`] (the `g_strfreev` contract); transfer-container
    /// hands over a `g_malloc`-owned pointer block while the strings stay
    /// caller-owned for the call; and element-only transfer hands over
    /// GLib-allocated duplicates inside a caller-owned block.
    fn encode_strings(
        &self,
        array: &[value::Value],
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        match (ownership, dup_elements) {
            (Ownership::Borrowed, false) => {
                let strv = build_strv(array)?;
                let ptr = strv.as_ptr() as *mut c_void;
                Ok(ffi::FfiValue::Storage(FfiStorage::new(
                    ptr,
                    FfiStorageKind::StrV(strv),
                )))
            }
            (Ownership::Full, true) => {
                let strv = build_strv(array)?;
                let container = strv.into_raw() as *mut c_void;
                Ok(ffi::FfiValue::Storage(
                    FfiStorage::unit(container)
                        .with_pending_transfer(container, ffi::PendingRelease::StrFreeV),
                ))
            }
            (Ownership::Full, false) => {
                let cstrings = ArrayType::extract_strings(array)?;
                let mut ptrs: Vec<*mut c_void> =
                    cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
                ptrs.push(std::ptr::null_mut());
                let container = leak_container_to_callee(&ptrs);
                Ok(ffi::FfiValue::Storage(
                    FfiStorage::new(container, FfiStorageKind::StringArray(cstrings, Vec::new()))
                        .with_pending_transfer(container, ffi::PendingRelease::GFree),
                ))
            }
            (Ownership::Borrowed, true) => {
                let mut ptrs = dup_strings_to_glib(array)?;
                ptrs.push(std::ptr::null_mut());
                let ptr = ptrs.as_mut_ptr() as *mut c_void;
                Ok(ffi::FfiValue::Storage(
                    FfiStorage::new(ptr, FfiStorageKind::StringArray(Vec::new(), ptrs))
                        .with_pending_transfer(ptr, ffi::PendingRelease::StringElements),
                ))
            }
        }
    }

    fn encode_handles(
        &self,
        handles: &[crate::managed::NativeHandle],
        item_type: &Type,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let (mut ptrs, acquired) = transfer_elements(handles, item_type, "array")?;
        ptrs.push(std::ptr::null_mut());

        if ownership.is_full() {
            let container = leak_container_to_callee(&ptrs);
            let release = group_with_container(acquired, container, ffi::PendingRelease::GFree);
            return Ok(ffi::FfiValue::Storage(
                FfiStorage::new(
                    container,
                    FfiStorageKind::ObjectArray(handles.to_vec(), Vec::new()),
                )
                .with_pending_transfer(container, release),
            ));
        }

        let ptr = ptrs.as_mut_ptr() as *mut c_void;
        let storage = FfiStorage::new(ptr, FfiStorageKind::ObjectArray(handles.to_vec(), ptrs));
        let storage = if acquired.is_empty() {
            storage
        } else {
            storage.with_pending_transfer(ptr, ffi::PendingRelease::Group(acquired))
        };
        Ok(ffi::FfiValue::Storage(storage))
    }
}

/// Stages string elements for a `GList`/`GSList` build: GLib-allocated
/// duplicates when the callee adopts the elements, or caller-owned `CString`s
/// (kept alive in the storage) when it borrows them.
fn string_list_parts(
    array: &[value::Value],
    dup_elements: bool,
) -> anyhow::Result<(Vec<CString>, Vec<*mut c_void>)> {
    if dup_elements {
        Ok((Vec::new(), dup_strings_to_glib(array)?))
    } else {
        let cstrings = ArrayType::extract_strings(array)?;
        let ptrs = cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
        Ok((cstrings, ptrs))
    }
}

/// Releases every per-element acquisition a failed container build made.
fn release_acquired(acquired: Vec<ffi::PendingTransfer>) {
    for entry in acquired {
        entry.release_now();
    }
}

/// Groups per-element releases with the container's own release into the one
/// pending transfer a transfer-full container argument arms.
fn group_with_container(
    mut acquired: Vec<ffi::PendingTransfer>,
    container: *mut c_void,
    container_release: ffi::PendingRelease,
) -> ffi::PendingRelease {
    if acquired.is_empty() {
        return container_release;
    }
    acquired.push(ffi::PendingTransfer::new(container, container_release));
    ffi::PendingRelease::Group(acquired)
}

/// Acquires per-element ownership for a handle-container build, pairing each
/// acquisition with its release so a mid-build failure unwinds and a success
/// can arm the lot. Returns the staged element pointers alongside the
/// acquisitions.
fn transfer_elements(
    handles: &[crate::managed::NativeHandle],
    item_type: &Type,
    container_label: &str,
) -> anyhow::Result<(Vec<*mut c_void>, Vec<ffi::PendingTransfer>)> {
    let mut ptrs = Vec::with_capacity(handles.len() + 1);
    let mut acquired: Vec<ffi::PendingTransfer> = Vec::new();
    for handle in handles {
        let ptr = handle.ptr();
        if ptr.is_null() {
            release_acquired(acquired);
            bail!("GObject in {container_label} has a null pointer");
        }
        // SAFETY: `ptr` came from a NativeHandle wrapping a live instance
        // of the item type.
        let element = match unsafe { item_type.ref_for_transfer(ptr) } {
            Ok(element) => element,
            Err(e) => {
                release_acquired(acquired);
                return Err(e);
            }
        };
        if let Some(release) = item_type.transfer_release() {
            acquired.push(ffi::PendingTransfer::new(element, release));
        }
        ptrs.push(element);
    }
    Ok((ptrs, acquired))
}

struct GListEncoder;

impl ArrayKindEncoder for GListEncoder {
    fn encode_strings(
        &self,
        array: &[value::Value],
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let should_free = ownership.is_borrowed();
        let (strings, ptrs) = string_list_parts(array, dup_elements)?;
        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
        for ptr in ptrs.iter().rev() {
            // SAFETY: Prepending to a (possibly null) GList head only
            // requires a valid element pointer, staged just above.
            list = unsafe { glib::ffi::g_list_prepend(list, *ptr) };
        }
        let storage = FfiStorage::new(
            list as *mut c_void,
            FfiStorageKind::StringGList(ffi::StringGListData {
                strings,
                list_ptr: list,
                should_free,
                elements_duped: dup_elements,
            }),
        );
        let storage = if should_free {
            storage
        } else {
            let acquired: Vec<ffi::PendingTransfer> = if dup_elements {
                ptrs.iter()
                    .map(|p| ffi::PendingTransfer::new(*p, ffi::PendingRelease::GFree))
                    .collect()
            } else {
                Vec::new()
            };
            let release =
                group_with_container(acquired, list.cast(), ffi::PendingRelease::ListSpineFree);
            storage.with_pending_transfer(list as *mut c_void, release)
        };
        Ok(ffi::FfiValue::Storage(storage))
    }

    fn encode_handles(
        &self,
        handles: &[crate::managed::NativeHandle],
        item_type: &Type,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let should_free = ownership.is_borrowed();
        let (ptrs, acquired) = transfer_elements(handles, item_type, "GList")?;
        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
        for ptr in ptrs.iter().rev() {
            // SAFETY: Prepending to a (possibly null) GList head only
            // requires a valid element pointer, staged just above.
            list = unsafe { glib::ffi::g_list_prepend(list, *ptr) };
        }
        let storage = FfiStorage::new(
            list as *mut c_void,
            FfiStorageKind::GList(ffi::GListData {
                handles: handles.to_vec(),
                list_ptr: list,
                should_free,
            }),
        );
        let storage = if should_free {
            if acquired.is_empty() {
                storage
            } else {
                storage.with_pending_transfer(
                    list as *mut c_void,
                    ffi::PendingRelease::Group(acquired),
                )
            }
        } else {
            let release =
                group_with_container(acquired, list.cast(), ffi::PendingRelease::ListSpineFree);
            storage.with_pending_transfer(list as *mut c_void, release)
        };
        Ok(ffi::FfiValue::Storage(storage))
    }
}

struct GSListEncoder;

impl ArrayKindEncoder for GSListEncoder {
    fn encode_strings(
        &self,
        array: &[value::Value],
        dup_elements: bool,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let should_free = ownership.is_borrowed();
        let (strings, ptrs) = string_list_parts(array, dup_elements)?;
        let mut list: *mut glib::ffi::GSList = std::ptr::null_mut();
        for ptr in ptrs.iter().rev() {
            // SAFETY: Prepending to a (possibly null) GSList head only
            // requires a valid element pointer, staged just above.
            list = unsafe { glib::ffi::g_slist_prepend(list, *ptr) };
        }
        let storage = FfiStorage::new(
            list as *mut c_void,
            FfiStorageKind::StringGSList(ffi::StringGSListData {
                strings,
                list_ptr: list,
                should_free,
                elements_duped: dup_elements,
            }),
        );
        let storage = if should_free {
            storage
        } else {
            let acquired: Vec<ffi::PendingTransfer> = if dup_elements {
                ptrs.iter()
                    .map(|p| ffi::PendingTransfer::new(*p, ffi::PendingRelease::GFree))
                    .collect()
            } else {
                Vec::new()
            };
            let release =
                group_with_container(acquired, list.cast(), ffi::PendingRelease::SListSpineFree);
            storage.with_pending_transfer(list as *mut c_void, release)
        };
        Ok(ffi::FfiValue::Storage(storage))
    }

    fn encode_handles(
        &self,
        handles: &[crate::managed::NativeHandle],
        item_type: &Type,
        ownership: Ownership,
    ) -> anyhow::Result<ffi::FfiValue> {
        let should_free = ownership.is_borrowed();
        let (ptrs, acquired) = transfer_elements(handles, item_type, "GSList")?;
        let mut list: *mut glib::ffi::GSList = std::ptr::null_mut();
        for ptr in ptrs.iter().rev() {
            // SAFETY: Prepending to a (possibly null) GSList head only
            // requires a valid element pointer, staged just above.
            list = unsafe { glib::ffi::g_slist_prepend(list, *ptr) };
        }
        let storage = FfiStorage::new(
            list as *mut c_void,
            FfiStorageKind::GSList(ffi::GSListData {
                handles: handles.to_vec(),
                list_ptr: list,
                should_free,
            }),
        );
        let storage = if should_free {
            if acquired.is_empty() {
                storage
            } else {
                storage.with_pending_transfer(
                    list as *mut c_void,
                    ffi::PendingRelease::Group(acquired),
                )
            }
        } else {
            let release =
                group_with_container(acquired, list.cast(), ffi::PendingRelease::SListSpineFree);
            storage.with_pending_transfer(list as *mut c_void, release)
        };
        Ok(ffi::FfiValue::Storage(storage))
    }
}

impl ArrayType {
    fn checked_f32_vec(values: &[f64]) -> anyhow::Result<Vec<f32>> {
        values
            .iter()
            .enumerate()
            .map(|(i, &v)| {
                if v.is_finite() && (v > f32::MAX as f64 || v < -(f32::MAX as f64)) {
                    bail!("Array element {i}: value {v} is out of range for f32");
                }
                Ok(v as f32)
            })
            .collect()
    }

    fn encode_integer_array(
        values: &[f64],
        int_type: IntegerKind,
    ) -> anyhow::Result<ffi::FfiValue> {
        Ok(ffi::FfiValue::Storage(
            int_type.checked_to_ffi_storage(values)?,
        ))
    }

    fn encode_float_array(values: &[f64], float_kind: FloatKind) -> anyhow::Result<ffi::FfiValue> {
        match float_kind {
            FloatKind::F32 => Ok(ffi::FfiValue::Storage(
                Self::checked_f32_vec(values)?.into(),
            )),
            FloatKind::F64 => Ok(ffi::FfiValue::Storage(values.to_vec().into())),
        }
    }

    fn encode_boolean_array(values: &[i32]) -> ffi::FfiValue {
        ffi::FfiValue::Storage(values.to_vec().into())
    }

    fn extract_numbers(array: &[value::Value]) -> anyhow::Result<Vec<f64>> {
        array
            .iter()
            .map(|v| match v {
                value::Value::Number(n) => Ok(*n),
                _ => bail!("Expected a Number, got {v:?}"),
            })
            .collect()
    }

    fn extract_booleans(array: &[value::Value]) -> anyhow::Result<Vec<i32>> {
        array
            .iter()
            .map(|v| match v {
                value::Value::Boolean(b) => Ok(i32::from(*b)),
                _ => bail!("Expected a Boolean, got {v:?}"),
            })
            .collect()
    }

    fn extract_strings(array: &[value::Value]) -> anyhow::Result<Vec<CString>> {
        array
            .iter()
            .map(|v| match v {
                value::Value::String(s) => Ok(CString::new(s.as_bytes())?),
                _ => bail!("Expected a String, got {v:?}"),
            })
            .collect()
    }

    fn extract_handles(
        array: &[value::Value],
    ) -> anyhow::Result<Vec<crate::managed::NativeHandle>> {
        array
            .iter()
            .map(|v| match v {
                value::Value::Object(handle) => Ok(handle.clone()),
                _ => bail!("Expected an Object, got {v:?}"),
            })
            .collect()
    }

    fn item_element_size(&self) -> Option<usize> {
        ItemCodec::resolve(&self.item_type).map(ItemCodec::element_size)
    }

    /// Resolves the [`ItemCodec`] for this array's element type, failing with a
    /// `context`-specific message when the type cannot appear as an element.
    fn item_codec(&self, context: &str) -> anyhow::Result<ItemCodec> {
        ItemCodec::resolve(&self.item_type)
            .ok_or_else(|| anyhow::anyhow!("Unsupported {context} item type: {:?}", self.item_type))
    }

    /// Decodes `len` elements laid out contiguously starting at `data`.
    ///
    /// Used for both `GArray` payloads and length-prefixed (`sized`/`fixed`)
    /// arrays, which share an identical contiguous layout.
    fn decode_contiguous(
        &self,
        codec: ItemCodec,
        data: *const u8,
        len: usize,
    ) -> anyhow::Result<Vec<value::Value>> {
        if len == 0 || data.is_null() {
            return Ok(Vec::new());
        }
        let values = match codec {
            ItemCodec::Integer(kind) | ItemCodec::Tagged(kind) => {
                // SAFETY: The caller guarantees `data` addresses `len`
                // contiguous elements of the resolved item codec.
                unsafe { kind.read_slice(data, len) }
                    .into_iter()
                    .map(value::Value::Number)
                    .collect()
            }
            ItemCodec::Float(FloatKind::F32) => {
                // SAFETY: The caller guarantees `data` addresses `len`
                // contiguous elements of the resolved item codec.
                unsafe { std::slice::from_raw_parts(data.cast::<f32>(), len) }
                    .iter()
                    .map(|&v| value::Value::Number(f64::from(v)))
                    .collect()
            }
            ItemCodec::Float(FloatKind::F64) => {
                // SAFETY: The caller guarantees `data` addresses `len`
                // contiguous elements of the resolved item codec.
                unsafe { std::slice::from_raw_parts(data.cast::<f64>(), len) }
                    .iter()
                    .copied()
                    .map(value::Value::Number)
                    .collect()
            }
            // SAFETY: The caller guarantees `data` addresses `len`
            // contiguous elements of the resolved item codec.
            ItemCodec::Boolean => unsafe { std::slice::from_raw_parts(data.cast::<i32>(), len) }
                .iter()
                .map(|&v| value::Value::Boolean(v != 0))
                .collect(),
            ItemCodec::Pointer | ItemCodec::String => {
                // SAFETY: The caller guarantees `data` addresses `len`
                // contiguous elements of the resolved item codec.
                let ptrs = unsafe { std::slice::from_raw_parts(data.cast::<*mut c_void>(), len) };
                return ptrs
                    .iter()
                    .map(|&item_ptr| self.item_type.decode(&ffi::FfiValue::Ptr(item_ptr)))
                    .collect();
            }
        };
        Ok(values)
    }

    pub fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        let array = match val {
            value::Value::Array(arr) => arr,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(ffi::FfiValue::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected an Array for array type, got {val:?}"),
        };

        if self.kind == ArrayKind::GByteArray {
            return self.encode_gbytearray(array);
        }

        if self.kind == ArrayKind::GArray {
            return self.encode_garray(array);
        }

        let encoder: &dyn ArrayKindEncoder = match &self.kind {
            ArrayKind::GList => &GListEncoder,
            ArrayKind::GSList => &GSListEncoder,
            _ => &NullTerminatedArrayEncoder,
        };

        match self.item_codec("array")? {
            ItemCodec::Integer(kind) => {
                Self::encode_integer_array(&Self::extract_numbers(array)?, kind)
            }
            ItemCodec::Tagged(kind) => Ok(ffi::FfiValue::Storage(
                kind.to_ffi_storage(&Self::extract_numbers(array)?),
            )),
            ItemCodec::Float(kind) => {
                Self::encode_float_array(&Self::extract_numbers(array)?, kind)
            }
            ItemCodec::Boolean => Ok(Self::encode_boolean_array(&Self::extract_booleans(array)?)),
            ItemCodec::String => {
                let dup_elements =
                    matches!(&*self.item_type, Type::String(s) if s.ownership.is_full());
                encoder.encode_strings(array, dup_elements, self.ownership)
            }
            ItemCodec::Pointer => {
                let handles = Self::extract_handles(array)?;

                if let Some(element_size) = self.element_size {
                    let mut buffer = vec![0u8; handles.len() * element_size];
                    for (i, handle) in handles.iter().enumerate() {
                        let ptr = handle.ptr();
                        if ptr.is_null() {
                            bail!("GObject in array has a null pointer");
                        }
                        let offset = i * element_size;
                        // SAFETY: The handle wraps a live struct of
                        // `element_size` bytes, and `buffer` was sized for
                        // one such element per handle.
                        unsafe {
                            std::ptr::copy_nonoverlapping(
                                ptr as *const u8,
                                buffer.as_mut_ptr().add(offset),
                                element_size,
                            );
                        }
                    }
                    return Ok(ffi::FfiValue::Storage(buffer.into()));
                }

                encoder.encode_handles(&handles, &self.item_type, self.ownership)
            }
        }
    }

    fn encode_gbytearray(&self, array: &[value::Value]) -> anyhow::Result<ffi::FfiValue> {
        let bytes: Vec<u8> = array
            .iter()
            .enumerate()
            .map(|(i, v)| match v {
                value::Value::Number(n) => {
                    if !n.is_finite() || n.fract() != 0.0 || *n < 0.0 || *n > 255.0 {
                        bail!("GByteArray element {i}: value {n} is out of range for u8 [0, 255]");
                    }
                    Ok(*n as u8)
                }
                _ => bail!("Expected a Number for GByteArray element, got {v:?}"),
            })
            .collect::<anyhow::Result<Vec<u8>>>()?;

        // SAFETY: The fresh GByteArray is live, and `bytes` is a live
        // local buffer of the appended length.
        let byte_array = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(bytes.len() as u32);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), bytes.len() as u32);
            ba
        };

        let owned: Option<glib::ByteArray> = self
            .ownership
            .is_borrowed()
            // SAFETY: `byte_array` was created above with one reference,
            // which this wrapper adopts as its own.
            .then(|| unsafe { glib::translate::from_glib_full(byte_array) });

        let storage = FfiStorage::new(byte_array as *mut c_void, FfiStorageKind::GByteArray(owned));
        let storage = if self.ownership.is_full() {
            storage.with_pending_transfer(
                byte_array as *mut c_void,
                ffi::PendingRelease::GByteArrayUnref,
            )
        } else {
            storage
        };
        Ok(ffi::FfiValue::Storage(storage))
    }

    fn append_integer_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        int_type: super::IntegerKind,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        let mut buf = [0u8; size_of::<i64>()];
        for n in Self::extract_numbers(array)? {
            // SAFETY: `buf` is an 8-byte local, wide enough for every
            // integer kind's write.
            unsafe { int_type.write_ptr(buf.as_mut_ptr(), n) };
            // SAFETY: `g_array` is the live GArray this encode allocated,
            // and `buf` holds one element of its declared width.
            unsafe {
                glib::ffi::g_array_append_vals(g_array, buf.as_ptr() as *const c_void, 1);
            }
        }
        Ok(())
    }

    fn append_float_values_to_garray(
        g_array: *mut glib::ffi::GArray,
        float_kind: super::FloatKind,
        array: &[value::Value],
    ) -> anyhow::Result<()> {
        for n in Self::extract_numbers(array)? {
            match float_kind {
                super::FloatKind::F32 => {
                    let v = n as f32;
                    // SAFETY: `g_array` is the live GArray the caller
                    // created, and `v` is one element of its declared
                    // width.
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &v as *const f32 as *const c_void,
                            1,
                        );
                    }
                }
                // SAFETY: `g_array` is the live GArray the caller created,
                // and `n` is one element of its declared width.
                super::FloatKind::F64 => unsafe {
                    glib::ffi::g_array_append_vals(g_array, &n as *const f64 as *const c_void, 1);
                },
            }
        }
        Ok(())
    }

    fn append_handle_values_to_garray(
        &self,
        g_array: *mut glib::ffi::GArray,
        array: &[value::Value],
    ) -> anyhow::Result<Vec<ffi::PendingTransfer>> {
        let handles = Self::extract_handles(array)?;
        let (ptrs, acquired) = transfer_elements(&handles, &self.item_type, "GArray")?;
        for ptr in ptrs {
            // SAFETY: `g_array` is the live GArray this encode allocated,
            // and the appended value is one pointer-sized element.
            unsafe {
                glib::ffi::g_array_append_vals(
                    g_array,
                    &ptr as *const *mut c_void as *const c_void,
                    1,
                );
            }
        }
        Ok(acquired)
    }

    fn append_items_to_garray(
        &self,
        g_array: *mut glib::ffi::GArray,
        array: &[value::Value],
    ) -> anyhow::Result<Vec<ffi::PendingTransfer>> {
        match self.item_codec("GArray")? {
            ItemCodec::Integer(kind) | ItemCodec::Tagged(kind) => {
                Self::append_integer_values_to_garray(g_array, kind, array).map(|()| Vec::new())
            }
            ItemCodec::Float(kind) => {
                Self::append_float_values_to_garray(g_array, kind, array).map(|()| Vec::new())
            }
            ItemCodec::Boolean => {
                for b in Self::extract_booleans(array)? {
                    // SAFETY: `g_array` is the live GArray the caller
                    // created, and `b` is one element of its declared
                    // width.
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &b as *const i32 as *const c_void,
                            1,
                        );
                    }
                }
                Ok(Vec::new())
            }
            ItemCodec::Pointer => self.append_handle_values_to_garray(g_array, array),
            ItemCodec::String => {
                let callee_adopts_strings =
                    matches!(&*self.item_type, Type::String(s) if s.ownership.is_full());
                if !callee_adopts_strings {
                    // SAFETY: `g_array` is the live GArray the caller
                    // created.
                    unsafe {
                        glib::ffi::g_array_set_clear_func(g_array, Some(glib::ffi::g_free));
                    }
                }
                let mut acquired = Vec::new();
                for dup in dup_strings_to_glib(array)? {
                    if callee_adopts_strings {
                        acquired.push(ffi::PendingTransfer::new(dup, ffi::PendingRelease::GFree));
                    }
                    // SAFETY: `g_array` is the live GArray the caller
                    // created, and `dup` is one pointer-sized element.
                    unsafe {
                        glib::ffi::g_array_append_vals(
                            g_array,
                            &dup as *const *mut c_void as *const c_void,
                            1,
                        );
                    }
                }
                Ok(acquired)
            }
        }
    }

    fn encode_garray(&self, array: &[value::Value]) -> anyhow::Result<ffi::FfiValue> {
        let item_size = self.item_element_size();
        let element_size = self.element_size.or(item_size).ok_or_else(|| {
            anyhow::anyhow!(
                "Cannot determine element size for GArray with item type {:?}",
                self.item_type
            )
        })?;

        if let Some(item_size) = item_size
            && element_size != item_size
        {
            bail!(
                "GArray element size override {element_size} does not match the {item_size}-byte layout of item type {:?}",
                self.item_type
            );
        }

        // SAFETY: Creating a GArray from size parameters has no pointer
        // preconditions.
        let g_array =
            unsafe { glib::ffi::g_array_sized_new(0, 0, element_size as u32, array.len() as u32) };

        let acquired = match self.append_items_to_garray(g_array, array) {
            Ok(acquired) => acquired,
            Err(err) => {
                // SAFETY: `g_array` holds the one reference created above;
                // releasing it also frees appended elements (the failed
                // append already unwound its own acquisitions).
                unsafe { glib::ffi::g_array_unref(g_array) };
                return Err(err);
            }
        };

        let should_free = self.ownership.is_borrowed();
        let storage = FfiStorage::new(
            g_array as *mut c_void,
            FfiStorageKind::GArray(ffi::GArrayData {
                array_ptr: g_array,
                should_free,
            }),
        );
        let storage = if should_free {
            if acquired.is_empty() {
                storage
            } else {
                storage.with_pending_transfer(
                    g_array as *mut c_void,
                    ffi::PendingRelease::Group(acquired),
                )
            }
        } else {
            let release =
                group_with_container(acquired, g_array.cast(), ffi::PendingRelease::GArrayUnref);
            storage.with_pending_transfer(g_array as *mut c_void, release)
        };
        Ok(ffi::FfiValue::Storage(storage))
    }

    pub fn decode(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        match &self.kind {
            ArrayKind::GList | ArrayKind::GSList => return self.decode_glist(ffi_value),
            ArrayKind::GArray => return self.decode_garray(ffi_value),
            ArrayKind::GPtrArray => return self.decode_gptrarray(ffi_value),
            ArrayKind::GByteArray => return self.decode_gbytearray(ffi_value),
            ArrayKind::Array | ArrayKind::Sized { .. } | ArrayKind::Fixed { .. } => {}
        }

        if let ffi::FfiValue::Ptr(ptr) = ffi_value {
            if ptr.is_null() {
                return Ok(value::Value::Array(vec![]));
            }

            return match self.item_codec("array")? {
                ItemCodec::String => Ok(self.decode_null_terminated_string_array(*ptr)),
                ItemCodec::Pointer => self.decode_null_terminated_ptr_array(*ptr),
                codec @ (ItemCodec::Integer(_)
                | ItemCodec::Tagged(_)
                | ItemCodec::Float(_)
                | ItemCodec::Boolean) => self.decode_zero_terminated_scalar_array(codec, *ptr),
            };
        }

        let ffi::FfiValue::Storage(storage) = ffi_value else {
            bail!("Expected a Storage ffi::FfiValue for Array, got {ffi_value:?}")
        };

        self.decode_storage(storage)
    }

    pub fn decode_with_context(
        &self,
        ffi_value: &ffi::FfiValue,
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
    ) -> anyhow::Result<value::Value> {
        match &self.kind {
            ArrayKind::Sized { size_index } => {
                let length = Self::size_from_args(ffi_args, args, *size_index)?;

                if let ffi::FfiValue::Ptr(ptr) = ffi_value {
                    if ptr.is_null() {
                        return Ok(value::Value::Array(vec![]));
                    }

                    return self.decode_sized_array(*ptr, length);
                }
            }
            ArrayKind::Fixed { size } => {
                if let ffi::FfiValue::Ptr(ptr) = ffi_value {
                    if ptr.is_null() {
                        return Ok(value::Value::Array(vec![]));
                    }

                    return self.decode_sized_array(*ptr, *size);
                }
            }
            ArrayKind::Array
            | ArrayKind::GList
            | ArrayKind::GSList
            | ArrayKind::GPtrArray
            | ArrayKind::GArray
            | ArrayKind::GByteArray => {}
        }

        self.decode(ffi_value)
    }
}

impl ArrayType {
    pub(crate) fn decode_glist(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(list_ptr) = ffi_value.as_non_null_ptr("GList/GSList")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let values: anyhow::Result<Vec<value::Value>> = (|| {
            let mut values = Vec::new();
            let mut current = list_ptr as *mut glib::ffi::GList;
            while !current.is_null() {
                // SAFETY: `current` is a non-null node of the live list
                // the native call returned.
                let data = unsafe { (*current).data };
                let item_ffi = ffi::FfiValue::Ptr(data);
                values.push(self.item_type.decode(&item_ffi)?);
                // SAFETY: Same non-null live-node guarantee as the `data`
                // read.
                current = unsafe { (*current).next };
            }
            Ok(values)
        })();

        if self.ownership.is_full() {
            if self.kind == ArrayKind::GSList {
                // SAFETY: A transfer-full return hands this decode the one
                // owned list, released here exactly once after copying.
                unsafe { glib::ffi::g_slist_free(list_ptr as *mut glib::ffi::GSList) };
            } else {
                // SAFETY: Same single-owner transfer-full guarantee as the
                // GSList branch.
                unsafe { glib::ffi::g_list_free(list_ptr as *mut glib::ffi::GList) };
            }
        }

        Ok(value::Value::Array(values?))
    }

    pub(crate) fn decode_garray(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(array_ptr) = ffi_value.as_non_null_ptr("GArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let codec = self.item_codec("GArray")?;
        let g_array = array_ptr as *const glib::ffi::GArray;
        // SAFETY: `array_ptr` is the live GArray the native call returned,
        // so its header fields are readable.
        let data = unsafe { (*g_array).data as *const u8 };
        // SAFETY: Same live-GArray guarantee as the `data` read.
        let len = unsafe { (*g_array).len as usize };
        let values = self.decode_contiguous(codec, data, len);

        if self.ownership.is_full() {
            let storage_owns = matches!(ffi_value, ffi::FfiValue::Storage(_));
            if !storage_owns {
                // SAFETY: A transfer-full return hands this decode the one
                // owned reference, released here exactly once after
                // copying.
                unsafe { glib::ffi::g_array_unref(array_ptr as *mut glib::ffi::GArray) };
            }
        }

        Ok(value::Value::Array(values?))
    }

    fn decode_gptrarray(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = ffi_value.as_non_null_ptr("GPtrArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let ptr_array = ptr as *mut glib::ffi::GPtrArray;
        // SAFETY: `ptr` is the live GPtrArray the native call returned, so
        // its header fields are readable.
        let len = unsafe { (*ptr_array).len as usize };
        // SAFETY: Same live-GPtrArray guarantee as the `len` read.
        let pdata = unsafe { (*ptr_array).pdata };
        let values: anyhow::Result<Vec<value::Value>> = (0..len)
            .map(|i| {
                // SAFETY: `i < len`, so the element slot is within the
                // live GPtrArray's data block.
                let item_ptr = unsafe { *pdata.add(i) };
                self.item_type.decode(&ffi::FfiValue::Ptr(item_ptr))
            })
            .collect();

        if self.ownership.is_full() {
            // SAFETY: A transfer-full return hands this decode the one
            // owned reference, released here exactly once after copying.
            unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
        }

        Ok(value::Value::Array(values?))
    }

    fn decode_gbytearray(&self, ffi_value: &ffi::FfiValue) -> anyhow::Result<value::Value> {
        let Some(ptr) = ffi_value.as_non_null_ptr("GByteArray")? else {
            return Ok(value::Value::Array(vec![]));
        };

        let byte_array = ptr as *mut glib::ffi::GByteArray;
        let storage_owns = matches!(ffi_value, ffi::FfiValue::Storage(_));
        let adopted: Option<glib::ByteArray> = (self.ownership.is_full() && !storage_owns)
            // SAFETY: A transfer-full return hands this decode the one
            // owned reference, which the wrapper adopts.
            .then(|| unsafe { glib::translate::from_glib_full(byte_array) });

        // SAFETY: `byte_array` is the live GByteArray the native call
        // returned, so its header fields are readable.
        let data = unsafe { (*byte_array).data };
        // SAFETY: Same live-GByteArray guarantee as the `data` read.
        let len = unsafe { (*byte_array).len as usize };

        let values: Vec<value::Value> = if data.is_null() || len == 0 {
            vec![]
        } else if let Some(owned) = &adopted {
            owned
                .iter()
                .map(|&b| value::Value::Number(f64::from(b)))
                .collect()
        } else {
            // SAFETY: The live GByteArray's header declared `len` readable
            // bytes at `data`.
            unsafe { std::slice::from_raw_parts(data, len) }
                .iter()
                .map(|&b| value::Value::Number(b as f64))
                .collect()
        };

        drop(adopted);
        Ok(value::Value::Array(values))
    }

    fn decode_null_terminated_ptr_array(&self, ptr: *mut c_void) -> anyhow::Result<value::Value> {
        let ptr_array = ptr as *const *mut c_void;
        let values: anyhow::Result<Vec<value::Value>> = (|| {
            let mut values = Vec::new();
            let mut i = 0;
            loop {
                // SAFETY: The native call returned a null-terminated
                // pointer array, and no prior element was null.
                let item_ptr = unsafe { *ptr_array.offset(i) };
                if item_ptr.is_null() {
                    break;
                }
                let item_ffi = ffi::FfiValue::Ptr(item_ptr);
                values.push(self.item_type.decode(&item_ffi)?);
                i += 1;
            }
            Ok(values)
        })();

        if self.ownership.is_full() {
            // SAFETY: A transfer-full return hands this decode the one
            // owned container, released here exactly once after copying.
            unsafe { glib::ffi::g_free(ptr) };
        }

        Ok(value::Value::Array(values?))
    }

    /// Decodes a zero-terminated array of scalar elements, walking the buffer
    /// with the element's own stride. The terminator is an all-zero element of
    /// that width.
    fn decode_zero_terminated_scalar_array(
        &self,
        codec: ItemCodec,
        ptr: *mut c_void,
    ) -> anyhow::Result<value::Value> {
        let stride = codec.element_size();
        let base = ptr as *const u8;
        let mut len = 0usize;
        loop {
            // SAFETY: The native call returned a zero-terminated buffer,
            // and no prior element was the terminator, so this element is
            // within it.
            let element = unsafe { std::slice::from_raw_parts(base.add(len * stride), stride) };
            if element.iter().all(|&byte| byte == 0) {
                break;
            }
            len += 1;
        }

        let values = self.decode_contiguous(codec, base, len);

        if self.ownership.is_full() {
            // SAFETY: A transfer-full return hands this decode the one
            // owned buffer, released here exactly once after copying.
            unsafe { glib::ffi::g_free(ptr) };
        }

        Ok(value::Value::Array(values?))
    }

    fn decode_null_terminated_string_array(&self, ptr: *mut c_void) -> value::Value {
        let items_full = matches!(&*self.item_type, Type::String(string_type) if string_type.ownership.is_full());

        let read_strv = |items: &[glib::GStringPtr]| {
            items
                .iter()
                .map(|item| {
                    value::Value::String(
                        // SAFETY: Every GStringPtr in a StrV is a live
                        // NUL-terminated string.
                        unsafe { glib::GStr::from_ptr_lossy(item.as_ptr()) }.to_string(),
                    )
                })
                .collect::<Vec<_>>()
        };

        let values = if self.ownership.is_full() {
            let strv = if items_full {
                // SAFETY: A fully transferred return hands this decode the
                // owned NULL-terminated array and its strings, which the
                // wrapper adopts.
                unsafe { glib::StrV::from_glib_full(ptr as *mut *mut c_char) }
            } else {
                // SAFETY: A transfer-container return hands this decode
                // the owned NULL-terminated array; the wrapper adopts it
                // and duplicates the borrowed strings.
                unsafe { glib::StrV::from_glib_container(ptr as *mut *const c_char) }
            };
            read_strv(&strv)
        } else {
            // SAFETY: A borrowed return stays callee-owned and live for
            // the duration of this read.
            let borrowed = unsafe { glib::StrVRef::from_glib_borrow(ptr as *const *const c_char) };
            read_strv(borrowed)
        };

        value::Value::Array(values)
    }

    fn decode_storage(&self, storage: &FfiStorage) -> anyhow::Result<value::Value> {
        let values = match self.item_codec("array")? {
            ItemCodec::Integer(kind) | ItemCodec::Tagged(kind) => kind
                .vec_to_f64(storage)?
                .into_iter()
                .map(value::Value::Number)
                .collect(),
            ItemCodec::Float(FloatKind::F32) => storage
                .as_f32_slice()?
                .iter()
                .map(|v| value::Value::Number(f64::from(*v)))
                .collect(),
            ItemCodec::Float(FloatKind::F64) => storage
                .as_f64_slice()?
                .iter()
                .map(|v| value::Value::Number(*v))
                .collect(),
            ItemCodec::Boolean => storage
                .as_bool_slice()?
                .iter()
                .map(|v| value::Value::Boolean(*v != 0))
                .collect(),
            ItemCodec::Pointer => storage
                .as_object_array()?
                .iter()
                .map(|handle| value::Value::Object(handle.clone()))
                .collect(),
            ItemCodec::String => match storage.kind() {
                FfiStorageKind::StrV(strv) => strv
                    .iter()
                    .map(|item| {
                        value::Value::String(
                            // SAFETY: Every GStringPtr in a StrV is a live
                            // NUL-terminated string.
                            unsafe { glib::GStr::from_ptr_lossy(item.as_ptr()) }.to_string(),
                        )
                    })
                    .collect(),
                _ => storage
                    .as_cstring_array()?
                    .iter()
                    .map(|cstr| Ok(value::Value::String(cstr.to_str()?.to_string())))
                    .collect::<anyhow::Result<Vec<value::Value>>>()?,
            },
        };

        Ok(value::Value::Array(values))
    }

    fn decode_sized_array(&self, ptr: *mut c_void, length: usize) -> anyhow::Result<value::Value> {
        let codec = self.item_codec("sized array")?;
        let values = self.decode_contiguous(codec, ptr.cast::<u8>(), length)?;
        Ok(value::Value::Array(values))
    }

    /// Decodes a contiguous array whose length arrives out of band (e.g. a
    /// sized signal parameter whose count is a sibling argument).
    ///
    /// # Safety
    /// `ptr` must be null or point to `length` contiguous elements of the
    /// declared item type.
    pub unsafe fn ptr_to_value_sized(
        &self,
        ptr: *mut c_void,
        length: usize,
    ) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }
        self.decode_sized_array(ptr, length)
    }

    /// # Safety
    /// `ptr` must be null or point to a valid array of the kind described by `self`.
    pub unsafe fn ptr_to_value(&self, ptr: *mut c_void) -> anyhow::Result<value::Value> {
        if ptr.is_null() {
            return Ok(value::Value::Array(vec![]));
        }
        match self.kind {
            ArrayKind::GPtrArray => {
                let ptr_array = ptr as *mut glib::ffi::GPtrArray;
                // SAFETY: The caller guarantees `ptr` is a live GPtrArray,
                // so its header fields are readable.
                let len = unsafe { (*ptr_array).len as usize };
                // SAFETY: Same live-GPtrArray guarantee as the `len` read.
                let pdata = unsafe { (*ptr_array).pdata };
                let mut values = Vec::with_capacity(len);
                for i in 0..len {
                    // SAFETY: `i < len`, so the element slot is within the
                    // live GPtrArray's data block.
                    let item_ptr = unsafe { *pdata.add(i) };
                    // SAFETY: A live GPtrArray's elements are live instances
                    // of the declared item type (or null).
                    let item_value =
                        unsafe { self.item_type.ptr_to_value(item_ptr, "GPtrArray item")? };
                    values.push(item_value);
                }
                Ok(value::Value::Array(values))
            }
            ArrayKind::GByteArray => {
                let ffi_value = ffi::FfiValue::Ptr(ptr);
                self.decode_gbytearray(&ffi_value)
            }
            ArrayKind::GArray => {
                let ffi_value = ffi::FfiValue::Ptr(ptr);
                self.decode_garray(&ffi_value)
            }
            ArrayKind::GList | ArrayKind::GSList => {
                let ffi_value = ffi::FfiValue::Ptr(ptr);
                self.decode_glist(&ffi_value)
            }
            ArrayKind::Array | ArrayKind::Sized { .. } | ArrayKind::Fixed { .. } => {
                let ffi_value = ffi::FfiValue::Ptr(ptr);
                self.decode(&ffi_value)
            }
        }
    }

    fn validated_size(size: f64, param_index: usize) -> anyhow::Result<usize> {
        if size < 0.0 || !size.is_finite() {
            bail!("Array size parameter at index {param_index} has invalid value: {size}");
        }
        Ok(size as usize)
    }

    fn size_from_args(
        ffi_args: &[ffi::FfiValue],
        args: &[Arg],
        size_index: usize,
    ) -> anyhow::Result<usize> {
        if size_index >= ffi_args.len() {
            bail!(
                "Size parameter index {} is out of bounds (args count: {})",
                size_index,
                ffi_args.len()
            );
        }

        let ffi_arg = &ffi_args[size_index];
        let arg = &args[size_index];

        if let Type::Ref(ref_type) = &arg.ty
            && let Type::Integer(int_type) = &*ref_type.inner_type
        {
            match ffi_arg {
                ffi::FfiValue::Storage(storage) => {
                    // SAFETY: The storage is the live, aligned scalar out
                    // slot the size argument's encode allocated.
                    let size = unsafe { int_type.read_ptr(storage.ptr() as *const u8) };
                    return Self::validated_size(size, size_index);
                }
                ffi::FfiValue::Ptr(ptr) if !ptr.is_null() => {
                    // SAFETY: A non-null pointer-valued size argument
                    // addresses the callee-written integer slot.
                    let size = unsafe { int_type.read_ptr(*ptr as *const u8) };
                    return Self::validated_size(size, size_index);
                }
                _ => {}
            }
        }

        if let Type::Integer(_) = &arg.ty
            && let Ok(num) = ffi_arg.to_number()
        {
            return Self::validated_size(num, size_index);
        }

        bail!(
            "Could not extract size from parameter at index {}: expected Ref<Integer> or Integer, got type {:?} with ffi value {:?}",
            size_index,
            arg.ty,
            ffi_arg
        );
    }
}
