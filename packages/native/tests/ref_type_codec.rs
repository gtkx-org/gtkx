//! Coverage tests for the non-excluded parts of [`native::types::RefType`].
//!
//! `RefType::encode` and `null_ptr_storage` are excluded from coverage; the
//! decode side, `decode_with_context`, `read_from_raw_ptr`, `from_glib_value`,
//! `call_cif`, `new`, and `decode_ref_string` are exercised here.

mod common;

use std::ffi::{CString, c_char, c_void};

use gtk4::glib;
use gtk4::prelude::ObjectType as _;

use libffi::middle as libffi;

use native::ffi::{self, FfiStorage, FfiStorageKind};
use native::types::{
    ArrayKind, ArrayType, BooleanType, FfiDecoder, FloatKind, GObjectType, IntegerKind, Ownership,
    RawPtrCodec, RefType, StringType, TaggedKind, TaggedType, Type,
};
use native::value::Value;

fn string_type() -> StringType {
    StringType {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn ptr_storage(slot: Box<*mut c_void>) -> ffi::FfiValue {
    let raw = slot.as_ref() as *const *mut c_void as *mut c_void;
    ffi::FfiValue::Storage(FfiStorage::new(raw, FfiStorageKind::PtrStorage(slot)))
}

fn u8_array_ref_type() -> RefType {
    RefType::new(Type::Array(ArrayType {
        item_type: Box::new(Type::Integer(IntegerKind::U8)),
        kind: ArrayKind::Array,
        ownership: Ownership::Borrowed,
        element_size: None,
    }))
}

#[test]
fn new_and_clone_and_debug() {
    common::run(|| {
        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        let cloned = ref_type.clone();
        assert!(matches!(
            &*cloned.inner_type,
            Type::Integer(IntegerKind::I32)
        ));
        assert!(format!("{ref_type:?}").contains("RefType"));
    });
}

#[test]
fn call_cif_rejects_ref_as_return_type() {
    common::run(|| {
        let cif = libffi::Cif::new(std::iter::empty(), libffi::Type::void());
        let code_ptr = libffi::CodePtr(std::ptr::null_mut());

        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        let result = native::types::FfiEncoder::call_cif(&ref_type, &cif, code_ptr, &[]);
        assert!(result.is_err());
    });
}

#[test]
fn decode_rejects_non_storage_non_null_ptr() {
    common::run(|| {
        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        let result = ref_type.decode(&ffi::FfiValue::I32(7));
        assert!(result.is_err());
    });
}

#[test]
fn decode_null_ptr_yields_null() {
    common::run(|| {
        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        let decoded = ref_type
            .decode(&ffi::FfiValue::Ptr(std::ptr::null_mut()))
            .expect("null ptr decode should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn decode_integer_reads_number() {
    common::run(|| {
        let mut value: i32 = 4321;
        let slot = &mut value as *mut i32 as *mut c_void;
        let ffi_value = ffi::FfiValue::Storage(FfiStorage::new(slot, FfiStorageKind::Unit));

        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        let decoded = ref_type
            .decode(&ffi_value)
            .expect("integer ref decode should succeed");
        assert!(matches!(decoded, Value::Number(n) if (n - 4321.0).abs() < f64::EPSILON));
    });
}

#[test]
fn decode_tagged_reads_number() {
    common::run(|| {
        let mut value: i32 = 9;
        let slot = &mut value as *mut i32 as *mut c_void;
        let ffi_value = ffi::FfiValue::Storage(FfiStorage::new(slot, FfiStorageKind::Unit));

        let tagged = TaggedType {
            kind: TaggedKind::Enum,
            library: "libgobject-2.0.so.0".to_owned(),
            get_type_fn: "g_unused_get_type".to_owned(),
            storage: IntegerKind::I32,
        };
        let ref_type = RefType::new(Type::Tagged(tagged));
        let decoded = ref_type
            .decode(&ffi_value)
            .expect("tagged ref decode should succeed");
        assert!(matches!(decoded, Value::Number(n) if (n - 9.0).abs() < f64::EPSILON));
    });
}

#[test]
fn decode_float_reads_number() {
    common::run(|| {
        let mut value: f64 = 2.5;
        let slot = &mut value as *mut f64 as *mut c_void;
        let ffi_value = ffi::FfiValue::Storage(FfiStorage::new(slot, FfiStorageKind::Unit));

        let ref_type = RefType::new(Type::Float(FloatKind::F64));
        let decoded = ref_type
            .decode(&ffi_value)
            .expect("float ref decode should succeed");
        assert!(matches!(decoded, Value::Number(n) if (n - 2.5).abs() < f64::EPSILON));
    });
}

#[test]
fn decode_gobject_delegates_to_inner_decoder() {
    common::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr() as *mut c_void;
        let slot = Box::new(obj_ptr);
        let storage = ptr_storage(slot);

        let ref_type = RefType::new(Type::GObject(GObjectType {
            ownership: Ownership::Borrowed,
        }));
        let decoded = ref_type
            .decode(&storage)
            .expect("gobject ref decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);
    });
}

#[test]
fn decode_string_reads_via_decode_ref_string() {
    common::run(|| {
        let cstring = CString::new("ref-string").unwrap();
        let slot = Box::new(cstring.as_ptr() as *mut c_void);
        let storage = ptr_storage(slot);

        let ref_type = RefType::new(Type::String(string_type()));
        let decoded = ref_type
            .decode(&storage)
            .expect("string ref decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "ref-string"));
    });
}

#[test]
fn decode_array_inner_bails_without_context() {
    common::run(|| {
        let slot = Box::new(std::ptr::null_mut());
        let storage = ptr_storage(slot);

        let ref_type = u8_array_ref_type();
        assert!(ref_type.decode(&storage).is_err());
    });
}

#[test]
fn decode_unsupported_inner_type_bails() {
    common::run(|| {
        let slot = Box::new(std::ptr::null_mut());
        let storage = ptr_storage(slot);

        let ref_type = RefType::new(Type::Boolean(BooleanType));
        assert!(ref_type.decode(&storage).is_err());
    });
}

#[test]
fn decode_ref_string_buffer_kind_reads_directly() {
    common::run(|| {
        let mut buffer = b"buffered\0".to_vec();
        let ptr = buffer.as_mut_ptr() as *mut c_void;
        let storage = ffi::FfiValue::Storage(FfiStorage::new(ptr, FfiStorageKind::Buffer(buffer)));

        let ref_type = RefType::new(Type::String(string_type()));
        let decoded = ref_type
            .decode(&storage)
            .expect("buffer string ref decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "buffered"));
    });
}

#[test]
fn decode_ref_string_null_storage_pointer_yields_null() {
    common::run(|| {
        let storage =
            ffi::FfiValue::Storage(FfiStorage::new(std::ptr::null_mut(), FfiStorageKind::Unit));
        let ref_type = RefType::new(Type::String(string_type()));
        let decoded = ref_type
            .decode(&storage)
            .expect("null storage string ref decode should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn decode_ref_string_null_inner_pointer_yields_null() {
    common::run(|| {
        let slot: Box<*mut c_void> = Box::new(std::ptr::null_mut());
        let storage = ptr_storage(slot);

        let ref_type = RefType::new(Type::String(string_type()));
        let decoded = ref_type
            .decode(&storage)
            .expect("null inner string ref decode should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn decode_ref_string_full_ownership_frees_pointer() {
    common::run(|| {
        let owned = unsafe { glib::ffi::g_strdup(c"owned-ref".as_ptr()) };
        let slot = Box::new(owned as *mut c_void);
        let storage = ptr_storage(slot);

        let full_string = StringType {
            ownership: Ownership::Full,
            length: None,
        };
        let ref_type = RefType::new(Type::String(full_string));
        let decoded = ref_type
            .decode(&storage)
            .expect("full string ref decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "owned-ref"));
    });
}

#[test]
fn decode_with_context_non_array_delegates_to_decode() {
    common::run(|| {
        let mut value: i32 = 11;
        let slot = &mut value as *mut i32 as *mut c_void;
        let ffi_value = ffi::FfiValue::Storage(FfiStorage::new(slot, FfiStorageKind::Unit));

        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        let decoded = ref_type
            .decode_with_context(&ffi_value, &[], &[])
            .expect("non-array decode_with_context should succeed");
        assert!(matches!(decoded, Value::Number(n) if (n - 11.0).abs() < f64::EPSILON));
    });
}

#[test]
fn decode_with_context_trait_method_delegates() {
    common::run(|| {
        let mut value: i32 = 13;
        let slot = &mut value as *mut i32 as *mut c_void;
        let ffi_value = ffi::FfiValue::Storage(FfiStorage::new(slot, FfiStorageKind::Unit));

        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        let decoded = FfiDecoder::decode_with_context(&ref_type, &ffi_value, &[], &[])
            .expect("trait decode_with_context should succeed");
        assert!(matches!(decoded, Value::Number(n) if (n - 13.0).abs() < f64::EPSILON));
    });
}

#[test]
fn decode_with_context_array_null_ptr_yields_null() {
    common::run(|| {
        let ref_type = u8_array_ref_type();
        let decoded = ref_type
            .decode_with_context(&ffi::FfiValue::Ptr(std::ptr::null_mut()), &[], &[])
            .expect("array null ptr decode_with_context should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn decode_with_context_array_rejects_non_storage() {
    common::run(|| {
        let ref_type = u8_array_ref_type();
        assert!(
            ref_type
                .decode_with_context(&ffi::FfiValue::I32(1), &[], &[])
                .is_err()
        );
    });
}

#[test]
fn decode_with_context_array_ptr_storage_null_inner_yields_empty_array() {
    common::run(|| {
        let slot: Box<*mut c_void> = Box::new(std::ptr::null_mut());
        let storage = ptr_storage(slot);

        let ref_type = u8_array_ref_type();
        let decoded = ref_type
            .decode_with_context(&storage, &[], &[])
            .expect("array ptr_storage null inner decode should succeed");
        assert!(matches!(decoded, Value::Array(arr) if arr.is_empty()));
    });
}

#[test]
fn decode_with_context_array_string_items_not_freed_by_ref() {
    common::run(|| {
        let inner = unsafe { glib::ffi::g_malloc0(std::mem::size_of::<*mut c_char>()) };
        let slot = Box::new(inner);
        let storage = ptr_storage(slot);

        let array_type = ArrayType {
            item_type: Box::new(Type::String(string_type())),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        };
        let ref_type = RefType::new(Type::Array(array_type));
        let decoded = ref_type
            .decode_with_context(&storage, &[], &[])
            .expect("array string items decode should succeed");
        assert!(matches!(decoded, Value::Array(arr) if arr.is_empty()));
    });
}

#[test]
fn decode_with_context_array_non_string_items_freed_by_ref() {
    common::run(|| {
        let inner = unsafe { glib::ffi::g_malloc0(std::mem::size_of::<*mut c_void>()) };
        let slot = Box::new(inner);
        let storage = ptr_storage(slot);

        let array_type = ArrayType {
            item_type: Box::new(Type::Integer(IntegerKind::U8)),
            kind: ArrayKind::Fixed { size: 0 },
            ownership: Ownership::Full,
            element_size: None,
        };
        let ref_type = RefType::new(Type::Array(array_type));
        let decoded = ref_type
            .decode_with_context(&storage, &[], &[])
            .expect("array non-string items decode should succeed");
        assert!(matches!(decoded, Value::Array(arr) if arr.is_empty()));
    });
}

#[test]
fn decode_with_context_array_non_ptr_storage_uses_storage_pointer() {
    common::run(|| {
        let mut buffer: Vec<u8> = vec![0u8; std::mem::size_of::<*mut c_void>()];
        let storage = ffi::FfiValue::Storage(FfiStorage::new(
            buffer.as_mut_ptr() as *mut c_void,
            FfiStorageKind::Buffer(buffer),
        ));

        let array_type = ArrayType {
            item_type: Box::new(Type::String(string_type())),
            kind: ArrayKind::Array,
            ownership: Ownership::Borrowed,
            element_size: None,
        };
        let ref_type = RefType::new(Type::Array(array_type));
        let decoded = ref_type
            .decode_with_context(&storage, &[], &[])
            .expect("array non-ptr-storage decode should succeed");
        assert!(matches!(decoded, Value::Array(arr) if arr.is_empty()));
    });
}

#[test]
fn read_from_raw_ptr_null_inner_yields_null() {
    common::run(|| {
        let inner: *mut c_void = std::ptr::null_mut();
        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        let value = ref_type
            .read_from_raw_ptr(&inner as *const *mut c_void as *const c_void, "ctx")
            .expect("read_from_raw_ptr should succeed");
        assert!(matches!(value, Value::Null));
    });
}

#[test]
fn read_from_raw_ptr_string_inner_reads_value() {
    common::run(|| {
        let cstring = CString::new("raw-ref").unwrap();
        let char_ptr = cstring.as_ptr() as *mut c_void;
        let inner_slot: *mut c_void = &char_ptr as *const *mut c_void as *mut c_void;

        let ref_type = RefType::new(Type::String(string_type()));
        let value = ref_type
            .read_from_raw_ptr(&inner_slot as *const *mut c_void as *const c_void, "ctx")
            .expect("read_from_raw_ptr should succeed");
        assert!(matches!(value, Value::String(s) if s == "raw-ref"));
    });
}
