mod common;

use std::ffi::c_void;

use native::ffi::FfiValue;
use native::types::{ArrayType, BlobType, FfiDecoder as _, FfiEncoder as _};
use native::value::{BufferView, BufferViewKind, Value};

use common::{f32_array_type, i32_array_type};

fn decode_array_items(array_type: &ArrayType, buffer_ptr: *const i32) -> Vec<Value> {
    let decoded = array_type
        .decode_with_context(&FfiValue::Ptr(buffer_ptr as *mut c_void), &[], &[])
        .expect("contiguous decode");
    let Value::Array(items) = decoded else {
        panic!("expected an array value");
    };
    items
}

#[test]
fn decodes_contiguous_i32_array_from_buffer() {
    let buffer: Vec<i32> = vec![10, 20, 30, 40];
    let array_type = i32_array_type(buffer.len());

    let items = decode_array_items(&array_type, buffer.as_ptr());

    assert_eq!(items.len(), buffer.len());
}

#[test]
fn decodes_empty_contiguous_array() {
    let array_type = i32_array_type(0);
    let buffer: Vec<i32> = vec![1];

    let items = decode_array_items(&array_type, buffer.as_ptr());

    assert!(items.is_empty());
}

fn encoded_ptr(encoded: &FfiValue) -> *mut c_void {
    let FfiValue::Ptr(ptr) = encoded else {
        panic!("expected a pointer passthrough, got {encoded:?}");
    };
    *ptr
}

#[test]
fn buffer_view_array_passthrough_shares_the_backing_store() {
    let mut buffer: Vec<f32> = vec![1.0, 2.0, 3.0];
    let view = BufferView::new(
        buffer.as_mut_ptr() as *mut c_void,
        buffer.len() * size_of::<f32>(),
        buffer.len(),
        BufferViewKind::Float32,
        false,
    );
    let array_type = f32_array_type();

    let encoded = array_type
        .encode(&Value::BufferView(view))
        .expect("view encode");
    let ptr = encoded_ptr(&encoded);
    assert_eq!(ptr, buffer.as_mut_ptr() as *mut c_void);

    // SAFETY: the encode passed the buffer through unchanged, so `ptr` aliases the live `buffer`
    // of three `f32`s; index 1 is in bounds and correctly typed, so the write is sound.
    unsafe { *ptr.cast::<f32>().add(1) = 9.5 };
    assert_eq!(buffer[1], 9.5);
}

#[test]
fn blob_view_passthrough_reads_and_writes_the_backing_store() {
    let mut buffer: Vec<u8> = vec![10, 20, 30];
    let view = BufferView::new(
        buffer.as_mut_ptr() as *mut c_void,
        buffer.len(),
        buffer.len(),
        BufferViewKind::Uint8,
        false,
    );

    let encoded = BlobType
        .encode(&Value::BufferView(view))
        .expect("blob encode");
    let ptr = encoded_ptr(&encoded);
    assert_eq!(ptr, buffer.as_mut_ptr() as *mut c_void);

    // SAFETY: the blob encode passed the buffer through unchanged, so `ptr` aliases the live
    // `buffer` of three `u8`s; indices 0 and 2 are in bounds, so the read and write are sound.
    unsafe {
        assert_eq!(*ptr.cast::<u8>(), 10);
        *ptr.cast::<u8>().add(2) = 99;
    }
    assert_eq!(buffer[2], 99);
}
