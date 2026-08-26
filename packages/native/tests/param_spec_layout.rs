use std::mem::{offset_of, size_of};

use gtk4::glib::ffi::GType;
use gtk4::glib::gobject_ffi::{GParamFlags, GParamSpec};

const RUNTIME_PARAM_SPEC: &str = include_str!("../../runtime/src/param-spec.ts");

fn runtime_offset(name: &str) -> usize {
    let declaration = format!("\nconst {name} = ");

    let rest = RUNTIME_PARAM_SPEC
        .split_once(&declaration)
        .unwrap_or_else(|| panic!("{name} is declared in param-spec.ts"))
        .1;

    rest.split_once(';')
        .expect("the declaration is terminated")
        .0
        .trim()
        .parse()
        .expect("the offset is a decimal literal")
}

#[test]
fn runtime_offsets_match_the_glib_param_spec_layout() {
    assert_eq!(
        runtime_offset("FLAGS_BYTE_OFFSET"),
        offset_of!(GParamSpec, flags)
    );

    assert_eq!(
        runtime_offset("VALUE_TYPE_BYTE_OFFSET"),
        offset_of!(GParamSpec, value_type)
    );

    assert_eq!(
        runtime_offset("OWNER_TYPE_BYTE_OFFSET"),
        offset_of!(GParamSpec, owner_type)
    );
}

#[test]
fn runtime_field_widths_match_the_glib_param_spec_layout() {
    assert_eq!(size_of::<GParamFlags>(), size_of::<u32>());
    assert_eq!(size_of::<GType>(), size_of::<u64>());
}
