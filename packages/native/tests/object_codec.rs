use test_support as helpers;

use std::ffi::c_void;

use gtk4::glib;

use napi::Env;
use napi::JsValue as _;
use napi::bindgen_prelude::{External, Unknown};

use native::ffi;
use native::ffi::codec::{Decoder, Encoder, ObjectCodec, Ownership, ReadSource};
use native::handle::Handle;

use helpers::napi_mock;
use helpers::{
    assert_decode_null_yields_null, assert_read_null_yields_null,
    assert_write_return_err_writes_null, fresh_gobject, get_gobject_refcount, read_slot,
    write_return_into_slot,
};

fn borrowed() -> ObjectCodec {
    ObjectCodec {
        ownership: Ownership::Borrowed,
    }
}

fn full() -> ObjectCodec {
    ObjectCodec {
        ownership: Ownership::Full,
    }
}

fn object_unknown(env: &Env, ptr: *mut glib::gobject_ffi::GObject) -> Unknown<'_> {
    External::new(Handle::from_glib_borrow(ptr.cast::<c_void>()))
        .into_unknown(env)
        .expect("wrapping handle should succeed")
}

fn encode_object(
    env: &Env,
    codec: &ObjectCodec,
    ptr: *mut glib::gobject_ffi::GObject,
) -> ffi::Stash {
    codec
        .encode(env, object_unknown(env, ptr))
        .expect("encode should succeed")
}

fn assert_is_object(value: &Unknown<'_>) {
    assert_eq!(
        napi_mock::value_type(value.raw()),
        Some(napi::sys::ValueType::napi_external)
    );
}

#[test]
fn encode_full_transfer_adds_exactly_one_ref() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, before) = fresh_gobject();

        let encoded = encode_object(&env, &full(), obj_ptr);
        encoded.disarm_pending_transfer();

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before + 1);

        let ffi::Stash::Storage(storage) = &encoded else {
            panic!("expected Storage ffi value");
        };
        assert_eq!(storage.ptr(), obj_ptr.cast::<c_void>());

        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);
    });
}

#[test]
fn encode_full_transfer_releases_reference_when_call_never_happens() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, before) = fresh_gobject();

        let encoded = encode_object(&env, &full(), obj_ptr);
        drop(encoded);

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);
    });
}

#[test]
fn encode_borrowed_does_not_change_refcount() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, before) = fresh_gobject();

        let encoded = encode_object(&env, &borrowed(), obj_ptr);

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);
        assert!(matches!(encoded, ffi::Stash::Ptr(_)));
    });
}

#[test]
fn encode_null_object_stays_null() {
    helpers::run(|| {
        helpers::assert_encode_null_yields_null_ptr(&full());
    });
}

#[test]
fn ref_for_transfer_full_adds_one_ref() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let returned = unsafe { full().ref_for_transfer(obj_ptr.cast::<c_void>()) }
            .expect("ref_for_transfer should succeed");

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before + 1);
        assert_eq!(returned, obj_ptr.cast::<c_void>());

        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);
    });
}

#[test]
fn ref_for_transfer_borrowed_keeps_refcount() {
    helpers::run(|| {
        let (_obj, obj_ptr, before) = fresh_gobject();

        let returned = unsafe { borrowed().ref_for_transfer(obj_ptr.cast::<c_void>()) }
            .expect("ref_for_transfer should succeed");

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);
        assert_eq!(returned, obj_ptr.cast::<c_void>());
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    helpers::run(|| {
        let returned = unsafe { full().ref_for_transfer(std::ptr::null_mut()) }
            .expect("null ref_for_transfer should succeed");
        assert!(returned.is_null());
    });
}

#[test]
fn decode_borrowed_adds_exactly_one_ref() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, before) = fresh_gobject();

        let decoded = borrowed()
            .decode(&env, &ffi::Stash::Ptr(obj_ptr.cast::<c_void>()))
            .expect("borrowed decode should succeed");

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before + 1);
        assert_is_object(&decoded);
    });
}

#[test]
fn decode_full_transfer_keeps_refcount_net_of_wrapper() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, _) = fresh_gobject();

        unsafe { glib::gobject_ffi::g_object_ref(obj_ptr) };
        let before = unsafe { get_gobject_refcount(obj_ptr) };

        let decoded = full()
            .decode(&env, &ffi::Stash::Ptr(obj_ptr.cast::<c_void>()))
            .expect("full decode should succeed");

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);
        assert_is_object(&decoded);
    });
}

#[test]
fn decode_floating_object_is_sunk() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let obj_ptr = unsafe {
            glib::gobject_ffi::g_object_new(
                glib::gobject_ffi::g_initially_unowned_get_type(),
                std::ptr::null(),
            )
        };

        assert!(unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 });
        let before = unsafe { get_gobject_refcount(obj_ptr) };

        let decoded = full()
            .decode(&env, &ffi::Stash::Ptr(obj_ptr.cast::<c_void>()))
            .expect("floating decode should succeed");

        assert!(!unsafe { glib::gobject_ffi::g_object_is_floating(obj_ptr) != 0 });
        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);
        assert_is_object(&decoded);
    });
}

#[test]
fn decode_null_pointer_yields_null() {
    helpers::run(|| {
        assert_decode_null_yields_null(&borrowed());
    });
}

#[test]
fn ptr_to_value_wraps_borrowed_object() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, before) = fresh_gobject();

        let value =
            unsafe { borrowed().read(&env, ReadSource::Value(obj_ptr.cast::<c_void>(), "ctx")) }
                .expect("ptr_to_value should succeed");

        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before + 1);
        assert_is_object(&value);
    });
}

#[test]
fn ptr_to_value_null_yields_null() {
    helpers::run(|| {
        assert_read_null_yields_null(&borrowed());
    });
}

#[test]
fn read_from_pointer_dereferences_and_wraps() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, _) = fresh_gobject();

        let value = unsafe { read_slot(&env, &borrowed(), obj_ptr.cast::<c_void>()) }
            .expect("read_from_pointer should succeed");
        assert_is_object(&value);
    });
}

#[test]
fn write_return_to_pointer_full_transfer_writes_referenced_pointer() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, before) = fresh_gobject();

        let slot = write_return_into_slot(&env, &full(), &Ok(object_unknown(&env, obj_ptr)));

        assert_eq!(slot, obj_ptr.cast::<c_void>());
        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before + 1);
        unsafe { glib::gobject_ffi::g_object_unref(obj_ptr) };
    });
}

#[test]
fn write_return_to_pointer_borrowed_keeps_refcount() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, before) = fresh_gobject();

        let slot = write_return_into_slot(&env, &borrowed(), &Ok(object_unknown(&env, obj_ptr)));

        assert_eq!(slot, obj_ptr.cast::<c_void>());
        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);
    });
}

#[test]
fn write_return_to_pointer_err_writes_null() {
    helpers::run(|| {
        assert_write_return_err_writes_null(&borrowed());
    });
}

#[test]
fn write_value_to_pointer_borrowed_stores_without_refcount_changes() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, before) = fresh_gobject();

        let slot = helpers::write_value_into_slot(
            &env,
            &borrowed(),
            std::ptr::null_mut(),
            object_unknown(&env, obj_ptr),
        );

        assert_eq!(slot, obj_ptr.cast::<c_void>());
        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before);
    });
}

#[test]
fn write_value_to_pointer_borrowed_leaves_previous_object_untouched() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_old, old_ptr, old_before) = fresh_gobject();
        let (_new, new_ptr, new_before) = fresh_gobject();

        let slot = helpers::write_value_into_slot(
            &env,
            &borrowed(),
            old_ptr.cast::<c_void>(),
            object_unknown(&env, new_ptr),
        );

        assert_eq!(slot, new_ptr.cast::<c_void>());
        assert_eq!(unsafe { get_gobject_refcount(new_ptr) }, new_before);
        assert_eq!(unsafe { get_gobject_refcount(old_ptr) }, old_before);
    });
}

#[test]
fn write_value_to_pointer_full_refs_new_and_unrefs_previous_object() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_old, old_ptr, _) = fresh_gobject();
        let (_new, new_ptr, _) = fresh_gobject();

        unsafe { glib::gobject_ffi::g_object_ref(old_ptr.cast()) };
        let old_before = unsafe { get_gobject_refcount(old_ptr) };
        let new_before = unsafe { get_gobject_refcount(new_ptr) };

        let slot = helpers::write_value_into_slot(
            &env,
            &full(),
            old_ptr.cast::<c_void>(),
            object_unknown(&env, new_ptr),
        );

        assert_eq!(slot, new_ptr.cast::<c_void>());
        assert_eq!(unsafe { get_gobject_refcount(new_ptr) }, new_before + 1);
        assert_eq!(unsafe { get_gobject_refcount(old_ptr) }, old_before - 1);

        unsafe { glib::gobject_ffi::g_object_unref(slot.cast()) };
    });
}

#[test]
fn write_value_to_pointer_full_null_releases_previous_object() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, _) = fresh_gobject();

        unsafe { glib::gobject_ffi::g_object_ref(obj_ptr.cast()) };
        let before = unsafe { get_gobject_refcount(obj_ptr) };

        let slot = helpers::write_value_into_slot(
            &env,
            &full(),
            obj_ptr.cast::<c_void>(),
            napi_mock::to_unknown(&env, napi_mock::fake_null()),
        );

        assert!(slot.is_null());
        assert_eq!(unsafe { get_gobject_refcount(obj_ptr) }, before - 1);
    });
}

// `gtk_scale_new` and every other GTK widget constructor is `transfer-ownership="none"` in GIR
// because the reference it returns is floating, so a transfer-none decode is the path a freshly
// constructed widget actually takes, and the float it carries is left for whoever adopts it.
fn floating_widget() -> *mut glib::gobject_ffi::GObject {
    let widget = unsafe {
        glib::gobject_ffi::g_object_new(
            glib::gobject_ffi::g_initially_unowned_get_type(),
            std::ptr::null(),
        )
    };
    assert_ne!(
        unsafe { glib::gobject_ffi::g_object_is_floating(widget) },
        0,
        "a freshly constructed GInitiallyUnowned starts out floating"
    );
    widget
}

fn decode_object<'e>(
    env: &'e Env,
    codec: &ObjectCodec,
    ptr: *mut glib::gobject_ffi::GObject,
) -> Unknown<'e> {
    codec
        .decode(env, &ffi::Stash::Ptr(ptr.cast::<c_void>()))
        .expect("decoding a live object should succeed")
}

#[test]
fn a_transfer_none_decode_of_a_sunk_object_still_takes_its_own_reference() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let widget = floating_widget();
        unsafe { glib::gobject_ffi::g_object_ref_sink(widget) };
        let before = unsafe { get_gobject_refcount(widget) };

        let decoded = decode_object(&env, &borrowed(), widget);

        assert_eq!(unsafe { get_gobject_refcount(widget) }, before + 1);
        assert_is_object(&decoded);
    });
}
