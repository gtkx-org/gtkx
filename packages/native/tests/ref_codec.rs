mod helpers;

use std::ffi::{CString, c_char, c_void};

use gtk4::glib;
use gtk4::prelude::ObjectType as _;

use native::ffi::descriptors::{
    ArrayDescriptor, ArrayKind, BooleanDescriptor, Descriptor, EnumFlagsDescriptor, EnumFlagsKind,
    FfiDecoder, FloatKind, GObjectDescriptor, IntegerKind, Ownership, ReadSource, RefDescriptor,
    StringDescriptor, UnicharDescriptor,
};
use native::ffi::value::Value;
use native::ffi::{self, Stash, StashKind};

fn string_type() -> StringDescriptor {
    StringDescriptor {
        ownership: Ownership::Borrowed,
        length: None,
    }
}

fn ptr_storage(inner: *mut c_void) -> ffi::StashedValue {
    let mut slot: Vec<*mut c_void> = vec![inner];
    let raw = slot.as_mut_ptr() as *mut c_void;
    ffi::StashedValue::Storage(Stash::new(raw, StashKind::PtrStorage(slot)))
}

fn u8_array_ref_type() -> RefDescriptor {
    RefDescriptor::new(Descriptor::Array(ArrayDescriptor {
        item_descriptor: Box::new(Descriptor::Integer(IntegerKind::U8)),
        kind: ArrayKind::Array,
        ownership: Ownership::Borrowed,
        element_size: None,
    }))
    .expect("Array is a valid Ref inner")
}

fn assert_array_decodes_empty(array_type: ArrayDescriptor, storage: &ffi::StashedValue) {
    let ref_type =
        RefDescriptor::new(Descriptor::Array(array_type)).expect("Array is a valid Ref inner");
    let decoded = ref_type
        .decode_with_context(storage, &[], &[])
        .expect("array decode should succeed");
    assert!(matches!(decoded, Value::Array(arr) if arr.is_empty()));
}

fn with_i32_storage_ref(value: i32, f: impl FnOnce(&ffi::StashedValue, &RefDescriptor)) {
    let mut value = value;
    let slot = &mut value as *mut i32 as *mut c_void;
    let stashed_value = ffi::StashedValue::Storage(Stash::new(slot, StashKind::Unit));
    let ref_type =
        RefDescriptor::new(Descriptor::Integer(IntegerKind::I32)).expect("valid Ref inner");
    f(&stashed_value, &ref_type);
}

fn ptr_sized_malloc_storage() -> ffi::StashedValue {
    // SAFETY: `g_malloc0` with a non-zero pointer-sized request returns a freshly allocated,
    // zeroed block that this helper wraps; the array decoder under test takes ownership and frees it.
    let inner = unsafe { glib::ffi::g_malloc0(std::mem::size_of::<*mut c_void>()) };
    ptr_storage(inner)
}

#[test]
fn decode_rejects_non_storage_non_null_ptr() {
    helpers::run(|| {
        let ref_type =
            RefDescriptor::new(Descriptor::Integer(IntegerKind::I32)).expect("valid Ref inner");
        let result = ref_type.decode(&ffi::StashedValue::I32(7));
        assert!(result.is_err());
    });
}

#[test]
fn decode_null_ptr_yields_null() {
    helpers::run(|| {
        let ref_type =
            RefDescriptor::new(Descriptor::Integer(IntegerKind::I32)).expect("valid Ref inner");
        let decoded = ref_type
            .decode(&ffi::StashedValue::Ptr(std::ptr::null_mut()))
            .expect("null ptr decode should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn decode_integer_reads_number() {
    helpers::run(|| {
        with_i32_storage_ref(4321, |stashed_value, ref_type| {
            let decoded = ref_type
                .decode(stashed_value)
                .expect("integer ref decode should succeed");
            assert!(matches!(decoded, Value::Number(n) if (n - 4321.0).abs() < f64::EPSILON));
        });
    });
}

#[test]
fn decode_enum_flags_reads_number() {
    helpers::run(|| {
        let mut value: i32 = 9;
        let slot = &mut value as *mut i32 as *mut c_void;
        let stashed_value = ffi::StashedValue::Storage(Stash::new(slot, StashKind::Unit));

        let enum_flags = EnumFlagsDescriptor {
            kind: EnumFlagsKind::Enum,
            shared_library: "libgobject-2.0.so.0".to_owned(),
            get_type_fn: "g_unused_get_type".to_owned(),
            storage: IntegerKind::I32,
        };
        let ref_type =
            RefDescriptor::new(Descriptor::EnumFlags(enum_flags)).expect("valid Ref inner");
        let decoded = ref_type
            .decode(&stashed_value)
            .expect("enum/flags ref decode should succeed");
        assert!(matches!(decoded, Value::Number(n) if (n - 9.0).abs() < f64::EPSILON));
    });
}

#[test]
fn decode_float_reads_number() {
    helpers::run(|| {
        let mut value: f64 = 2.5;
        let slot = &mut value as *mut f64 as *mut c_void;
        let stashed_value = ffi::StashedValue::Storage(Stash::new(slot, StashKind::Unit));

        let ref_type =
            RefDescriptor::new(Descriptor::Float(FloatKind::F64)).expect("valid Ref inner");
        let decoded = ref_type
            .decode(&stashed_value)
            .expect("float ref decode should succeed");
        assert!(matches!(decoded, Value::Number(n) if (n - 2.5).abs() < f64::EPSILON));
    });
}

#[test]
fn decode_gobject_delegates_to_inner_decoder() {
    helpers::run(|| {
        let obj = glib::Object::new::<glib::Object>();
        let obj_ptr = obj.as_ptr() as *mut c_void;
        let storage = ptr_storage(obj_ptr);

        let ref_type = RefDescriptor::new(Descriptor::GObject(GObjectDescriptor {
            ownership: Ownership::Borrowed,
        }))
        .expect("GObject is a valid Ref inner");
        let decoded = ref_type
            .decode(&storage)
            .expect("gobject ref decode should succeed");
        assert!(matches!(decoded, Value::Object(_)));
        drop(decoded);
    });
}

#[test]
fn decode_string_reads_via_decode_ref_string() {
    helpers::run(|| {
        let cstring = CString::new("ref-string").unwrap();
        let storage = ptr_storage(cstring.as_ptr() as *mut c_void);

        let ref_type =
            RefDescriptor::new(Descriptor::String(string_type())).expect("valid Ref inner");
        let decoded = ref_type
            .decode(&storage)
            .expect("string ref decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "ref-string"));
    });
}

#[test]
fn decode_array_inner_bails_without_context() {
    helpers::run(|| {
        let storage = ptr_storage(std::ptr::null_mut());

        let ref_type = u8_array_ref_type();
        assert!(ref_type.decode(&storage).is_err());
    });
}

#[test]
fn decode_boolean_reads_bool() {
    helpers::run(|| {
        let mut value: i32 = 1;
        let slot = &mut value as *mut i32 as *mut c_void;
        let stashed_value = ffi::StashedValue::Storage(Stash::new(slot, StashKind::Unit));

        let ref_type =
            RefDescriptor::new(Descriptor::Boolean(BooleanDescriptor)).expect("valid Ref inner");
        let decoded = ref_type
            .decode(&stashed_value)
            .expect("boolean ref decode should succeed");
        assert!(matches!(decoded, Value::Boolean(true)));
    });
}

#[test]
fn decode_unichar_reads_string() {
    helpers::run(|| {
        let mut value: u32 = 'é' as u32;
        let slot = &mut value as *mut u32 as *mut c_void;
        let stashed_value = ffi::StashedValue::Storage(Stash::new(slot, StashKind::Unit));

        let ref_type =
            RefDescriptor::new(Descriptor::Unichar(UnicharDescriptor)).expect("valid Ref inner");
        let decoded = ref_type
            .decode(&stashed_value)
            .expect("unichar ref decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "é"));
    });
}

#[test]
fn decode_ref_string_buffer_kind_reads_directly() {
    helpers::run(|| {
        let mut buffer = b"buffered\0".to_vec();
        let ptr = buffer.as_mut_ptr() as *mut c_void;
        let storage = ffi::StashedValue::Storage(Stash::new(ptr, StashKind::Buffer(buffer)));

        let ref_type =
            RefDescriptor::new(Descriptor::String(string_type())).expect("valid Ref inner");
        let decoded = ref_type
            .decode(&storage)
            .expect("buffer string ref decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "buffered"));
    });
}

#[test]
fn decode_ref_string_null_storage_pointer_yields_null() {
    helpers::run(|| {
        let storage = ffi::StashedValue::Storage(Stash::new(std::ptr::null_mut(), StashKind::Unit));
        let ref_type =
            RefDescriptor::new(Descriptor::String(string_type())).expect("valid Ref inner");
        let decoded = ref_type
            .decode(&storage)
            .expect("null storage string ref decode should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn decode_ref_string_null_inner_pointer_yields_null() {
    helpers::run(|| {
        let storage = ptr_storage(std::ptr::null_mut());

        let ref_type =
            RefDescriptor::new(Descriptor::String(string_type())).expect("valid Ref inner");
        let decoded = ref_type
            .decode(&storage)
            .expect("null inner string ref decode should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn decode_ref_string_full_ownership_frees_pointer() {
    helpers::run(|| {
        // SAFETY: `c"owned-ref"` is a valid NUL-terminated C string literal; `g_strdup` returns a
        // freshly `g_malloc`-ed owned copy that the full-ownership string ref decode below frees.
        let owned = unsafe { glib::ffi::g_strdup(c"owned-ref".as_ptr()) };
        let storage = ptr_storage(owned as *mut c_void);

        let full_string = StringDescriptor {
            ownership: Ownership::Full,
            length: None,
        };
        let ref_type =
            RefDescriptor::new(Descriptor::String(full_string)).expect("valid Ref inner");
        let decoded = ref_type
            .decode(&storage)
            .expect("full string ref decode should succeed");
        assert!(matches!(decoded, Value::String(s) if s == "owned-ref"));
    });
}

#[test]
fn decode_with_context_non_array_delegates_to_decode() {
    helpers::run(|| {
        with_i32_storage_ref(11, |stashed_value, ref_type| {
            let decoded = ref_type
                .decode_with_context(stashed_value, &[], &[])
                .expect("non-array decode_with_context should succeed");
            assert!(matches!(decoded, Value::Number(n) if (n - 11.0).abs() < f64::EPSILON));
        });
    });
}

#[test]
fn decode_with_context_trait_method_delegates() {
    helpers::run(|| {
        with_i32_storage_ref(13, |stashed_value, ref_type| {
            let decoded = FfiDecoder::decode_with_context(ref_type, stashed_value, &[], &[])
                .expect("trait decode_with_context should succeed");
            assert!(matches!(decoded, Value::Number(n) if (n - 13.0).abs() < f64::EPSILON));
        });
    });
}

#[test]
fn decode_with_context_array_null_ptr_yields_null() {
    helpers::run(|| {
        let ref_type = u8_array_ref_type();
        let decoded = ref_type
            .decode_with_context(&ffi::StashedValue::Ptr(std::ptr::null_mut()), &[], &[])
            .expect("array null ptr decode_with_context should succeed");
        assert!(matches!(decoded, Value::Null));
    });
}

#[test]
fn decode_with_context_array_ptr_storage_null_inner_yields_empty_array() {
    helpers::run(|| {
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
    helpers::run(|| {
        // SAFETY: `g_malloc0` with a non-zero pointer-sized request returns a freshly allocated,
        // zeroed block (a NULL-terminated empty `char*` array) that the array decoder takes and frees.
        let inner = unsafe { glib::ffi::g_malloc0(std::mem::size_of::<*mut c_char>()) };
        let storage = ptr_storage(inner);

        let array_type = ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::String(string_type())),
            kind: ArrayKind::Array,
            ownership: Ownership::Full,
            element_size: None,
        };
        assert_array_decodes_empty(array_type, &storage);
    });
}

#[test]
fn decode_with_context_array_container_released_by_array_decoder() {
    helpers::run(|| {
        let storage = ptr_sized_malloc_storage();

        let array_type = ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::GObject(GObjectDescriptor {
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
    helpers::run(|| {
        // SAFETY: `g_array_sized_new` with a valid element size returns a freshly allocated, owned
        // empty `GArray`; the full-ownership GArray decoder under test takes ownership and unrefs it.
        let g_array =
            unsafe { glib::ffi::g_array_sized_new(0, 0, std::mem::size_of::<u8>() as u32, 0) };
        let storage = ptr_storage(g_array as *mut c_void);

        let array_type = ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::Integer(IntegerKind::U8)),
            kind: ArrayKind::GArray,
            ownership: Ownership::Full,
            element_size: None,
        };
        assert_array_decodes_empty(array_type, &storage);
    });
}

#[test]
fn decode_with_context_array_non_string_items_freed_by_ref() {
    helpers::run(|| {
        let storage = ptr_sized_malloc_storage();

        let array_type = ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::Integer(IntegerKind::U8)),
            kind: ArrayKind::Fixed { size: 0 },
            ownership: Ownership::Full,
            element_size: None,
        };
        assert_array_decodes_empty(array_type, &storage);
    });
}

#[test]
fn decode_with_context_array_non_ptr_storage_uses_storage_pointer() {
    helpers::run(|| {
        let mut buffer: Vec<u8> = vec![0u8; std::mem::size_of::<*mut c_void>()];
        let storage = ffi::StashedValue::Storage(Stash::new(
            buffer.as_mut_ptr() as *mut c_void,
            StashKind::Buffer(buffer),
        ));

        let array_type = ArrayDescriptor {
            item_descriptor: Box::new(Descriptor::String(string_type())),
            kind: ArrayKind::Array,
            ownership: Ownership::Borrowed,
            element_size: None,
        };
        assert_array_decodes_empty(array_type, &storage);
    });
}

#[test]
fn read_from_pointer_null_inner_yields_null() {
    helpers::run(|| {
        let inner: *mut c_void = std::ptr::null_mut();
        let ref_type =
            RefDescriptor::new(Descriptor::Integer(IntegerKind::I32)).expect("valid Ref inner");
        // SAFETY: the `ReadSource::Slot` pointer is the address of the live `inner` pointer stack
        // local; the ref codec reads that one in-bounds pointer, finds it null, and yields `Null`.
        let value = unsafe {
            ref_type.read(ReadSource::Slot(
                &inner as *const *mut c_void as *const c_void,
                "ctx",
            ))
        }
        .expect("read_from_pointer should succeed");
        assert!(matches!(value, Value::Null));
    });
}

#[test]
fn read_from_pointer_string_inner_reads_value() {
    helpers::run(|| {
        let cstring = CString::new("raw-ref").unwrap();
        let char_ptr = cstring.as_ptr() as *mut c_void;
        let inner_slot: *mut c_void = &char_ptr as *const *mut c_void as *mut c_void;

        let ref_type =
            RefDescriptor::new(Descriptor::String(string_type())).expect("valid Ref inner");
        // SAFETY: the outer slot points to `inner_slot`, which holds `char_ptr` into the live
        // `cstring`; the ref codec reads the inner pointer, then the borrowed string it addresses,
        // both of which stay alive for the call.
        let value = unsafe {
            ref_type.read(ReadSource::Slot(
                &inner_slot as *const *mut c_void as *const c_void,
                "ctx",
            ))
        }
        .expect("read_from_pointer should succeed");
        assert!(matches!(value, Value::String(s) if s == "raw-ref"));
    });
}
