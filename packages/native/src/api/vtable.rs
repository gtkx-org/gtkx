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
    class_size: Option<u32>,
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

    if let Some(class_size) = class_size
        && end > class_size as usize
    {
        anyhow::bail!("{label} byte_offset {byte_offset} exceeds class size {class_size}");
    }

    Ok(())
}

fn peek_interface_vtable(
    class_ptr: *mut c_void,
    instance_type: glib::Type,
    interface_type: glib::Type,
    label: &str,
) -> anyhow::Result<*mut c_void> {
    let vtable =
        unsafe { gobject_ffi::g_type_interface_peek(class_ptr, interface_type.into_glib()) };

    if vtable.is_null() {
        anyhow::bail!(
            "{label}: type '{}' does not implement interface '{}'",
            instance_type.name(),
            interface_type.name()
        );
    }

    Ok(vtable)
}

#[allow(clippy::cast_ptr_alignment)]
pub(crate) fn resolve_vfunc_slot(
    instance_type: glib::Type,
    interface_type: Option<glib::Type>,
    byte_offset: usize,
    label: &str,
) -> anyhow::Result<*mut c_void> {
    let class_ptr = unsafe { gobject_ffi::g_type_class_ref(instance_type.into_glib()) };

    if class_ptr.is_null() {
        anyhow::bail!(
            "{label}: type '{}' has no class structure",
            instance_type.name()
        );
    }

    let slot = read_slot(class_ptr, instance_type, interface_type, byte_offset, label);

    if slot.is_err() {
        unsafe { gobject_ffi::g_type_class_unref(class_ptr) };
    }

    slot
}

#[allow(clippy::cast_ptr_alignment)]
fn read_slot(
    class_ptr: *mut c_void,
    instance_type: glib::Type,
    interface_type: Option<glib::Type>,
    byte_offset: usize,
    label: &str,
) -> anyhow::Result<*mut c_void> {
    let vtable = match interface_type {
        Some(interface_type) => {
            peek_interface_vtable(class_ptr, instance_type, interface_type, label)?
        }
        None => class_ptr,
    };

    let slot = unsafe {
        vtable
            .cast::<u8>()
            .add(byte_offset)
            .cast::<*mut c_void>()
            .read()
    };

    if slot.is_null() {
        anyhow::bail!(
            "{label}: type '{}' provides no implementation",
            instance_type.name()
        );
    }

    Ok(slot)
}

#[cfg(test)]
mod tests {
    use glib::prelude::StaticType as _;

    use super::*;

    #[test]
    fn query_type_reports_the_class_size_of_a_registered_type() {
        test_support::run(|| {
            let query = query_type(glib::Object::static_type()).expect("GObject can be queried");

            assert!(query.class_size as usize >= size_of::<gobject_ffi::GObjectClass>());
        });
    }

    #[test]
    fn query_type_reports_nothing_for_an_interface_type() {
        test_support::run(|| {
            assert!(query_type(glib::Type::INTERFACE).is_none());
        });
    }

    #[test]
    fn validate_vfunc_offset_accepts_aligned_offset_within_bounds() {
        validate_vfunc_offset(8, Some(64), "vfunc")
            .expect("aligned in-bounds offset should validate");
    }

    #[test]
    fn validate_vfunc_offset_accepts_any_aligned_offset_without_bounds() {
        validate_vfunc_offset(4096, None, "vfunc")
            .expect("an unbounded offset only has to be aligned");
    }

    #[test]
    fn validate_vfunc_offset_rejects_unaligned_offset() {
        assert!(validate_vfunc_offset(4, Some(64), "vfunc").is_err());
    }

    #[test]
    fn validate_vfunc_offset_rejects_offset_beyond_class_size() {
        assert!(validate_vfunc_offset(64, Some(64), "vfunc").is_err());
    }

    #[test]
    fn validate_vfunc_offset_rejects_end_overflow() {
        let aligned_max = usize::MAX - (align_of::<*mut c_void>() - 1);
        let error = validate_vfunc_offset(aligned_max, None, "vfunc")
            .expect_err("an offset whose end overflows must be rejected");

        assert!(error.to_string().contains("overflow"));
    }
}
