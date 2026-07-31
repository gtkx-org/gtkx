use std::ffi::{CStr, CString, c_char, c_void};

use gtk4::glib;
use helpers::{
    assert_decode_null_yields_null, assert_read_null_yields_null, napi_mock, read_slot,
    write_owned_value_into_slot, write_return_into_slot,
};
use napi::bindgen_prelude::{External, Unknown};
use napi::{Env, JsValue as _};
use native::ffi::codec::{Decoder, Encoder, Ownership, ReadCtx, StringCodec};
use native::ffi::descriptor::Descriptor;
use native::ffi::{PendingTransfer, ReleaseKind};
use native::{Handle, ffi};
use test_support as helpers;

helpers::g_free_recorder!();

fn borrowed() -> StringCodec {
    StringCodec {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn full() -> StringCodec {
    StringCodec {
        ownership: Ownership::Full,
        length: None,
    }
}

#[test]
fn encode_borrowed_keeps_string_in_storage() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let encoded = borrowed()
            .encode(
                &env,
                napi_mock::to_unknown(&env, napi_mock::fake_string("hello")),
            )
            .expect("borrowed encode should succeed");
        let ffi::Stash::Storage(storage) = encoded else {
            panic!("expected Storage ffi value");
        };
        let read = unsafe { CStr::from_ptr(storage.ptr() as *const c_char) };
        assert_eq!(read.to_str().unwrap(), "hello");
    });
}

#[test]
fn encode_full_duplicates_into_glib_string() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let encoded = full()
            .encode(
                &env,
                napi_mock::to_unknown(&env, napi_mock::fake_string("owned")),
            )
            .expect("full encode should succeed");
        encoded.disarm_pending_transfer();
        let ffi::Stash::Storage(storage) = &encoded else {
            panic!("expected Storage ffi value");
        };
        let ptr = storage.ptr();
        assert!(!ptr.is_null());
        let read = unsafe { CStr::from_ptr(ptr as *const c_char) };
        assert_eq!(read.to_str().unwrap(), "owned");
        unsafe { glib::ffi::g_free(ptr) };
    });
}

#[test]
fn encode_full_releases_duplicate_when_call_never_happens() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let encoded = full()
            .encode(
                &env,
                napi_mock::to_unknown(&env, napi_mock::fake_string("owned")),
            )
            .expect("full encode should succeed");
        drop(encoded);
    });
}

#[test]
fn encode_null_yields_null_pointer() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let encoded = borrowed()
            .encode(&env, napi_mock::to_unknown(&env, napi_mock::fake_null()))
            .expect("null encode should succeed");
        assert!(matches!(encoded, ffi::Stash::Ptr(p) if p.is_null()));

        let encoded = borrowed()
            .encode(
                &env,
                napi_mock::to_unknown(&env, napi_mock::fake_undefined()),
            )
            .expect("undefined encode should succeed");
        assert!(matches!(encoded, ffi::Stash::Ptr(p) if p.is_null()));
    });
}

#[test]
fn decode_borrowed_reads_string() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let cstring = CString::new("decoded").unwrap();
        let decoded = borrowed()
            .decode(&env, &ffi::Stash::Ptr(cstring.as_ptr() as *mut c_void))
            .expect("borrowed decode should succeed");
        assert_eq!(
            napi_mock::read_string(decoded.raw()).as_deref(),
            Some("decoded")
        );

        let still_valid = unsafe { CStr::from_ptr(cstring.as_ptr()) };
        assert_eq!(still_valid.to_str().unwrap(), "decoded");
    });
}

#[test]
fn decode_full_reads_and_frees() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let owned = unsafe { glib::ffi::g_strdup(c"owned-decode".as_ptr()) };
        let decoded = full()
            .decode(&env, &ffi::Stash::Ptr(owned.cast::<c_void>()))
            .expect("full decode should succeed");
        assert_eq!(
            napi_mock::read_string(decoded.raw()).as_deref(),
            Some("owned-decode")
        );
    });
}

#[test]
fn decode_null_yields_null() {
    helpers::run(|| {
        assert_decode_null_yields_null(&borrowed());
    });
}

#[test]
fn ptr_to_value_reads_string() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let cstring = CString::new("ptr-value").unwrap();
        let value = unsafe {
            borrowed().read(&env, ReadCtx::value(cstring.as_ptr() as *mut c_void, "ctx"))
        }
        .expect("ptr_to_value should succeed");
        assert_eq!(
            napi_mock::read_string(value.raw()).as_deref(),
            Some("ptr-value")
        );
    });
}

#[test]
fn ptr_to_value_null_yields_null() {
    helpers::run(|| {
        assert_read_null_yields_null(&borrowed());
    });
}

#[test]
fn read_from_pointer_dereferences_pointer_slot() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let cstring = CString::new("slot").unwrap();
        let value = unsafe { read_slot(&env, &borrowed(), cstring.as_ptr() as *mut c_void) }
            .expect("read_from_pointer should succeed");
        assert_eq!(napi_mock::read_string(value.raw()).as_deref(), Some("slot"));
    });
}

#[test]
fn write_return_to_pointer_writes_duplicated_string() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let slot = write_return_into_slot(
            &env,
            &borrowed(),
            &Ok(napi_mock::to_unknown(&env, napi_mock::fake_string("ret"))),
        );

        assert!(!slot.is_null());
        let read = unsafe { CStr::from_ptr(slot as *const c_char) };
        assert_eq!(read.to_str().unwrap(), "ret");
        unsafe { glib::ffi::g_free(slot) };
    });
}

#[test]
fn write_return_to_pointer_non_string_writes_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let slot = write_return_into_slot(
            &env,
            &borrowed(),
            &Ok(napi_mock::to_unknown(&env, napi_mock::fake_double(1.0))),
        );
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_pointer_writes_string() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (slot, transfer) = write_owned_value_into_slot(
            &env,
            &borrowed(),
            std::ptr::null_mut(),
            napi_mock::to_unknown(&env, napi_mock::fake_string("field")),
        );
        assert!(!slot.is_null());
        let read = unsafe { CStr::from_ptr(slot as *const c_char) };
        assert_eq!(read.to_str().unwrap(), "field");
        transfer
            .expect("the caller owns the written string")
            .release_now();
    });
}

fn assert_write_value_to_pointer_writes_null(env: &Env, value: Unknown<'_>) {
    let (slot, transfer) =
        write_owned_value_into_slot(env, &borrowed(), std::ptr::dangling_mut::<c_void>(), value);
    assert!(slot.is_null());
    transfer
        .expect("a null write still reports the slot no longer owns a string")
        .release_now();
}

#[test]
fn write_value_to_pointer_writes_null() {
    helpers::run(|| {
        let env = helpers::fake_env();
        assert_write_value_to_pointer_writes_null(
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_null()),
        );
        assert_write_value_to_pointer_writes_null(
            &env,
            napi_mock::to_unknown(&env, napi_mock::fake_undefined()),
        );
    });
}

fn write_over_previous_string(
    env: &Env,
    codec: &StringCodec,
    value: napi::sys::napi_value,
) -> (*mut c_void, *mut c_void, bool, Option<PendingTransfer>) {
    let previous = unsafe { glib::ffi::g_strdup(c"stale".as_ptr()) }.cast::<c_void>();
    drain_g_freed();
    let (slot, transfer) =
        write_owned_value_into_slot(env, codec, previous, napi_mock::to_unknown(env, value));
    let previous_freed = drain_g_freed().contains(&(previous as usize));
    (slot, previous, previous_freed, transfer)
}

#[test]
fn write_value_to_pointer_full_frees_previous_owned_string() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (slot, previous, previous_freed, transfer) =
            write_over_previous_string(&env, &full(), napi_mock::fake_string("fresh"));

        assert!(
            previous_freed,
            "an owned slot overwrite must free the previous string"
        );
        assert!(transfer.is_none());
        assert!(!slot.is_null());
        assert_ne!(slot, previous);
        let read = unsafe { CStr::from_ptr(slot as *const c_char) };
        assert_eq!(read.to_str().unwrap(), "fresh");
        unsafe { glib::ffi::g_free(slot) };
    });
}

#[test]
fn write_value_to_pointer_full_null_write_frees_previous_owned_string() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (slot, _previous, previous_freed, transfer) =
            write_over_previous_string(&env, &full(), napi_mock::fake_null());

        assert!(
            previous_freed,
            "clearing an owned slot must free the previous string"
        );
        assert!(transfer.is_none());
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_pointer_borrowed_keeps_previous_string() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (slot, previous, previous_freed, transfer) =
            write_over_previous_string(&env, &borrowed(), napi_mock::fake_string("fresh"));

        assert!(
            !previous_freed,
            "an unowned slot overwrite must not free the previous string"
        );
        let kept = unsafe { CStr::from_ptr(previous as *const c_char) };
        assert_eq!(kept.to_str().unwrap(), "stale");
        drain_g_freed();
        transfer
            .expect("the caller owns the written string")
            .release_now();
        assert_eq!(drain_g_freed(), vec![slot as usize]);
        unsafe { glib::ffi::g_free(previous) };
    });
}

#[test]
fn a_struct_handle_owns_the_strings_written_into_its_fields() {
    helpers::run(|| {
        let block = unsafe { glib::ffi::g_malloc0(16) };
        let handle = Handle::owned_struct(block);
        let fields = handle
            .field_store()
            .expect("a struct handle owns its field transfers");
        let first = unsafe { glib::ffi::g_strdup(c"first".as_ptr()) }.cast::<c_void>();
        let second = unsafe { glib::ffi::g_strdup(c"second".as_ptr()) }.cast::<c_void>();

        fields.adopt(0, PendingTransfer::new(first, ReleaseKind::GFree));
        drain_g_freed();

        fields.adopt(0, PendingTransfer::new(second, ReleaseKind::GFree));
        assert_eq!(drain_g_freed(), vec![first as usize]);

        drop(handle);
        let freed = drain_g_freed();
        assert!(freed.contains(&(second as usize)));
        assert!(freed.contains(&(block as usize)));
    });
}

#[test]
fn a_boxed_handle_leaves_its_field_strings_to_its_own_free_function() {
    helpers::run(|| {
        let (boxed, _) = helpers::owned_rgba_boxed();
        let handle = Handle::from(boxed);

        assert!(handle.field_store().is_none());

        drop(handle);
    });
}

fn write_string_field(env: &Env, handle: &External<Handle>, ownership: Ownership, text: &str) {
    native::api::write::write(
        env,
        handle,
        Descriptor::String {
            ownership,
            length: None,
        },
        0.0,
        napi_mock::to_unknown(env, napi_mock::fake_string(text)),
    )
    .expect("field write should succeed");
}

#[test]
fn repeated_owned_field_writes_free_the_displaced_string_once() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let handle = External::new(Handle::owned_struct(unsafe { glib::ffi::g_malloc0(16) }));

        write_string_field(&env, &handle, Ownership::Full, "first");
        let first = unsafe { ffi::Slot::new(handle.as_ptr()).load() };
        drain_g_freed();

        write_string_field(&env, &handle, Ownership::Full, "second");
        assert_eq!(
            drain_g_freed(),
            vec![first as usize],
            "the displaced string must be freed exactly once"
        );

        let second = unsafe { ffi::Slot::new(handle.as_ptr()).load() };
        unsafe { glib::ffi::g_free(second) };
    });
}

#[test]
fn a_transfer_none_field_write_is_owned_by_the_handle() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let handle = External::new(Handle::owned_struct(unsafe { glib::ffi::g_malloc0(16) }));

        write_string_field(&env, &handle, Ownership::Borrowed, "first");
        let first = unsafe { ffi::Slot::new(handle.as_ptr()).load() };
        drain_g_freed();

        write_string_field(&env, &handle, Ownership::Borrowed, "second");
        assert_eq!(
            drain_g_freed(),
            vec![first as usize],
            "the handle releases the string it displaced"
        );

        let second = unsafe { ffi::Slot::new(handle.as_ptr()).load() };
        drop(handle);
        assert!(drain_g_freed().contains(&(second as usize)));
    });
}

#[test]
fn a_transfer_none_field_write_on_a_boxed_handle_is_left_to_its_free_function() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let (boxed, _) = helpers::owned_rgba_boxed();
        let handle = External::new(Handle::from(boxed));

        write_string_field(&env, &handle, Ownership::Borrowed, "field");
        let written = unsafe { ffi::Slot::new(handle.as_ptr()).load() };
        drain_g_freed();

        // A boxed handle is released by its own free function, which already owns whatever its
        // fields point at; adopting the write as well would free the same pointer twice.
        drop(handle);
        assert!(!drain_g_freed().contains(&(written as usize)));
        unsafe { glib::ffi::g_free(written) };
    });
}

#[test]
fn a_borrowed_write_hands_its_allocation_to_the_caller() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let value = napi_mock::to_unknown(&env, napi_mock::fake_string("field"));
        let (slot, transfer) =
            write_owned_value_into_slot(&env, &borrowed(), std::ptr::null_mut(), value);

        let transfer =
            transfer.expect("a transfer-none string write allocates the value it stores");
        assert!(!slot.is_null());
        drain_g_freed();
        transfer.release_now();
        assert_eq!(drain_g_freed(), vec![slot as usize]);
    });
}

#[test]
fn an_owned_write_keeps_its_allocation_in_the_slot() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let value = napi_mock::to_unknown(&env, napi_mock::fake_string("field"));
        let (slot, transfer) =
            write_owned_value_into_slot(&env, &full(), std::ptr::null_mut(), value);

        assert!(
            transfer.is_none(),
            "a transfer-full string write leaves the slot owning the value"
        );
        unsafe { glib::ffi::g_free(slot) };
    });
}
