use test_support as helpers;
use test_support::napi_mock;

use std::ffi::c_void;

use napi::Env;
use napi::sys;
use native::ffi::value::{TypedView, ViewKind};

const ALL_KINDS: [ViewKind; 12] = [
    ViewKind::Int8,
    ViewKind::Uint8,
    ViewKind::Uint8Clamped,
    ViewKind::Int16,
    ViewKind::Uint16,
    ViewKind::Int32,
    ViewKind::Uint32,
    ViewKind::Float32,
    ViewKind::Float64,
    ViewKind::BigInt64,
    ViewKind::BigUint64,
    ViewKind::DataView,
];

fn fake_ptr(addr: usize) -> *mut c_void {
    std::ptr::without_provenance_mut::<c_void>(addr)
}

fn view_kind_to_typedarray(kind: ViewKind) -> sys::napi_typedarray_type {
    match kind {
        ViewKind::Int8 => sys::TypedarrayType::int8_array,
        ViewKind::Uint8 => sys::TypedarrayType::uint8_array,
        ViewKind::Uint8Clamped => sys::TypedarrayType::uint8_clamped_array,
        ViewKind::Int16 => sys::TypedarrayType::int16_array,
        ViewKind::Uint16 => sys::TypedarrayType::uint16_array,
        ViewKind::Int32 => sys::TypedarrayType::int32_array,
        ViewKind::Uint32 => sys::TypedarrayType::uint32_array,
        ViewKind::Float32 => sys::TypedarrayType::float32_array,
        ViewKind::Float64 => sys::TypedarrayType::float64_array,
        ViewKind::BigInt64 => sys::TypedarrayType::bigint64_array,
        ViewKind::BigUint64 => sys::TypedarrayType::biguint64_array,
        ViewKind::DataView => unreachable!("DataView is not a typed array"),
    }
}

fn make_view(env: &Env, ptr: *mut c_void, length: usize, kind: ViewKind) -> TypedView {
    let raw = if kind == ViewKind::DataView {
        napi_mock::fake_data_view(ptr, length * kind.element_size(), 0)
    } else {
        napi_mock::fake_typed_array(view_kind_to_typedarray(kind), ptr, length, 0)
    };
    TypedView::from_unknown(env, napi_mock::to_unknown(env, raw))
        .expect("reading view info should succeed")
        .expect("value should be recognized as a view")
}

#[test]
fn buffer_view_kind_display_matches_js_names() {
    let expected = [
        (ViewKind::Int8, "Int8Array"),
        (ViewKind::Uint8, "Uint8Array"),
        (ViewKind::Uint8Clamped, "Uint8ClampedArray"),
        (ViewKind::Int16, "Int16Array"),
        (ViewKind::Uint16, "Uint16Array"),
        (ViewKind::Int32, "Int32Array"),
        (ViewKind::Uint32, "Uint32Array"),
        (ViewKind::Float32, "Float32Array"),
        (ViewKind::Float64, "Float64Array"),
        (ViewKind::BigInt64, "BigInt64Array"),
        (ViewKind::BigUint64, "BigUint64Array"),
        (ViewKind::DataView, "DataView"),
    ];
    for (kind, name) in expected {
        assert_eq!(kind.to_string(), name);
        assert_eq!(format!("{kind}"), name);
    }
}

#[test]
fn buffer_view_byte_length_tracks_kind_element_size() {
    helpers::run(|| {
        let env = helpers::fake_env();
        for kind in ALL_KINDS {
            let length = 5usize;
            let byte_length = length * kind.element_size();
            let ptr = fake_ptr(0x80);
            let view = make_view(&env, ptr, length, kind);
            assert_eq!(view.ptr(), ptr);
            assert_eq!(view.byte_length(), byte_length);
            assert_eq!(view.length(), length);
            assert_eq!(view.kind(), kind);
            assert_eq!(
                view.byte_length(),
                view.length() * view.kind().element_size()
            );
        }
    });
}

#[test]
fn buffer_view_rejects_shared_array_buffer_backed_typed_arrays() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let raw = napi_mock::fake_shared_typed_array(
            sys::TypedarrayType::uint8_array,
            fake_ptr(0x40),
            4,
            0,
        );
        let error = TypedView::from_unknown(&env, napi_mock::to_unknown(&env, raw))
            .expect_err("a SharedArrayBuffer-backed typed array must be rejected");
        assert!(matches!(error.status, napi::Status::InvalidArg));
        assert!(error.reason.contains("SharedArrayBuffer"));
    });
}

#[test]
fn buffer_view_rejects_shared_array_buffer_backed_data_views() {
    helpers::run(|| {
        let env = helpers::fake_env();
        let raw = napi_mock::fake_shared_data_view(fake_ptr(0x40), 8, 0);
        let error = TypedView::from_unknown(&env, napi_mock::to_unknown(&env, raw))
            .expect_err("a SharedArrayBuffer-backed DataView must be rejected");
        assert!(matches!(error.status, napi::Status::InvalidArg));
        assert!(error.reason.contains("SharedArrayBuffer"));
    });
}

#[test]
fn buffer_view_kind_rejects_unknown_tag() {
    let unknown: sys::napi_typedarray_type = 99;
    let error = ViewKind::try_from(unknown).expect_err("an unknown tag must be rejected");
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
    helpers::run(|| {
        let env = helpers::fake_env();
        let ptr = fake_ptr(0x100);
        let view = make_view(&env, ptr, 4, ViewKind::Int32);
        let copied = view;
        let cloned = Clone::clone(&view);
        for other in [copied, cloned] {
            assert_eq!(other.ptr(), view.ptr());
            assert_eq!(other.byte_length(), view.byte_length());
            assert_eq!(other.length(), view.length());
            assert_eq!(other.kind(), view.kind());
        }
        assert!(format!("{view:?}").contains("TypedView"));
    });
}
