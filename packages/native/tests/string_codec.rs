use test_support as helpers;

use std::ffi::{CStr, CString, c_char, c_void};

use gtk4::glib;

use native::ffi;
use native::ffi::codec::{Decoder, Encoder, Ownership, PtrWriter, ReadSource, StringCodec};
use native::ffi::value::Value;

use helpers::{
    assert_decode_null_yields_null, assert_read_null_yields_null, read_slot, write_return_into_slot,
};

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
        let encoded = borrowed()
            .encode(&Value::String("hello".to_owned()))
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
        let encoded = full()
            .encode(&Value::String("owned".to_owned()))
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
        let encoded = full()
            .encode(&Value::String("owned".to_owned()))
            .expect("full encode should succeed");
        drop(encoded);
    });
}

#[test]
fn encode_null_yields_null_pointer() {
    helpers::run(|| {
        let encoded = borrowed()
            .encode(&Value::Null)
            .expect("null encode should succeed");
        assert!(matches!(encoded, ffi::Stash::Ptr(p) if p.is_null()));

        let encoded = borrowed()
            .encode(&Value::Undefined)
            .expect("undefined encode should succeed");
        assert!(matches!(encoded, ffi::Stash::Ptr(p) if p.is_null()));
    });
}

#[test]
fn decode_borrowed_reads_string() {
    helpers::run(|| {
        let cstring = CString::new("decoded").unwrap();
        let decoded = borrowed()
            .decode(&ffi::Stash::Ptr(cstring.as_ptr() as *mut c_void))
            .expect("borrowed decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "decoded"));

        let still_valid = unsafe { CStr::from_ptr(cstring.as_ptr()) };
        assert_eq!(still_valid.to_str().unwrap(), "decoded");
    });
}

#[test]
fn decode_full_reads_and_frees() {
    helpers::run(|| {
        let owned = unsafe { glib::ffi::g_strdup(c"owned-decode".as_ptr()) };
        let decoded = full()
            .decode(&ffi::Stash::Ptr(owned as *mut c_void))
            .expect("full decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "owned-decode"));
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
        let cstring = CString::new("ptr-value").unwrap();
        let value =
            unsafe { borrowed().read(ReadSource::Value(cstring.as_ptr() as *mut c_void, "ctx")) }
                .expect("ptr_to_value should succeed");
        assert!(matches!(value, Value::String(s) if s == "ptr-value"));
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
        let cstring = CString::new("slot").unwrap();
        let value = unsafe { read_slot(&borrowed(), cstring.as_ptr() as *mut c_void) }
            .expect("read_from_pointer should succeed");
        assert!(matches!(value, Value::String(s) if s == "slot"));
    });
}

#[test]
fn write_return_to_pointer_writes_duplicated_string() {
    helpers::run(|| {
        let slot = write_return_into_slot(&borrowed(), &Ok(Value::String("ret".to_owned())));

        assert!(!slot.is_null());
        let read = unsafe { CStr::from_ptr(slot as *const c_char) };
        assert_eq!(read.to_str().unwrap(), "ret");
        unsafe { glib::ffi::g_free(slot) };
    });
}

#[test]
fn write_return_to_pointer_non_string_writes_null() {
    helpers::run(|| {
        let slot = write_return_into_slot(&borrowed(), &Ok(Value::Number(1.0)));
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_pointer_writes_string() {
    helpers::run(|| {
        let mut slot: *mut c_char = std::ptr::null_mut();
        borrowed()
            .write_value_to_ptr(
                unsafe { ffi::Slot::new(&mut slot as *mut *mut c_char as *mut c_void) },
                &Value::String("field".to_owned()),
            )
            .expect("write_value_to_ptr should succeed");
        assert!(!slot.is_null());
        let read = unsafe { CStr::from_ptr(slot) };
        assert_eq!(read.to_str().unwrap(), "field");
        unsafe { glib::ffi::g_free(slot as *mut c_void) };
    });
}

fn assert_write_value_to_pointer_writes_null(value: &Value) {
    let mut slot: *const c_char = std::ptr::dangling::<c_char>();
    borrowed()
        .write_value_to_ptr(
            unsafe { ffi::Slot::new(&mut slot as *mut *const c_char as *mut c_void) },
            value,
        )
        .expect("write should succeed");
    assert!(slot.is_null());
}

#[test]
fn write_value_to_pointer_writes_null() {
    helpers::run(|| {
        assert_write_value_to_pointer_writes_null(&Value::Null);
        assert_write_value_to_pointer_writes_null(&Value::Undefined);
    });
}
