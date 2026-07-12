use test_support as helpers;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::ObjectType as _;
use gtk4::prelude::StaticType as _;

use napi::Env;
use napi::JsValue as _;
use napi::bindgen_prelude::{External, Unknown};

use native::ffi;
use native::ffi::codec::{
    ArrayCodec, ArrayKind, BoxedCodec, Codec, Decoder, ObjectCodec, Ownership, StringCodec,
};

use test_support::napi_mock;

fn gobject_type_of(ownership: Ownership) -> Codec {
    Codec::Object(ObjectCodec { ownership })
}

fn string_type_of(ownership: Ownership) -> Codec {
    Codec::String(StringCodec {
        ownership,
        length: None,
    })
}

fn rgba_boxed_type_of(ownership: Ownership) -> Codec {
    Codec::Boxed(BoxedCodec {
        ownership,
        type_name: "GdkRGBA".to_string(),
        shared_library: None,
        get_type_fn_name: None,
        free_fn_name: None,
        caller_allocated: false,
    })
}

fn gvariant_fundamental_type_of(ownership: Ownership) -> Codec {
    Codec::Fundamental(native::ffi::codec::FundamentalCodec {
        ownership,
        shared_library: "libglib-2.0.so.0".to_string(),
        ref_fn_name: "g_variant_ref_sink".to_string(),
        unref_fn_name: "g_variant_unref".to_string(),
    })
}

fn gobject_glist_type_of(container: Ownership) -> Codec {
    Codec::Array(
        ArrayCodec::new(
            Box::new(gobject_type_of(Ownership::Borrowed)),
            ArrayKind::GList,
            container,
            None,
            None,
            None,
        )
        .expect("valid glist codec"),
    )
}

fn string_array_type_of(item: Ownership, container: Ownership, kind: ArrayKind) -> Codec {
    Codec::Array(
        ArrayCodec::new(
            Box::new(string_type_of(item)),
            kind,
            container,
            None,
            None,
            None,
        )
        .expect("valid array codec"),
    )
}

fn decode_ptr<'e>(env: &'e Env, codec: &Codec, ptr: *mut c_void) -> Unknown<'e> {
    codec
        .decode(env, &ffi::Stash::Ptr(ptr))
        .expect("decode should succeed")
}

fn assert_null_ptr_decodes_to_null(env: &Env, codec: &Codec) {
    assert!(napi_mock::is_null(
        decode_ptr(env, codec, std::ptr::null_mut()).raw()
    ));
}

fn decode_array(env: &Env, codec: &Codec, ptr: *mut c_void) -> Vec<napi::sys::napi_value> {
    let decoded = decode_ptr(env, codec, ptr);
    napi_mock::read_array(decoded.raw()).expect("Expected an array")
}

fn assert_string_item(items: &[napi::sys::napi_value], index: usize, expected: &str) {
    assert_eq!(
        items
            .get(index)
            .copied()
            .and_then(napi_mock::read_string)
            .as_deref(),
        Some(expected)
    );
}

fn new_gobject_handle() -> (glib::Object, *mut c_void, native::Handle) {
    let obj = glib::Object::new::<glib::Object>();
    let obj_ptr = obj.as_ptr() as *mut c_void;
    let handle = native::Handle::from_glib_borrow(obj_ptr);
    (obj, obj_ptr, handle)
}

fn build_gobject_glist(count: usize) -> *mut glib::ffi::GList {
    let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
    for _ in 0..count {
        let obj = glib::Object::new::<glib::Object>();
        unsafe {
            glib::gobject_ffi::g_object_ref(obj.as_ptr());
        }
        list = unsafe { glib::ffi::g_list_append(list, obj.as_ptr() as *mut c_void) };
    }
    list
}

fn ptr_slot_stash(ptr: *mut c_void) -> ffi::Stash {
    let mut slot: Vec<*mut c_void> = vec![ptr];
    let storage_ptr = slot.as_mut_ptr() as *mut c_void;
    ffi::Stash::Storage(ffi::StashStorage::new(
        storage_ptr,
        ffi::StashData::PtrSlot(slot),
    ))
}

#[test]
fn glist_transfer_none_does_not_free_list() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let list = build_gobject_glist(3);

        let items = decode_array(
            &env,
            &gobject_glist_type_of(Ownership::Borrowed),
            list as *mut c_void,
        );
        assert_eq!(items.len(), 3);

        assert!(!list.is_null());

        let length = unsafe { glib::ffi::g_list_length(list) };
        for index in 0..length {
            let data = unsafe { glib::ffi::g_list_nth_data(list, index) };
            if !data.is_null() {
                unsafe {
                    glib::gobject_ffi::g_object_unref(data as *mut glib::gobject_ffi::GObject);
                }
            }
        }
        unsafe {
            glib::ffi::g_list_free(list);
        }
    });
}

#[test]
fn glist_full_transfer_frees_list() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let list = build_gobject_glist(3);

        let items = decode_array(
            &env,
            &gobject_glist_type_of(Ownership::Full),
            list as *mut c_void,
        );
        assert_eq!(items.len(), 3);
    });
}

#[test]
fn glist_null_returns_empty_array() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let items = decode_array(
            &env,
            &gobject_glist_type_of(Ownership::Full),
            std::ptr::null_mut(),
        );
        assert!(items.is_empty());
    });
}

#[test]
fn strv_transfer_none_does_not_free() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let strings = [
            std::ffi::CString::new("hello").unwrap(),
            std::ffi::CString::new("world").unwrap(),
        ];
        let mut ptrs: Vec<*const i8> = strings.iter().map(|s| s.as_ptr()).collect();
        ptrs.push(std::ptr::null());

        let items = decode_array(
            &env,
            &string_array_type_of(Ownership::Borrowed, Ownership::Borrowed, ArrayKind::Array),
            ptrs.as_ptr() as *mut c_void,
        );
        assert_eq!(items.len(), 2);
        assert_string_item(&items, 0, "hello");
        assert_string_item(&items, 1, "world");

        assert_eq!(
            unsafe { std::ffi::CStr::from_ptr(strings[0].as_ptr()) }
                .to_str()
                .unwrap(),
            "hello"
        );
    });
}

#[test]
fn strv_full_transfer_frees_strings() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let s1 = unsafe { glib::ffi::g_strdup(c"hello".as_ptr()) };
        let s2 = unsafe { glib::ffi::g_strdup(c"world".as_ptr()) };

        let strv = unsafe {
            let ptr = glib::ffi::g_malloc(3 * std::mem::size_of::<*mut i8>()) as *mut *mut i8;
            *ptr = s1;
            *ptr.add(1) = s2;
            *ptr.add(2) = std::ptr::null_mut();
            ptr
        };

        let items = decode_array(
            &env,
            &string_array_type_of(Ownership::Full, Ownership::Full, ArrayKind::Array),
            strv as *mut c_void,
        );
        assert_eq!(items.len(), 2);
    });
}

#[test]
fn from_cif_value_fundamental_gvariant_transfer_none() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let variant = unsafe {
            let ptr = glib::ffi::g_variant_new_int32(42);
            glib::ffi::g_variant_ref_sink(ptr);
            ptr
        };

        let result = decode_ptr(
            &env,
            &gvariant_fundamental_type_of(Ownership::Borrowed),
            variant as *mut c_void,
        );
        assert!(
            napi_mock::read_external(result.raw()).is_some(),
            "Expected an external handle"
        );

        unsafe {
            glib::ffi::g_variant_unref(variant);
        }
    });
}

#[test]
fn from_cif_value_fundamental_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        assert_null_ptr_decodes_to_null(&env, &gvariant_fundamental_type_of(Ownership::Full));
    });
}

#[test]
fn from_cif_value_ref_gobject_null_inner() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let cif_value = ptr_slot_stash(std::ptr::null_mut());
        let codec = Codec::Ref(
            native::ffi::codec::RefCodec::new(gobject_type_of(Ownership::Borrowed))
                .expect("GObject is a valid Ref inner"),
        );

        let result = codec
            .decode(&env, &cif_value)
            .expect("Ref<GObject> null decode failed");
        assert!(napi_mock::is_null(result.raw()));
    });
}

#[test]
fn from_cif_value_ref_boxed() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let type_ = gdk::RGBA::static_type();
        let ptr = helpers::allocate_test_boxed(type_);

        let cif_value = ptr_slot_stash(ptr);
        let codec = Codec::Ref(
            native::ffi::codec::RefCodec::new(rgba_boxed_type_of(Ownership::Borrowed))
                .expect("Boxed is a valid Ref inner"),
        );

        let result = codec
            .decode(&env, &cif_value)
            .expect("Ref<Boxed> decode failed");
        assert!(
            napi_mock::read_external(result.raw()).is_some(),
            "Expected an external handle"
        );

        unsafe {
            glib::gobject_ffi::g_boxed_free(type_.into_glib(), ptr);
        }
    });
}

#[test]
fn glist_with_string_items() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let s1 = std::ffi::CString::new("hello").unwrap();
        let s2 = std::ffi::CString::new("world").unwrap();

        let mut list: *mut glib::ffi::GList = std::ptr::null_mut();
        list = unsafe { glib::ffi::g_list_append(list, s1.as_ptr() as *mut c_void) };
        list = unsafe { glib::ffi::g_list_append(list, s2.as_ptr() as *mut c_void) };

        let items = decode_array(
            &env,
            &string_array_type_of(Ownership::Borrowed, Ownership::Borrowed, ArrayKind::GList),
            list as *mut c_void,
        );
        assert_eq!(items.len(), 2);
        assert_string_item(&items, 0, "hello");
        assert_string_item(&items, 1, "world");

        unsafe {
            glib::ffi::g_list_free(list);
        }
    });
}

#[test]
fn result_to_ptr_returns_handle_pointer_for_object() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, handle) = new_gobject_handle();

        let unknown = External::new(handle).into_unknown(&env).unwrap();
        let codec = gobject_type_of(Ownership::Borrowed);
        assert_eq!(
            helpers::write_return_into_slot(&env, &codec, &Ok(unknown)),
            obj_ptr
        );
    });
}

#[test]
fn result_to_ptr_returns_null_for_non_object_ok() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let value = napi_mock::to_unknown(&env, napi_mock::fake_double(7.0));
        let codec = gobject_type_of(Ownership::Borrowed);
        assert!(helpers::write_return_into_slot(&env, &codec, &Ok(value)).is_null());
    });
}

#[test]
fn result_to_ptr_returns_null_for_err() {
    helpers::run(|| {
        helpers::assert_write_return_err_writes_null(&gobject_type_of(Ownership::Borrowed));
    });
}

#[test]
fn object_ptr_returns_handle_pointer() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr, handle) = new_gobject_handle();

        let unknown = External::new(handle).into_unknown(&env).unwrap();
        assert_eq!(
            native::ffi::value::handle_ptr(&env, unknown, "GObject").unwrap(),
            obj_ptr
        );
    });
}

#[test]
fn object_ptr_returns_null_for_null_and_undefined() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let null_value = napi_mock::to_unknown(&env, napi_mock::fake_null());
        let undefined_value = napi_mock::to_unknown(&env, napi_mock::fake_undefined());
        assert!(
            native::ffi::value::handle_ptr(&env, null_value, "GObject")
                .unwrap()
                .is_null()
        );
        assert!(
            native::ffi::value::handle_ptr(&env, undefined_value, "GObject")
                .unwrap()
                .is_null()
        );
    });
}

#[test]
fn object_ptr_errors_for_non_object_variants() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let samples = vec![
            napi_mock::to_unknown(&env, napi_mock::fake_double(1.0)),
            napi_mock::to_unknown(&env, napi_mock::fake_string("s")),
            napi_mock::to_unknown(&env, napi_mock::fake_bool(false)),
            napi_mock::to_unknown(&env, napi_mock::fake_array(&[])),
        ];
        for sample in samples {
            assert!(native::ffi::value::handle_ptr(&env, sample, "GObject").is_err());
        }
    });
}

#[test]
fn decode_with_context_decodes_integer() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let stash = ffi::Stash::I32(99);
        let codec = Codec::Integer(native::ffi::codec::IntegerCodec::I32);

        let result = codec
            .decode_with_context(&env, &stash, &[], &[])
            .expect("decode should succeed");

        assert_eq!(napi_mock::read_double(result.raw()), Some(99.0));
    });
}
