//! Instruction-count benchmarks over the pure marshalling hot paths.
//!
//! These exercise both marshalling directions — container and string decoding
//! (pointer and per-element index math over Rust-allocated buffers) and
//! argument encoding (`Value` extraction into FFI storage) — with no GTK or
//! `GLib` FFI, so they double as the Miri subset: deterministic,
//! runner-independent, and free of any `dlopen`'d library. Under the
//! `CodSpeed` runner the wall-clock harness is replaced by instruction
//! counting, gating the per-element cost as the input grows. The
//! buffer-view passthrough groups gate the opposite property: their cost
//! must stay flat as the view grows, because any slope means a copy crept
//! into the zero-copy path.

#![allow(clippy::significant_drop_tightening)]

use std::ffi::{CString, c_void};

use codspeed_criterion_compat::measurement::WallTime;
use codspeed_criterion_compat::{
    BenchmarkGroup, BenchmarkId, Criterion, black_box, criterion_group, criterion_main,
};
use native::ffi::FfiValue;
use native::types::{
    ArrayKind, ArrayType, BlobType, FfiDecoder as _, FfiEncoder as _, FloatKind, IntegerKind,
    Ownership, StringType, Type,
};
use native::value::{BufferView, BufferViewKind, Value};

const SIZES: [usize; 3] = [256, 1024, 4096];

fn i32_array_type(size: usize) -> ArrayType {
    ArrayType {
        item_type: Box::new(Type::Integer(IntegerKind::I32)),
        kind: ArrayKind::Fixed { size },
        ownership: Ownership::Borrowed,
        element_size: None,
    }
}

fn borrowed_string_type() -> StringType {
    StringType {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn borrowed_string_array_type(kind: ArrayKind) -> ArrayType {
    ArrayType {
        item_type: Box::new(Type::String(borrowed_string_type())),
        kind,
        ownership: Ownership::Borrowed,
        element_size: None,
    }
}

fn register_decode_case(
    group: &mut BenchmarkGroup<'_, WallTime>,
    n: usize,
    array_type: &ArrayType,
    ffi_value: &FfiValue,
    expectation: &str,
) {
    group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, _| {
        b.iter(|| {
            let decoded = array_type
                .decode_with_context(ffi_value, &[], &[])
                .expect(expectation);
            black_box(decoded);
        });
    });
}

fn bench_decode_contiguous(c: &mut Criterion) {
    let mut group = c.benchmark_group("array_decode_i32_fixed");
    for &n in &SIZES {
        let buffer: Vec<i32> = (0..n as i32).collect();
        let array_type = i32_array_type(n);
        let ffi_value = FfiValue::Ptr(buffer.as_ptr() as *mut c_void);
        register_decode_case(&mut group, n, &array_type, &ffi_value, "contiguous decode");
    }
    group.finish();
}

fn bench_encode_contiguous(c: &mut Criterion) {
    let mut group = c.benchmark_group("array_encode_i32_fixed");
    for &n in &SIZES {
        let values = Value::Array((0..n as i32).map(|i| Value::Number(f64::from(i))).collect());
        let array_type = i32_array_type(n);
        group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, _| {
            b.iter(|| {
                let encoded = array_type
                    .encode(black_box(&values), false)
                    .expect("contiguous encode");
                black_box(encoded);
            });
        });
    }
    group.finish();
}

fn bench_encode_view_passthrough(c: &mut Criterion) {
    let mut group = c.benchmark_group("buffer_view_encode_passthrough");
    for &n in &SIZES {
        let mut buffer: Vec<f32> = vec![0.0; n];
        let view = BufferView::new(
            buffer.as_mut_ptr() as *mut c_void,
            n * size_of::<f32>(),
            n,
            BufferViewKind::Float32,
            false,
        );
        let value = Value::BufferView(view);
        let array_type = ArrayType {
            item_type: Box::new(Type::Float(FloatKind::F32)),
            kind: ArrayKind::Sized { size_index: 1 },
            ownership: Ownership::Borrowed,
            element_size: None,
        };
        group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, _| {
            b.iter(|| {
                let encoded = array_type
                    .encode(black_box(&value), false)
                    .expect("view encode");
                black_box(encoded);
            });
        });
    }
    group.finish();
}

fn bench_blob_encode_passthrough(c: &mut Criterion) {
    let mut group = c.benchmark_group("blob_encode_passthrough");
    for &n in &SIZES {
        let mut buffer: Vec<u8> = vec![0; n];
        let view = BufferView::new(
            buffer.as_mut_ptr() as *mut c_void,
            n,
            n,
            BufferViewKind::Uint8,
            false,
        );
        let value = Value::BufferView(view);
        group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, _| {
            b.iter(|| {
                let encoded = BlobType
                    .encode(black_box(&value), false)
                    .expect("blob encode");
                black_box(encoded);
            });
        });
    }
    group.finish();
}

fn bench_decode_string(c: &mut Criterion) {
    let mut group = c.benchmark_group("string_decode_borrowed");
    for &n in &SIZES {
        let payload = CString::new("a".repeat(n)).expect("payload");
        let string_type = borrowed_string_type();
        let ffi_value = FfiValue::Ptr(payload.as_ptr() as *mut c_void);
        group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, _| {
            b.iter(|| {
                let decoded = string_type.decode(&ffi_value).expect("string decode");
                black_box(decoded);
            });
        });
    }
    group.finish();
}

fn bench_encode_string(c: &mut Criterion) {
    let mut group = c.benchmark_group("string_encode_borrowed");
    for &n in &SIZES {
        let value = Value::String("a".repeat(n));
        let string_type = borrowed_string_type();
        group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, _| {
            b.iter(|| {
                let encoded = string_type
                    .encode(black_box(&value), false)
                    .expect("string encode");
                black_box(encoded);
            });
        });
    }
    group.finish();
}

fn bench_decode_glist(c: &mut Criterion) {
    let mut group = c.benchmark_group("glist_decode_string");
    for &n in &SIZES {
        let payload = CString::new("x").expect("payload");
        let mut nodes: Vec<glib::ffi::GList> = (0..n)
            .map(|_| glib::ffi::GList {
                data: payload.as_ptr() as *mut c_void,
                next: std::ptr::null_mut(),
                prev: std::ptr::null_mut(),
            })
            .collect();
        let mut next: *mut glib::ffi::GList = std::ptr::null_mut();
        for node in nodes.iter_mut().rev() {
            node.next = next;
            next = std::ptr::from_mut(node);
        }
        let list_type = borrowed_string_array_type(ArrayKind::GList);
        let ffi_value = FfiValue::Ptr(nodes.as_mut_ptr() as *mut c_void);
        register_decode_case(&mut group, n, &list_type, &ffi_value, "glist decode");
    }
    group.finish();
}

fn bench_decode_zero_terminated(c: &mut Criterion) {
    let mut group = c.benchmark_group("array_decode_i32_zero_terminated");
    for &n in &SIZES {
        let mut buffer: Vec<i32> = (1..=n as i32).collect();
        buffer.push(0);
        let array_type = ArrayType {
            item_type: Box::new(Type::Integer(IntegerKind::I32)),
            kind: ArrayKind::Array,
            ownership: Ownership::Borrowed,
            element_size: None,
        };
        let ffi_value = FfiValue::Ptr(buffer.as_ptr() as *mut c_void);
        register_decode_case(
            &mut group,
            n,
            &array_type,
            &ffi_value,
            "zero-terminated decode",
        );
    }
    group.finish();
}

fn bench_decode_string_array(c: &mut Criterion) {
    let mut group = c.benchmark_group("array_decode_string_null_terminated");
    for &n in &SIZES {
        let payloads: Vec<CString> = (0..n)
            .map(|i| CString::new(format!("item-{i}")).expect("payload"))
            .collect();
        let mut ptrs: Vec<*mut c_void> =
            payloads.iter().map(|s| s.as_ptr() as *mut c_void).collect();
        ptrs.push(std::ptr::null_mut());
        let array_type = borrowed_string_array_type(ArrayKind::Array);
        let ffi_value = FfiValue::Ptr(ptrs.as_ptr() as *mut c_void);
        register_decode_case(
            &mut group,
            n,
            &array_type,
            &ffi_value,
            "string array decode",
        );
    }
    group.finish();
}

criterion_group!(
    benches,
    bench_decode_contiguous,
    bench_encode_contiguous,
    bench_encode_view_passthrough,
    bench_blob_encode_passthrough,
    bench_decode_string,
    bench_encode_string,
    bench_decode_glist,
    bench_decode_zero_terminated,
    bench_decode_string_array,
);
criterion_main!(benches);
