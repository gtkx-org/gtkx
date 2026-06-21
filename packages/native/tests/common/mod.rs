#![allow(dead_code)]

use std::ffi::c_void;
use std::sync::{Mutex, MutexGuard, Once, PoisonError};

use gtk4::gdk;
use gtk4::glib::{self, translate::IntoGlib as _};
use gtk4::prelude::StaticType as _;

use native::managed::Boxed;
use native::types::{
    ArrayKind, ArrayType, FfiDecoder, FfiEncoder, FloatKind, IntegerKind, Ownership, RawPtrCodec,
    ReadSource, TaggedKind, TaggedType, Type,
};
use native::value::Value;

static GTK_INIT: Once = Once::new();

static SERIAL: Mutex<()> = Mutex::new(());

pub fn ensure_gtk_init() {
    GTK_INIT.call_once(|| {
        gtk4::init().expect("Failed to initialize GTK4 for tests");
    });
}

pub fn serial_guard() -> MutexGuard<'static, ()> {
    SERIAL.lock().unwrap_or_else(PoisonError::into_inner)
}

pub fn run<F, R>(f: F) -> R
where
    F: FnOnce() -> R,
{
    let _guard = serial_guard();
    ensure_gtk_init();
    f()
}

pub fn make_integer_hash_table(entries: &[(usize, usize)]) -> *mut glib::ffi::GHashTable {
    // SAFETY: this runs under `run`/`serial_guard` on the GTK-initialized test thread.
    // `g_hash_table_new_full` with direct hash/equal and no destroy notifies yields a valid
    // table that stores integer keys/values as borrowed pointers; the without-provenance
    // pointers are never dereferenced, only compared and stored by value.
    unsafe {
        let table = glib::ffi::g_hash_table_new_full(
            Some(glib::ffi::g_direct_hash),
            Some(glib::ffi::g_direct_equal),
            None,
            None,
        );
        for (key, value) in entries {
            glib::ffi::g_hash_table_insert(
                table,
                std::ptr::without_provenance_mut(*key),
                std::ptr::without_provenance_mut(*value),
            );
        }
        table
    }
}

/// Ref function for a fundamental codec backed by `GParamSpec`.
///
/// # Safety
///
/// `ptr` must be null or point to a live `GParamSpec`; the call adds one reference and returns
/// the same pointer, leaving the caller responsible for the matching unref.
pub unsafe extern "C" fn param_spec_ref(ptr: *mut c_void) -> *mut c_void {
    // SAFETY: `ptr` is a live `GParamSpec` per the contract; `g_param_spec_ref` takes one
    // additional reference and returns it unchanged.
    unsafe {
        glib::gobject_ffi::g_param_spec_ref(ptr as *mut glib::gobject_ffi::GParamSpec)
            as *mut c_void
    }
}

/// Unref function for a fundamental codec backed by `GParamSpec`.
///
/// # Safety
///
/// `ptr` must point to a live `GParamSpec` for which the caller holds a reference; that
/// reference is released and may free the spec, so `ptr` must not be used afterwards.
pub unsafe extern "C" fn param_spec_unref(ptr: *mut c_void) {
    // SAFETY: `ptr` is a live `GParamSpec` the caller owns a reference to per the contract;
    // `g_param_spec_unref` releases exactly that reference.
    unsafe {
        glib::gobject_ffi::g_param_spec_unref(ptr as *mut glib::gobject_ffi::GParamSpec);
    }
}

#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub fn param_spec_refcount(ptr: *mut c_void) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    // SAFETY: `ptr` is non-null (checked above) and points to a live `GParamSpec` supplied by the
    // test; reading its `ref_count` field is a plain field access on a valid struct.
    unsafe {
        let param = ptr as *mut glib::gobject_ffi::GParamSpec;
        (*param).ref_count
    }
}

#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub fn get_gobject_refcount(obj_ptr: *mut glib::gobject_ffi::GObject) -> u32 {
    if obj_ptr.is_null() {
        return 0;
    }
    // SAFETY: `obj_ptr` is non-null (checked above) and points to a live `GObject`; reading its
    // `ref_count` field is a plain field access on a valid struct.
    unsafe { (*obj_ptr).ref_count }
}

#[must_use]
pub fn allocate_test_boxed(gtype: glib::Type) -> *mut std::ffi::c_void {
    // SAFETY: runs on the GTK-initialized test thread. `rgba.as_ptr()` is a valid pointer to a
    // live `GdkRGBA` value, and `gtype` is its matching boxed type, so `g_boxed_copy` returns a
    // newly owned boxed copy that the caller is responsible for freeing.
    unsafe {
        let rgba = gdk::RGBA::new(1.0, 0.5, 0.25, 1.0);
        glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), rgba.as_ptr() as *const _)
    }
}

#[must_use]
pub fn owned_rgba_boxed() -> (Boxed, *mut std::ffi::c_void) {
    let gtype = gdk::RGBA::static_type();
    let ptr = allocate_test_boxed(gtype);
    (Boxed::from_glib_full(Some(gtype), ptr), ptr)
}

pub fn is_valid_boxed_ptr(ptr: *mut std::ffi::c_void, gtype: glib::Type) -> bool {
    if ptr.is_null() {
        return false;
    }

    if gtype == gdk::RGBA::static_type() {
        // SAFETY: `ptr` is non-null (checked above) and `gtype` identifies it as a `GdkRGBA`, so
        // reinterpreting it as `&GdkRGBA` and reading its float fields is valid.
        unsafe {
            let rgba: &gdk::ffi::GdkRGBA = &*(ptr as *const gdk::ffi::GdkRGBA);
            rgba.red >= 0.0 && rgba.red <= 1.0 && rgba.alpha >= 0.0 && rgba.alpha <= 1.0
        }
    } else {
        true
    }
}

pub struct TestBoxed {
    pub ptr: *mut c_void,
    pub ty: Option<glib::Type>,
    pub is_owned: bool,
}

impl Drop for TestBoxed {
    fn drop(&mut self) {
        if self.is_owned && !self.ptr.is_null() {
            // SAFETY: `is_owned` means this `TestBoxed` owns `self.ptr`, which is non-null
            // (checked above). A `Some(gtype)` boxed value is freed with the matching
            // `g_boxed_free`; a `None` plain allocation with `g_free`. Either frees the owned
            // value exactly once as the wrapper is dropped.
            unsafe {
                match self.ty {
                    Some(gtype) => {
                        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), self.ptr);
                    }
                    None => {
                        glib::ffi::g_free(self.ptr);
                    }
                }
            }
        }
    }
}

pub fn enum_tagged() -> TaggedType {
    TaggedType {
        kind: TaggedKind::Enum,
        library: "libgtk-4.so.1".to_owned(),
        get_type_fn: "gtk_orientation_get_type".to_owned(),
        storage: IntegerKind::I32,
    }
}

pub fn flags_tagged() -> TaggedType {
    TaggedType {
        kind: TaggedKind::Flags,
        library: "libgtk-4.so.1".to_owned(),
        get_type_fn: "gtk_state_flags_get_type".to_owned(),
        storage: IntegerKind::U32,
    }
}

pub fn assert_encode_null_yields_null_ptr<C: FfiEncoder>(codec: &C) {
    let encoded = codec
        .encode(&Value::Null)
        .expect("null encode should succeed");
    assert!(matches!(encoded, native::ffi::FfiValue::Ptr(p) if p.is_null()));
}

pub fn assert_decode_null_yields_null<C: FfiDecoder>(codec: &C) {
    let decoded = codec
        .decode(&native::ffi::FfiValue::Ptr(std::ptr::null_mut()))
        .expect("null decode should succeed");
    assert!(matches!(decoded, Value::Null));
}

pub fn assert_read_null_yields_null<C: FfiDecoder>(codec: &C) {
    // SAFETY: `ReadSource::Value` with a null pointer is the documented null case; every decoder's
    // `read_value` null-guards before dereferencing, so a null pointer reads as `Value::Null`.
    let value = unsafe { codec.read(ReadSource::Value(std::ptr::null_mut(), "ctx")) }
        .expect("null ptr_to_value should succeed");
    assert!(matches!(value, Value::Null));
}

/// Reads a value from a pointer-sized slot whose stored pointer is `ptr`, exercising the
/// `ReadSource::Slot` decode path.
///
/// # Safety
///
/// `ptr` must be a value the decoder `C` can read from a slot — typically null or a live pointer
/// of the type the codec expects, owned by the GTK-initialized test thread.
pub unsafe fn read_slot<C: FfiDecoder>(codec: &C, ptr: *mut c_void) -> anyhow::Result<Value> {
    let slot: *mut c_void = ptr;
    // SAFETY: `&slot` is a live, pointer-sized stack slot holding `ptr`; `read_pointer_slot`
    // reads one pointer from it and decodes the pointee per the caller's `ptr` contract.
    unsafe {
        codec.read(ReadSource::Slot(
            &slot as *const *mut c_void as *const c_void,
            "ctx",
        ))
    }
}

pub fn write_return_into_slot<C: RawPtrCodec>(codec: &C, value: &Result<Value, ()>) -> *mut c_void {
    let mut slot: *mut c_void = std::ptr::null_mut();
    // SAFETY: `&mut slot` is a live, pointer-sized stack slot; `write_return_to_raw_ptr` writes
    // exactly one pointer (or null) into it, which is read back after the call.
    unsafe { codec.write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, value) };
    slot
}

pub fn write_value_into_slot<C: RawPtrCodec>(
    codec: &C,
    initial: *mut c_void,
    value: &Value,
) -> *mut c_void {
    let mut slot: *mut c_void = initial;
    // SAFETY: `&mut slot` is a live, pointer-sized stack slot pre-seeded with `initial` (the prior
    // owned pointer or null); `write_value_to_raw_ptr` swaps in the new value, balancing ownership.
    unsafe { codec.write_value_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, value) }
        .expect("write_value_to_raw_ptr should succeed");
    slot
}

pub fn assert_write_return_err_writes_null<C: RawPtrCodec>(codec: &C) {
    let mut slot: *mut c_void = std::ptr::dangling_mut::<c_void>();
    let value: Result<Value, ()> = Err(());
    // SAFETY: `&mut slot` is a live, pointer-sized stack slot; on an `Err` value
    // `write_return_to_raw_ptr` writes null into it without reading the dangling initial value.
    unsafe {
        codec.write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);
    }
    assert!(slot.is_null());
}

#[must_use]
pub fn i32_array_type(size: usize) -> ArrayType {
    ArrayType {
        item_type: Box::new(Type::Integer(IntegerKind::I32)),
        kind: ArrayKind::Fixed { size },
        ownership: Ownership::Borrowed,
        element_size: None,
    }
}

#[must_use]
pub fn f32_array_type() -> ArrayType {
    ArrayType {
        item_type: Box::new(Type::Float(FloatKind::F32)),
        kind: ArrayKind::Sized { size_index: 1 },
        ownership: Ownership::Borrowed,
        element_size: None,
    }
}
