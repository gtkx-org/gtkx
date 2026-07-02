use test_support as helpers;

use std::ffi::c_void;

use native::ffi::Stash;
use native::ffi::codec::{ArrayCodec, BufferCodec, Decoder as _, Encoder as _};
use native::ffi::value::{BufferView, BufferViewKind, Value};

use helpers::{f32_array_codec, i32_array_codec};

fn decode_array_items(array_codec: &ArrayCodec, buffer_ptr: *const i32) -> Vec<Value> {
    let decoded = array_codec
        .decode_with_context(&Stash::Ptr(buffer_ptr as *mut c_void), &[], &[])
        .expect("contiguous decode");
    let Value::Array(items) = decoded else {
        panic!("expected an array value");
    };
    items
}

#[test]
fn decodes_contiguous_i32_array_from_buffer() {
    let buffer: Vec<i32> = vec![10, 20, 30, 40];
    let array_codec = i32_array_codec(buffer.len() as u32);

    let items = decode_array_items(&array_codec, buffer.as_ptr());

    assert_eq!(items.len(), buffer.len());
}

#[test]
fn decodes_empty_contiguous_array() {
    let array_codec = i32_array_codec(0);
    let buffer: Vec<i32> = vec![1];

    let items = decode_array_items(&array_codec, buffer.as_ptr());

    assert!(items.is_empty());
}

fn encoded_ptr(encoded: &Stash) -> *mut c_void {
    let Stash::Ptr(ptr) = encoded else {
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
    );
    let array_codec = f32_array_codec();

    let encoded = array_codec
        .encode(&Value::BufferView(view))
        .expect("view encode");
    let ptr = encoded_ptr(&encoded);
    assert_eq!(ptr, buffer.as_mut_ptr() as *mut c_void);

    unsafe { *ptr.cast::<f32>().add(1) = 9.5 };
    assert_eq!(buffer[1], 9.5);
}

#[test]
fn buffer_view_passthrough_reads_and_writes_the_backing_store() {
    let mut buffer: Vec<u8> = vec![10, 20, 30];
    let view = BufferView::new(
        buffer.as_mut_ptr() as *mut c_void,
        buffer.len(),
        buffer.len(),
        BufferViewKind::Uint8,
    );

    let encoded = BufferCodec
        .encode(&Value::BufferView(view))
        .expect("buffer encode");
    let ptr = encoded_ptr(&encoded);
    assert_eq!(ptr, buffer.as_mut_ptr() as *mut c_void);

    unsafe {
        assert_eq!(*ptr.cast::<u8>(), 10);
        *ptr.cast::<u8>().add(2) = 99;
    }
    assert_eq!(buffer[2], 99);
}
