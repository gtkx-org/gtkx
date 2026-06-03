//! FFI-free marshalling tests that double as the Miri subset.
//!
//! Miri has no access to FFI, so it cannot execute a `dlopen`'d GTK or `GLib`.
//! Every test here touches only pointer and per-element index math over a
//! Rust-allocated buffer — the container-decode hot path — so Miri can validate
//! the unsafe pointer arithmetic for out-of-bounds and provenance violations.
//! `scripts/ci-miri.sh` runs exactly this target under Miri.

use std::ffi::c_void;

use native::ffi::FfiValue;
use native::types::{ArrayKind, ArrayType, IntegerKind, Ownership, Type};
use native::value::Value;

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
