use std::ffi::c_void;

use glib::translate::IntoGlib as _;
use glib::{self, gobject_ffi};

#[derive(Clone, Copy)]
pub(crate) enum VfuncVtable {
    Class(glib::Type),
    Interface {
        instance_type: glib::Type,
        interface_type: glib::Type,
    },
    DefaultInterface(glib::Type),
}

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

fn ref_class(instance_type: glib::Type, label: &str) -> anyhow::Result<*mut c_void> {
    let class_ptr = unsafe { gobject_ffi::g_type_class_ref(instance_type.into_glib()) };

    if class_ptr.is_null() {
        anyhow::bail!(
            "{label}: type '{}' has no class structure",
            instance_type.name()
        );
    }

    Ok(class_ptr)
}

#[allow(clippy::cast_ptr_alignment)]
fn read_slot(
    vtable: *mut c_void,
    byte_offset: usize,
    source: &str,
    label: &str,
) -> anyhow::Result<*mut c_void> {
    let slot = unsafe {
        vtable
            .cast::<u8>()
            .add(byte_offset)
            .cast::<*mut c_void>()
            .read()
    };

    if slot.is_null() {
        anyhow::bail!("{label}: {source} provides no implementation");
    }

    Ok(slot)
}

fn releasing_on_error(
    read: impl FnOnce() -> anyhow::Result<*mut c_void>,
    release: impl FnOnce(),
) -> anyhow::Result<*mut c_void> {
    let slot = read();

    if slot.is_err() {
        release();
    }

    slot
}

fn resolve_class_slot(
    instance_type: glib::Type,
    byte_offset: usize,
    label: &str,
) -> anyhow::Result<*mut c_void> {
    let class_ptr = ref_class(instance_type, label)?;
    let source = format!("type '{}'", instance_type.name());

    releasing_on_error(
        || read_slot(class_ptr, byte_offset, &source, label),
        || unsafe { gobject_ffi::g_type_class_unref(class_ptr) },
    )
}

fn resolve_interface_slot(
    instance_type: glib::Type,
    interface_type: glib::Type,
    byte_offset: usize,
    label: &str,
) -> anyhow::Result<*mut c_void> {
    let class_ptr = ref_class(instance_type, label)?;
    let source = format!("type '{}'", instance_type.name());

    releasing_on_error(
        || {
            peek_interface_vtable(class_ptr, instance_type, interface_type, label)
                .and_then(|vtable| read_slot(vtable, byte_offset, &source, label))
        },
        || unsafe { gobject_ffi::g_type_class_unref(class_ptr) },
    )
}

fn resolve_default_interface_slot(
    interface_type: glib::Type,
    byte_offset: usize,
    label: &str,
) -> anyhow::Result<*mut c_void> {
    let vtable = unsafe { gobject_ffi::g_type_default_interface_ref(interface_type.into_glib()) };

    if vtable.is_null() {
        anyhow::bail!(
            "{label}: interface '{}' has no default vtable",
            interface_type.name()
        );
    }

    let source = format!("interface '{}'", interface_type.name());

    releasing_on_error(
        || read_slot(vtable, byte_offset, &source, label),
        || unsafe { gobject_ffi::g_type_default_interface_unref(vtable) },
    )
}

pub(crate) fn resolve_vfunc_slot(
    vtable: VfuncVtable,
    byte_offset: usize,
    label: &str,
) -> anyhow::Result<*mut c_void> {
    match vtable {
        VfuncVtable::Class(instance_type) => resolve_class_slot(instance_type, byte_offset, label),
        VfuncVtable::Interface {
            instance_type,
            interface_type,
        } => resolve_interface_slot(instance_type, interface_type, byte_offset, label),
        VfuncVtable::DefaultInterface(interface_type) => {
            resolve_default_interface_slot(interface_type, byte_offset, label)
        }
    }
}
