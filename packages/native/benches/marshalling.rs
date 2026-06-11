//! Instruction-count benchmarks over the pure marshalling hot paths.
//!
//! These exercise container decoding — pointer and per-element index math over
//! a Rust-allocated buffer — with no GTK or `GLib` FFI, so they double as the
//! Miri subset: deterministic, runner-independent, and free of any `dlopen`'d
//! library. Under the `CodSpeed` runner the wall-clock harness is replaced by
//! instruction counting, gating the per-element cost as the input grows.

#![allow(clippy::significant_drop_tightening)]

use std::ffi::c_void;

use codspeed_criterion_compat::{
    BenchmarkId, Criterion, black_box, criterion_group, criterion_main,
};
use native::ffi::FfiValue;
use native::types::{ArrayKind, ArrayType, IntegerKind, Ownership, Type};

fn i32_array_type(size: usize) -> ArrayType {
    ArrayType {
        item_type: Box::new(Type::Integer(IntegerKind::I32)),
        kind: ArrayKind::Fixed { size },
        ownership: Ownership::Borrowed,
        element_size: None,
    }
}

fn bench_decode_contiguous(c: &mut Criterion) {
    let mut group = c.benchmark_group("array_decode_i32_fixed");
    for &n in &[256_usize, 1024, 4096] {
        let buffer: Vec<i32> = (0..n as i32).collect();
        let array_type = i32_array_type(n);
        let ptr = buffer.as_ptr() as *mut c_void;
        group.bench_with_input(BenchmarkId::from_parameter(n), &n, |b, _| {
            b.iter(|| {
                let decoded = array_type
                    .decode_with_context(&FfiValue::Ptr(ptr), &[], &[])
                    .expect("contiguous decode");
                black_box(decoded);
            });
        });
    }
    group.finish();
}

criterion_group!(benches, bench_decode_contiguous);
criterion_main!(benches);
