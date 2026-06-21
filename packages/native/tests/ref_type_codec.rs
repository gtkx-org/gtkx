mod common;

use std::ffi::{CString, c_char, c_void};

use gtk4::glib;
use gtk4::prelude::ObjectType as _;

use native::ffi::{self, FfiStorage, FfiStorageKind};
use native::types::{
    ArrayKind, ArrayType, BooleanType, FfiDecoder, FloatKind, GObjectType, IntegerKind, Ownership,
    ReadSource, RefType, StringType, TaggedKind, TaggedType, Type, UnicharType,
};
use native::value::Value;

fn string_type() -> StringType {
    StringType {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn ptr_storage(inner: *mut c_void) -> ffi::FfiValue {
    let mut slot: Vec<*mut c_void> = vec![inner];
    let raw = slot.as_mut_ptr() as *mut c_void;
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

fn assert_array_decodes_empty(array_type: ArrayType, storage: &ffi::FfiValue) {
    let ref_type = RefType::new(Type::Array(array_type));
    let decoded = ref_type
        .decode_with_context(storage, &[], &[])
        .expect("array decode should succeed");
    assert!(matches!(decoded, Value::Array(arr) if arr.is_empty()));
}

fn with_i32_storage_ref(value: i32, f: impl FnOnce(&ffi::FfiValue, &RefType)) {
    let mut value = value;
    let slot = &mut value as *mut i32 as *mut c_void;
    let ffi_value = ffi::FfiValue::Storage(FfiStorage::new(slot, FfiStorageKind::Unit));
    let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
    f(&ffi_value, &ref_type);
}

fn ptr_sized_malloc_storage() -> ffi::FfiValue {
    // SAFETY: `g_malloc0` with a non-zero pointer-sized request returns a freshly allocated,
    // zeroed block that this helper wraps; the array decoder under test takes ownership and frees it.
    let inner = unsafe { glib::ffi::g_malloc0(std::mem::size_of::<*mut c_void>()) };
    ptr_storage(inner)
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
        with_i32_storage_ref(4321, |ffi_value, ref_type| {
            let decoded = ref_type
                .decode(ffi_value)
                .expect("integer ref decode should succeed");
            assert!(matches!(decoded, Value::Number(n) if (n - 4321.0).abs() < f64::EPSILON));
        });
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
        let storage = ptr_storage(obj_ptr);

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
        let storage = ptr_storage(cstring.as_ptr() as *mut c_void);

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
        let storage = ptr_storage(std::ptr::null_mut());

        let ref_type = u8_array_ref_type();
        assert!(ref_type.decode(&storage).is_err());
    });
}

#[test]
fn decode_boolean_reads_bool() {
    common::run(|| {
        let mut value: i32 = 1;
        let slot = &mut value as *mut i32 as *mut c_void;
        let ffi_value = ffi::FfiValue::Storage(FfiStorage::new(slot, FfiStorageKind::Unit));

        let ref_type = RefType::new(Type::Boolean(BooleanType));
        let decoded = ref_type
            .decode(&ffi_value)
            .expect("boolean ref decode should succeed");
        assert!(matches!(decoded, Value::Boolean(true)));
    });
}

#[test]
fn decode_unichar_reads_string() {
    common::run(|| {
        let mut value: u32 = 'é' as u32;
        let slot = &mut value as *mut u32 as *mut c_void;
        let ffi_value = ffi::FfiValue::Storage(FfiStorage::new(slot, FfiStorageKind::Unit));

        let ref_type = RefType::new(Type::Unichar(UnicharType));
        let decoded = ref_type
            .decode(&ffi_value)
            .expect("unichar ref decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "é"));
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
        let storage = ptr_storage(std::ptr::null_mut());

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
        // SAFETY: `c"owned-ref"` is a valid NUL-terminated C string literal; `g_strdup` returns a
        // freshly `g_malloc`-ed owned copy that the full-ownership string ref decode below frees.
        let owned = unsafe { glib::ffi::g_strdup(c"owned-ref".as_ptr()) };
        let storage = ptr_storage(owned as *mut c_void);

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
        with_i32_storage_ref(11, |ffi_value, ref_type| {
            let decoded = ref_type
                .decode_with_context(ffi_value, &[], &[])
                .expect("non-array decode_with_context should succeed");
            assert!(matches!(decoded, Value::Number(n) if (n - 11.0).abs() < f64::EPSILON));
        });
    });
}

#[test]
fn decode_with_context_trait_method_delegates() {
    common::run(|| {
        with_i32_storage_ref(13, |ffi_value, ref_type| {
            let decoded = FfiDecoder::decode_with_context(ref_type, ffi_value, &[], &[])
                .expect("trait decode_with_context should succeed");
            assert!(matches!(decoded, Value::Number(n) if (n - 13.0).abs() < f64::EPSILON));
        });
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
fn decode_with_context_array_ptr_storage_null_inner_yields_empty_array() {
    common::run(|| {
        let storage = ptr_storage(std::ptr::null_mut());

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
        // SAFETY: `g_malloc0` with a non-zero pointer-sized request returns a freshly allocated,
        // zeroed block (a NULL-terminated empty `char*` array) that the array decoder takes and frees.
        let inner = unsafe { glib::ffi::g_malloc0(std::mem::size_of::<*mut c_char>()) };
        let storage = ptr_storage(inner);

        let array_type = ArrayType {
            item_type: Box::new(Type::String(string_type())),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        };
        assert_array_decodes_empty(array_type, &storage);
    });
}

#[test]
fn decode_with_context_array_container_released_by_array_decoder() {
    common::run(|| {
        let storage = ptr_sized_malloc_storage();

        let array_type = ArrayType {
            item_type: Box::new(Type::GObject(GObjectType {
                ownership: Ownership::Borrowed,
            })),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        };
        assert_array_decodes_empty(array_type, &storage);
    });
}

#[test]
fn decode_with_context_garray_container_released_by_array_decoder() {
    common::run(|| {
        // SAFETY: `g_array_sized_new` with a valid element size returns a freshly allocated, owned
        // empty `GArray`; the full-ownership GArray decoder under test takes ownership and unrefs it.
        let g_array =
            unsafe { glib::ffi::g_array_sized_new(0, 0, std::mem::size_of::<u8>() as u32, 0) };
        let storage = ptr_storage(g_array as *mut c_void);

        let array_type = ArrayType {
            item_type: Box::new(Type::Integer(IntegerKind::U8)),
            kind: ArrayKind::GArray,
            ownership: Ownership::Full,
            element_size: None,
        };
        assert_array_decodes_empty(array_type, &storage);
    });
}

#[test]
fn decode_with_context_array_non_string_items_freed_by_ref() {
    common::run(|| {
        let storage = ptr_sized_malloc_storage();

        let array_type = ArrayType {
            item_type: Box::new(Type::Integer(IntegerKind::U8)),
            kind: ArrayKind::Fixed { size: 0 },
            ownership: Ownership::Full,
            element_size: None,
        };
        assert_array_decodes_empty(array_type, &storage);
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
        assert_array_decodes_empty(array_type, &storage);
    });
}

#[test]
fn read_from_raw_ptr_null_inner_yields_null() {
    common::run(|| {
        let inner: *mut c_void = std::ptr::null_mut();
        let ref_type = RefType::new(Type::Integer(IntegerKind::I32));
        // SAFETY: the `ReadSource::Slot` pointer is the address of the live `inner` pointer stack
        // local; the ref codec reads that one in-bounds pointer, finds it null, and yields `Null`.
        let value = unsafe {
            ref_type.read(ReadSource::Slot(
                &inner as *const *mut c_void as *const c_void,
                "ctx",
            ))
        }
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
        // SAFETY: the outer slot points to `inner_slot`, which holds `char_ptr` into the live
        // `cstring`; the ref codec reads the inner pointer, then the borrowed string it addresses,
        // both of which stay alive for the call.
        let value = unsafe {
            ref_type.read(ReadSource::Slot(
                &inner_slot as *const *mut c_void as *const c_void,
                "ctx",
            ))
        }
        .expect("read_from_raw_ptr should succeed");
        assert!(matches!(value, Value::String(s) if s == "raw-ref"));
    });
}
