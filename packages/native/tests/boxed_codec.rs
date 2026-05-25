//! Coverage tests for [`native::types::BoxedType`] and
//! [`native::types::StructType`] codec implementations.

mod common;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::{FromGlib as _, IntoGlib as _, ToGlibPtrMut as _};
use gtk4::prelude::StaticType as _;

use native::ffi;
use native::managed::NativeHandle;
use native::types::{
    BoxedType, FfiDecoder, FfiEncoder, GlibValueCodec, Ownership, RawPtrCodec, StructType,
};
use native::value::Value;

fn rgba_type_name() -> String {
    gdk::RGBA::static_type().name().to_string()
}

fn boxed(ownership: Ownership) -> BoxedType {
    BoxedType {
        ownership,
        type_name: rgba_type_name(),
        library: None,
        get_type_fn: None,
        free_fn: None,
    }
}

fn struct_type(ownership: Ownership, size: Option<usize>) -> StructType {
    StructType {
        ownership,
        type_name: "PlainStruct".to_owned(),
        size,
    }
}

#[test]
fn gtype_resolves_from_registered_name() {
    common::run(|| {
        let resolved = boxed(Ownership::Borrowed).gtype();
        assert_eq!(resolved, Some(gdk::RGBA::static_type()));
    });
}

#[test]
fn gtype_resolves_via_library_lookup() {
    common::run(|| {
        let bytes_type = BoxedType {
            ownership: Ownership::Borrowed,
            type_name: "GBytes".to_owned(),
            library: Some("libgobject-2.0.so.0".to_owned()),
            get_type_fn: Some("g_bytes_get_type".to_owned()),
            free_fn: None,
        };
        let resolved = bytes_type.gtype();
        assert_eq!(resolved, Some(glib::Bytes::static_type()));
    });
}

#[test]
fn gtype_unknown_without_library_yields_none() {
    common::run(|| {
        let unknown = BoxedType {
            ownership: Ownership::Borrowed,
            type_name: "CompletelyUnknownBoxed".to_owned(),
            library: None,
            get_type_fn: None,
            free_fn: None,
        };
        assert!(unknown.gtype().is_none());
    });
}

#[test]
fn gtype_unknown_with_library_but_no_get_type_fn_yields_none() {
    common::run(|| {
        let unknown = BoxedType {
            ownership: Ownership::Borrowed,
            type_name: "AnotherUnknownBoxed".to_owned(),
            library: Some("libgobject-2.0.so.0".to_owned()),
            get_type_fn: None,
            free_fn: None,
        };
        assert!(unknown.gtype().is_none());
    });
}

#[test]
fn gtype_with_missing_symbol_reports_error_and_yields_none() {
    common::run(|| {
        let bad = BoxedType {
            ownership: Ownership::Borrowed,
            type_name: "BadSymbolBoxed".to_owned(),
            library: Some("libgobject-2.0.so.0".to_owned()),
            get_type_fn: Some("definitely_not_a_real_symbol_xyz".to_owned()),
            free_fn: None,
        };
        assert!(bad.gtype().is_none());
    });
}

#[test]
fn encode_full_copies_to_distinct_pointer() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let encoded = boxed(Ownership::Full)
            .encode(&Value::Object(NativeHandle::borrowed(original)), false)
            .expect("full encode should succeed");
        let ffi::FfiValue::Ptr(copied) = encoded else {
            panic!("expected Ptr ffi value");
        };
        assert!(!copied.is_null());
        assert_ne!(copied, original);
        assert!(common::is_valid_boxed_ptr(copied, gtype));

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), copied);
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original);
        }
    });
}

#[test]
fn encode_borrowed_keeps_same_pointer() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let encoded = boxed(Ownership::Borrowed)
            .encode(&Value::Object(NativeHandle::borrowed(original)), false)
            .expect("borrowed encode should succeed");
        let ffi::FfiValue::Ptr(ptr) = encoded else {
            panic!("expected Ptr ffi value");
        };
        assert_eq!(ptr, original);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn encode_full_null_pointer_stays_null() {
    common::run(|| {
        let encoded = boxed(Ownership::Full)
            .encode(&Value::Null, false)
            .expect("null encode should succeed");
        assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p.is_null()));
    });
}

#[test]
fn ref_for_transfer_full_copies_to_distinct_pointer() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let copied = boxed(Ownership::Full)
            .ref_for_transfer(original)
            .expect("ref_for_transfer should succeed");
        assert!(!copied.is_null());
        assert_ne!(copied, original);

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), copied);
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original);
        }
    });
}

#[test]
fn ref_for_transfer_borrowed_returns_same_pointer() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let returned = boxed(Ownership::Borrowed)
            .ref_for_transfer(original)
            .expect("ref_for_transfer should succeed");
        assert_eq!(returned, original);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    common::run(|| {
        let returned = boxed(Ownership::Full)
            .ref_for_transfer(std::ptr::null_mut())
            .expect("null ref_for_transfer should succeed");
        assert!(returned.is_null());
    });
}

#[test]
fn decode_full_dups_owned_boxed() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let decoded = boxed(Ownership::Full)
            .decode(&ffi::FfiValue::Ptr(original))
            .expect("full decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);
    });
}

#[test]
fn decode_borrowed_copies_boxed() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let decoded = boxed(Ownership::Borrowed)
            .decode(&ffi::FfiValue::Ptr(original))
            .expect("borrowed decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn decode_borrowed_unknown_gtype_bails() {
    common::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let unknown = BoxedType {
            ownership: Ownership::Borrowed,
            type_name: "DecodeUnknownBoxed".to_owned(),
            library: None,
            get_type_fn: None,
            free_fn: None,
        };
        let result = unknown.decode(&ffi::FfiValue::Ptr(raw));
        assert!(result.is_err());

        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn decode_null_yields_null() {
    common::run(|| {
        let decoded = boxed(Ownership::Borrowed)
            .decode(&ffi::FfiValue::Ptr(std::ptr::null_mut()))
            .expect("null decode should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn ptr_to_value_wraps_boxed() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let value = boxed(Ownership::Borrowed)
            .ptr_to_value(original, "ctx")
            .expect("ptr_to_value should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn ptr_to_value_null_yields_null() {
    common::run(|| {
        let value = boxed(Ownership::Borrowed)
            .ptr_to_value(std::ptr::null_mut(), "ctx")
            .expect("null ptr_to_value should succeed");
        assert!(matches!(value, Value::Null));
    });
}

#[test]
fn decode_none_wraps_without_copying() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let decoded = boxed(Ownership::None)
            .decode(&ffi::FfiValue::Ptr(original))
            .expect("none decode should succeed");
        let Value::Object(handle) = &decoded else {
            panic!("expected Object value");
        };
        assert_eq!(handle.ptr(), original);

        // Dropping the wrapper must not free the underlying pointer: the
        // caller (the test) still owns it.
        drop(decoded);
        assert!(common::is_valid_boxed_ptr(original, gtype));

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn decode_none_skips_borrowed_copy_failure() {
    common::run(|| {
        // The same descriptor under Borrowed would `bail!` because there is
        // no GType to copy from; under None it just wraps the pointer.
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let descriptor = BoxedType {
            ownership: Ownership::None,
            type_name: "NoneDecodeUnknownBoxed".to_owned(),
            library: None,
            get_type_fn: None,
            free_fn: None,
        };

        let decoded = descriptor
            .decode(&ffi::FfiValue::Ptr(raw))
            .expect("none decode should succeed even without gtype");
        let Value::Object(handle) = &decoded else {
            panic!("expected Object value");
        };
        assert_eq!(handle.ptr(), raw);
        drop(decoded);

        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn ptr_to_value_defensive_copies_regardless_of_ownership_tag() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        for ownership in [Ownership::Borrowed, Ownership::Full, Ownership::None] {
            let value = boxed(ownership)
                .ptr_to_value(original, "ctx")
                .expect("ptr_to_value should succeed");
            let Value::Object(handle) = &value else {
                panic!("expected Object value");
            };
            assert_ne!(
                handle.ptr(),
                original,
                "ptr_to_value must produce an independent copy, not alias the source"
            );
            drop(value);
            assert!(common::is_valid_boxed_ptr(original, gtype));
        }

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn read_from_raw_ptr_dereferences_slot() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);
        let slot: *mut c_void = original;

        let value = boxed(Ownership::Borrowed)
            .read_from_raw_ptr(&slot as *const *mut c_void as *const c_void, "ctx")
            .expect("read_from_raw_ptr should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn write_return_to_raw_ptr_copies_boxed() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let mut slot: *mut c_void = std::ptr::null_mut();
        let value: Result<Value, ()> = Ok(Value::Object(NativeHandle::borrowed(original)));
        boxed(Ownership::Borrowed)
            .write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);

        assert!(!slot.is_null());
        assert_ne!(slot, original);

        unsafe {
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), slot);
            glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original);
        }
    });
}

#[test]
fn write_return_to_raw_ptr_err_writes_null() {
    common::run(|| {
        let mut slot: *mut c_void = std::ptr::dangling_mut::<c_void>();
        let value: Result<Value, ()> = Err(());
        boxed(Ownership::Borrowed)
            .write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_raw_ptr_writes_boxed() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let mut slot: *mut c_void = std::ptr::null_mut();
        boxed(Ownership::Borrowed)
            .write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &Value::Object(NativeHandle::borrowed(original)),
            )
            .expect("write_value_to_raw_ptr should succeed");
        assert_eq!(slot, original);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn to_glib_value_wraps_boxed() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let gvalue = boxed(Ownership::Borrowed)
            .to_glib_value(&Value::Object(NativeHandle::borrowed(original)))
            .expect("to_glib_value should succeed")
            .expect("expected Some(glib::Value)");
        assert_eq!(gvalue.type_(), gtype);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn to_glib_value_non_object_yields_none() {
    common::run(|| {
        let result = boxed(Ownership::Borrowed)
            .to_glib_value(&Value::Number(1.0))
            .expect("to_glib_value should succeed");
        assert!(result.is_none());
    });
}

#[test]
fn to_glib_value_null_pointer_yields_none() {
    common::run(|| {
        let result = boxed(Ownership::Borrowed)
            .to_glib_value(&Value::Object(NativeHandle::borrowed(std::ptr::null_mut())))
            .expect("to_glib_value should succeed");
        assert!(result.is_none());
    });
}

#[test]
fn to_glib_value_unknown_gtype_yields_none() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);
        let unknown = BoxedType {
            ownership: Ownership::Borrowed,
            type_name: "GtypeUnknownBoxed".to_owned(),
            library: None,
            get_type_fn: None,
            free_fn: None,
        };
        let result = unknown
            .to_glib_value(&Value::Object(NativeHandle::borrowed(original)))
            .expect("to_glib_value should succeed");
        assert!(result.is_none());

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn from_glib_value_string_type_returns_string() {
    common::run(|| {
        let gvalue = glib::Value::from("boxed-string");
        let value = boxed(Ownership::Borrowed)
            .from_glib_value(&gvalue)
            .expect("from_glib_value should succeed");
        assert!(matches!(value, Value::String(s) if s == "boxed-string"));
    });
}

#[test]
fn from_glib_value_string_type_with_null_content_bails() {
    common::run(|| {
        let gvalue = glib::Value::from_type(glib::Type::STRING);
        let result = boxed(Ownership::Borrowed).from_glib_value(&gvalue);
        assert!(result.is_err());
    });
}

#[test]
fn from_glib_value_null_boxed_yields_null() {
    common::run(|| {
        let gvalue = glib::Value::from_type(gdk::RGBA::static_type());
        let value = boxed(Ownership::Borrowed)
            .from_glib_value(&gvalue)
            .expect("from_glib_value should succeed");
        assert!(matches!(value, Value::Null));
    });
}

#[test]
fn from_glib_value_borrowed_boxed() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let mut gvalue = glib::Value::from_type(gtype);
        unsafe {
            glib::gobject_ffi::g_value_set_boxed(gvalue.to_glib_none_mut().0, original as *const _);
        }
        let value = boxed(Ownership::Borrowed)
            .from_glib_value(&gvalue)
            .expect("from_glib_value should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn from_glib_value_full_boxed_dups() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let mut gvalue = glib::Value::from_type(gtype);
        unsafe {
            glib::gobject_ffi::g_value_set_boxed(gvalue.to_glib_none_mut().0, original as *const _);
        }
        let value = boxed(Ownership::Full)
            .from_glib_value(&gvalue)
            .expect("from_glib_value should succeed");
        let Value::Object(handle) = &value else {
            panic!("expected Object value");
        };
        assert_ne!(handle.ptr(), original);
        drop(value);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn from_glib_value_nested_gvalue_unwraps() {
    common::run(|| {
        let inner = glib::Value::from("nested");
        let gvalue_type = unsafe { glib::Type::from_glib(glib::gobject_ffi::g_value_get_type()) };
        let mut outer = glib::Value::from_type(gvalue_type);
        unsafe {
            glib::gobject_ffi::g_value_set_boxed(
                outer.to_glib_none_mut().0,
                (&inner as *const glib::Value).cast(),
            );
        }
        let value = boxed(Ownership::Borrowed)
            .from_glib_value(&outer)
            .expect("from_glib_value should succeed");
        assert!(matches!(value, Value::String(s) if s == "nested"));
    });
}

#[test]
fn struct_encode_keeps_pointer() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let encoded = struct_type(Ownership::Borrowed, None)
            .encode(&Value::Object(NativeHandle::borrowed(original)), false)
            .expect("struct encode should succeed");
        assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p == original));

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn struct_decode_full_takes_ownership() {
    common::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let decoded = struct_type(Ownership::Full, None)
            .decode(&ffi::FfiValue::Ptr(raw))
            .expect("struct full decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);
    });
}

#[test]
fn struct_decode_borrowed_with_size_copies() {
    common::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let decoded = struct_type(Ownership::Borrowed, Some(64))
            .decode(&ffi::FfiValue::Ptr(raw))
            .expect("struct sized decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);

        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_decode_borrowed_without_size_is_unowned() {
    common::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let decoded = struct_type(Ownership::Borrowed, None)
            .decode(&ffi::FfiValue::Ptr(raw))
            .expect("struct unowned decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);

        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_decode_null_yields_null() {
    common::run(|| {
        let decoded = struct_type(Ownership::Borrowed, None)
            .decode(&ffi::FfiValue::Ptr(std::ptr::null_mut()))
            .expect("struct null decode should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn struct_ptr_to_value_wraps_struct() {
    common::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let value = struct_type(Ownership::Borrowed, Some(64))
            .ptr_to_value(raw, "ctx")
            .expect("struct ptr_to_value should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);

        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_ptr_to_value_null_yields_null() {
    common::run(|| {
        let value = struct_type(Ownership::Borrowed, None)
            .ptr_to_value(std::ptr::null_mut(), "ctx")
            .expect("struct null ptr_to_value should succeed");
        assert!(matches!(value, Value::Null));
    });
}

#[test]
fn struct_ptr_to_value_defensive_copies_regardless_of_ownership_tag() {
    common::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };

        for ownership in [Ownership::Borrowed, Ownership::Full, Ownership::None] {
            let value = struct_type(ownership, Some(64))
                .ptr_to_value(raw, "ctx")
                .expect("struct ptr_to_value should succeed");
            let Value::Object(handle) = &value else {
                panic!("expected Object value");
            };
            assert_ne!(
                handle.ptr(),
                raw,
                "struct ptr_to_value must produce an independent copy when size is known"
            );
            drop(value);
        }

        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_ptr_to_value_without_size_wraps_unowned() {
    common::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };

        let value = struct_type(Ownership::Borrowed, None)
            .ptr_to_value(raw, "ctx")
            .expect("struct ptr_to_value without size should succeed");
        let Value::Object(handle) = &value else {
            panic!("expected Object value");
        };
        assert_eq!(
            handle.ptr(),
            raw,
            "without size the wrapper aliases the source pointer; the parent allocation owns it"
        );
        drop(value);

        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_write_return_to_raw_ptr_writes_pointer() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let mut slot: *mut c_void = std::ptr::null_mut();
        let value: Result<Value, ()> = Ok(Value::Object(NativeHandle::borrowed(original)));
        struct_type(Ownership::Borrowed, None)
            .write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);
        assert_eq!(slot, original);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn struct_write_value_to_raw_ptr_writes_pointer() {
    common::run(|| {
        let gtype = gdk::RGBA::static_type();
        let original = common::allocate_test_boxed(gtype);

        let mut slot: *mut c_void = std::ptr::null_mut();
        struct_type(Ownership::Borrowed, None)
            .write_value_to_raw_ptr(
                &mut slot as *mut *mut c_void as *mut c_void,
                &Value::Object(NativeHandle::borrowed(original)),
            )
            .expect("struct write_value_to_raw_ptr should succeed");
        assert_eq!(slot, original);

        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn struct_from_glib_value_bails() {
    common::run(|| {
        let gvalue = glib::Value::from(1i32);
        assert!(
            struct_type(Ownership::Borrowed, None)
                .from_glib_value(&gvalue)
                .is_err()
        );
    });
}

#[test]
fn struct_decode_none_wraps_without_copying() {
    common::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(24) };

        let decoded = struct_type(Ownership::None, Some(24))
            .decode(&ffi::FfiValue::Ptr(raw))
            .expect("struct none decode should succeed");
        let Value::Object(handle) = &decoded else {
            panic!("expected Object value");
        };
        assert_eq!(handle.ptr(), raw);
        drop(decoded);

        unsafe { glib::ffi::g_free(raw) };
    });
}

mod free_fn {
    use std::ffi::c_void;

    use gtk4::glib;

    use native::ffi;
    use native::types::{BoxedType, FfiDecoder, Ownership, RawPtrCodec};
    use native::value::Value;

    use super::common;

    const LIBGLIB: &str = "libglib-2.0.so.0";
    const G_FREE: &str = "g_free";

    fn boxed_with_free_fn(ownership: Ownership) -> BoxedType {
        BoxedType {
            ownership,
            type_name: "FreeFnBoxed".to_owned(),
            library: Some(LIBGLIB.to_owned()),
            get_type_fn: None,
            free_fn: Some(G_FREE.to_owned()),
        }
    }

    #[test]
    fn decode_full_with_free_fn_owns_pointer() {
        common::run(|| {
            // g_malloc0 + g_free is a balanced pair via the freeFn hook.
            let ptr = unsafe { glib::ffi::g_malloc0(16) };

            let decoded = boxed_with_free_fn(Ownership::Full)
                .decode(&ffi::FfiValue::Ptr(ptr))
                .expect("full decode with freeFn should succeed");
            let Value::Object(handle) = &decoded else {
                panic!("expected Object value");
            };
            assert_eq!(handle.ptr(), ptr);
            // Drop runs the resolved g_free under the GLib thread; if it
            // didn't, leak detectors and miri would surface the missed
            // free in CI coverage runs.
            drop(decoded);
        });
    }

    #[test]
    fn decode_borrowed_with_free_fn_wraps_without_owning() {
        common::run(|| {
            let ptr = unsafe { glib::ffi::g_malloc0(16) };

            let decoded = boxed_with_free_fn(Ownership::Borrowed)
                .decode(&ffi::FfiValue::Ptr(ptr))
                .expect("borrowed decode with freeFn should succeed");
            let Value::Object(handle) = &decoded else {
                panic!("expected Object value");
            };
            assert_eq!(handle.ptr(), ptr);
            // Dropping the borrowed wrapper must NOT call free_fn; the
            // caller still owns the allocation and frees it manually.
            drop(decoded);

            unsafe { glib::ffi::g_free(ptr) };
        });
    }

    #[test]
    fn ptr_to_value_full_with_free_fn_owns_pointer() {
        common::run(|| {
            let ptr = unsafe { glib::ffi::g_malloc0(16) };

            let value = boxed_with_free_fn(Ownership::Full)
                .ptr_to_value(ptr, "ctx")
                .expect("ptr_to_value with freeFn should succeed");
            let Value::Object(handle) = &value else {
                panic!("expected Object value");
            };
            assert_eq!(handle.ptr(), ptr);
            drop(value);
        });
    }

    #[test]
    fn ptr_to_value_borrowed_with_free_fn_wraps_without_owning() {
        common::run(|| {
            let ptr = unsafe { glib::ffi::g_malloc0(16) };

            let value = boxed_with_free_fn(Ownership::Borrowed)
                .ptr_to_value(ptr, "ctx")
                .expect("ptr_to_value with freeFn should succeed");
            let Value::Object(handle) = &value else {
                panic!("expected Object value");
            };
            assert_eq!(handle.ptr(), ptr);
            drop(value);

            unsafe { glib::ffi::g_free(ptr) };
        });
    }

    #[test]
    fn decode_with_unresolvable_free_fn_bails() {
        common::run(|| {
            let raw = unsafe { glib::ffi::g_malloc0(8) };
            let descriptor = BoxedType {
                ownership: Ownership::Full,
                type_name: "BadFreeFnBoxed".to_owned(),
                library: Some(LIBGLIB.to_owned()),
                get_type_fn: None,
                free_fn: Some("definitely_not_a_real_symbol_xyz".to_owned()),
            };

            let err = descriptor
                .decode(&ffi::FfiValue::Ptr(raw))
                .expect_err("decode with missing free symbol should fail");
            let msg = format!("{err}");
            assert!(msg.contains("BadFreeFnBoxed"));
            assert!(msg.contains("definitely_not_a_real_symbol_xyz"));

            unsafe { glib::ffi::g_free(raw) };
        });
    }

    #[test]
    fn decode_with_unloadable_library_bails() {
        common::run(|| {
            let raw = unsafe { glib::ffi::g_malloc0(8) };
            let descriptor = BoxedType {
                ownership: Ownership::Full,
                type_name: "BadLibBoxed".to_owned(),
                library: Some("libdoes-not-exist-xyz-12345.so.0".to_owned()),
                get_type_fn: None,
                free_fn: Some(G_FREE.to_owned()),
            };

            let err = descriptor
                .decode(&ffi::FfiValue::Ptr(raw))
                .expect_err("decode with missing library should fail");
            assert!(format!("{err}").contains("BadLibBoxed"));

            unsafe { glib::ffi::g_free(raw) };
        });
    }

    #[test]
    fn ptr_to_value_null_with_free_fn_yields_null() {
        common::run(|| {
            let value = boxed_with_free_fn(Ownership::Full)
                .ptr_to_value(std::ptr::null_mut::<c_void>(), "ctx")
                .expect("null ptr_to_value should succeed");
            assert!(matches!(value, Value::Null));
        });
    }

    #[test]
    fn descriptor_with_free_fn_falls_back_for_library_lookup() {
        common::run(|| {
            // The "(no library)" fallback branch in boxed_with_free_fn is
            // reached when freeFn is set but library is None. The lookup
            // unconditionally fails, surfacing the type name in the error.
            let raw = unsafe { glib::ffi::g_malloc0(8) };
            let descriptor = BoxedType {
                ownership: Ownership::Full,
                type_name: "LibrarylessFreeFn".to_owned(),
                library: None,
                get_type_fn: None,
                free_fn: Some(G_FREE.to_owned()),
            };

            let err = descriptor
                .decode(&ffi::FfiValue::Ptr(raw))
                .expect_err("decode without library should fail");
            assert!(format!("{err}").contains("LibrarylessFreeFn"));

            unsafe { glib::ffi::g_free(raw) };
        });
    }
}
