mod common;

use std::ffi::{CStr, CString, c_char, c_void};

use gtk4::glib;

use native::ffi;
use native::types::{FfiDecoder, FfiEncoder, Ownership, RawPtrCodec, ReadSource, StringType};
use native::value::Value;

use common::{
    assert_decode_null_yields_null, assert_read_null_yields_null, read_slot, write_return_into_slot,
};

fn borrowed() -> StringType {
    StringType {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn full() -> StringType {
    StringType {
        ownership: Ownership::Full,
        length: None,
    }
}

#[test]
fn encode_borrowed_keeps_string_in_storage() {
    common::run(|| {
        let encoded = borrowed()
            .encode(&Value::String("hello".to_owned()))
            .expect("borrowed encode should succeed");
        let ffi::FfiValue::Storage(storage) = encoded else {
            panic!("expected Storage ffi value");
        };
        // SAFETY: the borrowed encode kept the source string alive inside `storage`, so its
        // pointer addresses a valid NUL-terminated C string for `CStr::from_ptr`.
        let read = unsafe { CStr::from_ptr(storage.ptr() as *const c_char) };
        assert_eq!(read.to_str().unwrap(), "hello");
    });
}

#[test]
fn encode_full_duplicates_into_glib_string() {
    common::run(|| {
        let encoded = full()
            .encode(&Value::String("owned".to_owned()))
            .expect("full encode should succeed");
        encoded.disarm_pending_transfer();
        let ffi::FfiValue::Storage(storage) = &encoded else {
            panic!("expected Storage ffi value");
        };
        let ptr = storage.ptr();
        assert!(!ptr.is_null());
        // SAFETY: the full encode produced a freshly `g_malloc`-ed NUL-terminated copy at `ptr`
        // whose transfer was disarmed, so this owns it: `CStr::from_ptr` reads the valid string.
        let read = unsafe { CStr::from_ptr(ptr as *const c_char) };
        assert_eq!(read.to_str().unwrap(), "owned");
        // SAFETY: `ptr` is the owned `g_malloc`-ed duplicate; `g_free` releases it exactly once.
        unsafe { glib::ffi::g_free(ptr) };
    });
}

#[test]
fn encode_full_releases_duplicate_when_call_never_happens() {
    common::run(|| {
        let encoded = full()
            .encode(&Value::String("owned".to_owned()))
            .expect("full encode should succeed");
        drop(encoded);
    });
}

#[test]
fn encode_null_yields_null_pointer() {
    common::run(|| {
        let encoded = borrowed()
            .encode(&Value::Null)
            .expect("null encode should succeed");
        assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p.is_null()));

        let encoded = borrowed()
            .encode(&Value::Undefined)
            .expect("undefined encode should succeed");
        assert!(matches!(encoded, ffi::FfiValue::Ptr(p) if p.is_null()));
    });
}

#[test]
fn decode_borrowed_reads_string() {
    common::run(|| {
        let cstring = CString::new("decoded").unwrap();
        let decoded = borrowed()
            .decode(&ffi::FfiValue::Ptr(cstring.as_ptr() as *mut c_void))
            .expect("borrowed decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "decoded"));
    });
}

#[test]
fn decode_full_reads_and_frees() {
    common::run(|| {
        // SAFETY: `c"owned-decode"` is a valid NUL-terminated C string literal; `g_strdup` returns
        // a freshly `g_malloc`-ed owned copy that the full decode below takes ownership of and frees.
        let owned = unsafe { glib::ffi::g_strdup(c"owned-decode".as_ptr()) };
        let decoded = full()
            .decode(&ffi::FfiValue::Ptr(owned as *mut c_void))
            .expect("full decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "owned-decode"));
    });
}

#[test]
fn decode_null_yields_null() {
    common::run(|| {
        assert_decode_null_yields_null(&borrowed());
    });
}

#[test]
fn ptr_to_value_reads_string() {
    common::run(|| {
        let cstring = CString::new("ptr-value").unwrap();
        // SAFETY: `cstring` stays alive for the call, so the `ReadSource::Value` pointer addresses
        // a valid NUL-terminated C string that the borrowed string codec reads without taking it.
        let value =
            unsafe { borrowed().read(ReadSource::Value(cstring.as_ptr() as *mut c_void, "ctx")) }
                .expect("ptr_to_value should succeed");
        assert!(matches!(value, Value::String(s) if s == "ptr-value"));
    });
}

#[test]
fn ptr_to_value_null_yields_null() {
    common::run(|| {
        assert_read_null_yields_null(&borrowed());
    });
}

#[test]
fn read_from_raw_ptr_dereferences_pointer_slot() {
    common::run(|| {
        let cstring = CString::new("slot").unwrap();
        // SAFETY: `read_slot` places `cstring`'s pointer into a pointer slot and reads through it;
        // `cstring` stays alive for the call, so the slot points to a valid NUL-terminated string.
        let value = unsafe { read_slot(&borrowed(), cstring.as_ptr() as *mut c_void) }
            .expect("read_from_raw_ptr should succeed");
        assert!(matches!(value, Value::String(s) if s == "slot"));
    });
}

#[test]
fn write_return_to_raw_ptr_writes_duplicated_string() {
    common::run(|| {
        let slot = write_return_into_slot(&borrowed(), &Ok(Value::String("ret".to_owned())));

        assert!(!slot.is_null());
        // SAFETY: the borrowed return write duplicated the string into the freshly `g_malloc`-ed
        // `slot`, so it addresses a valid NUL-terminated C string for `CStr::from_ptr`.
        let read = unsafe { CStr::from_ptr(slot as *const c_char) };
        assert_eq!(read.to_str().unwrap(), "ret");
        // SAFETY: `slot` is the owned `g_malloc`-ed duplicate; `g_free` releases it exactly once.
        unsafe { glib::ffi::g_free(slot) };
    });
}

#[test]
fn write_return_to_raw_ptr_non_string_writes_null() {
    common::run(|| {
        let slot = write_return_into_slot(&borrowed(), &Ok(Value::Number(1.0)));
        assert!(slot.is_null());
    });
}

#[test]
fn write_value_to_raw_ptr_writes_string() {
    common::run(|| {
        let mut slot: *mut c_char = std::ptr::null_mut();
        // SAFETY: the address of the live, writable pointer stack local `slot` is the pointer slot
        // `write_value_to_raw_ptr` stores the duplicated string pointer into, which is in bounds.
        unsafe {
            borrowed().write_value_to_raw_ptr(
                &mut slot as *mut *mut c_char as *mut c_void,
                &Value::String("field".to_owned()),
            )
        }
        .expect("write_value_to_raw_ptr should succeed");
        assert!(!slot.is_null());
        // SAFETY: `slot` now holds the freshly `g_malloc`-ed duplicate, a valid NUL-terminated C
        // string for `CStr::from_ptr`.
        let read = unsafe { CStr::from_ptr(slot) };
        assert_eq!(read.to_str().unwrap(), "field");
        // SAFETY: `slot` is the owned `g_malloc`-ed duplicate; `g_free` releases it exactly once.
        unsafe { glib::ffi::g_free(slot as *mut c_void) };
    });
}

fn assert_write_value_to_raw_ptr_writes_null(value: &Value) {
    let mut slot: *const c_char = std::ptr::dangling::<c_char>();
    // SAFETY: the address of the live, writable pointer stack local `slot` is the pointer slot
    // `write_value_to_raw_ptr` writes into; for a null/undefined value it stores a null pointer,
    // overwriting the dangling sentinel without ever dereferencing it.
    unsafe {
        borrowed().write_value_to_raw_ptr(&mut slot as *mut *const c_char as *mut c_void, value)
    }
    .expect("write should succeed");
    assert!(slot.is_null());
}

#[test]
fn write_value_to_raw_ptr_writes_null() {
    common::run(|| {
        assert_write_value_to_raw_ptr_writes_null(&Value::Null);
        assert_write_value_to_raw_ptr_writes_null(&Value::Undefined);
    });
}
