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

pub unsafe extern "C" fn param_spec_ref(ptr: *mut c_void) -> *mut c_void {
    unsafe {
        glib::gobject_ffi::g_param_spec_ref(ptr as *mut glib::gobject_ffi::GParamSpec)
            as *mut c_void
    }
}

pub unsafe extern "C" fn param_spec_unref(ptr: *mut c_void) {
    unsafe {
        glib::gobject_ffi::g_param_spec_unref(ptr as *mut glib::gobject_ffi::GParamSpec);
    }
}

#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub fn param_spec_refcount(ptr: *mut c_void) -> u32 {
    if ptr.is_null() {
        return 0;
    }
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
    unsafe { (*obj_ptr).ref_count }
}

#[must_use]
pub fn allocate_test_boxed(gtype: glib::Type) -> *mut std::ffi::c_void {
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
    let value = unsafe { codec.read(ReadSource::Value(std::ptr::null_mut(), "ctx")) }
        .expect("null ptr_to_value should succeed");
    assert!(matches!(value, Value::Null));
}

pub unsafe fn read_slot<C: FfiDecoder>(codec: &C, ptr: *mut c_void) -> anyhow::Result<Value> {
    let slot: *mut c_void = ptr;
    unsafe {
        codec.read(ReadSource::Slot(
            &slot as *const *mut c_void as *const c_void,
            "ctx",
        ))
    }
}

pub fn write_return_into_slot<C: RawPtrCodec>(codec: &C, value: &Result<Value, ()>) -> *mut c_void {
    let mut slot: *mut c_void = std::ptr::null_mut();
    unsafe { codec.write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, value) };
    slot
}

pub fn write_value_into_slot<C: RawPtrCodec>(
    codec: &C,
    initial: *mut c_void,
    value: &Value,
) -> *mut c_void {
    let mut slot: *mut c_void = initial;
    unsafe { codec.write_value_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, value) }
        .expect("write_value_to_raw_ptr should succeed");
    slot
}

pub fn assert_write_return_err_writes_null<C: RawPtrCodec>(codec: &C) {
    let mut slot: *mut c_void = std::ptr::dangling_mut::<c_void>();
    let value: Result<Value, ()> = Err(());
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
