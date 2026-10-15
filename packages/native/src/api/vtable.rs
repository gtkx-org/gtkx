use std::ffi::c_void;

use glib::translate::IntoGlib as _;
use glib::{self, gobject_ffi};

pub(crate) fn query_type(type_: glib::Type) -> Option<gobject_ffi::GTypeQuery> {
    let mut query = gobject_ffi::GTypeQuery {
        type_: 0,
        type_name: std::ptr::null(),
        class_size: 0,
        instance_size: 0,
    };
    unsafe { gobject_ffi::g_type_query(type_.into_glib(), &raw mut query) };

    (query.type_ != 0).then_some(query)
}

pub(crate) fn validate_vfunc_offset(
    byte_offset: usize,
    class_size: u32,
    label: &str,
) -> anyhow::Result<()> {
    let pointer_align = align_of::<*mut c_void>();
    let pointer_size = size_of::<*mut c_void>();

    if !byte_offset.is_multiple_of(pointer_align) {
        anyhow::bail!(
            "{label} byte_offset {byte_offset} is not aligned to a pointer ({pointer_align})"
        );
    }

    let end = byte_offset
        .checked_add(pointer_size)
        .ok_or_else(|| anyhow::anyhow!("{label} byte_offset overflow"))?;

    if end > class_size as usize {
        anyhow::bail!("{label} byte_offset {byte_offset} exceeds class size {class_size}");
    }

    Ok(())
}
