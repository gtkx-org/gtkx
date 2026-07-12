use std::ffi::c_void;
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::thread;

use gtk4::gdk;
use gtk4::glib::{self, translate::IntoGlib as _};
use gtk4::prelude::ObjectType as _;
use gtk4::prelude::StaticType as _;

use native::Handle;

use native::ffi::Slot;
use native::ffi::codec::{
    ArrayCodec, ArrayKind, Codec, Decoder, Encoder, EnumFlagsCodec, EnumFlagsKind, FloatCodec,
    IntegerCodec, Ownership, PtrWriter, ReadSource,
};
use native::ffi::library_cache::FfiCache;
use native::handle::Boxed;
use native::messaging::node_env;

use napi::Env;
use napi::JsValue as _;
use napi::bindgen_prelude::Unknown;

macro_rules! keep_symbols {
    ($($symbol:ident),* $(,)?) => {
        $( std::hint::black_box($symbol as *const ()); )*
    };
}

#[macro_export]
macro_rules! g_free_recorder {
    () => {
        ::std::thread_local! {
            static G_FREED: ::std::cell::RefCell<::std::vec::Vec<usize>> =
                const { ::std::cell::RefCell::new(::std::vec::Vec::new()) };
        }

        unsafe extern "C" {
            fn free(ptr: *mut ::std::ffi::c_void);
        }

        #[unsafe(no_mangle)]
        pub unsafe extern "C" fn g_free(ptr: *mut ::std::ffi::c_void) {
            G_FREED.with_borrow_mut(|freed| freed.push(ptr as usize));
            unsafe { free(ptr) };
        }

        fn drain_g_freed() -> ::std::vec::Vec<usize> {
            G_FREED.with_borrow_mut(::std::mem::take)
        }
    };
}

pub mod napi_mock;
pub mod uv_mock;

pub use napi_mock::fake_env;

static SERIAL: Mutex<()> = Mutex::new(());

pub fn serial_guard() -> MutexGuard<'static, ()> {
    SERIAL.lock().unwrap_or_else(PoisonError::into_inner)
}

pub fn register_common_boxed_types() {
    let _ = gdk::RGBA::static_type();
    let _ = glib::Bytes::static_type();
}

pub fn run<F, R>(f: F) -> R
where
    F: FnOnce() -> R,
{
    let _guard = serial_guard();
    register_common_boxed_types();
    FfiCache::with(|state| *state = FfiCache::default());
    napi_mock::install_napi_mock();
    napi_mock::reset();
    uv_mock::install_uv_mock();
    uv_mock::reset();
    node_env::install(fake_env()).expect("installing the fake node env should succeed");
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

pub fn assert_unresolvable_symbol_failure_keeps_param_spec(
    pspec: *mut c_void,
    before: u32,
    result: anyhow::Result<()>,
    context: &str,
) {
    let err = result.expect_err(context);
    assert!(
        err.to_string().contains("Failed to find symbol"),
        "unexpected error: {err}"
    );
    assert_eq!(param_spec_refcount(pspec), before);
    unsafe {
        glib::gobject_ffi::g_param_spec_unref(pspec as *mut glib::gobject_ffi::GParamSpec);
    }
}

pub fn make_bool_param_spec() -> *mut c_void {
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
    let env = fake_env();
    let encoded = codec
        .encode(&env, napi_mock::to_unknown(&env, napi_mock::fake_null()))
        .expect("null encode should succeed");
    assert!(matches!(encoded, native::ffi::Stash::Ptr(p) if p.is_null()));
}

pub fn assert_decode_null_yields_null<C: Decoder>(codec: &C) {
    let env = fake_env();
    let decoded = codec
        .decode(&env, &native::ffi::Stash::Ptr(std::ptr::null_mut()))
        .expect("null decode should succeed");
    assert!(napi_mock::is_null(decoded.raw()));
}

pub fn assert_read_null_yields_null<C: Decoder>(codec: &C) {
    let env = fake_env();
    let value = unsafe { codec.read(&env, ReadSource::Value(std::ptr::null_mut(), "ctx")) }
        .expect("null ptr_to_value should succeed");
    assert!(napi_mock::is_null(value.raw()));
}

pub unsafe fn read_slot<'e, C: Decoder>(
    env: &'e Env,
    codec: &C,
    ptr: *mut c_void,
) -> anyhow::Result<Unknown<'e>> {
    let slot: *mut c_void = ptr;
    unsafe {
        codec.read(
            env,
            ReadSource::Slot(&slot as *const *mut c_void as *const c_void, "ctx"),
        )
    }
}

pub fn write_return_into_slot<C: PtrWriter>(
    env: &Env,
    codec: &C,
    value: &Result<Unknown<'_>, ()>,
) -> *mut c_void {
    let mut slot: *mut c_void = std::ptr::null_mut();
    codec.write_return_to_ptr(
        env,
        unsafe { Slot::new(&mut slot as *mut *mut c_void as *mut c_void) },
        value,
    );
    slot
}

pub fn write_value_into_slot<C: PtrWriter>(
    env: &Env,
    codec: &C,
    initial: *mut c_void,
    value: Unknown<'_>,
) -> *mut c_void {
    let mut slot: *mut c_void = initial;
    codec
        .write_value_to_ptr(
            env,
            unsafe { Slot::new(&mut slot as *mut *mut c_void as *mut c_void) },
            value,
        )
        .expect("write_value_to_ptr should succeed");
    slot
}

pub fn assert_write_return_err_writes_null<C: PtrWriter>(codec: &C) {
    let env = fake_env();
    let mut slot: *mut c_void = std::ptr::dangling_mut::<c_void>();
    let value: Result<Unknown, ()> = Err(());
    codec.write_return_to_ptr(
        &env,
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
