//! FFI-free marshalling tests that double as the Miri subset.
//!
//! Miri has no access to FFI, so it cannot execute a `dlopen`'d GTK or `GLib`.
//! Every test here touches only pointer and per-element index math over a
//! Rust-allocated buffer — the container-decode hot path — so Miri can validate
//! the unsafe pointer arithmetic for out-of-bounds and provenance violations.
//! `scripts/ci-miri.sh` runs exactly this target under Miri.

use std::ffi::c_void;

use native::ffi::FfiValue;
use native::types::{
    ArrayKind, ArrayType, BlobType, FfiEncoder as _, FloatKind, IntegerKind, Ownership, Type,
};
use native::value::{BufferView, BufferViewKind, Value};

fn i32_array_type(size: usize) -> ArrayType {
    ArrayType {
        item_type: Box::new(Type::Integer(IntegerKind::I32)),
        kind: ArrayKind::Fixed { size },
        ownership: Ownership::Borrowed,
        element_size: None,
    }
}

#[test]
fn decodes_contiguous_i32_array_from_buffer() {
    let buffer: Vec<i32> = vec![10, 20, 30, 40];
    let array_type = i32_array_type(buffer.len());

    let decoded = array_type
        .decode_with_context(&FfiValue::Ptr(buffer.as_ptr() as *mut c_void), &[], &[])
        .expect("contiguous decode");

    let Value::Array(items) = decoded else {
        panic!("expected an array value");
    };
    assert_eq!(items.len(), buffer.len());
}

#[test]
fn decodes_empty_contiguous_array() {
    let array_type = i32_array_type(0);
    let buffer: Vec<i32> = vec![1];

    let decoded = array_type
        .decode_with_context(&FfiValue::Ptr(buffer.as_ptr() as *mut c_void), &[], &[])
        .expect("contiguous decode");

    let Value::Array(items) = decoded else {
        panic!("expected an array value");
    };
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
    let array_type = ArrayType {
        item_type: Box::new(Type::Float(FloatKind::F32)),
        kind: ArrayKind::Sized { size_index: 1 },
        ownership: Ownership::Borrowed,
        element_size: None,
    };

    let encoded = array_type
        .encode(&Value::BufferView(view), false)
        .expect("view encode");
    let ptr = encoded_ptr(&encoded);
    assert_eq!(ptr, buffer.as_mut_ptr() as *mut c_void);

    // SAFETY: `ptr` is the live backing store of `buffer`, with mutable
    // provenance taken at view construction; this models a callee write-back.
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
        .encode(&Value::BufferView(view), false)
        .expect("blob encode");
    let ptr = encoded_ptr(&encoded);
    assert_eq!(ptr, buffer.as_mut_ptr() as *mut c_void);

    // SAFETY: `ptr` is the live backing store of `buffer`, with mutable
    // provenance taken at view construction; this models a callee
    // read-then-write.
    unsafe {
        assert_eq!(*ptr.cast::<u8>(), 10);
        *ptr.cast::<u8>().add(2) = 99;
    }
    assert_eq!(buffer[2], 99);
}
