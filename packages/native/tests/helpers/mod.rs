#![allow(dead_code)]

use std::ffi::c_void;
use std::sync::mpsc::{RecvError, Sender, sync_channel};
use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError};
use std::thread;

use gtk4::gdk;
use gtk4::glib::{self, translate::IntoGlib as _};
use gtk4::prelude::StaticType as _;

use native::ffi::descriptor::{
    ArrayDescriptor, ArrayKind, Codec, EnumFlagsDescriptor, EnumFlagsKind, FfiDecoder, FfiEncoder,
    FloatKind, IntegerKind, Ownership, PointerWriter, ReadSource,
};
use native::ffi::library_cache::GlibThreadState;
use native::ffi::value::Value;
use native::handle::Boxed;

static SERIAL: Mutex<()> = Mutex::new(());

type GlibJob = Box<dyn FnOnce() + Send>;

static GLIB_THREAD: OnceLock<Sender<GlibJob>> = OnceLock::new();

thread_local! {
    static ON_GLIB_THREAD: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

fn glib_thread() -> &'static Sender<GlibJob> {
    GLIB_THREAD.get_or_init(|| {
        let (tx, rx) = std::sync::mpsc::channel::<GlibJob>();
        thread::Builder::new()
            .name("gtkx-test-glib".to_owned())
            .spawn(move || {
                ON_GLIB_THREAD.with(|flag| flag.set(true));
                gtk4::init().expect("Failed to initialize GTK4 for tests");
                for job in rx {
                    job();
                }
            })
            .expect("spawning the GLib test thread should succeed");
        tx
    })
}

pub fn ensure_glib_init() {
    on_glib_thread(|| {});
}

pub fn serial_guard() -> MutexGuard<'static, ()> {
    SERIAL.lock().unwrap_or_else(PoisonError::into_inner)
}

fn on_glib_thread<F, R>(f: F) -> R
where
    F: FnOnce() -> R + Send,
    R: Send,
{
    if ON_GLIB_THREAD.with(std::cell::Cell::get) {
        return f();
    }

    let (result_tx, result_rx) = sync_channel::<thread::Result<R>>(0);
    let scoped_job: Box<dyn FnOnce() + Send + '_> = Box::new(move || {
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f));
        let _ = result_tx.send(outcome);
    });
    let job: Box<dyn FnOnce() + Send> = unsafe {
        std::mem::transmute::<Box<dyn FnOnce() + Send + '_>, Box<dyn FnOnce() + Send>>(scoped_job)
    };

    glib_thread()
        .send(job)
        .expect("the GLib test thread should accept jobs");

    match result_rx.recv() {
        Ok(Ok(value)) => value,
        Ok(Err(payload)) => std::panic::resume_unwind(payload),
        Err(RecvError) => panic!("the GLib test thread terminated before returning a result"),
    }
}

pub fn run<F, R>(f: F) -> R
where
    F: FnOnce() -> R + Send,
    R: Send,
{
    let _guard = serial_guard();
    on_glib_thread(|| {
        GlibThreadState::with(|state| *state = GlibThreadState::default());
        f()
    })
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
    pub descriptor: Option<glib::Type>,
    pub is_owned: bool,
}

impl Drop for TestBoxed {
    fn drop(&mut self) {
        if self.is_owned && !self.ptr.is_null() {
            unsafe {
                match self.descriptor {
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

pub fn assert_encode_null_yields_null_ptr<C: FfiEncoder>(codec: &C) {
    let encoded = codec
        .encode(&Value::Null)
        .expect("null encode should succeed");
    assert!(matches!(encoded, native::ffi::StashedValue::Ptr(p) if p.is_null()));
}

pub fn assert_decode_null_yields_null<C: FfiDecoder>(codec: &C) {
    let decoded = codec
        .decode(&native::ffi::StashedValue::Ptr(std::ptr::null_mut()))
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

pub fn write_return_into_slot<C: PointerWriter>(
    codec: &C,
    value: &Result<Value, ()>,
) -> *mut c_void {
    let mut slot: *mut c_void = std::ptr::null_mut();
    unsafe { codec.write_return_to_pointer(&mut slot as *mut *mut c_void as *mut c_void, value) };
    slot
}

pub fn write_value_into_slot<C: PointerWriter>(
    codec: &C,
    initial: *mut c_void,
    value: &Value,
) -> *mut c_void {
    let mut slot: *mut c_void = initial;
    unsafe { codec.write_value_to_pointer(&mut slot as *mut *mut c_void as *mut c_void, value) }
        .expect("write_value_to_pointer should succeed");
    slot
}

pub fn assert_write_return_err_writes_null<C: PointerWriter>(codec: &C) {
    let mut slot: *mut c_void = std::ptr::dangling_mut::<c_void>();
    let value: Result<Value, ()> = Err(());
    unsafe {
        codec.write_return_to_pointer(&mut slot as *mut *mut c_void as *mut c_void, &value);
    }
    assert!(slot.is_null());
}

#[must_use]
pub fn i32_array_descriptor(size: usize) -> ArrayDescriptor {
    ArrayDescriptor {
        item_descriptor: Box::new(Codec::Integer(IntegerKind::I32)),
        kind: ArrayKind::Fixed { size },
        ownership: Ownership::Borrowed,
        element_size: None,
    }
}

#[must_use]
pub fn f32_array_descriptor() -> ArrayDescriptor {
    ArrayDescriptor {
        item_descriptor: Box::new(Codec::Float(FloatKind::F32)),
        kind: ArrayKind::Sized { size_index: 1 },
        ownership: Ownership::Borrowed,
        element_size: None,
    }
}

pub fn enum_descriptor() -> EnumFlagsDescriptor {
    EnumFlagsDescriptor {
        kind: EnumFlagsKind::Enum,
        shared_library: "libgtk-4.so.1".to_owned(),
        get_type_fn: "gtk_orientation_get_type".to_owned(),
        storage: IntegerKind::I32,
    }
}

pub fn flags_descriptor() -> EnumFlagsDescriptor {
    EnumFlagsDescriptor {
        kind: EnumFlagsKind::Flags,
        shared_library: "libgtk-4.so.1".to_owned(),
        get_type_fn: "gtk_state_flags_get_type".to_owned(),
        storage: IntegerKind::U32,
    }
}
