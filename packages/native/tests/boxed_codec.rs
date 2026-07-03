use test_support as helpers;

use std::ffi::c_void;

use gtk4::gdk;
use gtk4::glib;
use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::StaticType as _;

use native::ffi;
use native::ffi::codec::{
    BoxedCodec, Decoder, Encoder, Ownership, PtrWriter, ReadSource, StructCodec,
};
use native::ffi::value::Value;
use native::handle::Handle;

use helpers::{
    assert_decode_null_yields_null, assert_read_null_yields_null,
    assert_write_return_err_writes_null, read_slot, write_return_into_slot, write_value_into_slot,
};

fn rgba_type_name() -> String {
    gdk::RGBA::static_type().name().to_string()
}

fn boxed(ownership: Ownership) -> BoxedCodec {
    BoxedCodec {
        ownership,
        type_name: rgba_type_name(),
        shared_library: None,
        get_type_fn_name: None,
        free_fn_name: None,
        caller_allocated: false,
    }
}

fn struct_type(ownership: Ownership, size: Option<usize>) -> StructCodec {
    StructCodec {
        ownership,
        size,
        caller_allocated: false,
    }
}

fn assert_slot_holds_copy_then_free(slot: *mut c_void, original: *mut c_void, type_: glib::Type) {
    assert!(!slot.is_null());
    assert_ne!(slot, original);
    unsafe {
        glib::gobject_ffi::g_boxed_free(type_.into_glib(), slot);
        glib::gobject_ffi::g_boxed_free(type_.into_glib(), original);
    }
}

fn rgba_boxed_alloc() -> (glib::Type, *mut c_void) {
    let type_ = gdk::RGBA::static_type();
    (type_, helpers::allocate_test_boxed(type_))
}

fn free_rgba(type_: glib::Type, ptr: *mut c_void) {
    unsafe { glib::gobject_ffi::g_boxed_free(type_.into_glib(), ptr) };
}

fn object_value_of(ptr: *mut c_void) -> Value {
    Value::Object(Handle::from_glib_borrow(ptr))
}

fn assert_read_aliases_source<C: Decoder>(codec: &C, original: *mut c_void, message: &str) {
    let value = unsafe { codec.read(ReadSource::Value(original, "ctx")) }
        .expect("ptr_to_value should succeed");
    let Value::Object(handle) = &value else {
        panic!("expected Object value");
    };
    assert_eq!(handle.as_ptr(), original, "{message}");
    drop(value);
}

fn encode_rgba(ownership: Ownership, ptr: *mut c_void) -> ffi::Stash {
    boxed(ownership)
        .encode(&object_value_of(ptr))
        .expect("encode should succeed")
}

#[test]
fn type_resolves_from_registered_name() {
    helpers::run(|| {
        let resolved = boxed(Ownership::Borrowed).type_().expect("type resolves");
        assert_eq!(resolved, Some(gdk::RGBA::static_type()));
    });
}

#[test]
fn type_resolves_via_library_lookup() {
    helpers::run(|| {
        let bytes_type = BoxedCodec {
            ownership: Ownership::Borrowed,
            type_name: "GBytes".to_owned(),
            shared_library: Some("libgobject-2.0.so.0".to_owned()),
            get_type_fn_name: Some("g_bytes_get_type".to_owned()),
            free_fn_name: None,
            caller_allocated: false,
        };
        let resolved = bytes_type.type_().expect("type resolves");
        assert_eq!(resolved, Some(glib::Bytes::static_type()));
    });
}

#[test]
fn encode_full_copies_to_distinct_pointer() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let encoded = encode_rgba(Ownership::Full, original);
        encoded.disarm_pending_transfer();
        let ffi::Stash::Storage(storage) = &encoded else {
            panic!("expected Storage ffi value");
        };
        let copied = storage.ptr();
        assert!(!copied.is_null());
        assert_ne!(copied, original);
        assert!(helpers::is_valid_boxed_ptr(copied, type_));

        free_rgba(type_, copied);
        free_rgba(type_, original);
    });
}

#[test]
fn encode_full_releases_copy_when_call_never_happens() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let encoded = encode_rgba(Ownership::Full, original);
        drop(encoded);

        free_rgba(type_, original);
    });
}

#[test]
fn encode_borrowed_keeps_same_pointer() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let encoded = encode_rgba(Ownership::Borrowed, original);
        let ffi::Stash::Ptr(ptr) = encoded else {
            panic!("expected Ptr ffi value");
        };
        assert_eq!(ptr, original);

        free_rgba(type_, original);
    });
}

#[test]
fn encode_full_null_pointer_stays_null() {
    helpers::run(|| {
        helpers::assert_encode_null_yields_null_ptr(&boxed(Ownership::Full));
    });
}

#[test]
fn ref_for_transfer_full_copies_to_distinct_pointer() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let copied = unsafe { boxed(Ownership::Full).ref_for_transfer(original) }
            .expect("ref_for_transfer should succeed");
        assert!(!copied.is_null());
        assert_ne!(copied, original);

        free_rgba(type_, copied);
        free_rgba(type_, original);
    });
}

#[test]
fn ref_for_transfer_borrowed_returns_same_pointer() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let returned = unsafe { boxed(Ownership::Borrowed).ref_for_transfer(original) }
            .expect("ref_for_transfer should succeed");
        assert_eq!(returned, original);

        free_rgba(type_, original);
    });
}

#[test]
fn ref_for_transfer_full_null_is_noop() {
    helpers::run(|| {
        let returned = unsafe { boxed(Ownership::Full).ref_for_transfer(std::ptr::null_mut()) }
            .expect("null ref_for_transfer should succeed");
        assert!(returned.is_null());
    });
}

#[test]
fn decode_full_dups_owned_boxed() {
    helpers::run(|| {
        let (_type, original) = rgba_boxed_alloc();

        let decoded = boxed(Ownership::Full)
            .decode(&ffi::Stash::Ptr(original))
            .expect("full decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);
    });
}

#[test]
fn decode_borrowed_copies_boxed() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let decoded = boxed(Ownership::Borrowed)
            .decode(&ffi::Stash::Ptr(original))
            .expect("borrowed decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);

        assert!(helpers::is_valid_boxed_ptr(original, type_));
        free_rgba(type_, original);
    });
}

#[test]
fn decode_null_yields_null() {
    helpers::run(|| {
        assert_decode_null_yields_null(&boxed(Ownership::Borrowed));
    });
}
#[test]
fn ptr_to_value_null_yields_null() {
    helpers::run(|| {
        assert_read_null_yields_null(&boxed(Ownership::Borrowed));
    });
}

#[test]
fn ptr_to_value_defensive_copies_regardless_of_ownership_tag() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        for ownership in [Ownership::Borrowed, Ownership::Full] {
            let value = unsafe { boxed(ownership).read(ReadSource::Value(original, "ctx")) }
                .expect("ptr_to_value should succeed");
            let Value::Object(handle) = &value else {
                panic!("expected Object value");
            };
            assert_ne!(
                handle.as_ptr(),
                original,
                "ptr_to_value must produce an independent copy, not alias the source"
            );
            drop(value);
            assert!(helpers::is_valid_boxed_ptr(original, type_));
        }

        free_rgba(type_, original);
    });
}

#[test]
fn caller_allocated_boxed_aliases_source_without_copying() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let descriptor = BoxedCodec {
            caller_allocated: true,
            ..boxed(Ownership::Borrowed)
        };
        assert_read_aliases_source(
            &descriptor,
            original,
            "a caller-allocated out boxed must alias the caller's buffer, not copy it",
        );
        assert!(helpers::is_valid_boxed_ptr(original, type_));

        free_rgba(type_, original);
    });
}

#[test]
fn caller_allocated_struct_aliases_source_without_copying() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let descriptor = StructCodec {
            caller_allocated: true,
            ..struct_type(Ownership::Borrowed, Some(size_of::<gdk::ffi::GdkRGBA>()))
        };
        assert_read_aliases_source(
            &descriptor,
            original,
            "a caller-allocated out struct must alias the caller's buffer, not copy it",
        );

        free_rgba(type_, original);
    });
}

#[test]
fn read_from_pointer_dereferences_slot() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let value = unsafe { read_slot(&boxed(Ownership::Borrowed), original) }
            .expect("read_from_pointer should succeed");
        assert!(matches!(value, Value::Object(_)));
        drop(value);

        free_rgba(type_, original);
    });
}

#[test]
fn write_return_to_pointer_full_transfer_copies_boxed() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let slot = write_return_into_slot(&boxed(Ownership::Full), &Ok(object_value_of(original)));

        assert_slot_holds_copy_then_free(slot, original, type_);
    });
}

#[test]
fn write_return_to_pointer_borrowed_writes_same_pointer() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let slot =
            write_return_into_slot(&boxed(Ownership::Borrowed), &Ok(object_value_of(original)));

        assert_eq!(slot, original);
        free_rgba(type_, original);
    });
}

#[test]
fn write_return_to_pointer_err_writes_null() {
    helpers::run(|| {
        assert_write_return_err_writes_null(&boxed(Ownership::Borrowed));
    });
}

#[test]
fn write_value_to_pointer_writes_boxed() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let slot = write_value_into_slot(
            &boxed(Ownership::Borrowed),
            std::ptr::null_mut(),
            &object_value_of(original),
        );
        assert_slot_holds_copy_then_free(slot, original, type_);
    });
}

#[test]
fn write_value_to_pointer_falls_back_when_type_unresolvable() {
    helpers::run(|| {
        let target: u64 = 0xAA55;
        let unknown = BoxedCodec {
            ownership: Ownership::Borrowed,
            type_name: "GTypeUnknownBoxed".to_owned(),
            shared_library: None,
            get_type_fn_name: None,
            free_fn_name: None,
            caller_allocated: false,
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
fn write_value_to_pointer_writes_null_when_src_is_null() {
    helpers::run(|| {
        let slot = write_value_into_slot(
            &boxed(Ownership::Borrowed),
            std::ptr::null_mut(),
            &object_value_of(std::ptr::null_mut()),
        );
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_pointer_frees_previous_pointer_in_slot() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();
        let previous = helpers::allocate_test_boxed(type_);

        let slot = write_value_into_slot(
            &boxed(Ownership::Borrowed),
            previous,
            &object_value_of(original),
        );
        assert!(!slot.is_null());
        assert_ne!(slot, original);
        assert_ne!(slot, previous);

        free_rgba(type_, slot);
        free_rgba(type_, original);
    });
}

#[test]
fn struct_encode_keeps_pointer() {
    helpers::run(|| {
        let type_ = gdk::RGBA::static_type();
        let original = helpers::allocate_test_boxed(type_);

        let encoded = struct_type(Ownership::Borrowed, None)
            .encode(&Value::Object(Handle::from_glib_borrow(original)))
            .expect("struct encode should succeed");
        assert!(matches!(encoded, ffi::Stash::Ptr(p) if p == original));

        unsafe { glib::gobject_ffi::g_boxed_free(type_.into_glib(), original) };
    });
}

#[test]
fn struct_decode_full_takes_ownership() {
    helpers::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let decoded = struct_type(Ownership::Full, None)
            .decode(&ffi::Stash::Ptr(raw))
            .expect("struct full decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);
    });
}

#[test]
fn struct_decode_borrowed_with_size_copies() {
    helpers::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let decoded = struct_type(Ownership::Borrowed, Some(64))
            .decode(&ffi::Stash::Ptr(raw))
            .expect("struct sized decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);

        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_decode_borrowed_without_size_is_unowned() {
    helpers::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };
        let decoded = struct_type(Ownership::Borrowed, None)
            .decode(&ffi::Stash::Ptr(raw))
            .expect("struct unowned decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);

        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_decode_null_yields_null() {
    helpers::run(|| {
        assert_decode_null_yields_null(&struct_type(Ownership::Borrowed, None));
    });
}
#[test]
fn struct_ptr_to_value_null_yields_null() {
    helpers::run(|| {
        assert_read_null_yields_null(&struct_type(Ownership::Borrowed, None));
    });
}

#[test]
fn struct_ptr_to_value_defensive_copies_regardless_of_ownership_tag() {
    helpers::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };

        for ownership in [Ownership::Borrowed, Ownership::Full] {
            let value =
                unsafe { struct_type(ownership, Some(64)).read(ReadSource::Value(raw, "ctx")) }
                    .expect("struct ptr_to_value should succeed");
            let Value::Object(handle) = &value else {
                panic!("expected Object value");
            };
            assert_ne!(
                handle.as_ptr(),
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
    helpers::run(|| {
        let raw = unsafe { glib::ffi::g_malloc0(64) };

        let value =
            unsafe { struct_type(Ownership::Borrowed, None).read(ReadSource::Value(raw, "ctx")) }
                .expect("struct ptr_to_value without size should succeed");
        let Value::Object(handle) = &value else {
            panic!("expected Object value");
        };
        assert_eq!(
            handle.as_ptr(),
            raw,
            "without size the wrapper aliases the source pointer; the parent allocation owns it"
        );
        drop(value);

        unsafe { glib::ffi::g_free(raw) };
    });
}

#[test]
fn struct_write_return_to_pointer_writes_pointer() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let slot = write_return_into_slot(
            &struct_type(Ownership::Borrowed, None),
            &Ok(object_value_of(original)),
        );
        assert_eq!(slot, original);

        free_rgba(type_, original);
    });
}

#[test]
fn struct_write_value_to_pointer_writes_pointer() {
    helpers::run(|| {
        let (type_, original) = rgba_boxed_alloc();

        let slot = write_value_into_slot(
            &struct_type(Ownership::Borrowed, None),
            std::ptr::null_mut(),
            &object_value_of(original),
        );
        assert_eq!(slot, original);

        free_rgba(type_, original);
    });
}

#[test]
fn struct_write_value_to_pointer_with_size_copies_into_dst() {
    helpers::run(|| {
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
fn struct_write_value_to_pointer_with_size_writes_null_for_null_src() {
    helpers::run(|| {
        let slot = write_value_into_slot(
            &struct_type(Ownership::Borrowed, Some(std::mem::size_of::<u64>())),
            7 as *mut c_void,
            &object_value_of(std::ptr::null_mut()),
        );

        assert!(slot.is_null());
    });
}

#[test]
fn struct_write_value_to_pointer_with_size_bails_for_null_dst() {
    helpers::run(|| {
        let src: u64 = 1;
        let mut slot: *mut c_void = std::ptr::null_mut();

        let err = struct_type(Ownership::Borrowed, Some(std::mem::size_of::<u64>()))
            .write_value_to_ptr(
                unsafe { ffi::Slot::new(&mut slot as *mut *mut c_void as *mut c_void) },
                &Value::Object(Handle::from_glib_borrow(&src as *const u64 as *mut c_void)),
            );

        assert!(err.is_err());
    });
}

mod free_fn {
    use std::ffi::c_void;

    use gtk4::glib;

    use native::ffi;
    use native::ffi::codec::{BoxedCodec, Decoder, Ownership, ReadSource};
    use native::ffi::value::Value;

    use super::helpers;

    const LIBGLIB: &str = "libglib-2.0.so.0";
    const G_FREE: &str = "g_free";

    fn boxed_with_free_fn(ownership: Ownership) -> BoxedCodec {
        BoxedCodec {
            ownership,
            type_name: "FreeFnBoxed".to_owned(),
            shared_library: Some(LIBGLIB.to_owned()),
            get_type_fn_name: None,
            free_fn_name: Some(G_FREE.to_owned()),
            caller_allocated: false,
        }
    }

    fn assert_free_fn_wrapper_aliases(
        ownership: Ownership,
        wrap: impl FnOnce(&BoxedCodec, *mut c_void) -> Value,
    ) {
        let ptr = unsafe { glib::ffi::g_malloc0(16) };

        let value = wrap(&boxed_with_free_fn(ownership), ptr);
        let Value::Object(handle) = &value else {
            panic!("expected Object value");
        };
        assert_eq!(handle.as_ptr(), ptr);
        drop(value);

        if ownership.is_borrowed() {
            unsafe { glib::ffi::g_free(ptr) };
        }
    }

    fn decode_wrapper(descriptor: &BoxedCodec, ptr: *mut c_void) -> Value {
        descriptor
            .decode(&ffi::Stash::Ptr(ptr))
            .expect("decode with freeFnName should succeed")
    }

    fn ptr_to_value_wrapper(descriptor: &BoxedCodec, ptr: *mut c_void) -> Value {
        unsafe { descriptor.read(ReadSource::Value(ptr, "ctx")) }
            .expect("ptr_to_value with freeFnName should succeed")
    }

    #[test]
    fn decode_full_with_free_fn_owns_pointer() {
        helpers::run(|| {
            assert_free_fn_wrapper_aliases(Ownership::Full, decode_wrapper);
        });
    }

    #[test]
    fn decode_borrowed_with_free_fn_wraps_without_owning() {
        helpers::run(|| {
            assert_free_fn_wrapper_aliases(Ownership::Borrowed, decode_wrapper);
        });
    }

    #[test]
    fn ptr_to_value_full_with_free_fn_owns_pointer() {
        helpers::run(|| {
            assert_free_fn_wrapper_aliases(Ownership::Full, ptr_to_value_wrapper);
        });
    }

    #[test]
    fn ptr_to_value_borrowed_with_free_fn_wraps_without_owning() {
        helpers::run(|| {
            assert_free_fn_wrapper_aliases(Ownership::Borrowed, ptr_to_value_wrapper);
        });
    }

    #[test]
    fn decode_with_unresolvable_free_fn_bails() {
        helpers::run(|| {
            let raw = unsafe { glib::ffi::g_malloc0(8) };
            let descriptor = BoxedCodec {
                ownership: Ownership::Full,
                type_name: "BadFreeFnBoxed".to_owned(),
                shared_library: Some(LIBGLIB.to_owned()),
                get_type_fn_name: None,
                free_fn_name: Some("definitely_not_a_real_symbol_xyz".to_owned()),
                caller_allocated: false,
            };

            let err = descriptor
                .decode(&ffi::Stash::Ptr(raw))
                .expect_err("decode with missing free symbol should fail");
            let msg = format!("{err}");
            assert!(msg.contains("BadFreeFnBoxed"));
            assert!(msg.contains("definitely_not_a_real_symbol_xyz"));

            unsafe { glib::ffi::g_free(raw) };
        });
    }

    #[test]
    fn decode_with_unloadable_library_bails() {
        helpers::run(|| {
            let raw = unsafe { glib::ffi::g_malloc0(8) };
            let descriptor = BoxedCodec {
                ownership: Ownership::Full,
                type_name: "BadLibBoxed".to_owned(),
                shared_library: Some("libdoes-not-exist-xyz-12345.so.0".to_owned()),
                get_type_fn_name: None,
                free_fn_name: Some(G_FREE.to_owned()),
                caller_allocated: false,
            };

            let err = descriptor
                .decode(&ffi::Stash::Ptr(raw))
                .expect_err("decode with missing library should fail");
            assert!(format!("{err}").contains("BadLibBoxed"));

            unsafe { glib::ffi::g_free(raw) };
        });
    }

    #[test]
    fn ptr_to_value_null_with_free_fn_yields_null() {
        helpers::run(|| {
            helpers::assert_read_null_yields_null(&boxed_with_free_fn(Ownership::Full));
        });
    }

    #[test]
    fn descriptor_with_free_fn_falls_back_for_library_lookup() {
        helpers::run(|| {
            let raw = unsafe { glib::ffi::g_malloc0(8) };
            let descriptor = BoxedCodec {
                ownership: Ownership::Full,
                type_name: "LibrarylessFreeFn".to_owned(),
                shared_library: None,
                get_type_fn_name: None,
                free_fn_name: Some(G_FREE.to_owned()),
                caller_allocated: false,
            };

            let err = descriptor
                .decode(&ffi::Stash::Ptr(raw))
                .expect_err("decode without library should fail");
            assert!(format!("{err}").contains("LibrarylessFreeFn"));

            unsafe { glib::ffi::g_free(raw) };
        });
    }
}
