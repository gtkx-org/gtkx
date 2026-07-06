use std::ffi::c_void;
use std::sync::mpsc::{RecvError, Sender, sync_channel};
use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError};
use std::thread;

use gtk4::gdk;
use gtk4::glib::{self, translate::IntoGlib as _};
use gtk4::prelude::ObjectType as _;
use gtk4::prelude::StaticType as _;

use native::Handle;

use native::ffi::codec::{
    ArrayCodec, ArrayKind, Codec, EnumFlagsCodec, EnumFlagsKind, Decoder, Encoder,
    FloatCodec, IntegerCodec, Ownership, PtrWriter, ReadSource,
};
use native::ffi::Slot;
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

pub fn param_spec_refcount(ptr: *mut c_void) -> u32 {
    if ptr.is_null() {
        return 0;
    }
    unsafe {
        let param = ptr as *mut glib::gobject_ffi::GParamSpec;
        (*param).ref_count
    }
}

pub fn get_gobject_refcount(obj_ptr: *mut glib::gobject_ffi::GObject) -> u32 {
    if obj_ptr.is_null() {
        return 0;
    }
    unsafe { (*obj_ptr).ref_count }
}

pub fn make_bool_param_spec() -> *mut c_void {
    ensure_glib_init();
    unsafe {
        glib::gobject_ffi::g_param_spec_boolean(
            c"gtkx-test-param".as_ptr(),
            c"Test".as_ptr(),
            c"A test parameter".as_ptr(),
            glib::ffi::GFALSE,
            glib::gobject_ffi::G_PARAM_READABLE,
        ) as *mut c_void
    }
}

pub fn fresh_gobject() -> (glib::Object, *mut glib::gobject_ffi::GObject, u32) {
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr();
    let before = get_gobject_refcount(obj_ptr);
    (obj, obj_ptr, before)
}

pub fn boxed_handle() -> Handle {
    let ptr = allocate_test_boxed(gdk::RGBA::static_type());
    Handle::from_glib_borrow(ptr)
}

pub fn pump_default_context_until(done: impl Fn() -> bool) {
    let context = glib::MainContext::default();
    for _ in 0..1000 {
        if done() {
            return;
        }
        if !context.iteration(false) {
            thread::yield_now();
        }
    }
}

pub fn allocate_test_boxed(type_: glib::Type) -> *mut std::ffi::c_void {
    unsafe {
        let rgba = gdk::RGBA::new(1.0, 0.5, 0.25, 1.0);
        glib::gobject_ffi::g_boxed_copy(type_.into_glib(), rgba.as_ptr() as *const _)
    }
}

pub fn owned_rgba_boxed() -> (Boxed, *mut std::ffi::c_void) {
    let type_ = gdk::RGBA::static_type();
    let ptr = allocate_test_boxed(type_);
    (Boxed::from_glib_full(Some(type_), ptr), ptr)
}

pub fn is_valid_boxed_ptr(ptr: *mut std::ffi::c_void, type_: glib::Type) -> bool {
    if ptr.is_null() {
        return false;
    }

    if type_ == gdk::RGBA::static_type() {
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
    pub type_: Option<glib::Type>,
    pub is_owned: bool,
}

impl Drop for TestBoxed {
    fn drop(&mut self) {
        if self.is_owned && !self.ptr.is_null() {
            unsafe {
                match self.type_ {
                    Some(type_) => {
                        glib::gobject_ffi::g_boxed_free(type_.into_glib(), self.ptr);
                    }
                    None => {
                        glib::ffi::g_free(self.ptr);
                    }
                }
            }
        }
    }
}

pub fn assert_encode_null_yields_null_ptr<C: Encoder>(codec: &C) {
    let encoded = codec
        .encode(&Value::Null)
        .expect("null encode should succeed");
    assert!(matches!(encoded, native::ffi::Stash::Ptr(p) if p.is_null()));
}

pub fn assert_decode_null_yields_null<C: Decoder>(codec: &C) {
    let decoded = codec
        .decode(&native::ffi::Stash::Ptr(std::ptr::null_mut()))
        .expect("null decode should succeed");
    assert!(matches!(decoded, Value::Null));
}

pub fn assert_read_null_yields_null<C: Decoder>(codec: &C) {
    let value = unsafe { codec.read(ReadSource::Value(std::ptr::null_mut(), "ctx")) }
        .expect("null ptr_to_value should succeed");
    assert!(matches!(value, Value::Null));
}

pub unsafe fn read_slot<C: Decoder>(codec: &C, ptr: *mut c_void) -> anyhow::Result<Value> {
    let slot: *mut c_void = ptr;
    unsafe {
        codec.read(ReadSource::Slot(
            &slot as *const *mut c_void as *const c_void,
            "ctx",
        ))
    }
}

pub fn write_return_into_slot<C: PtrWriter>(
    codec: &C,
    value: &Result<Value, ()>,
) -> *mut c_void {
    let mut slot: *mut c_void = std::ptr::null_mut();
    codec.write_return_to_ptr(
        unsafe { Slot::new(&mut slot as *mut *mut c_void as *mut c_void) },
        value,
    );
    slot
}

pub fn write_value_into_slot<C: PtrWriter>(
    codec: &C,
    initial: *mut c_void,
    value: &Value,
) -> *mut c_void {
    let mut slot: *mut c_void = initial;
    codec
        .write_value_to_ptr(
            unsafe { Slot::new(&mut slot as *mut *mut c_void as *mut c_void) },
            value,
        )
        .expect("write_value_to_ptr should succeed");
    slot
}

pub fn assert_write_return_err_writes_null<C: PtrWriter>(codec: &C) {
    let mut slot: *mut c_void = std::ptr::dangling_mut::<c_void>();
    let value: Result<Value, ()> = Err(());
    codec.write_return_to_ptr(
        unsafe { Slot::new(&mut slot as *mut *mut c_void as *mut c_void) },
        &value,
    );
    assert!(slot.is_null());
}

pub fn i32_array_codec(size: u32) -> ArrayCodec {
    ArrayCodec::new(
        Box::new(Codec::Integer(IntegerCodec::I32)),
        ArrayKind::Fixed,
        Ownership::Borrowed,
        None,
        Some(size),
        None,
    )
    .expect("valid fixed array codec")
}

pub fn f32_array_codec() -> ArrayCodec {
    ArrayCodec::new(
        Box::new(Codec::Float(FloatCodec::F32)),
        ArrayKind::Sized,
        Ownership::Borrowed,
        Some(1),
        None,
        None,
    )
    .expect("valid sized array codec")
}

pub fn enum_codec() -> EnumFlagsCodec {
    EnumFlagsCodec {
        kind: EnumFlagsKind::Enum,
        shared_library: "libgtk-4.so.1".to_owned(),
        get_type_fn_name: "gtk_orientation_get_type".to_owned(),
        storage: IntegerCodec::I32,
    }
}
