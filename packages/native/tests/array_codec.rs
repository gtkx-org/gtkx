use test_support as helpers;

use std::ffi::{CString, c_char, c_void};

use gtk4::glib;

use napi::Env;
use napi::JsValue as _;
use napi::bindgen_prelude::{External, Unknown};
use napi::sys;

use native::Handle;
use native::ffi::codec::{
    ArrayCodec, ArrayKind, BigIntCodec, BooleanCodec, Codec, Decoder, Encoder, EnumFlagsCodec,
    EnumFlagsKind, FloatCodec, FundamentalCodec, IntegerCodec, ObjectCodec, Ownership, PtrWriter,
    ReadSource, RefCodec, StringCodec, StructCodec,
};
use native::ffi::{GArrayData, ListData, ListPayload, Slot, Stash, StashData};

use helpers::{boxed_handle, napi_mock};

fn struct_item_codec() -> Codec {
    Codec::Struct(StructCodec {
        ownership: Ownership::Borrowed,
        size: Some(size_of::<gtk4::gdk::ffi::GdkRGBA>()),
        caller_allocated: false,
    })
}

fn string_item_codec(ownership: Ownership) -> Codec {
    Codec::String(StringCodec {
        ownership,
        length: None,
    })
}

fn enum_flags_item_codec() -> Codec {
    Codec::EnumFlags(EnumFlagsCodec {
        kind: EnumFlagsKind::Enum,
        shared_library: "Gtk".to_string(),
        get_type_fn_name: "gtk_orientation_get_type".to_string(),
        storage: IntegerCodec::I32,
    })
}

fn i32_zero_terminated(ownership: Ownership) -> ArrayCodec {
    array_codec(
        Codec::Integer(IntegerCodec::I32),
        ArrayKind::Array,
        ownership,
    )
}

fn u16_zero_terminated_full() -> ArrayCodec {
    array_codec(
        Codec::Integer(IntegerCodec::U16),
        ArrayKind::Array,
        Ownership::Full,
    )
}

fn array_codec(item: Codec, kind: ArrayKind, ownership: Ownership) -> ArrayCodec {
    ArrayCodec::new(Box::new(item), kind, ownership, None, None, None).expect("valid array codec")
}

fn sized_array_type(item: Codec, size_index: u32, ownership: Ownership) -> ArrayCodec {
    ArrayCodec::new(
        Box::new(item),
        ArrayKind::Sized,
        ownership,
        Some(size_index),
        None,
        None,
    )
    .expect("valid sized array codec")
}

fn fixed_array_type(item: Codec, size: u32, ownership: Ownership) -> ArrayCodec {
    ArrayCodec::new(
        Box::new(item),
        ArrayKind::Fixed,
        ownership,
        None,
        Some(size),
        None,
    )
    .expect("valid fixed array codec")
}

fn gobject_item_codec(ownership: Ownership) -> Codec {
    Codec::Object(ObjectCodec { ownership })
}

fn unresolvable_fundamental_item_codec() -> Codec {
    Codec::Fundamental(FundamentalCodec {
        ownership: Ownership::Full,
        shared_library: "libgobject-2.0.so.0".to_owned(),
        ref_fn_name: "no_such_array_ref_symbol_12345".to_owned(),
        unref_fn_name: "g_param_spec_unref".to_owned(),
    })
}

fn gobject_refcount(ptr: *mut std::ffi::c_void) -> u32 {
    unsafe { (*(ptr as *mut gtk4::glib::gobject_ffi::GObject)).ref_count }
}

fn new_gobject() -> (glib::Object, *mut c_void) {
    let obj = glib::Object::new::<glib::Object>();
    let ptr = glib::translate::ToGlibPtr::<*mut glib::gobject_ffi::GObject>::to_glib_none(&obj).0
        as *mut c_void;
    (obj, ptr)
}

fn number(value: f64) -> sys::napi_value {
    napi_mock::fake_double(value)
}

fn boolean(value: bool) -> sys::napi_value {
    napi_mock::fake_bool(value)
}

fn string(value: &str) -> sys::napi_value {
    napi_mock::fake_string(value)
}

fn bigint(value: i128) -> sys::napi_value {
    napi_mock::fake_bigint_i128(value)
}

fn object(env: &Env, handle: Handle) -> sys::napi_value {
    External::new(handle)
        .into_unknown(env)
        .expect("external into_unknown should succeed")
        .raw()
}

fn array<'e>(env: &'e Env, items: &[sys::napi_value]) -> Unknown<'e> {
    napi_mock::to_unknown(env, napi_mock::fake_array(items))
}

fn decoded_items(value: &Unknown<'_>) -> Vec<sys::napi_value> {
    napi_mock::read_array(value.raw()).expect("expected array")
}

fn assert_full_element_container_releases_on_drop(kind: ArrayKind, container: Ownership) {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr) = new_gobject();
        let before = gobject_refcount(obj_ptr);

        let descriptor = array_codec(gobject_item_codec(Ownership::Full), kind, container);
        let val = array(&env, &[object(&env, Handle::from_glib_borrow(obj_ptr))]);
        let encoded = descriptor.encode(&env, val).unwrap();
        assert_eq!(gobject_refcount(obj_ptr), before + 1);

        drop(encoded);
        assert_eq!(gobject_refcount(obj_ptr), before);
    });
}

fn assert_string_list_full_container_borrowed_elements_releases_spine(kind: ArrayKind) {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            kind,
            Ownership::Full,
        );
        let val = array(&env, &[string("kept")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let (items_duped, retained) = match storage.data() {
            StashData::List(ListData {
                payload:
                    ListPayload::Strings {
                        strings,
                        items_duped,
                    },
                ..
            }) => (*items_duped, strings.len()),
            other => panic!("expected string list storage, got {other:?}"),
        };
        assert!(!items_duped);
        assert_eq!(retained, 1);
        drop(encoded);
    });
}

#[test]
fn encode_glist_handles_full_ownership_releases_when_call_never_happens() {
    assert_full_element_container_releases_on_drop(ArrayKind::GList, Ownership::Full);
}

#[test]
fn encode_glist_handles_full_ownership_transfers_to_callee_when_disarmed() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr) = new_gobject();
        let before = gobject_refcount(obj_ptr);

        let descriptor = array_codec(
            gobject_item_codec(Ownership::Full),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = array(&env, &[object(&env, Handle::from_glib_borrow(obj_ptr))]);
        let encoded = descriptor.encode(&env, val).unwrap();
        encoded.disarm_pending_transfer();

        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let list = storage.ptr() as *mut gtk4::glib::ffi::GList;
        unsafe {
            gtk4::glib::ffi::g_list_free(list);
            gtk4::glib::gobject_ffi::g_object_unref(obj_ptr.cast());
        }
        drop(encoded);
        assert_eq!(gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn encode_glist_handles_releases_acquired_elements_when_later_element_is_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (_obj, obj_ptr) = new_gobject();
        let before = gobject_refcount(obj_ptr);

        let descriptor = array_codec(
            gobject_item_codec(Ownership::Full),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = array(
            &env,
            &[
                object(&env, Handle::from_glib_borrow(obj_ptr)),
                object(&env, Handle::from_glib_borrow(std::ptr::null_mut())),
            ],
        );
        assert!(descriptor.encode(&env, val).is_err());
        assert_eq!(gobject_refcount(obj_ptr), before);
    });
}

#[test]
fn encode_gslist_strings_full_container_releases_when_call_never_happens() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GSList,
            Ownership::Full,
        );
        let val = array(&env, &[string("foo")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        drop(encoded);
    });
}

#[test]
fn encode_garray_full_ownership_adopted_strings_release_when_call_never_happens() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let val = array(&env, &[string("foo")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        drop(encoded);
    });
}

#[test]
fn decode_with_context_sized_enum_flags_elements_without_range_guard() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = sized_array_type(enum_flags_item_codec(), 0, Ownership::Borrowed);
        let data: Vec<i32> = vec![0, 1, 2];
        let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
        let ffi_args = [Stash::U32(3)];
        let arg_codecs = [Codec::Integer(IntegerCodec::U32)];
        let decoded = descriptor
            .decode_with_context(&env, &stash, &ffi_args, &arg_codecs)
            .unwrap();
        let items = decoded_items(&decoded);
        assert_eq!(items.len(), 3);
        assert_eq!(napi_mock::read_double(items[2]), Some(2.0));
    });
}

#[test]
fn encode_optional_null_yields_null_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::Array,
            Ownership::Full,
        );
        match descriptor
            .encode(&env, napi_mock::to_unknown(&env, napi_mock::fake_null()))
            .unwrap()
        {
            Stash::Ptr(ptr) => assert!(ptr.is_null()),
            other => panic!("expected null ptr, got {other:?}"),
        }
        match descriptor
            .encode(
                &env,
                napi_mock::to_unknown(&env, napi_mock::fake_undefined()),
            )
            .unwrap()
        {
            Stash::Ptr(ptr) => assert!(ptr.is_null()),
            other => panic!("expected null ptr, got {other:?}"),
        }
    });
}

#[test]
fn encode_integer_array_extract_error() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = i32_zero_terminated(Ownership::Full);
        let val = array(&env, &[boolean(true)]);
        assert!(descriptor.encode(&env, val).is_err());
    });
}

#[test]
fn encode_enum_flags_array_roundtrips_through_storage() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(enum_flags_item_codec(), ArrayKind::Array, Ownership::Full);
        let val = array(&env, &[number(0.0), number(1.0)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const i32, 2) };
        assert_eq!(slice, &[0, 1]);
    });
}

#[test]
fn encode_float_f32_array_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Float(FloatCodec::F32),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = array(&env, &[number(1.5), number(2.5)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const f32, 2) };
        assert_eq!(slice, &[1.5f32, 2.5]);
    });
}

#[test]
fn encode_float_f64_array_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Float(FloatCodec::F64),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = array(&env, &[number(1.25)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const f64, 1) };
        assert_eq!(slice, &[1.25f64]);
    });
}

#[test]
fn encode_boolean_array_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Boolean(BooleanCodec),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = array(&env, &[boolean(true), boolean(false)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const i32, 2) };
        assert_eq!(slice, &[1, 0]);
    });
}

#[test]
fn encode_boolean_array_extract_error() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Boolean(BooleanCodec),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = array(&env, &[number(1.0)]);
        assert!(descriptor.encode(&env, val).is_err());
    });
}

#[test]
fn encode_string_array_extract_error() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = array(&env, &[number(1.0)]);
        assert!(descriptor.encode(&env, val).is_err());
    });
}

#[test]
fn encode_string_array_full_ownership_transfers_glib_container() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = array(&env, &[string("foo"), string("bar")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        encoded.disarm_pending_transfer();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };

        let container = storage.ptr() as *mut *mut std::ffi::c_char;
        let first = unsafe { std::ffi::CStr::from_ptr(*container) };
        let second = unsafe { std::ffi::CStr::from_ptr(*container.add(1)) };
        assert_eq!(first.to_str().unwrap(), "foo");
        assert_eq!(second.to_str().unwrap(), "bar");
        assert!(unsafe { (*container.add(2)).is_null() });

        unsafe { glib::ffi::g_strfreev(container) };
    });
}

#[test]
fn encode_string_array_full_ownership_releases_when_call_never_happens() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = array(&env, &[string("foo")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        drop(encoded);
    });
}

#[test]
fn encode_string_array_borrowed_container_and_elements_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::Array,
            Ownership::Borrowed,
        );
        let val = array(&env, &[string("foo")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        assert!(matches!(storage.data(), StashData::StrV(_)));

        let ptrs = unsafe {
            std::slice::from_raw_parts(storage.ptr() as *const *const std::ffi::c_char, 2)
        };
        let s = unsafe { std::ffi::CStr::from_ptr(ptrs[0]) };
        assert_eq!(s.to_str().unwrap(), "foo");
        assert!(ptrs[1].is_null());
    });
}

#[test]
fn encode_string_array_element_transfer_hands_over_duplicates() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::Array,
            Ownership::Borrowed,
        );
        let val = array(&env, &[string("foo")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        encoded.disarm_pending_transfer();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let StashData::StringArray(retained, ptrs) = storage.data() else {
            panic!("expected string array storage")
        };
        assert!(retained.is_empty());
        assert_eq!(ptrs.len(), 2);
        assert!(ptrs[1].is_null());

        let dup = unsafe { std::ffi::CStr::from_ptr(ptrs[0] as *const std::ffi::c_char) };
        assert_eq!(dup.to_str().unwrap(), "foo");
        unsafe { glib::ffi::g_free(ptrs[0]) };
    });
}

#[test]
fn encode_string_array_borrowed_keeps_elements() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = array(&env, &[string("foo")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let ptrs = unsafe {
            std::slice::from_raw_parts(storage.ptr() as *const *const std::ffi::c_char, 2)
        };
        let s = unsafe { std::ffi::CStr::from_ptr(ptrs[0]) };
        assert_eq!(s.to_str().unwrap(), "foo");
        assert!(ptrs[1].is_null());
    });
}

#[test]
fn encode_pointer_array_with_element_size_copies_into_buffer() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
        descriptor.element_size = Some(size_of::<gtk4::gdk::ffi::GdkRGBA>());
        let val = array(&env, &[object(&env, boxed_handle())]);
        let encoded = descriptor.encode(&env, val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn encode_pointer_array_with_element_size_rejects_null_handle() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
        descriptor.element_size = Some(8);
        let val = array(
            &env,
            &[object(&env, Handle::from_glib_borrow(std::ptr::null_mut()))],
        );
        assert!(descriptor.encode(&env, val).is_err());
    });
}

#[test]
fn encode_pointer_array_extract_error() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
        let val = array(&env, &[number(1.0)]);
        assert!(descriptor.encode(&env, val).is_err());
    });
}

#[test]
fn encode_pointer_array_full_ownership_transfers_glib_container() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
        let val = array(&env, &[object(&env, boxed_handle())]);
        let encoded = descriptor.encode(&env, val).unwrap();
        encoded.disarm_pending_transfer();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let StashData::ObjectArray(handles, ptrs) = storage.data() else {
            panic!("expected object array storage")
        };
        assert_eq!(handles.len(), 1);
        assert!(ptrs.is_empty());

        let container = storage.ptr() as *mut *mut std::ffi::c_void;
        assert!(!unsafe { *container }.is_null());
        assert!(unsafe { *container.add(1) }.is_null());

        unsafe { glib::ffi::g_free(container as *mut std::ffi::c_void) };
    });
}

#[test]
fn encode_pointer_array_null_terminated_with_handles() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Borrowed);
        let val = array(&env, &[object(&env, boxed_handle())]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let Stash::Storage(storage) = encoded else {
            panic!("expected storage")
        };
        let StashData::ObjectArray(_, ptrs) = storage.data() else {
            panic!("expected object array storage")
        };
        assert_eq!(ptrs.len(), 2);
        assert!(ptrs[1].is_null());
    });
}

#[test]
fn encode_pointer_array_null_terminated_empty_has_sentinel() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Borrowed);
        let encoded = descriptor.encode(&env, array(&env, &[])).unwrap();
        let Stash::Storage(storage) = encoded else {
            panic!("expected storage")
        };
        let StashData::ObjectArray(_, ptrs) = storage.data() else {
            panic!("expected object array storage")
        };
        assert_eq!(ptrs.len(), 1);
        assert!(ptrs[0].is_null());
    });
}

#[test]
fn encode_pointer_array_null_terminated_rejects_null_handle() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
        let val = array(
            &env,
            &[object(&env, Handle::from_glib_borrow(std::ptr::null_mut()))],
        );
        assert!(descriptor.encode(&env, val).is_err());
    });
}

#[test]
fn encode_glist_strings_full_ownership_dups_elements() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GList,
            Ownership::Borrowed,
        );
        let val = array(&env, &[string("a"), string("b")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn encode_glist_strings_borrowed_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::GList,
            Ownership::Borrowed,
        );
        let val = array(&env, &[string("a"), string("b")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn encode_glist_handles_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GList, Ownership::Borrowed);
        let val = array(&env, &[object(&env, boxed_handle())]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn encode_glist_handles_rejects_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GList, Ownership::Borrowed);
        let val = array(
            &env,
            &[object(&env, Handle::from_glib_borrow(std::ptr::null_mut()))],
        );
        assert!(descriptor.encode(&env, val).is_err());
    });
}

#[test]
fn encode_gslist_strings_full_ownership_dups_elements() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GSList,
            Ownership::Borrowed,
        );
        let val = array(&env, &[string("x"), string("y")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn encode_gslist_strings_borrowed_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::GSList,
            Ownership::Borrowed,
        );
        let val = array(&env, &[string("x"), string("y")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn encode_gslist_handles_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GSList, Ownership::Borrowed);
        let val = array(&env, &[object(&env, boxed_handle())]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn encode_gslist_handles_rejects_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GSList, Ownership::Borrowed);
        let val = array(
            &env,
            &[object(&env, Handle::from_glib_borrow(std::ptr::null_mut()))],
        );
        assert!(descriptor.encode(&env, val).is_err());
    });
}

#[test]
fn encode_gbytearray_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Borrowed,
        );
        let val = array(&env, &[number(1.0), number(2.0), number(255.0)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        assert_eq!(decoded_items(&decoded).len(), 3);
    });
}

#[test]
fn encode_garray_integer_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = array(&env, &[number(10.0), number(-20.0)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn encode_garray_float_f32_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Float(FloatCodec::F32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = array(&env, &[number(1.5)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn encode_garray_float_f64_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Float(FloatCodec::F64),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = array(&env, &[number(2.75)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn encode_garray_boolean_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Boolean(BooleanCodec),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = array(&env, &[boolean(true), boolean(false)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn encode_garray_enum_flags_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            enum_flags_item_codec(),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = array(&env, &[number(1.0)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn encode_garray_handles_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GArray, Ownership::Borrowed);
        let val = array(&env, &[object(&env, boxed_handle())]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn encode_garray_handles_rejects_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GArray, Ownership::Borrowed);
        let val = array(
            &env,
            &[object(&env, Handle::from_glib_borrow(std::ptr::null_mut()))],
        );
        assert!(descriptor.encode(&env, val).is_err());
    });
}

#[test]
fn encode_garray_strings_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = array(&env, &[string("hello")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn encode_garray_explicit_element_size_used() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let mut descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        descriptor.element_size = Some(size_of::<i32>());
        let val = array(&env, &[number(7.0)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

fn encode_scalar_storage(env: &Env, descriptor: &ArrayCodec, values: &[sys::napi_value]) -> Stash {
    descriptor
        .encode(env, array(env, values))
        .expect("scalar array encode should succeed")
}

macro_rules! assert_scalar_storage {
    ($encoded:expr, $variant:ident, $expected:expr) => {
        let Stash::Storage(storage) = &$encoded else {
            panic!("expected storage")
        };
        let StashData::$variant(items) = storage.data() else {
            panic!("expected {} storage", stringify!($variant))
        };
        assert_eq!(items.as_slice(), $expected);
    };
}

#[test]
fn encode_zero_terminated_integer_array_appends_terminator() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = u16_zero_terminated_full();
        let encoded = encode_scalar_storage(&env, &descriptor, &[number(1.0), number(2.0)]);
        assert_scalar_storage!(encoded, U16Vec, &[1u16, 2, 0]);
    });
}

#[test]
fn encode_zero_terminated_empty_integer_array_is_only_terminator() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = i32_zero_terminated(Ownership::Full);
        let encoded = encode_scalar_storage(&env, &descriptor, &[]);
        assert_scalar_storage!(encoded, I32Vec, &[0i32]);
    });
}

#[test]
fn encode_zero_terminated_enum_flags_array_appends_terminator() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(enum_flags_item_codec(), ArrayKind::Array, Ownership::Full);
        let encoded = encode_scalar_storage(&env, &descriptor, &[number(3.0), number(1.0)]);
        assert_scalar_storage!(encoded, I32Vec, &[3i32, 1, 0]);
    });
}

#[test]
fn encode_zero_terminated_float_array_appends_terminator() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let f32_descriptor = array_codec(
            Codec::Float(FloatCodec::F32),
            ArrayKind::Array,
            Ownership::Full,
        );
        let encoded = encode_scalar_storage(&env, &f32_descriptor, &[number(1.5), number(2.5)]);
        assert_scalar_storage!(encoded, F32Vec, &[1.5f32, 2.5, 0.0]);

        let f64_descriptor = array_codec(
            Codec::Float(FloatCodec::F64),
            ArrayKind::Array,
            Ownership::Full,
        );
        let encoded = encode_scalar_storage(&env, &f64_descriptor, &[number(1.25)]);
        assert_scalar_storage!(encoded, F64Vec, &[1.25f64, 0.0]);
    });
}

#[test]
fn encode_zero_terminated_boolean_array_appends_terminator() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Boolean(BooleanCodec),
            ArrayKind::Array,
            Ownership::Full,
        );
        let encoded = encode_scalar_storage(&env, &descriptor, &[boolean(true)]);
        assert_scalar_storage!(encoded, I32Vec, &[1i32, 0]);
    });
}

#[test]
fn encode_zero_terminated_bigint_array_appends_terminator() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let u64_descriptor = array_codec(
            Codec::BigInt(BigIntCodec::U64),
            ArrayKind::Array,
            Ownership::Full,
        );
        let encoded = encode_scalar_storage(&env, &u64_descriptor, &[bigint(5), bigint(9)]);
        assert_scalar_storage!(encoded, U64Vec, &[5u64, 9, 0]);

        let i64_descriptor = array_codec(
            Codec::BigInt(BigIntCodec::I64),
            ArrayKind::Array,
            Ownership::Full,
        );
        let encoded = encode_scalar_storage(&env, &i64_descriptor, &[bigint(-7)]);
        assert_scalar_storage!(encoded, I64Vec, &[-7i64, 0]);
    });
}

#[test]
fn encode_length_bounded_scalar_arrays_append_no_terminator() {
    helpers::run(|| {
        let env = helpers::fake_env();
        for descriptor in [
            sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed),
            fixed_array_type(Codec::Integer(IntegerCodec::I32), 1, Ownership::Borrowed),
        ] {
            let encoded = encode_scalar_storage(&env, &descriptor, &[number(7.0)]);
            assert_scalar_storage!(encoded, I32Vec, &[7i32]);
        }
    });
}

fn assert_decodes_to_seven_eight_nine(env: &Env, descriptor: &ArrayCodec, ptr: *mut c_void) {
    let decoded = descriptor
        .decode(env, &Stash::Ptr(ptr))
        .expect("zero-terminated scalar decode should succeed");
    let items = decoded_items(&decoded);
    assert_eq!(items.len(), 3);
    assert_eq!(napi_mock::read_double(items[0]), Some(7.0));
    assert_eq!(napi_mock::read_double(items[2]), Some(9.0));
}

#[test]
fn zero_terminated_scalar_array_roundtrips_through_encode_and_decode() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = i32_zero_terminated(Ownership::Borrowed);
        let encoded =
            encode_scalar_storage(&env, &descriptor, &[number(7.0), number(8.0), number(9.0)]);
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        assert_decodes_to_seven_eight_nine(&env, &descriptor, storage.ptr());
    });
}

#[test]
fn decode_zero_terminated_scalar_array_reads_with_scalar_stride() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = i32_zero_terminated(Ownership::Borrowed);
        let buffer: [i32; 4] = [7, 8, 9, 0];
        assert_decodes_to_seven_eight_nine(&env, &descriptor, buffer.as_ptr() as *mut c_void);
    });
}

#[test]
fn encode_bigint_array_roundtrips_through_storage() {
    helpers::run(|| {
        let env = helpers::fake_env();
        for kind in [BigIntCodec::I64, BigIntCodec::U64] {
            let descriptor = array_codec(Codec::BigInt(kind), ArrayKind::Array, Ownership::Full);
            let big = i128::from(u32::MAX) + 1;
            let val = array(&env, &[bigint(big), bigint(7)]);
            let encoded = descriptor.encode(&env, val).unwrap();
            let Stash::Storage(storage) = &encoded else {
                panic!("expected storage")
            };
            match kind {
                BigIntCodec::I64 => {
                    let slice =
                        unsafe { std::slice::from_raw_parts(storage.ptr() as *const i64, 2) };
                    assert_eq!(slice, &[big as i64, 7]);
                }
                BigIntCodec::U64 => {
                    let slice =
                        unsafe { std::slice::from_raw_parts(storage.ptr() as *const u64, 2) };
                    assert_eq!(slice, &[big as u64, 7]);
                }
            }
        }
    });
}

#[test]
fn encode_garray_bigint_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        for kind in [BigIntCodec::I64, BigIntCodec::U64] {
            let descriptor =
                array_codec(Codec::BigInt(kind), ArrayKind::GArray, Ownership::Borrowed);
            let big = i128::from(u32::MAX) + 5;
            let val = array(&env, &[bigint(10), bigint(big)]);
            let encoded = descriptor.encode(&env, val).unwrap();
            let decoded = descriptor.decode(&env, &encoded).unwrap();
            let items = decoded_items(&decoded);
            assert_eq!(items.len(), 2);
            assert_eq!(napi_mock::read_bigint_i128(items[1]), Some(big));
        }
    });
}

#[test]
fn decode_contiguous_bigint_elements() {
    helpers::run(|| {
        let env = helpers::fake_env();
        for kind in [BigIntCodec::I64, BigIntCodec::U64] {
            let descriptor = fixed_array_type(Codec::BigInt(kind), 2, Ownership::Borrowed);
            let data: Vec<i64> = vec![100, 42];
            let decoded = descriptor
                .decode_with_context(&env, &Stash::Ptr(data.as_ptr() as *mut c_void), &[], &[])
                .unwrap();
            let items = decoded_items(&decoded);
            assert_eq!(items.len(), 2);
            assert_eq!(napi_mock::read_bigint_i128(items[1]), Some(42));
        }
    });
}

#[test]
fn decode_zero_terminated_bigint_array() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::BigInt(BigIntCodec::U64),
            ArrayKind::Array,
            Ownership::Borrowed,
        );
        let buffer: [u64; 3] = [5, 9, 0];
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(buffer.as_ptr() as *mut c_void))
            .expect("zero-terminated bigint decode should succeed");
        let items = decoded_items(&decoded);
        assert_eq!(items.len(), 2);
        assert_eq!(napi_mock::read_bigint_i128(items[0]), Some(5));
    });
}

#[test]
fn encode_bigint_array_rejects_out_of_range() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let neg = array_codec(
            Codec::BigInt(BigIntCodec::U64),
            ArrayKind::Array,
            Ownership::Full,
        );
        assert!(neg.encode(&env, array(&env, &[bigint(-1)])).is_err());

        let over = array_codec(
            Codec::BigInt(BigIntCodec::I64),
            ArrayKind::Array,
            Ownership::Full,
        );
        assert!(
            over.encode(&env, array(&env, &[bigint(i128::from(i64::MAX) + 1)]))
                .is_err()
        );
    });
}

#[test]
fn decode_gptrarray_frees_container_when_element_decode_fails() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        unsafe { glib::ffi::g_ptr_array_add(ptr_array, std::ptr::without_provenance_mut(0x4)) };
        unsafe { glib::ffi::g_ptr_array_ref(ptr_array) };

        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GPtrArray,
            Ownership::Full,
        );
        assert!(
            descriptor
                .decode(&env, &Stash::Ptr(ptr_array as *mut std::ffi::c_void))
                .is_err()
        );

        unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
    });
}

#[test]
fn decode_glist_frees_spine_when_element_decode_fails() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let list = unsafe {
            glib::ffi::g_list_append(std::ptr::null_mut(), std::ptr::without_provenance_mut(0x4))
        };

        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GList,
            Ownership::Full,
        );
        assert!(
            descriptor
                .decode(&env, &Stash::Ptr(list as *mut std::ffi::c_void))
                .is_err()
        );
    });
}

#[test]
fn encode_garray_append_error_unrefs_and_propagates() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = array(&env, &[boolean(true)]);
        assert!(descriptor.encode(&env, val).is_err());
    });
}

#[test]
fn encode_gptrarray_uses_null_terminated_layout() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GPtrArray, Ownership::Full);
        let val = array(&env, &[object(&env, boxed_handle())]);
        let encoded = descriptor.encode(&env, val).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn encode_integer_array_into_storage() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = u16_zero_terminated_full();
        let encoded = descriptor
            .encode(&env, array(&env, &[number(1.0), number(2.0)]))
            .unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const u16, 2) };
        assert_eq!(slice, &[1u16, 2]);
    });
}

#[test]
fn decode_null_ptr_yields_empty_array() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::Array,
            Ownership::Full,
        );
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(std::ptr::null_mut()))
            .unwrap();
        assert!(decoded_items(&decoded).is_empty());
    });
}

#[test]
fn decode_null_terminated_string_array_from_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::Array,
            Ownership::Borrowed,
        );
        let s0 = CString::new("first").unwrap();
        let s1 = CString::new("second").unwrap();
        let mut ptrs: Vec<*const c_char> = vec![s0.as_ptr(), s1.as_ptr(), std::ptr::null()];
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(ptrs.as_mut_ptr() as *mut c_void))
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn decode_null_terminated_string_array_full_ownership_frees() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::Array,
            Ownership::Full,
        );
        let strv = unsafe {
            let arr = glib::ffi::g_malloc0(size_of::<*mut c_char>() * 3) as *mut *mut c_char;
            *arr = glib::ffi::g_strdup(c"a".as_ptr());
            *arr.add(1) = glib::ffi::g_strdup(c"b".as_ptr());
            arr
        };
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(strv as *mut c_void))
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn decode_null_terminated_borrowed_string_array_full_ownership_frees_vector_only() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::Array,
            Ownership::Full,
        );
        let strv = unsafe {
            let arr = glib::ffi::g_malloc0(size_of::<*mut c_char>() * 2) as *mut *mut c_char;
            *arr = c"borrowed".as_ptr().cast_mut();
            arr
        };
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(strv as *mut c_void))
            .unwrap();
        let items = decoded_items(&decoded);
        assert_eq!(
            napi_mock::read_string(items[0]),
            Some("borrowed".to_string())
        );
    });
}

#[test]
fn decode_null_terminated_ptr_array_from_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Borrowed);
        let h0 = boxed_handle();
        let h1 = boxed_handle();
        let mut ptrs: Vec<*mut c_void> = vec![h0.as_ptr(), h1.as_ptr(), std::ptr::null_mut()];
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(ptrs.as_mut_ptr() as *mut c_void))
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn decode_null_terminated_ptr_array_full_ownership_frees() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
        let arr = unsafe {
            let mem = glib::ffi::g_malloc0(size_of::<*mut c_void>() * 2) as *mut *mut c_void;
            *mem = boxed_handle().as_ptr();
            mem
        };
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(arr as *mut c_void))
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn decode_glist_empty_and_populated() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GList, Ownership::Full);
        let empty = descriptor
            .decode(&env, &Stash::Ptr(std::ptr::null_mut()))
            .unwrap();
        assert!(decoded_items(&empty).is_empty());

        let list =
            unsafe { glib::ffi::g_list_append(std::ptr::null_mut(), boxed_handle().as_ptr()) };
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(list as *mut c_void))
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn decode_gslist_full_ownership_frees_list() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GSList, Ownership::Full);
        let list =
            unsafe { glib::ffi::g_slist_append(std::ptr::null_mut(), boxed_handle().as_ptr()) };
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(list as *mut c_void))
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn decode_garray_from_borrowed_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let value: i32 = 42;
        unsafe {
            glib::ffi::g_array_append_vals(g_array, &value as *const i32 as *const c_void, 1);
        }
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(g_array as *mut c_void))
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn decode_garray_null_yields_empty() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(std::ptr::null_mut()))
            .unwrap();
        assert!(decoded_items(&decoded).is_empty());
    });
}

#[test]
fn decode_garray_storage_owned_does_not_double_free() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Full,
        );
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let storage = native::ffi::StashStorage::new(
            g_array as *mut c_void,
            native::ffi::StashData::GArray(GArrayData {
                ptr: g_array,
                should_free: true,
            }),
        );
        let decoded = descriptor.decode(&env, &Stash::Storage(storage)).unwrap();
        assert!(decoded_items(&decoded).is_empty());
    });
}

#[test]
fn decode_gptrarray_from_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GPtrArray, Ownership::Full);
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        unsafe { glib::ffi::g_ptr_array_add(ptr_array, boxed_handle().as_ptr()) };
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(ptr_array as *mut c_void))
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn decode_gptrarray_null_yields_empty() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GPtrArray, Ownership::Full);
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(std::ptr::null_mut()))
            .unwrap();
        assert!(decoded_items(&decoded).is_empty());
    });
}

#[test]
fn decode_gbytearray_from_ptr_and_empty() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Borrowed,
        );
        let bytes = [1u8, 2, 3];
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(3);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 3);
            ba
        };
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(ba as *mut c_void))
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 3);
        unsafe { glib::ffi::g_byte_array_unref(ba) };

        let empty = unsafe { glib::ffi::g_byte_array_new() };
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(empty as *mut c_void))
            .unwrap();
        assert!(decoded_items(&decoded).is_empty());
        unsafe { glib::ffi::g_byte_array_unref(empty) };
    });
}

#[test]
fn decode_gbytearray_full_ownership_unrefs_raw_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Full,
        );
        let bytes = [7u8, 8];
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(2);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 2);
            glib::ffi::g_byte_array_ref(ba)
        };
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(ba as *mut c_void))
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
        unsafe { glib::ffi::g_byte_array_unref(ba) };
    });
}

#[test]
fn decode_gbytearray_null_yields_empty() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Full,
        );
        let decoded = descriptor
            .decode(&env, &Stash::Ptr(std::ptr::null_mut()))
            .unwrap();
        assert!(decoded_items(&decoded).is_empty());
    });
}

#[test]
fn decode_with_context_sized_array() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor =
            sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
        let data: Vec<i32> = vec![5, 6, 7];
        let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
        let ffi_args = [Stash::U32(3)];
        let arg_codecs = [Codec::Integer(IntegerCodec::U32)];
        let decoded = descriptor
            .decode_with_context(&env, &stash, &ffi_args, &arg_codecs)
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 3);
    });
}

#[test]
fn decode_with_context_sized_array_null_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor =
            sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
        let stash = Stash::Ptr(std::ptr::null_mut());
        let ffi_args = [Stash::U32(3)];
        let arg_codecs = [Codec::Integer(IntegerCodec::U32)];
        let decoded = descriptor
            .decode_with_context(&env, &stash, &ffi_args, &arg_codecs)
            .unwrap();
        assert!(decoded_items(&decoded).is_empty());
    });
}

#[test]
fn decode_with_context_sized_rejects_non_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor =
            sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
        let storage = native::ffi::StashStorage::from(vec![1i32, 2]);
        let stash = Stash::Storage(storage);
        let ffi_args = [Stash::U32(2)];
        let arg_codecs = [Codec::Integer(IntegerCodec::U32)];
        assert!(
            descriptor
                .decode_with_context(&env, &stash, &ffi_args, &arg_codecs)
                .is_err()
        );
    });
}

#[test]
fn decode_with_context_fixed_array() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = fixed_array_type(Codec::Float(FloatCodec::F64), 2, Ownership::Borrowed);
        let data: Vec<f64> = vec![1.0, 2.0];
        let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
        let decoded = descriptor
            .decode_with_context(&env, &stash, &[], &[])
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn decode_with_context_fixed_array_null_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = fixed_array_type(Codec::Float(FloatCodec::F64), 2, Ownership::Borrowed);
        let stash = Stash::Ptr(std::ptr::null_mut());
        let decoded = descriptor
            .decode_with_context(&env, &stash, &[], &[])
            .unwrap();
        assert!(decoded_items(&decoded).is_empty());
    });
}

#[test]
fn decode_with_context_fixed_rejects_non_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor =
            fixed_array_type(Codec::Integer(IntegerCodec::I32), 1, Ownership::Borrowed);
        let storage = native::ffi::StashStorage::from(vec![9i32]);
        assert!(
            descriptor
                .decode_with_context(&env, &Stash::Storage(storage), &[], &[])
                .is_err()
        );
    });
}

#[test]
fn decode_with_context_array_kind_rejects_non_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = i32_zero_terminated(Ownership::Borrowed);
        let storage = native::ffi::StashStorage::from(vec![1i32]);
        assert!(
            descriptor
                .decode_with_context(&env, &Stash::Storage(storage), &[], &[])
                .is_err()
        );
    });
}

#[test]
fn decode_contiguous_empty_and_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor =
            fixed_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
        let data: Vec<i32> = vec![1];
        let decoded = descriptor
            .decode_with_context(&env, &Stash::Ptr(data.as_ptr() as *mut c_void), &[], &[])
            .unwrap();
        assert!(decoded_items(&decoded).is_empty());
    });
}

#[test]
fn decode_contiguous_pointer_elements() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = fixed_array_type(struct_item_codec(), 1, Ownership::Borrowed);
        let handle = boxed_handle();
        let data: Vec<*mut c_void> = vec![handle.as_ptr()];
        let decoded = descriptor
            .decode_with_context(&env, &Stash::Ptr(data.as_ptr() as *mut c_void), &[], &[])
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn decode_contiguous_float_and_boolean() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let f32_ty = fixed_array_type(Codec::Float(FloatCodec::F32), 1, Ownership::Borrowed);
        let f32_data: Vec<f32> = vec![1.5];
        let f32_decoded = f32_ty
            .decode_with_context(
                &env,
                &Stash::Ptr(f32_data.as_ptr() as *mut c_void),
                &[],
                &[],
            )
            .unwrap();
        assert!(napi_mock::read_array(f32_decoded.raw()).is_some());

        let bool_ty = fixed_array_type(Codec::Boolean(BooleanCodec), 1, Ownership::Borrowed);
        let bool_data: Vec<i32> = vec![1];
        let bool_decoded = bool_ty
            .decode_with_context(
                &env,
                &Stash::Ptr(bool_data.as_ptr() as *mut c_void),
                &[],
                &[],
            )
            .unwrap();
        assert!(napi_mock::read_array(bool_decoded.raw()).is_some());
    });
}

#[test]
fn encode_storage_pointer_elements() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
        let encoded = descriptor
            .encode(&env, array(&env, &[object(&env, boxed_handle())]))
            .unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let ptrs = unsafe { std::slice::from_raw_parts(storage.ptr() as *const *mut c_void, 2) };
        assert!(!ptrs[0].is_null());
        assert!(ptrs[1].is_null());
    });
}

#[test]
fn ptr_to_value_null_yields_empty() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = i32_zero_terminated(Ownership::Borrowed);
        let value =
            unsafe { descriptor.read(&env, ReadSource::Value(std::ptr::null_mut(), "array")) }
                .unwrap();
        assert!(decoded_items(&value).is_empty());
    });
}

#[test]
fn ptr_to_value_gptrarray() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            struct_item_codec(),
            ArrayKind::GPtrArray,
            Ownership::Borrowed,
        );
        let ptr_array = unsafe { glib::ffi::g_ptr_array_new() };
        unsafe { glib::ffi::g_ptr_array_add(ptr_array, boxed_handle().as_ptr()) };
        let value =
            unsafe { descriptor.read(&env, ReadSource::Value(ptr_array as *mut c_void, "array")) }
                .unwrap();
        assert_eq!(decoded_items(&value).len(), 1);
        unsafe { glib::ffi::g_ptr_array_unref(ptr_array) };
    });
}

#[test]
fn ptr_to_value_gbytearray() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Borrowed,
        );
        let bytes = [9u8];
        let ba = unsafe {
            let ba = glib::ffi::g_byte_array_sized_new(1);
            glib::ffi::g_byte_array_append(ba, bytes.as_ptr(), 1);
            ba
        };
        let value = unsafe { descriptor.read(&env, ReadSource::Value(ba as *mut c_void, "array")) }
            .unwrap();
        assert_eq!(decoded_items(&value).len(), 1);
        unsafe { glib::ffi::g_byte_array_unref(ba) };
    });
}

#[test]
fn ptr_to_value_garray() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::I32),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let g_array = unsafe { glib::ffi::g_array_sized_new(0, 0, size_of::<i32>() as u32, 0) };
        let value: i32 = 1;
        unsafe {
            glib::ffi::g_array_append_vals(g_array, &value as *const i32 as *const c_void, 1)
        };
        let decoded =
            unsafe { descriptor.read(&env, ReadSource::Value(g_array as *mut c_void, "array")) }
                .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
        unsafe { glib::ffi::g_array_unref(g_array) };
    });
}

#[test]
fn ptr_to_value_glist() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::GList, Ownership::Borrowed);
        let list =
            unsafe { glib::ffi::g_list_append(std::ptr::null_mut(), boxed_handle().as_ptr()) };
        let decoded =
            unsafe { descriptor.read(&env, ReadSource::Value(list as *mut c_void, "array")) }
                .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
        unsafe { glib::ffi::g_list_free(list) };
    });
}

#[test]
fn ptr_to_value_plain_array() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Borrowed);
        let h0 = boxed_handle();
        let mut data: Vec<*mut c_void> = vec![h0.as_ptr(), std::ptr::null_mut()];
        let decoded = unsafe {
            descriptor.read(
                &env,
                ReadSource::Value(data.as_mut_ptr() as *mut c_void, "array"),
            )
        }
        .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 1);
    });
}

#[test]
fn size_from_args_reads_integer_argument() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor =
            sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
        let data: Vec<i32> = vec![10, 20];
        let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
        let ffi_args = [Stash::I32(2)];
        let arg_codecs = [Codec::Integer(IntegerCodec::I32)];
        let decoded = descriptor
            .decode_with_context(&env, &stash, &ffi_args, &arg_codecs)
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn size_from_args_reads_ref_integer_storage() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor =
            sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
        let data: Vec<i32> = vec![10, 20];
        let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
        let size_storage = native::ffi::StashStorage::from(vec![2i32]);
        let ffi_args = [Stash::Storage(size_storage)];
        let arg_codecs = [Codec::Ref(
            RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("valid Ref inner"),
        )];
        let decoded = descriptor
            .decode_with_context(&env, &stash, &ffi_args, &arg_codecs)
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn size_from_args_reads_ref_integer_ptr() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor =
            sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
        let data: Vec<i32> = vec![10, 20];
        let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
        let size: i32 = 2;
        let ffi_args = [Stash::Ptr(&size as *const i32 as *mut c_void)];
        let arg_codecs = [Codec::Ref(
            RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("valid Ref inner"),
        )];
        let decoded = descriptor
            .decode_with_context(&env, &stash, &ffi_args, &arg_codecs)
            .unwrap();
        assert_eq!(decoded_items(&decoded).len(), 2);
    });
}

#[test]
fn size_from_args_ref_null_ptr_falls_through_to_error() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor =
            sized_array_type(Codec::Integer(IntegerCodec::I32), 0, Ownership::Borrowed);
        let data: Vec<i32> = vec![1];
        let stash = Stash::Ptr(data.as_ptr() as *mut c_void);
        let ffi_args = [Stash::Ptr(std::ptr::null_mut())];
        let arg_codecs = [Codec::Ref(
            RefCodec::new(Codec::Integer(IntegerCodec::I32)).expect("valid Ref inner"),
        )];
        assert!(
            descriptor
                .decode_with_context(&env, &stash, &ffi_args, &arg_codecs)
                .is_err()
        );
    });
}

#[test]
fn item_codec_resolves_pointer_kinds() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Full);
        let encoded = descriptor.encode(&env, array(&env, &[])).unwrap();
        assert!(matches!(encoded, Stash::Storage(_)));
    });
}

#[test]
fn trait_methods_delegate_to_inherent_implementations() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = i32_zero_terminated(Ownership::Borrowed);

        let encoded = Encoder::encode(&descriptor, &env, array(&env, &[number(1.0)])).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let slice = unsafe { std::slice::from_raw_parts(storage.ptr() as *const i32, 1) };
        assert_eq!(slice, &[1]);

        let ptr_ty = array_codec(struct_item_codec(), ArrayKind::Array, Ownership::Borrowed);
        let h0 = boxed_handle();
        let mut data: Vec<*mut c_void> = vec![h0.as_ptr(), std::ptr::null_mut()];
        let from_ptr = unsafe {
            Decoder::read(
                &ptr_ty,
                &env,
                ReadSource::Value(data.as_mut_ptr() as *mut c_void, "ctx"),
            )
        }
        .unwrap();
        assert_eq!(decoded_items(&from_ptr).len(), 1);
    });
}

#[test]
fn encode_string_array_dup_elements_failure_frees_earlier_duplicates() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::Array,
            Ownership::Borrowed,
        );
        let val = array(&env, &[string("first"), number(2.0)]);
        let err = descriptor
            .encode(&env, val)
            .expect_err("a non-string element after a duplicated one must fail");
        assert!(err.to_string().contains("Expected a String"));
    });
}

#[test]
fn encode_pointer_array_borrowed_container_full_elements_releases_when_call_never_happens() {
    assert_full_element_container_releases_on_drop(ArrayKind::Array, Ownership::Borrowed);
}

#[test]
fn encode_glist_handles_borrowed_container_full_elements_releases_when_call_never_happens() {
    assert_full_element_container_releases_on_drop(ArrayKind::GList, Ownership::Borrowed);
}

#[test]
fn encode_gslist_handles_borrowed_container_full_elements_releases_when_call_never_happens() {
    assert_full_element_container_releases_on_drop(ArrayKind::GSList, Ownership::Borrowed);
}

#[test]
fn encode_gslist_handles_full_ownership_releases_when_call_never_happens() {
    assert_full_element_container_releases_on_drop(ArrayKind::GSList, Ownership::Full);
}

#[test]
fn encode_glist_handles_fails_and_unwinds_when_element_transfer_fails() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let pspec = helpers::make_bool_param_spec();
        let before = helpers::param_spec_refcount(pspec);

        let descriptor = array_codec(
            unresolvable_fundamental_item_codec(),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = array(&env, &[object(&env, Handle::from_glib_borrow(pspec))]);
        helpers::assert_unresolvable_symbol_failure_keeps_param_spec(
            pspec,
            before,
            descriptor.encode(&env, val).map(|_| ()),
            "an unresolvable element ref function must fail the transfer",
        );
    });
}

#[test]
fn encode_glist_strings_full_container_full_elements_releases_when_call_never_happens() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::GList,
            Ownership::Full,
        );
        let val = array(&env, &[string("a"), string("b")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        let StashData::List(data) = storage.data() else {
            panic!("expected string glist storage")
        };
        let ListPayload::Strings { items_duped, .. } = &data.payload else {
            panic!("expected string payload")
        };
        assert!(*items_duped);
        assert!(!data.should_free);
        let first = unsafe {
            std::ffi::CStr::from_ptr((*(data.ptr as *mut glib::ffi::GList)).data as *const c_char)
        };
        assert_eq!(first.to_str().unwrap(), "a");
        drop(encoded);
    });
}

#[test]
fn encode_glist_strings_full_container_borrowed_elements_releases_spine_when_call_never_happens() {
    assert_string_list_full_container_borrowed_elements_releases_spine(ArrayKind::GList);
}

#[test]
fn encode_gslist_strings_full_container_borrowed_elements_releases_spine_when_call_never_happens() {
    assert_string_list_full_container_borrowed_elements_releases_spine(ArrayKind::GSList);
}

#[test]
fn encode_gbytearray_full_ownership_releases_when_call_never_happens() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            Codec::Integer(IntegerCodec::U8),
            ArrayKind::GByteArray,
            Ownership::Full,
        );
        let val = array(&env, &[number(1.0), number(2.0)]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let Stash::Storage(storage) = &encoded else {
            panic!("expected storage")
        };
        assert!(!storage.ptr().is_null());
        assert!(matches!(storage.data(), StashData::GByteArray(None)));
        drop(encoded);
    });
}

#[test]
fn encode_garray_borrowed_strings_installs_clear_func_and_roundtrips() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Borrowed),
            ArrayKind::GArray,
            Ownership::Borrowed,
        );
        let val = array(&env, &[string("hello"), string("world")]);
        let encoded = descriptor.encode(&env, val).unwrap();
        let decoded = descriptor.decode(&env, &encoded).unwrap();
        let items = decoded_items(&decoded);
        assert_eq!(napi_mock::read_string(items[0]), Some("hello".to_string()));
        assert_eq!(napi_mock::read_string(items[1]), Some("world".to_string()));
        drop(encoded);
    });
}

#[test]
fn decode_zero_terminated_scalar_array_full_ownership_frees_buffer() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = i32_zero_terminated(Ownership::Full);
        let buffer = unsafe {
            let mem = glib::ffi::g_malloc0(size_of::<i32>() * 4) as *mut i32;
            *mem = 7;
            *mem.add(1) = 8;
            *mem.add(2) = 9;
            mem
        };
        assert_decodes_to_seven_eight_nine(&env, &descriptor, buffer as *mut c_void);
    });
}

#[test]
fn write_return_to_pointer_full_string_array_hands_caller_owned_container() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::Array,
            Ownership::Full,
        );
        let val = array(&env, &[string("alpha"), string("beta")]);
        let mut slot: *mut c_void = std::ptr::null_mut();
        let ret = &mut slot as *mut *mut c_void as *mut c_void;
        PtrWriter::write_return_to_ptr(&descriptor, &env, unsafe { Slot::new(ret) }, &Ok(val));
        assert!(!slot.is_null());
        let strv = unsafe { glib::StrV::from_glib_full(slot as *mut *mut c_char) };
        let items: Vec<String> = strv
            .iter()
            .map(|item| unsafe { glib::GStr::from_ptr_lossy(item.as_ptr()) }.to_string())
            .collect();
        assert_eq!(items, vec!["alpha".to_string(), "beta".to_string()]);
    });
}

#[test]
fn write_return_to_pointer_null_err_and_non_array_write_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = array_codec(
            string_item_codec(Ownership::Full),
            ArrayKind::Array,
            Ownership::Full,
        );
        let mut slot: *mut c_void = 7 as *mut c_void;
        let ret = &mut slot as *mut *mut c_void as *mut c_void;
        let null_val: Result<Unknown, ()> = Ok(napi_mock::to_unknown(&env, napi_mock::fake_null()));
        PtrWriter::write_return_to_ptr(&descriptor, &env, unsafe { Slot::new(ret) }, &null_val);
        assert!(slot.is_null());

        slot = 7 as *mut c_void;
        let err_val: Result<Unknown, ()> = Err(());
        PtrWriter::write_return_to_ptr(&descriptor, &env, unsafe { Slot::new(ret) }, &err_val);
        assert!(slot.is_null());

        slot = 7 as *mut c_void;
        let num_val: Result<Unknown, ()> =
            Ok(napi_mock::to_unknown(&env, napi_mock::fake_double(1.0)));
        PtrWriter::write_return_to_ptr(&descriptor, &env, unsafe { Slot::new(ret) }, &num_val);
        assert!(slot.is_null());
    });
}

#[test]
fn write_return_to_pointer_encode_error_writes_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let descriptor = i32_zero_terminated(Ownership::Full);
        let val = array(&env, &[string("not a number")]);
        let mut slot: *mut c_void = 7 as *mut c_void;
        let ret = &mut slot as *mut *mut c_void as *mut c_void;
        PtrWriter::write_return_to_ptr(&descriptor, &env, unsafe { Slot::new(ret) }, &Ok(val));
        assert!(slot.is_null());
    });
}
