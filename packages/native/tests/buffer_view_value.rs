use test_support as helpers;

use std::ffi::c_void;

use napi::sys;
use native::ffi::value::{BufferView, BufferViewKind, Value};
use native::handle::{Boxed, Fundamental, Handle};

const ALL_KINDS: [BufferViewKind; 12] = [
    BufferViewKind::Int8,
    BufferViewKind::Uint8,
    BufferViewKind::Uint8Clamped,
    BufferViewKind::Int16,
    BufferViewKind::Uint16,
    BufferViewKind::Int32,
    BufferViewKind::Uint32,
    BufferViewKind::Float32,
    BufferViewKind::Float64,
    BufferViewKind::BigInt64,
    BufferViewKind::BigUint64,
    BufferViewKind::DataView,
];

fn fake_ptr(addr: usize) -> *mut c_void {
    std::ptr::without_provenance_mut::<c_void>(addr)
}

fn null_boxed() -> Boxed {
    Boxed::from_glib_full(None, std::ptr::null_mut())
}

fn null_fundamental() -> Fundamental {
    Fundamental::from_glib_full(std::ptr::null_mut(), None, None)
}

#[test]
fn buffer_view_kind_display_matches_js_names() {
    let expected = [
        (BufferViewKind::Int8, "Int8Array"),
        (BufferViewKind::Uint8, "Uint8Array"),
        (BufferViewKind::Uint8Clamped, "Uint8ClampedArray"),
        (BufferViewKind::Int16, "Int16Array"),
        (BufferViewKind::Uint16, "Uint16Array"),
        (BufferViewKind::Int32, "Int32Array"),
        (BufferViewKind::Uint32, "Uint32Array"),
        (BufferViewKind::Float32, "Float32Array"),
        (BufferViewKind::Float64, "Float64Array"),
        (BufferViewKind::BigInt64, "BigInt64Array"),
        (BufferViewKind::BigUint64, "BigUint64Array"),
        (BufferViewKind::DataView, "DataView"),
    ];
    for (kind, name) in expected {
        assert_eq!(kind.to_string(), name);
        assert_eq!(format!("{kind}"), name);
    }
}

#[test]
fn buffer_view_byte_length_tracks_kind_element_size() {
    for kind in ALL_KINDS {
        let length = 5usize;
        let byte_length = length * kind.element_size();
        let ptr = fake_ptr(0x80);
        let view = BufferView::new(ptr, byte_length, length, kind);
        assert_eq!(view.ptr(), ptr);
        assert_eq!(view.byte_length(), byte_length);
        assert_eq!(view.length(), length);
        assert_eq!(view.kind(), kind);
        assert_eq!(
            view.byte_length(),
            view.length() * view.kind().element_size()
        );
    }
}

#[test]
fn buffer_view_kind_rejects_unknown_tag() {
    let unknown: sys::napi_typedarray_type = 99;
    let error = BufferViewKind::try_from(unknown).expect_err("an unknown tag must be rejected");
    assert!(matches!(error.status, napi::Status::InvalidArg));
    assert!(error.reason.contains("Unsupported typed-array type tag"));
    assert!(error.reason.contains("99"));
}

#[test]
fn buffer_view_kind_debug_is_non_empty_and_distinct() {
    let mut rendered: Vec<String> = ALL_KINDS.iter().map(|kind| format!("{kind:?}")).collect();
    assert!(rendered.iter().all(|text| !text.is_empty()));
    rendered.sort();
    let unique = rendered.len();
    rendered.dedup();
    assert_eq!(rendered.len(), unique);
}

#[test]
fn buffer_view_is_copy_and_clone_and_debug() {
    let ptr = fake_ptr(0x100);
    let view = BufferView::new(ptr, 16, 4, BufferViewKind::Int32);
    let copied = view;
    let cloned = Clone::clone(&view);
    for other in [copied, cloned] {
        assert_eq!(other.ptr(), view.ptr());
        assert_eq!(other.byte_length(), view.byte_length());
        assert_eq!(other.length(), view.length());
        assert_eq!(other.kind(), view.kind());
    }
    assert!(format!("{view:?}").contains("BufferView"));
}

#[test]
fn from_boxed_produces_null_backed_object() {
    let value = Value::from(null_boxed());
    let ptr = value
        .object_ptr("GdkRGBA")
        .expect("a boxed-backed object should expose its pointer");
    assert!(ptr.is_null());
    assert!(matches!(value, Value::Object(_)));
}

#[test]
fn from_fundamental_produces_null_backed_object() {
    let value = Value::from(null_fundamental());
    let ptr = value
        .object_ptr("GVariant")
        .expect("a fundamental-backed object should expose its pointer");
    assert!(ptr.is_null());
    assert!(matches!(value, Value::Object(_)));
}

#[test]
fn from_handle_value_produces_object() {
    let value = Value::from(native::handle::Value::Fundamental(null_fundamental()));
    assert!(matches!(value, Value::Object(_)));
    assert!(
        value
            .object_ptr("GVariant")
            .expect("object_ptr should succeed")
            .is_null()
    );
}

#[test]
fn from_owned_boxed_keeps_backing_pointer() {
    helpers::run(|| {
        let (boxed, ptr) = helpers::owned_rgba_boxed();
        let value = Value::from(boxed);
        assert_eq!(
            value
                .object_ptr("GdkRGBA")
                .expect("object_ptr should succeed"),
            ptr
        );
    });
}

#[test]
fn value_variants_clone_matches_debug() {
    let samples = vec![
        Value::Number(3.5),
        Value::BigInt(-42),
        Value::String("hello".to_owned()),
        Value::Boolean(true),
        Value::Null,
        Value::Undefined,
        Value::Array(vec![Value::Number(1.0), Value::Boolean(false)]),
        Value::BufferView(BufferView::new(
            fake_ptr(0x10),
            8,
            2,
            BufferViewKind::Float32,
        )),
        Value::Object(Handle::from_glib_borrow(std::ptr::null_mut())),
    ];
    for sample in &samples {
        let cloned = sample.clone();
        assert_eq!(format!("{sample:?}"), format!("{cloned:?}"));
    }
}

#[test]
fn nested_array_value_clone_is_independent() {
    let original = Value::Array(vec![Value::Array(vec![Value::String("deep".to_owned())])]);
    let cloned = original.clone();
    assert_eq!(format!("{original:?}"), format!("{cloned:?}"));
    match cloned {
        Value::Array(items) => assert_eq!(items.len(), 1),
        other => panic!("expected Value::Array, got {other:?}"),
    }
}
