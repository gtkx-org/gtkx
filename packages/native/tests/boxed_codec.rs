//! Coverage tests for [`native::types::BoxedType`] and
//! [`native::types::StructType`] codec implementations.

mod common;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::StaticType as _;

use native::ffi;
use native::managed::NativeHandle;
use native::types::{BoxedType, FfiDecoder, FfiEncoder, Ownership, RawPtrCodec, StructType};
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
    StructType { ownership, size }
}

fn assert_slot_holds_copy_then_free(slot: *mut c_void, original: *mut c_void, gtype: glib::Type) {
    assert!(!slot.is_null());
    assert_ne!(slot, original);
    // SAFETY: Frees the boxed allocations this test owns.
    unsafe {
        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), slot);
        glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original);
    }
}

fn rgba_boxed_alloc() -> (glib::Type, *mut c_void) {
    let gtype = gdk::RGBA::static_type();
    (gtype, common::allocate_test_boxed(gtype))
}

fn free_rgba(gtype: glib::Type, ptr: *mut c_void) {
    // SAFETY: Frees the boxed allocation this test owns.
    unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), ptr) };
}

fn object_value_of(ptr: *mut c_void) -> Value {
    Value::Object(NativeHandle::borrowed(ptr))
}

fn encode_rgba(ownership: Ownership, ptr: *mut c_void) -> ffi::FfiValue {
    boxed(ownership)
        .encode(&object_value_of(ptr), false)
        .expect("encode should succeed")
}

/// Writes `value` into a null-initialized slot through
/// `write_return_to_raw_ptr` and returns the written pointer.
fn write_return_into_slot<C: RawPtrCodec>(codec: &C, value: &Result<Value, ()>) -> *mut c_void {
    let mut slot: *mut c_void = std::ptr::null_mut();
    // SAFETY: `slot` is a writable local pointer-sized slot.
    unsafe { codec.write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, value) };
    slot
}

/// Writes `value` into a slot seeded with `initial` through
/// `write_value_to_raw_ptr`, asserting success, and returns the written
/// pointer.
fn write_value_into_slot<C: RawPtrCodec>(
    codec: &C,
    initial: *mut c_void,
    value: &Value,
) -> *mut c_void {
    let mut slot: *mut c_void = initial;
    // SAFETY: `slot` is a writable local pointer-sized slot whose seed value
    // satisfies the per-test ownership contract.
    unsafe { codec.write_value_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, value) }
        .expect("write_value_to_raw_ptr should succeed");
    slot
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
        let (gtype, original) = rgba_boxed_alloc();

        let encoded = encode_rgba(Ownership::Full, original);
        encoded.disarm_pending_transfer();
        let ffi::FfiValue::Storage(storage) = &encoded else {
            panic!("expected Storage ffi value");
        };
        let copied = storage.ptr();
        assert!(!copied.is_null());
        assert_ne!(copied, original);
        assert!(common::is_valid_boxed_ptr(copied, gtype));

        free_rgba(gtype, copied);
        free_rgba(gtype, original);
    });
}

#[test]
fn encode_full_releases_copy_when_call_never_happens() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();

        let encoded = encode_rgba(Ownership::Full, original);
        drop(encoded);

        free_rgba(gtype, original);
    });
}

#[test]
fn encode_borrowed_keeps_same_pointer() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();

        let encoded = encode_rgba(Ownership::Borrowed, original);
        let ffi::FfiValue::Ptr(ptr) = encoded else {
            panic!("expected Ptr ffi value");
        };
        assert_eq!(ptr, original);

        free_rgba(gtype, original);
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
        let (gtype, original) = rgba_boxed_alloc();

        // SAFETY: `original` addresses a live boxed GdkRGBA.
        let copied = unsafe { boxed(Ownership::Full).ref_for_transfer(original) }
            .expect("ref_for_transfer should succeed");
        assert!(!copied.is_null());
        assert_ne!(copied, original);

        free_rgba(gtype, copied);
        free_rgba(gtype, original);
    });
}

#[test]
fn ref_for_transfer_borrowed_returns_same_pointer() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();

        // SAFETY: `original` addresses a live boxed GdkRGBA.
        let returned = unsafe { boxed(Ownership::Borrowed).ref_for_transfer(original) }
            .expect("ref_for_transfer should succeed");
        assert_eq!(returned, original);

        free_rgba(gtype, original);
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    common::run(|| {
        // SAFETY: Null short-circuits before any copy is made.
        let returned = unsafe { boxed(Ownership::Full).ref_for_transfer(std::ptr::null_mut()) }
            .expect("null ref_for_transfer should succeed");
        assert!(returned.is_null());
    });
}

#[test]
fn decode_full_dups_owned_boxed() {
    common::run(|| {
        let (_gtype, original) = rgba_boxed_alloc();

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
        let (gtype, original) = rgba_boxed_alloc();

        let decoded = boxed(Ownership::Borrowed)
            .decode(&ffi::FfiValue::Ptr(original))
            .expect("borrowed decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);

        free_rgba(gtype, original);
    });
}

#[test]
fn decode_borrowed_unknown_gtype_bails() {
    common::run(|| {
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
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

        // SAFETY: Frees the allocation this test owns.
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
        let (gtype, original) = rgba_boxed_alloc();

        // SAFETY: `original` addresses a live boxed GdkRGBA.
        let value = unsafe { boxed(Ownership::Borrowed).ptr_to_value(original, "ctx") }
            .expect("ptr_to_value should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);

        free_rgba(gtype, original);
    });
}

#[test]
fn ptr_to_value_null_yields_null() {
    common::run(|| {
        // SAFETY: Null short-circuits before any read.
        let value = unsafe { boxed(Ownership::Borrowed).ptr_to_value(std::ptr::null_mut(), "ctx") }
            .expect("null ptr_to_value should succeed");
        assert!(matches!(value, Value::Null));
    });
}

#[test]
fn ptr_to_value_defensive_copies_regardless_of_ownership_tag() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();

        for ownership in [Ownership::Borrowed, Ownership::Full] {
            // SAFETY: `original` addresses a live boxed GdkRGBA.
            let value = unsafe { boxed(ownership).ptr_to_value(original, "ctx") }
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

        free_rgba(gtype, original);
    });
}

#[test]
fn read_from_raw_ptr_dereferences_slot() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();
        let slot: *mut c_void = original;

        // SAFETY: `slot` is a live local pointer-sized slot holding a live
        // boxed GdkRGBA pointer.
        let value = unsafe {
            boxed(Ownership::Borrowed)
                .read_from_raw_ptr(&slot as *const *mut c_void as *const c_void, "ctx")
        }
        .expect("read_from_raw_ptr should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);

        free_rgba(gtype, original);
    });
}

#[test]
fn write_return_to_raw_ptr_full_transfer_copies_boxed() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();

        let slot = write_return_into_slot(&boxed(Ownership::Full), &Ok(object_value_of(original)));

        assert_slot_holds_copy_then_free(slot, original, gtype);
    });
}

#[test]
fn write_return_to_raw_ptr_borrowed_writes_same_pointer() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();

        let slot =
            write_return_into_slot(&boxed(Ownership::Borrowed), &Ok(object_value_of(original)));

        assert_eq!(slot, original);
        free_rgba(gtype, original);
    });
}

#[test]
fn write_return_to_raw_ptr_err_writes_null() {
    common::run(|| {
        let mut slot: *mut c_void = std::ptr::dangling_mut::<c_void>();
        let value: Result<Value, ()> = Err(());
        // SAFETY: `slot` is a writable local pointer-sized slot.
        unsafe {
            boxed(Ownership::Borrowed)
                .write_return_to_raw_ptr(&mut slot as *mut *mut c_void as *mut c_void, &value);
        }
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_raw_ptr_writes_boxed() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();

        let slot = write_value_into_slot(
            &boxed(Ownership::Borrowed),
            std::ptr::null_mut(),
            &object_value_of(original),
        );
        assert_slot_holds_copy_then_free(slot, original, gtype);
    });
}

#[test]
fn write_value_to_raw_ptr_falls_back_when_gtype_unresolvable() {
    common::run(|| {
        let target: u64 = 0xAA55;
        let unknown = BoxedType {
            ownership: Ownership::Borrowed,
            type_name: "GtypeUnknownBoxed".to_owned(),
            library: None,
            get_type_fn: None,
            free_fn: None,
        };

        let slot = write_value_into_slot(
            &unknown,
            std::ptr::null_mut(),
            &object_value_of(&target as *const u64 as *mut c_void),
        );
        assert_eq!(slot, &target as *const u64 as *mut c_void);
    });
}

#[test]
fn write_value_to_raw_ptr_writes_null_when_src_is_null() {
    common::run(|| {
        let slot = write_value_into_slot(
            &boxed(Ownership::Borrowed),
            std::ptr::null_mut(),
            &object_value_of(std::ptr::null_mut()),
        );
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_raw_ptr_frees_previous_pointer_in_slot() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();
        let previous = common::allocate_test_boxed(gtype);

        let slot = write_value_into_slot(
            &boxed(Ownership::Borrowed),
            previous,
            &object_value_of(original),
        );
        assert!(!slot.is_null());
        assert_ne!(slot, original);
        assert_ne!(slot, previous);

        free_rgba(gtype, slot);
        free_rgba(gtype, original);
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

        // SAFETY: Frees the boxed allocation this test owns.
        unsafe { glib::gobject_ffi::g_boxed_free(gtype.into_glib(), original) };
    });
}

#[test]
fn struct_decode_full_takes_ownership() {
    common::run(|| {
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
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
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let decoded = struct_type(Ownership::Borrowed, Some(64))
            .decode(&ffi::FfiValue::Ptr(raw))
            .expect("struct sized decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);

        // SAFETY: Frees the allocation this test owns.
        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_decode_borrowed_without_size_is_unowned() {
    common::run(|| {
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let decoded = struct_type(Ownership::Borrowed, None)
            .decode(&ffi::FfiValue::Ptr(raw))
            .expect("struct unowned decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);

        // SAFETY: Frees the allocation this test owns.
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
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        // SAFETY: `raw` addresses a live 64-byte allocation.
        let value = unsafe { struct_type(Ownership::Borrowed, Some(64)).ptr_to_value(raw, "ctx") }
            .expect("struct ptr_to_value should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);

        // SAFETY: Frees the allocation this test owns.
        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_ptr_to_value_null_yields_null() {
    common::run(|| {
        // SAFETY: Null short-circuits before any read.
        let value = unsafe {
            struct_type(Ownership::Borrowed, None).ptr_to_value(std::ptr::null_mut(), "ctx")
        }
        .expect("struct null ptr_to_value should succeed");
        assert!(matches!(value, Value::Null));
    });
}

#[test]
fn struct_ptr_to_value_defensive_copies_regardless_of_ownership_tag() {
    common::run(|| {
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
        let raw = unsafe { glib::ffi::g_malloc0(64) };

        for ownership in [Ownership::Borrowed, Ownership::Full] {
            // SAFETY: `raw` addresses a live 64-byte allocation.
            let value = unsafe { struct_type(ownership, Some(64)).ptr_to_value(raw, "ctx") }
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

        // SAFETY: Frees the allocation this test owns.
        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_ptr_to_value_without_size_wraps_unowned() {
    common::run(|| {
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
        let raw = unsafe { glib::ffi::g_malloc0(64) };

        // SAFETY: `raw` addresses a live 64-byte allocation.
        let value = unsafe { struct_type(Ownership::Borrowed, None).ptr_to_value(raw, "ctx") }
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

        // SAFETY: Frees the allocation this test owns.
        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_write_return_to_raw_ptr_writes_pointer() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();

        let slot = write_return_into_slot(
            &struct_type(Ownership::Borrowed, None),
            &Ok(object_value_of(original)),
        );
        assert_eq!(slot, original);

        free_rgba(gtype, original);
    });
}

#[test]
fn struct_write_value_to_raw_ptr_writes_pointer() {
    common::run(|| {
        let (gtype, original) = rgba_boxed_alloc();

        let slot = write_value_into_slot(
            &struct_type(Ownership::Borrowed, None),
            std::ptr::null_mut(),
            &object_value_of(original),
        );
        assert_eq!(slot, original);

        free_rgba(gtype, original);
    });
}

#[test]
fn struct_write_value_to_raw_ptr_with_size_copies_into_dst() {
    common::run(|| {
        let src: u64 = 0xDEAD_BEEF_DEAD_BEEF;
        let mut dst: u64 = 0;

        let slot = write_value_into_slot(
            &struct_type(Ownership::Borrowed, Some(std::mem::size_of::<u64>())),
            &mut dst as *mut u64 as *mut c_void,
            &object_value_of(&src as *const u64 as *mut c_void),
        );

        assert_eq!(dst, src);
        assert_eq!(slot, &mut dst as *mut u64 as *mut c_void);
    });
}

#[test]
fn struct_write_value_to_raw_ptr_with_size_writes_null_for_null_src() {
    common::run(|| {
        let slot = write_value_into_slot(
            &struct_type(Ownership::Borrowed, Some(std::mem::size_of::<u64>())),
            7 as *mut c_void,
            &object_value_of(std::ptr::null_mut()),
        );

        assert!(slot.is_null());
    });
}

#[test]
fn struct_write_value_to_raw_ptr_with_size_bails_for_null_dst() {
    common::run(|| {
        let src: u64 = 1;
        let mut slot: *mut c_void = std::ptr::null_mut();

        // SAFETY: `slot` is a writable local pointer-sized slot; the null
        // destination bails before any copy.
        let err = unsafe {
            struct_type(Ownership::Borrowed, Some(std::mem::size_of::<u64>()))
                .write_value_to_raw_ptr(
                    &mut slot as *mut *mut c_void as *mut c_void,
                    &Value::Object(NativeHandle::borrowed(&src as *const u64 as *mut c_void)),
                )
        };

        assert!(err.is_err());
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

    /// Allocates 16 zeroed bytes and asserts the value `wrap` produces
    /// aliases the allocation. A full wrapper adopts the allocation and
    /// releases it via the resolved free function on drop (leak detectors
    /// would surface a missed free); a borrowed wrapper leaves ownership
    /// with the test, which then frees it.
    fn assert_free_fn_wrapper_aliases(
        ownership: Ownership,
        wrap: impl FnOnce(&BoxedType, *mut c_void) -> Value,
    ) {
        // SAFETY: Allocating zeroed memory has no pointer preconditions.
        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        let value = wrap(&boxed_with_free_fn(ownership), ptr);
        let Value::Object(handle) = &value else {
            panic!("expected Object value");
        };
        assert_eq!(handle.ptr(), ptr);
        drop(value);

        if ownership.is_borrowed() {
            // SAFETY: Frees the allocation this test owns.
            unsafe { glib::ffi::g_free(ptr) };
        }
    }

    fn decode_wrapper(descriptor: &BoxedType, ptr: *mut c_void) -> Value {
        descriptor
            .decode(&ffi::FfiValue::Ptr(ptr))
            .expect("decode with freeFn should succeed")
    }

    fn ptr_to_value_wrapper(descriptor: &BoxedType, ptr: *mut c_void) -> Value {
        // SAFETY: `ptr` addresses a live 16-byte allocation.
        unsafe { descriptor.ptr_to_value(ptr, "ctx") }
            .expect("ptr_to_value with freeFn should succeed")
    }

    #[test]
    fn decode_full_with_free_fn_owns_pointer() {
        common::run(|| {
            assert_free_fn_wrapper_aliases(Ownership::Full, decode_wrapper);
        });
    }

    #[test]
    fn decode_borrowed_with_free_fn_wraps_without_owning() {
        common::run(|| {
            assert_free_fn_wrapper_aliases(Ownership::Borrowed, decode_wrapper);
        });
    }

    #[test]
    fn ptr_to_value_full_with_free_fn_owns_pointer() {
        common::run(|| {
            assert_free_fn_wrapper_aliases(Ownership::Full, ptr_to_value_wrapper);
        });
    }

    #[test]
    fn ptr_to_value_borrowed_with_free_fn_wraps_without_owning() {
        common::run(|| {
            assert_free_fn_wrapper_aliases(Ownership::Borrowed, ptr_to_value_wrapper);
        });
    }

    #[test]
    fn decode_with_unresolvable_free_fn_bails() {
        common::run(|| {
            // SAFETY: Allocating zeroed memory has no pointer preconditions.
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

            // SAFETY: Frees the allocation this test owns.
            unsafe { glib::ffi::g_free(raw) };
        });
    }

    #[test]
    fn decode_with_unloadable_library_bails() {
        common::run(|| {
            // SAFETY: Allocating zeroed memory has no pointer preconditions.
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

            // SAFETY: Frees the allocation this test owns.
            unsafe { glib::ffi::g_free(raw) };
        });
    }

    #[test]
    fn ptr_to_value_null_with_free_fn_yields_null() {
        common::run(|| {
            // SAFETY: Null short-circuits before any read.
            let value = unsafe {
                boxed_with_free_fn(Ownership::Full)
                    .ptr_to_value(std::ptr::null_mut::<c_void>(), "ctx")
            }
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
            // SAFETY: Allocating zeroed memory has no pointer preconditions.
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

            // SAFETY: Frees the allocation this test owns.
            unsafe { glib::ffi::g_free(raw) };
        });
    }
}
