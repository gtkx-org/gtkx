use std::ffi::{CStr, c_char, c_void};

use gtk4::glib::translate::IntoGlib as _;
use gtk4::prelude::StaticType as _;
use gtk4::{gdk, glib};
use napi::bindgen_prelude::{External, Unknown};
use napi::{Env, JsValue as _};
use native::ffi::codec::{
    ArrayKind, Codec, Decoder as _, Ownership, PtrWriter as _, ReadCtx, SlotInit,
};
use native::ffi::descriptor::{Descriptor, Descriptors, NestedDescriptor};
use native::ffi::{PendingTransfer, Slot};
use native::handle::Handle;
use native::value::handle_ptr;
use test_support as helpers;
use test_support::napi_mock;

helpers::g_free_recorder!();

const BLOCK_SIZE: usize = 16;
const RGBA_SIZE: u32 = 16;
const GVALUE_SIZE: u32 = 24;
const GLIB: &str = "libglib-2.0.so.0";
const GOBJECT: &str = "libgobject-2.0.so.0";
const GTK: &str = "libgtk-4.so.1";
const TEXT: &str = "gtkx-written";
const STALE: &CStr = c"gtkx-stale";
const REFUSED: &str = "cannot be written to a raw pointer";

const _: () = assert!(size_of::<gdk::ffi::GdkRGBA>() == BLOCK_SIZE);
const _: () = assert!(size_of::<glib::gobject_ffi::GValue>() == GVALUE_SIZE as usize);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Subject {
    Object,
    FloatingObject,
    ParamSpec,
    Rgba,
    Block,
    Text,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Stored {
    Alias,
    SunkAlias,
    Copy,
    Null,
}

#[derive(Debug, Clone, Copy)]
enum Source {
    Value,
    Null,
}

#[derive(Debug, Clone, Copy)]
enum Scalar {
    Number(f64),
    Bool(bool),
    Big(i64),
}

#[derive(Debug, Clone, Copy)]
struct Stores {
    stored: Stored,
    transfer: bool,
    source: i64,
    displaced: i64,
}

#[derive(Debug, Clone, Copy)]
enum Effect {
    Refuses(&'static str),
    Stores(Stores),
    CopiesInPlace,
    CopiesIntoDest,
    ReplacesInlineValue,
    Roundtrips(Scalar),
}

#[derive(Debug, Clone, Copy)]
struct Write {
    subject: Subject,
    source: Source,
    init: SlotInit,
    effect: Effect,
}

#[derive(Debug, Clone, Copy)]
enum Owner {
    Struct,
    Boxed,
    Borrowed,
}

#[derive(Debug, Clone, Copy)]
enum Via {
    PointerSlot,
    InlineSlot,
    Value,
}

#[derive(Debug, Clone, Copy)]
struct Decode {
    stored: Stored,
    source: i64,
    settled: i64,
}

#[derive(Debug, Clone, Copy)]
enum ReadEffect {
    Handle(Decode),
    Text,
}

#[derive(Debug, Clone, Copy)]
struct Read {
    subject: Subject,
    transfer: Ownership,
    via: Via,
    effect: ReadEffect,
}

#[derive(Debug, Clone, Copy)]
enum Check {
    Write(Write),
    Read(Read),
}

struct Cell {
    name: &'static str,
    emitted: u32,
    on_path: u32,
    descriptor: fn() -> Descriptor,
    check: Check,
}

#[derive(Clone, Copy)]
struct Decoded {
    src: *mut c_void,
    before: i64,
}

fn rgba_type_name() -> String {
    gdk::RGBA::static_type().name().to_string()
}

fn boxed(ownership: Ownership, size: Option<u32>, inline: bool) -> Descriptor {
    Descriptor::Boxed {
        ownership,
        type_name: rgba_type_name(),
        shared_library: None,
        get_type_fn_name: None,
        free_fn_name: None,
        caller_allocated: Some(false),
        size,
        inline: Some(inline),
    }
}

fn named_boxed(type_name: &str, size: Option<u32>, inline: bool) -> Descriptor {
    Descriptor::Boxed {
        ownership: Ownership::Borrowed,
        type_name: type_name.to_owned(),
        shared_library: None,
        get_type_fn_name: None,
        free_fn_name: None,
        caller_allocated: Some(false),
        size,
        inline: Some(inline),
    }
}

fn struct_of(ownership: Ownership, size: Option<u32>, inline: bool) -> Descriptor {
    Descriptor::Struct {
        ownership,
        size,
        caller_allocated: Some(false),
        inline: Some(inline),
    }
}

fn fundamental(ownership: Ownership, ref_fn_name: &str, inline: bool) -> Descriptor {
    Descriptor::Fundamental {
        ownership,
        shared_library: GOBJECT.to_owned(),
        ref_fn_name: ref_fn_name.to_owned(),
        unref_fn_name: "g_param_spec_unref".to_owned(),
        type_name: None,
        inline: Some(inline),
    }
}

fn array_of(
    item: Descriptor,
    kind: ArrayKind,
    fixed: Option<u32>,
    sized: Option<u32>,
) -> Descriptor {
    Descriptor::Array {
        item_descriptor: NestedDescriptor(Box::new(item)),
        array_kind: kind,
        ownership: Ownership::Borrowed,
        size_param_index: sized,
        fixed_size: fixed,
        element_size: None,
    }
}

fn string_of(ownership: Ownership) -> Descriptor {
    Descriptor::String {
        ownership,
        length: None,
    }
}

fn d_string_borrowed() -> Descriptor {
    string_of(Ownership::Borrowed)
}

fn d_string_full() -> Descriptor {
    string_of(Ownership::Full)
}

fn d_object_borrowed() -> Descriptor {
    Descriptor::Object {
        ownership: Ownership::Borrowed,
    }
}

fn d_object_full() -> Descriptor {
    Descriptor::Object {
        ownership: Ownership::Full,
    }
}

fn d_boxed_borrowed_sized() -> Descriptor {
    boxed(Ownership::Borrowed, Some(RGBA_SIZE), false)
}

fn d_boxed_borrowed_unsized() -> Descriptor {
    boxed(Ownership::Borrowed, None, false)
}

fn d_boxed_full_sized() -> Descriptor {
    boxed(Ownership::Full, Some(RGBA_SIZE), false)
}

fn d_boxed_inline() -> Descriptor {
    boxed(Ownership::Borrowed, Some(RGBA_SIZE), true)
}

fn d_boxed_inline_unsized() -> Descriptor {
    boxed(Ownership::Borrowed, None, true)
}

fn d_boxed_inline_gvalue() -> Descriptor {
    named_boxed("GValue", Some(GVALUE_SIZE), true)
}

fn d_boxed_inline_gclosure() -> Descriptor {
    named_boxed("GClosure", Some(8), true)
}

fn d_boxed_unresolvable() -> Descriptor {
    named_boxed("GtkxUnregisteredBoxed", None, false)
}

fn d_boxed_caller_allocated() -> Descriptor {
    Descriptor::Boxed {
        ownership: Ownership::Borrowed,
        type_name: rgba_type_name(),
        shared_library: None,
        get_type_fn_name: None,
        free_fn_name: None,
        caller_allocated: Some(true),
        size: Some(RGBA_SIZE),
        inline: Some(false),
    }
}

fn d_boxed_free_fn() -> Descriptor {
    Descriptor::Boxed {
        ownership: Ownership::Borrowed,
        type_name: "GtkxFreeFnBoxed".to_owned(),
        shared_library: Some(GLIB.to_owned()),
        get_type_fn_name: None,
        free_fn_name: Some("g_free".to_owned()),
        caller_allocated: Some(false),
        size: None,
        inline: Some(false),
    }
}

fn d_struct_borrowed_unsized() -> Descriptor {
    struct_of(Ownership::Borrowed, None, false)
}

fn d_struct_borrowed_sized() -> Descriptor {
    struct_of(Ownership::Borrowed, Some(RGBA_SIZE), false)
}

fn d_struct_full_sized() -> Descriptor {
    struct_of(Ownership::Full, Some(RGBA_SIZE), false)
}

fn d_struct_inline() -> Descriptor {
    struct_of(Ownership::Borrowed, Some(RGBA_SIZE), true)
}

fn d_struct_inline_unsized() -> Descriptor {
    struct_of(Ownership::Borrowed, None, true)
}

fn d_struct_caller_allocated() -> Descriptor {
    Descriptor::Struct {
        ownership: Ownership::Borrowed,
        size: Some(RGBA_SIZE),
        caller_allocated: Some(true),
        inline: Some(false),
    }
}

fn d_fundamental_borrowed() -> Descriptor {
    fundamental(Ownership::Borrowed, "g_param_spec_ref", false)
}

fn d_fundamental_full() -> Descriptor {
    fundamental(Ownership::Full, "g_param_spec_ref", false)
}

fn d_fundamental_inline() -> Descriptor {
    fundamental(Ownership::Borrowed, "g_param_spec_ref", true)
}

fn d_fundamental_without_ref_fn() -> Descriptor {
    fundamental(Ownership::Borrowed, "", false)
}

fn d_array() -> Descriptor {
    array_of(d_string_borrowed(), ArrayKind::Array, None, None)
}

fn d_fixed_array() -> Descriptor {
    array_of(Descriptor::Float64, ArrayKind::Fixed, Some(2), None)
}

fn d_sized_array() -> Descriptor {
    array_of(Descriptor::Uint8, ArrayKind::Sized, None, Some(0))
}

fn d_slist() -> Descriptor {
    array_of(d_boxed_borrowed_sized(), ArrayKind::GSList, None, None)
}

fn d_hashtable() -> Descriptor {
    Descriptor::Hashtable {
        key_descriptor: NestedDescriptor(Box::new(d_string_borrowed())),
        value_descriptor: NestedDescriptor(Box::new(d_string_borrowed())),
        ownership: Ownership::Borrowed,
    }
}

fn d_callback() -> Descriptor {
    Descriptor::Callback {
        arg_descriptors: Descriptors(Vec::new()),
        return_descriptor: NestedDescriptor(Box::new(Descriptor::Void)),
        has_destroy: Some(false),
        user_data_index: None,
        scope: None,
    }
}

fn d_ref() -> Descriptor {
    Descriptor::Ref {
        inner_descriptor: NestedDescriptor(Box::new(Descriptor::Int32)),
        inout: Some(false),
    }
}

fn d_unichar() -> Descriptor {
    Descriptor::Unichar
}

fn d_void() -> Descriptor {
    Descriptor::Void
}

fn d_buffer() -> Descriptor {
    Descriptor::Buffer
}

fn d_int8() -> Descriptor {
    Descriptor::Int8
}

fn d_uint8() -> Descriptor {
    Descriptor::Uint8
}

fn d_int16() -> Descriptor {
    Descriptor::Int16
}

fn d_uint16() -> Descriptor {
    Descriptor::Uint16
}

fn d_int32() -> Descriptor {
    Descriptor::Int32
}

fn d_uint32() -> Descriptor {
    Descriptor::Uint32
}

fn d_int64() -> Descriptor {
    Descriptor::Int64
}

fn d_uint64() -> Descriptor {
    Descriptor::Uint64
}

fn d_bigint64() -> Descriptor {
    Descriptor::Bigint64
}

fn d_biguint64() -> Descriptor {
    Descriptor::Biguint64
}

fn d_float32() -> Descriptor {
    Descriptor::Float32
}

fn d_float64() -> Descriptor {
    Descriptor::Float64
}

fn d_boolean() -> Descriptor {
    Descriptor::Boolean
}

fn d_enum() -> Descriptor {
    Descriptor::Enum {
        shared_library: GTK.to_owned(),
        get_type_fn_name: "gtk_orientation_get_type".to_owned(),
        signed: false,
    }
}

fn d_flags() -> Descriptor {
    Descriptor::Flags {
        shared_library: GTK.to_owned(),
        get_type_fn_name: "gtk_state_flags_get_type".to_owned(),
        signed: false,
    }
}

const fn stores(stored: Stored, transfer: bool, source: i64, displaced: i64) -> Effect {
    Effect::Stores(Stores {
        stored,
        transfer,
        source,
        displaced,
    })
}

const fn writes(subject: Subject, init: SlotInit, effect: Effect) -> Check {
    Check::Write(Write {
        subject,
        source: Source::Value,
        init,
        effect,
    })
}

const fn writes_null(subject: Subject, init: SlotInit, effect: Effect) -> Check {
    Check::Write(Write {
        subject,
        source: Source::Null,
        init,
        effect,
    })
}

const fn refuses(fragment: &'static str) -> Check {
    refuses_writing(Subject::Block, fragment)
}

const fn refuses_writing(subject: Subject, fragment: &'static str) -> Check {
    writes(subject, SlotInit::Initialized, Effect::Refuses(fragment))
}

const fn roundtrips(scalar: Scalar) -> Check {
    writes(
        Subject::Block,
        SlotInit::Initialized,
        Effect::Roundtrips(scalar),
    )
}

const fn reads(subject: Subject, transfer: Ownership, via: Via, effect: ReadEffect) -> Check {
    Check::Read(Read {
        subject,
        transfer,
        via,
        effect,
    })
}

const fn decodes(stored: Stored, source: i64, settled: i64) -> ReadEffect {
    ReadEffect::Handle(Decode {
        stored,
        source,
        settled,
    })
}

const CELLS: &[Cell] = &[
    Cell {
        name: "string · transfer-none · field write",
        emitted: 4268,
        on_path: 78,
        descriptor: d_string_borrowed,
        check: writes(
            Subject::Text,
            SlotInit::Initialized,
            stores(Stored::Copy, true, 0, 0),
        ),
    },
    Cell {
        name: "string · transfer-none · null write",
        emitted: 4268,
        on_path: 0,
        descriptor: d_string_borrowed,
        check: writes_null(
            Subject::Text,
            SlotInit::Initialized,
            stores(Stored::Null, true, 0, 0),
        ),
    },
    Cell {
        name: "string · transfer-full · initialized slot",
        emitted: 497,
        on_path: 0,
        descriptor: d_string_full,
        check: writes(
            Subject::Text,
            SlotInit::Initialized,
            stores(Stored::Copy, false, 0, -1),
        ),
    },
    Cell {
        name: "string · transfer-full · uninitialized slot",
        emitted: 497,
        on_path: 0,
        descriptor: d_string_full,
        check: writes(
            Subject::Text,
            SlotInit::Uninitialized,
            stores(Stored::Copy, false, 0, 0),
        ),
    },
    Cell {
        name: "object · transfer-none · field write",
        emitted: 14284,
        on_path: 5,
        descriptor: d_object_borrowed,
        check: writes(
            Subject::Object,
            SlotInit::Initialized,
            stores(Stored::Alias, false, 0, 0),
        ),
    },
    Cell {
        name: "object · transfer-full · initialized slot",
        emitted: 955,
        on_path: 0,
        descriptor: d_object_full,
        check: writes(
            Subject::Object,
            SlotInit::Initialized,
            stores(Stored::Alias, false, 1, -1),
        ),
    },
    Cell {
        name: "object · transfer-full · uninitialized slot",
        emitted: 955,
        on_path: 0,
        descriptor: d_object_full,
        check: writes(
            Subject::Object,
            SlotInit::Uninitialized,
            stores(Stored::Alias, false, 1, 0),
        ),
    },
    Cell {
        name: "object · transfer-full · null write",
        emitted: 955,
        on_path: 0,
        descriptor: d_object_full,
        check: writes_null(
            Subject::Object,
            SlotInit::Initialized,
            stores(Stored::Null, false, 0, -1),
        ),
    },
    Cell {
        name: "boxed · transfer-none · sized · field write",
        emitted: 2421,
        on_path: 10,
        descriptor: d_boxed_borrowed_sized,
        check: writes(
            Subject::Rgba,
            SlotInit::Initialized,
            stores(Stored::Copy, true, 0, 0),
        ),
    },
    Cell {
        name: "boxed · transfer-none · unsized · field write",
        emitted: 2194,
        on_path: 3,
        descriptor: d_boxed_borrowed_unsized,
        check: writes(
            Subject::Rgba,
            SlotInit::Initialized,
            stores(Stored::Copy, true, 0, 0),
        ),
    },
    Cell {
        name: "boxed · transfer-none · null write",
        emitted: 2421,
        on_path: 0,
        descriptor: d_boxed_borrowed_sized,
        check: writes_null(
            Subject::Rgba,
            SlotInit::Initialized,
            stores(Stored::Null, false, 0, 0),
        ),
    },
    Cell {
        name: "boxed · transfer-full · initialized slot",
        emitted: 130,
        on_path: 0,
        descriptor: d_boxed_full_sized,
        check: writes(
            Subject::Rgba,
            SlotInit::Initialized,
            stores(Stored::Copy, false, 0, -1),
        ),
    },
    Cell {
        name: "boxed · transfer-full · uninitialized slot",
        emitted: 130,
        on_path: 0,
        descriptor: d_boxed_full_sized,
        check: writes(
            Subject::Rgba,
            SlotInit::Uninitialized,
            stores(Stored::Copy, false, 0, 0),
        ),
    },
    Cell {
        name: "boxed · unresolvable GType · field write",
        emitted: 56,
        on_path: 0,
        descriptor: d_boxed_unresolvable,
        check: writes(
            Subject::Block,
            SlotInit::Initialized,
            stores(Stored::Alias, false, 0, 0),
        ),
    },
    Cell {
        name: "boxed · inline · field write",
        emitted: 16,
        on_path: 10,
        descriptor: d_boxed_inline,
        check: writes(Subject::Rgba, SlotInit::Initialized, Effect::CopiesInPlace),
    },
    Cell {
        name: "boxed · inline · GValue copy-into-place",
        emitted: 0,
        on_path: 0,
        descriptor: d_boxed_inline_gvalue,
        check: writes(
            Subject::Block,
            SlotInit::Initialized,
            Effect::ReplacesInlineValue,
        ),
    },
    Cell {
        name: "boxed · inline · GClosure",
        emitted: 0,
        on_path: 0,
        descriptor: d_boxed_inline_gclosure,
        check: refuses("no copy-into-place operation"),
    },
    Cell {
        name: "boxed · inline · unsized",
        emitted: 0,
        on_path: 0,
        descriptor: d_boxed_inline_unsized,
        check: refuses("its size is unknown"),
    },
    Cell {
        name: "struct · transfer-none · unsized · field write",
        emitted: 582,
        on_path: 19,
        descriptor: d_struct_borrowed_unsized,
        check: writes(
            Subject::Block,
            SlotInit::Initialized,
            stores(Stored::Alias, false, 0, 0),
        ),
    },
    Cell {
        name: "struct · transfer-none · sized · initialized slot",
        emitted: 198,
        on_path: 0,
        descriptor: d_struct_borrowed_sized,
        check: writes(
            Subject::Block,
            SlotInit::Initialized,
            Effect::CopiesIntoDest,
        ),
    },
    Cell {
        name: "struct · transfer-none · sized · uninitialized slot",
        emitted: 198,
        on_path: 0,
        descriptor: d_struct_borrowed_sized,
        check: writes(
            Subject::Block,
            SlotInit::Uninitialized,
            stores(Stored::Alias, false, 0, 0),
        ),
    },
    Cell {
        name: "struct · transfer-full · sized · uninitialized slot",
        emitted: 6,
        on_path: 0,
        descriptor: d_struct_full_sized,
        check: writes(
            Subject::Block,
            SlotInit::Uninitialized,
            stores(Stored::Copy, false, 0, 0),
        ),
    },
    Cell {
        name: "struct · inline · field write",
        emitted: 67,
        on_path: 8,
        descriptor: d_struct_inline,
        check: writes(Subject::Block, SlotInit::Initialized, Effect::CopiesInPlace),
    },
    Cell {
        name: "struct · inline · unsized",
        emitted: 0,
        on_path: 0,
        descriptor: d_struct_inline_unsized,
        check: refuses("inline struct field whose size is unknown"),
    },
    Cell {
        name: "fundamental · transfer-none · field write",
        emitted: 707,
        on_path: 1,
        descriptor: d_fundamental_borrowed,
        check: writes(
            Subject::ParamSpec,
            SlotInit::Initialized,
            stores(Stored::Alias, true, 1, 0),
        ),
    },
    Cell {
        name: "fundamental · transfer-none · null write",
        emitted: 707,
        on_path: 0,
        descriptor: d_fundamental_borrowed,
        check: writes_null(
            Subject::ParamSpec,
            SlotInit::Initialized,
            stores(Stored::Null, false, 0, 0),
        ),
    },
    Cell {
        name: "fundamental · unref without a ref fn",
        emitted: 0,
        on_path: 0,
        descriptor: d_fundamental_without_ref_fn,
        check: refuses_writing(Subject::ParamSpec, "without a ref function"),
    },
    Cell {
        name: "fundamental · transfer-full · initialized slot",
        emitted: 237,
        on_path: 0,
        descriptor: d_fundamental_full,
        check: writes(
            Subject::ParamSpec,
            SlotInit::Initialized,
            stores(Stored::Alias, false, 1, -1),
        ),
    },
    Cell {
        name: "fundamental · transfer-full · uninitialized slot",
        emitted: 237,
        on_path: 0,
        descriptor: d_fundamental_full,
        check: writes(
            Subject::ParamSpec,
            SlotInit::Uninitialized,
            stores(Stored::Alias, false, 1, 0),
        ),
    },
    Cell {
        name: "fundamental · inline",
        emitted: 0,
        on_path: 0,
        descriptor: d_fundamental_inline,
        check: refuses_writing(Subject::ParamSpec, "inline fundamental field"),
    },
    Cell {
        name: "array · null-terminated · field write",
        emitted: 322,
        on_path: 17,
        descriptor: d_array,
        check: refuses(REFUSED),
    },
    Cell {
        name: "array · fixed · field write",
        emitted: 83,
        on_path: 21,
        descriptor: d_fixed_array,
        check: refuses(REFUSED),
    },
    Cell {
        name: "array · sized · field write",
        emitted: 375,
        on_path: 2,
        descriptor: d_sized_array,
        check: refuses(REFUSED),
    },
    Cell {
        name: "array · gslist · field write",
        emitted: 37,
        on_path: 1,
        descriptor: d_slist,
        check: refuses(REFUSED),
    },
    Cell {
        name: "hashtable · field write",
        emitted: 47,
        on_path: 0,
        descriptor: d_hashtable,
        check: refuses(REFUSED),
    },
    Cell {
        name: "callback · field write",
        emitted: 1283,
        on_path: 0,
        descriptor: d_callback,
        check: refuses(REFUSED),
    },
    Cell {
        name: "ref · field write",
        emitted: 153,
        on_path: 0,
        descriptor: d_ref,
        check: refuses(REFUSED),
    },
    Cell {
        name: "unichar · field write",
        emitted: 83,
        on_path: 0,
        descriptor: d_unichar,
        check: refuses(REFUSED),
    },
    Cell {
        name: "void · field write",
        emitted: 7416,
        on_path: 0,
        descriptor: d_void,
        check: refuses(REFUSED),
    },
    Cell {
        name: "buffer · field write",
        emitted: 49,
        on_path: 0,
        descriptor: d_buffer,
        check: refuses(REFUSED),
    },
    Cell {
        name: "int8 · field roundtrip",
        emitted: 28,
        on_path: 1,
        descriptor: d_int8,
        check: roundtrips(Scalar::Number(-7.0)),
    },
    Cell {
        name: "uint8 · field roundtrip",
        emitted: 180,
        on_path: 7,
        descriptor: d_uint8,
        check: roundtrips(Scalar::Number(200.0)),
    },
    Cell {
        name: "int16 · field roundtrip",
        emitted: 17,
        on_path: 8,
        descriptor: d_int16,
        check: roundtrips(Scalar::Number(-300.0)),
    },
    Cell {
        name: "uint16 · field roundtrip",
        emitted: 94,
        on_path: 15,
        descriptor: d_uint16,
        check: roundtrips(Scalar::Number(60000.0)),
    },
    Cell {
        name: "int32 · field roundtrip",
        emitted: 2962,
        on_path: 157,
        descriptor: d_int32,
        check: roundtrips(Scalar::Number(-123_456.0)),
    },
    Cell {
        name: "uint32 · field roundtrip",
        emitted: 2564,
        on_path: 198,
        descriptor: d_uint32,
        check: roundtrips(Scalar::Number(4_000_000_000.0)),
    },
    Cell {
        name: "int64 · field roundtrip",
        emitted: 134,
        on_path: 1,
        descriptor: d_int64,
        check: roundtrips(Scalar::Number(-9_007_199_254_740_991.0)),
    },
    Cell {
        name: "uint64 · field roundtrip",
        emitted: 1971,
        on_path: 145,
        descriptor: d_uint64,
        check: roundtrips(Scalar::Number(9_007_199_254_740_991.0)),
    },
    Cell {
        name: "bigint64 · field roundtrip",
        emitted: 186,
        on_path: 14,
        descriptor: d_bigint64,
        check: roundtrips(Scalar::Big(i64::MIN)),
    },
    Cell {
        name: "biguint64 · field roundtrip",
        emitted: 145,
        on_path: 11,
        descriptor: d_biguint64,
        check: roundtrips(Scalar::Big(i64::MAX)),
    },
    Cell {
        name: "float32 · field roundtrip",
        emitted: 686,
        on_path: 59,
        descriptor: d_float32,
        check: roundtrips(Scalar::Number(0.5)),
    },
    Cell {
        name: "float64 · field roundtrip",
        emitted: 1010,
        on_path: 31,
        descriptor: d_float64,
        check: roundtrips(Scalar::Number(-1.25)),
    },
    Cell {
        name: "boolean · field roundtrip",
        emitted: 4443,
        on_path: 16,
        descriptor: d_boolean,
        check: roundtrips(Scalar::Bool(true)),
    },
    Cell {
        name: "enum · field roundtrip",
        emitted: 1307,
        on_path: 3,
        descriptor: d_enum,
        check: roundtrips(Scalar::Number(1.0)),
    },
    Cell {
        name: "flags · field roundtrip",
        emitted: 550,
        on_path: 5,
        descriptor: d_flags,
        check: roundtrips(Scalar::Number(6.0)),
    },
    Cell {
        name: "gtype · field roundtrip",
        emitted: 237,
        on_path: 4,
        descriptor: d_biguint64,
        check: roundtrips(Scalar::Big(80)),
    },
    Cell {
        name: "object · transfer-none · field read",
        emitted: 14284,
        on_path: 4,
        descriptor: d_object_borrowed,
        check: reads(
            Subject::Object,
            Ownership::Borrowed,
            Via::PointerSlot,
            decodes(Stored::Alias, 1, 0),
        ),
    },
    Cell {
        name: "object · transfer-full · callback arg read",
        emitted: 955,
        on_path: 0,
        descriptor: d_object_full,
        check: reads(
            Subject::Object,
            Ownership::Full,
            Via::PointerSlot,
            decodes(Stored::Alias, 0, -1),
        ),
    },
    Cell {
        name: "object · transfer-full · floating read",
        emitted: 955,
        on_path: 0,
        descriptor: d_object_full,
        check: reads(
            Subject::FloatingObject,
            Ownership::Full,
            Via::Value,
            decodes(Stored::SunkAlias, 0, -1),
        ),
    },
    Cell {
        name: "boxed · transfer-none · field read",
        emitted: 2421,
        on_path: 6,
        descriptor: d_boxed_borrowed_sized,
        check: reads(
            Subject::Rgba,
            Ownership::Borrowed,
            Via::PointerSlot,
            decodes(Stored::Copy, 0, 0),
        ),
    },
    Cell {
        name: "boxed · transfer-full · callback arg read",
        emitted: 130,
        on_path: 0,
        descriptor: d_boxed_full_sized,
        check: reads(
            Subject::Rgba,
            Ownership::Full,
            Via::PointerSlot,
            decodes(Stored::Copy, 0, 0),
        ),
    },
    Cell {
        name: "boxed · inline · field read",
        emitted: 16,
        on_path: 6,
        descriptor: d_boxed_inline,
        check: reads(
            Subject::Rgba,
            Ownership::Borrowed,
            Via::InlineSlot,
            decodes(Stored::Copy, 0, 0),
        ),
    },
    Cell {
        name: "boxed · caller-allocated · out read",
        emitted: 12,
        on_path: 0,
        descriptor: d_boxed_caller_allocated,
        check: reads(
            Subject::Rgba,
            Ownership::Borrowed,
            Via::PointerSlot,
            decodes(Stored::Alias, 0, 0),
        ),
    },
    Cell {
        name: "boxed · free-fn · read",
        emitted: 3,
        on_path: 0,
        descriptor: d_boxed_free_fn,
        check: reads(
            Subject::Block,
            Ownership::Borrowed,
            Via::Value,
            decodes(Stored::Alias, 0, 0),
        ),
    },
    Cell {
        name: "struct · transfer-none · unsized · field read",
        emitted: 582,
        on_path: 16,
        descriptor: d_struct_borrowed_unsized,
        check: reads(
            Subject::Block,
            Ownership::Borrowed,
            Via::PointerSlot,
            decodes(Stored::Alias, 0, 0),
        ),
    },
    Cell {
        name: "struct · transfer-none · sized · field read",
        emitted: 198,
        on_path: 5,
        descriptor: d_struct_borrowed_sized,
        check: reads(
            Subject::Block,
            Ownership::Borrowed,
            Via::PointerSlot,
            decodes(Stored::Copy, 0, 0),
        ),
    },
    Cell {
        name: "struct · inline · field read",
        emitted: 67,
        on_path: 59,
        descriptor: d_struct_inline,
        check: reads(
            Subject::Block,
            Ownership::Borrowed,
            Via::InlineSlot,
            decodes(Stored::Copy, 0, 0),
        ),
    },
    Cell {
        name: "struct · caller-allocated · out read",
        emitted: 3,
        on_path: 0,
        descriptor: d_struct_caller_allocated,
        check: reads(
            Subject::Block,
            Ownership::Borrowed,
            Via::PointerSlot,
            decodes(Stored::Alias, 0, 0),
        ),
    },
    Cell {
        name: "fundamental · transfer-none · field read",
        emitted: 707,
        on_path: 1,
        descriptor: d_fundamental_borrowed,
        check: reads(
            Subject::ParamSpec,
            Ownership::Borrowed,
            Via::PointerSlot,
            decodes(Stored::Alias, 1, 0),
        ),
    },
    Cell {
        name: "fundamental · transfer-full · read refs on top of the transfer",
        emitted: 237,
        on_path: 0,
        descriptor: d_fundamental_full,
        check: reads(
            Subject::ParamSpec,
            Ownership::Full,
            Via::PointerSlot,
            decodes(Stored::Alias, 1, 0),
        ),
    },
    Cell {
        name: "string · transfer-none · field read",
        emitted: 4268,
        on_path: 63,
        descriptor: d_string_borrowed,
        check: reads(
            Subject::Text,
            Ownership::Borrowed,
            Via::PointerSlot,
            ReadEffect::Text,
        ),
    },
    Cell {
        name: "string · transfer-full · slot read frees nothing",
        emitted: 497,
        on_path: 0,
        descriptor: d_string_full,
        check: reads(
            Subject::Text,
            Ownership::Full,
            Via::PointerSlot,
            ReadEffect::Text,
        ),
    },
];

thread_local! {
    static FILL: std::cell::Cell<u8> = const { std::cell::Cell::new(0) };
}

fn next_fill() -> u8 {
    FILL.with(|cell| {
        let next = cell.get().wrapping_add(0x11);
        cell.set(next);
        next
    })
}

fn filled_block() -> *mut c_void {
    let ptr = unsafe { glib::ffi::g_malloc0(BLOCK_SIZE) };
    unsafe { std::ptr::write_bytes(ptr.cast::<u8>(), next_fill(), BLOCK_SIZE) };
    ptr
}

fn plain_object() -> *mut c_void {
    unsafe {
        glib::gobject_ffi::g_object_new(glib::Object::static_type().into_glib(), std::ptr::null())
    }
    .cast()
}

fn floating_object() -> *mut c_void {
    unsafe {
        let ptr = glib::gobject_ffi::g_object_new(
            glib::gobject_ffi::g_initially_unowned_get_type(),
            std::ptr::null(),
        );
        glib::gobject_ffi::g_object_ref(ptr.cast());
        ptr.cast()
    }
}

impl Subject {
    fn alloc(self) -> *mut c_void {
        match self {
            Self::Object => plain_object(),
            Self::FloatingObject => floating_object(),
            Self::ParamSpec => helpers::make_bool_param_spec(),
            Self::Rgba | Self::Block => filled_block(),
            Self::Text => unsafe { glib::ffi::g_strdup(STALE.as_ptr()) }.cast(),
        }
    }

    fn refcount(self, ptr: *mut c_void) -> Option<u32> {
        match self {
            Self::Object | Self::FloatingObject => {
                Some(unsafe { helpers::get_gobject_refcount(ptr.cast()) })
            }
            Self::ParamSpec => Some(unsafe { helpers::param_spec_refcount(ptr) }),
            Self::Rgba | Self::Block | Self::Text => None,
        }
    }

    fn acquire(self, ptr: *mut c_void) {
        match self {
            Self::Object => unsafe {
                glib::gobject_ffi::g_object_ref(ptr.cast());
            },
            Self::ParamSpec => unsafe {
                helpers::param_spec_ref(ptr);
            },
            Self::FloatingObject | Self::Rgba | Self::Block | Self::Text => {}
        }
    }

    fn release(self, ptr: *mut c_void) {
        unsafe {
            match self {
                Self::Object | Self::FloatingObject => {
                    glib::gobject_ffi::g_object_unref(ptr.cast());
                }
                Self::ParamSpec => helpers::param_spec_unref(ptr),
                Self::Rgba => {
                    glib::gobject_ffi::g_boxed_free(gdk::RGBA::static_type().into_glib(), ptr);
                }
                Self::Block | Self::Text => glib::ffi::g_free(ptr),
            }
        }
    }

    fn has_native_source(self) -> bool {
        self != Self::Text
    }

    fn defers_release(self) -> bool {
        matches!(self, Self::Object | Self::FloatingObject)
    }
}

struct Scene {
    subject: Subject,
    frees: Vec<usize>,
}

impl Scene {
    fn open(subject: Subject) -> Self {
        drain_g_freed();
        Self {
            subject,
            frees: Vec::new(),
        }
    }

    fn absorb(&mut self) {
        self.frees.extend(drain_g_freed());
    }

    fn claims(&self, ptr: *mut c_void) -> i64 {
        if ptr.is_null() {
            return 0;
        }
        if let Some(count) = self.subject.refcount(ptr) {
            return i64::from(count);
        }
        let freed = self
            .frees
            .iter()
            .filter(|&&seen| seen == ptr.addr())
            .count();
        1 - i64::try_from(freed).expect("a free count fits in i64")
    }

    fn release_all(&mut self, ptrs: &[*mut c_void]) {
        let mut seen: Vec<usize> = Vec::new();
        for &ptr in ptrs {
            if ptr.is_null() || seen.contains(&ptr.addr()) {
                continue;
            }
            seen.push(ptr.addr());
            for _ in 0..self.claims(ptr) {
                self.subject.release(ptr);
            }
            self.absorb();
        }
    }
}

fn codec_of(cell: &Cell) -> Codec {
    (cell.descriptor)()
        .into_codec()
        .unwrap_or_else(|error| panic!("{}: the descriptor must build a codec: {error}", cell.name))
}

fn handle_value(env: &Env, ptr: *mut c_void) -> Unknown<'_> {
    External::new(Handle::from_glib_borrow(ptr))
        .into_unknown(env)
        .expect("wrapping a handle should succeed")
}

fn written_value(subject: Subject, source: Source, env: &Env, ptr: *mut c_void) -> Unknown<'_> {
    match source {
        Source::Null => napi_mock::to_unknown(env, napi_mock::fake_null()),
        Source::Value if subject == Subject::Text => {
            napi_mock::to_unknown(env, napi_mock::fake_string(TEXT))
        }
        Source::Value => handle_value(env, ptr),
    }
}

fn write_into(
    cell: &Cell,
    env: &Env,
    slot: *mut c_void,
    value: Unknown<'_>,
    init: SlotInit,
) -> anyhow::Result<Option<PendingTransfer>> {
    codec_of(cell).write_value_to_ptr(env, unsafe { Slot::new(slot) }, value, init)
}

fn bytes_of<'a>(ptr: *const c_void) -> &'a [u8] {
    unsafe { std::slice::from_raw_parts(ptr.cast::<u8>(), BLOCK_SIZE) }
}

fn assert_stored(
    cell: &Cell,
    expect: Stored,
    word: *mut c_void,
    src: *mut c_void,
    old: *mut c_void,
) {
    match expect {
        Stored::Alias | Stored::SunkAlias => assert_eq!(
            word, src,
            "{}: the slot must hold the source pointer",
            cell.name
        ),
        Stored::Null => assert!(word.is_null(), "{}: the slot must be cleared", cell.name),
        Stored::Copy => {
            assert!(
                !word.is_null(),
                "{}: the slot must hold an acquired copy",
                cell.name
            );
            assert_ne!(
                word, src,
                "{}: the slot must not alias the source",
                cell.name
            );
            assert_ne!(
                word, old,
                "{}: the slot must not keep the displaced pointer",
                cell.name
            );
        }
    }
}

fn release_transfer(
    cell: &Cell,
    scene: &mut Scene,
    transfer: Option<PendingTransfer>,
    stored: *mut c_void,
) {
    let Some(transfer) = transfer else { return };
    if stored.is_null() {
        transfer.release_now();
        scene.absorb();
        return;
    }
    let before = scene.claims(stored);
    transfer.release_now();
    scene.absorb();
    assert_eq!(
        scene.claims(stored) - before,
        -1,
        "{}: the returned PendingTransfer must release exactly the claim the write acquired",
        cell.name
    );
}

fn assert_stores(cell: &Cell, plan: &Write, expect: Stores) {
    let env = helpers::fake_env();
    let subject = plan.subject;
    let src = if subject.has_native_source() && matches!(plan.source, Source::Value) {
        subject.alloc()
    } else {
        std::ptr::null_mut()
    };
    let displaced = subject.alloc();
    if expect.displaced < 0 {
        subject.acquire(displaced);
    }
    let mut scene = Scene::open(subject);
    let source_before = scene.claims(src);
    let displaced_before = scene.claims(displaced);

    let mut word = displaced;
    let transfer = write_into(
        cell,
        &env,
        (&raw mut word).cast(),
        written_value(subject, plan.source, &env, src),
        plan.init,
    )
    .unwrap_or_else(|error| panic!("{}: the write must succeed: {error}", cell.name));
    scene.absorb();

    assert_stored(cell, expect.stored, word, src, displaced);
    assert_eq!(
        transfer.is_some(),
        expect.transfer,
        "{}: a PendingTransfer must be handed back exactly when the write acquired something",
        cell.name
    );
    assert_eq!(
        scene.claims(src) - source_before,
        expect.source,
        "{}: claims taken on the written value",
        cell.name
    );
    assert_eq!(
        scene.claims(displaced) - displaced_before,
        expect.displaced,
        "{}: claims released from the displaced value",
        cell.name
    );

    release_transfer(cell, &mut scene, transfer, word);
    scene.release_all(&[word, displaced, src]);
}

fn assert_copies_in_place(cell: &Cell, plan: &Write) {
    let env = helpers::fake_env();
    let subject = plan.subject;
    let src = subject.alloc();
    let mut dest = [0u8; BLOCK_SIZE];
    let mut scene = Scene::open(subject);
    let before = scene.claims(src);

    let transfer = write_into(
        cell,
        &env,
        dest.as_mut_ptr().cast(),
        written_value(subject, plan.source, &env, src),
        plan.init,
    )
    .unwrap_or_else(|error| panic!("{}: the inline write must succeed: {error}", cell.name));
    scene.absorb();

    assert!(
        transfer.is_none(),
        "{}: an inline write stores no pointer, so it has nothing to hand back",
        cell.name
    );
    assert_eq!(
        &dest[..],
        bytes_of(src.cast_const()),
        "{}: an inline write must land the source bytes in the slot",
        cell.name
    );
    assert_ne!(
        unsafe { dest.as_ptr().cast::<usize>().read_unaligned() },
        src.addr(),
        "{}: an inline slot must hold the bytes, never a pointer to them",
        cell.name
    );
    assert_eq!(
        scene.claims(src),
        before,
        "{}: an inline write takes no claim on the source",
        cell.name
    );
    scene.release_all(&[src]);
}

fn assert_copies_into_dest(cell: &Cell, plan: &Write) {
    let env = helpers::fake_env();
    let subject = plan.subject;
    let src = subject.alloc();
    let dest = subject.alloc();
    let mut scene = Scene::open(subject);

    let mut word = dest;
    let transfer = write_into(
        cell,
        &env,
        (&raw mut word).cast(),
        written_value(subject, plan.source, &env, src),
        plan.init,
    )
    .unwrap_or_else(|error| panic!("{}: the write must succeed: {error}", cell.name));
    scene.absorb();

    assert!(
        transfer.is_none(),
        "{}: copying into a caller's buffer acquires nothing",
        cell.name
    );
    assert_eq!(
        word, dest,
        "{}: an initialized sized slot keeps its destination pointer",
        cell.name
    );
    assert_eq!(
        bytes_of(dest.cast_const()),
        bytes_of(src.cast_const()),
        "{}: the source bytes must be copied into the destination",
        cell.name
    );
    assert_eq!(
        scene.claims(dest),
        1,
        "{}: the destination must not be released",
        cell.name
    );
    scene.release_all(&[dest, src]);
}

fn gvalue_holding(text: &CStr) -> *mut glib::gobject_ffi::GValue {
    unsafe {
        let value = glib::ffi::g_malloc0(GVALUE_SIZE as usize).cast::<glib::gobject_ffi::GValue>();
        glib::gobject_ffi::g_value_init(value, glib::Type::STRING.into_glib());
        glib::gobject_ffi::g_value_set_string(value, text.as_ptr());
        value
    }
}

fn gvalue_string(value: *mut glib::gobject_ffi::GValue) -> *const c_char {
    unsafe { glib::gobject_ffi::g_value_get_string(value) }
}

fn assert_replaces_inline_value(cell: &Cell) {
    let env = helpers::fake_env();
    let dest = gvalue_holding(c"displaced-contents");
    let src = gvalue_holding(c"replacement-contents");
    let stale = gvalue_string(dest);
    let mut scene = Scene::open(Subject::Block);

    let transfer = write_into(
        cell,
        &env,
        dest.cast(),
        handle_value(&env, src.cast()),
        SlotInit::Initialized,
    )
    .unwrap_or_else(|error| {
        panic!(
            "{}: the inline GValue write must succeed: {error}",
            cell.name
        )
    });
    scene.absorb();

    assert!(transfer.is_none(), "{}: nothing is handed back", cell.name);
    assert_eq!(
        scene.claims(stale.cast_mut().cast()),
        0,
        "{}: the displaced GValue contents must be released exactly once",
        cell.name
    );
    let copied = gvalue_string(dest);
    assert_ne!(
        copied,
        gvalue_string(src),
        "{}: an inline GValue write must deep-copy, not alias the source contents",
        cell.name
    );
    assert_eq!(unsafe { CStr::from_ptr(copied) }, c"replacement-contents");
    assert_eq!(
        unsafe { CStr::from_ptr(gvalue_string(src)) },
        c"replacement-contents",
        "{}: the source must be left intact",
        cell.name
    );

    unsafe {
        glib::gobject_ffi::g_value_unset(dest);
        glib::gobject_ffi::g_value_unset(src);
        glib::ffi::g_free(dest.cast());
        glib::ffi::g_free(src.cast());
    }
}

fn assert_refuses(cell: &Cell, plan: &Write, fragment: &str) {
    let env = helpers::fake_env();
    let block = plan.subject.alloc();
    let sentinel = std::ptr::dangling_mut::<c_void>();
    let mut word = sentinel;
    let mut scene = Scene::open(plan.subject);

    let error = write_into(
        cell,
        &env,
        (&raw mut word).cast(),
        handle_value(&env, block),
        SlotInit::Initialized,
    )
    .err()
    .unwrap_or_else(|| panic!("{}: this descriptor must refuse the write", cell.name));
    scene.absorb();

    assert!(
        error.to_string().contains(fragment),
        "{}: expected a refusal mentioning {fragment:?}, got {error}",
        cell.name
    );
    assert_eq!(
        word, sentinel,
        "{}: a refused write must leave the slot untouched",
        cell.name
    );
    assert_eq!(
        scene.claims(block),
        1,
        "{}: a refused write must release nothing",
        cell.name
    );
    scene.release_all(&[block]);
}

fn scalar_value(env: &Env, scalar: Scalar) -> Unknown<'_> {
    let raw = match scalar {
        Scalar::Number(number) => napi_mock::fake_double(number),
        Scalar::Bool(flag) => napi_mock::fake_bool(flag),
        Scalar::Big(number) => napi_mock::fake_bigint_i128(i128::from(number)),
    };
    napi_mock::to_unknown(env, raw)
}

fn assert_scalar_read_back(cell: &Cell, scalar: Scalar, value: &Unknown<'_>) {
    match scalar {
        Scalar::Number(number) => assert_eq!(
            napi_mock::read_double(value.raw()),
            Some(number),
            "{}: the scalar must survive a write/read round trip",
            cell.name
        ),
        Scalar::Bool(flag) => assert_eq!(
            napi_mock::read_bool(value.raw()),
            Some(flag),
            "{}: the scalar must survive a write/read round trip",
            cell.name
        ),
        Scalar::Big(number) => assert_eq!(
            napi_mock::read_bigint_i128(value.raw()),
            Some(i128::from(number)),
            "{}: the scalar must survive a write/read round trip",
            cell.name
        ),
    }
}

fn assert_roundtrips(cell: &Cell, scalar: Scalar) {
    let env = helpers::fake_env();
    let codec = codec_of(cell);
    let mut buffer = [0u8; BLOCK_SIZE];

    let transfer = codec
        .write_value_to_ptr(
            &env,
            unsafe { Slot::new(buffer.as_mut_ptr().cast()) },
            scalar_value(&env, scalar),
            SlotInit::Initialized,
        )
        .unwrap_or_else(|error| panic!("{}: the scalar write must succeed: {error}", cell.name));

    assert!(
        transfer.is_none(),
        "{}: a scalar write allocates nothing to hand back",
        cell.name
    );
    let read_back = unsafe {
        codec.read(
            &env,
            ReadCtx::slot(buffer.as_ptr().cast(), "ownership matrix"),
        )
    }
    .unwrap_or_else(|error| panic!("{}: the scalar must read back: {error}", cell.name));
    assert_scalar_read_back(cell, scalar, &read_back);
}

fn assert_reads(cell: &Cell, plan: &Read) {
    let env = helpers::fake_env();
    let subject = plan.subject;
    let src = subject.alloc();
    if plan.transfer.is_full() {
        subject.acquire(src);
    }
    let mut scene = Scene::open(subject);
    let decoded = Decoded {
        src,
        before: scene.claims(src),
    };
    let word = src;
    let source = match plan.via {
        Via::PointerSlot => ReadCtx::slot((&raw const word).cast(), "ownership matrix"),
        Via::InlineSlot => ReadCtx::slot(src.cast_const(), "ownership matrix"),
        Via::Value => ReadCtx::value(src, "ownership matrix"),
    };

    let value = unsafe { codec_of(cell).read(&env, source.with_transfer(plan.transfer)) }
        .unwrap_or_else(|error| panic!("{}: the read must succeed: {error}", cell.name));
    scene.absorb();

    match plan.effect {
        ReadEffect::Text => assert_reads_text(cell, &scene, &value, decoded),
        ReadEffect::Handle(expect) => assert_reads_handle(cell, &mut scene, value, decoded, expect),
    }
    scene.release_all(&[src]);
}

fn assert_reads_text(cell: &Cell, scene: &Scene, value: &Unknown<'_>, decoded: Decoded) {
    assert_eq!(
        napi_mock::read_string(value.raw()).as_deref(),
        STALE.to_str().ok(),
        "{}: the slot text must be decoded",
        cell.name
    );
    assert_eq!(
        scene.claims(decoded.src),
        decoded.before,
        "{}: reading a string releases nothing",
        cell.name
    );
}

fn assert_reads_handle(
    cell: &Cell,
    scene: &mut Scene,
    value: Unknown<'_>,
    decoded: Decoded,
    expect: Decode,
) {
    let raw = value.raw();
    let ptr = handle_ptr(value, "ownership matrix")
        .unwrap_or_else(|error| panic!("{}: the read must decode a handle: {error}", cell.name));
    assert_stored(cell, expect.stored, ptr, decoded.src, std::ptr::null_mut());
    if expect.stored == Stored::SunkAlias {
        assert_eq!(
            unsafe { glib::gobject_ffi::g_object_is_floating(ptr.cast()) },
            0,
            "{}: a transfer-full read must sink the floating reference",
            cell.name
        );
    }
    assert_eq!(
        scene.claims(decoded.src) - decoded.before,
        expect.source,
        "{}: claims the read took on the source",
        cell.name
    );

    napi_mock::collect(raw);
    settle(scene, decoded, expect.settled);
    scene.absorb();
    assert_eq!(
        scene.claims(decoded.src) - decoded.before,
        expect.settled,
        "{}: claims still held once the wrapper is collected",
        cell.name
    );
    if expect.stored == Stored::Copy {
        assert_eq!(
            scene.claims(ptr),
            0,
            "{}: the wrapper owns the copy it decoded and releases it",
            cell.name
        );
    }
}

fn settle(scene: &Scene, decoded: Decoded, settled: i64) {
    if !scene.subject.defers_release() {
        return;
    }
    helpers::pump_default_context_until(|| scene.claims(decoded.src) - decoded.before == settled);
}

fn adoption_handle(owner: Owner) -> External<Handle> {
    match owner {
        Owner::Struct => External::new(Handle::owned_struct(unsafe {
            glib::ffi::g_malloc0(BLOCK_SIZE)
        })),
        Owner::Borrowed => External::new(Handle::from_glib_borrow(unsafe {
            glib::ffi::g_malloc0(BLOCK_SIZE)
        })),
        Owner::Boxed => {
            let (rgba, _) = helpers::owned_rgba_boxed();
            External::new(Handle::from(rgba))
        }
    }
}

fn assert_handle_adoption(cell: &Cell, subject: Subject, owner: Owner, adopts: bool) {
    let env = helpers::fake_env();
    let src = if subject.has_native_source() {
        subject.alloc()
    } else {
        std::ptr::null_mut()
    };
    let handle = adoption_handle(owner);
    let owner_ptr = handle.as_ptr();
    native::api::write::write(
        &env,
        &handle,
        (cell.descriptor)(),
        0.0,
        written_value(subject, Source::Value, &env, src),
    )
    .unwrap_or_else(|error| panic!("{}: the field write must succeed: {error}", cell.name));

    let written = unsafe { Slot::new(handle.as_ptr()).load() };
    let mut scene = Scene::open(subject);
    let before = scene.claims(written);
    drop(handle);
    scene.absorb();

    let expected = if adopts { before - 1 } else { before };
    assert_eq!(
        scene.claims(written),
        expected,
        "{}: field adoption under a {owner:?} handle",
        cell.name
    );
    scene.release_all(&[written, src]);
    if matches!(owner, Owner::Borrowed) {
        unsafe { glib::ffi::g_free(owner_ptr) };
    }
}

fn run_write(cell: &Cell, plan: &Write) {
    match plan.effect {
        Effect::Refuses(fragment) => assert_refuses(cell, plan, fragment),
        Effect::Stores(expect) => assert_stores(cell, plan, expect),
        Effect::CopiesInPlace => assert_copies_in_place(cell, plan),
        Effect::CopiesIntoDest => assert_copies_into_dest(cell, plan),
        Effect::ReplacesInlineValue => assert_replaces_inline_value(cell),
        Effect::Roundtrips(scalar) => assert_roundtrips(cell, scalar),
    }
}

fn adopting_writes() -> impl Iterator<Item = (&'static Cell, Subject)> {
    CELLS.iter().filter_map(|cell| match cell.check {
        Check::Write(Write {
            subject,
            effect:
                Effect::Stores(Stores {
                    transfer: true,
                    stored: Stored::Alias | Stored::Copy,
                    ..
                }),
            ..
        }) => Some((cell, subject)),
        _ => None,
    })
}

#[test]
fn every_write_cell_honors_the_ownership_contract() {
    for cell in CELLS {
        let Check::Write(plan) = cell.check else {
            continue;
        };
        helpers::run(|| run_write(cell, &plan));
    }
}

#[test]
fn every_read_cell_honors_the_ownership_contract() {
    for cell in CELLS {
        let Check::Read(plan) = cell.check else {
            continue;
        };
        helpers::run(|| assert_reads(cell, &plan));
    }
}

#[test]
fn only_a_struct_handle_adopts_the_transfers_its_fields_hand_back() {
    for (cell, subject) in adopting_writes() {
        helpers::run(|| assert_handle_adoption(cell, subject, Owner::Struct, true));
        helpers::run(|| assert_handle_adoption(cell, subject, Owner::Boxed, false));
        helpers::run(|| assert_handle_adoption(cell, subject, Owner::Borrowed, false));
    }
}

#[test]
fn the_emitted_cells_the_runtime_refuses_are_exactly_these() {
    let refused = CELLS
        .iter()
        .filter(|cell| {
            cell.on_path > 0
                && matches!(
                    cell.check,
                    Check::Write(Write {
                        effect: Effect::Refuses(_),
                        ..
                    })
                )
        })
        .map(|cell| cell.name)
        .collect::<Vec<_>>();

    assert_eq!(
        refused,
        [
            "array · null-terminated · field write",
            "array · fixed · field write",
            "array · sized · field write",
            "array · gslist · field write",
        ],
        "a descriptor codegen emits on the field path that the runtime refuses is a hole in the \
         marshalling surface; change this list only when one is closed or opened deliberately"
    );
}

#[test]
fn the_inventory_columns_are_consistent() {
    for cell in CELLS {
        assert!(
            cell.on_path <= cell.emitted,
            "{}: a descriptor cannot reach one path more often than it occurs at all",
            cell.name
        );
        assert!(
            cell.emitted > 0 || cell.on_path == 0,
            "{}: a cell codegen never emits must not claim occurrences on a path",
            cell.name
        );
    }
}
