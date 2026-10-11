use std::ffi::c_void;

use glib::translate::IntoGlib as _;
use glib::{self, gobject_ffi};
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::type_class::{class_pointer, validate_class_type};
use crate::api::{native_result, type_from_bigint};
use crate::handle::Handle;

#[derive(Clone, Copy)]
enum VfuncVtable {
    Class(glib::Type),
    Interface {
        instance_type: glib::Type,
        interface_type: glib::Type,
    },
    DefaultInterface(glib::Type),
}

/// A checked slot location whose owning class or interface is referenced when the slot is read.
pub struct VfuncSlot {
    vtable: VfuncVtable,
    byte_offset: usize,
    vtable_size: u32,
    label: String,
}

/// Metadata identifying a class, implemented-interface, or default-interface vtable slot.
#[napi(object, object_to_js = false)]
pub struct VfuncSlotOptions {
    /// The class carrying the slot. Omitted for the interface's own default vtable.
    pub instance_type: Option<BigInt>,
    /// The interface owning the slot. Omitted for slots in the class structure.
    pub interface_type: Option<BigInt>,
    /// Byte offset of the function pointer within the vtable.
    pub byte_offset: u32,
    /// Generated interface-vtable size; class-vtable sizes come from `g_type_query`.
    pub vtable_size: Option<u32>,
    /// Name used to report invalid slots and absent implementations.
    pub label: String,
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

fn vfunc_vtable(
    instance_type: Option<glib::Type>,
    interface_type: Option<glib::Type>,
    label: &str,
) -> anyhow::Result<VfuncVtable> {
    if let Some(instance_type) = instance_type {
        validate_class_type(instance_type, label)?;
    }
    if let Some(interface_type) = interface_type {
        anyhow::ensure!(
            interface_type.is_a(glib::Type::INTERFACE),
            "{label}: type '{}' is not an interface",
            interface_type.name()
        );
    }
    match (instance_type, interface_type) {
        (Some(instance_type), Some(interface_type)) => Ok(VfuncVtable::Interface {
            instance_type,
            interface_type,
        }),
        (Some(instance_type), None) => Ok(VfuncVtable::Class(instance_type)),
        (None, Some(interface_type)) => Ok(VfuncVtable::DefaultInterface(interface_type)),
        (None, None) => anyhow::bail!(
            "{label} binds a slot with neither an instance type nor an interface type to read it \
             from"
        ),
    }
}

fn vfunc_offset_bounds(
    vtable: VfuncVtable,
    vtable_size: Option<u32>,
    label: &str,
) -> anyhow::Result<u32> {
    match vtable {
        VfuncVtable::Class(instance_type) => query_type(instance_type)
            .map(|query| query.class_size)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "{label} binds a class slot of type '{}', whose class size g_type_query does \
                     not report",
                    instance_type.name()
                )
            }),
        VfuncVtable::Interface { interface_type, .. }
        | VfuncVtable::DefaultInterface(interface_type) => vtable_size.ok_or_else(|| {
            anyhow::anyhow!(
                "{label} binds a slot of interface {interface_type} without a vtable size, which \
                 would leave byte_offset bounded only by its alignment"
            )
        }),
    }
}

/// Validates a vtable slot without reading its implementation or initializing its owning class.
#[napi(catch_unwind)]
pub fn compile_vfunc_slot(options: VfuncSlotOptions) -> Result<External<VfuncSlot>> {
    let instance_type = options
        .instance_type
        .as_ref()
        .map(|type_| type_from_bigint(type_, "compile_vfunc_slot: instance"))
        .transpose()?;
    let interface_type = options
        .interface_type
        .as_ref()
        .map(|type_| type_from_bigint(type_, "compile_vfunc_slot: interface"))
        .transpose()?;
    let byte_offset = options.byte_offset as usize;
    let vtable = native_result(
        "compile_vfunc_slot",
        vfunc_vtable(instance_type, interface_type, &options.label),
    )?;
    let vtable_size = native_result(
        "compile_vfunc_slot",
        vfunc_offset_bounds(vtable, options.vtable_size, &options.label),
    )?;
    native_result(
        "compile_vfunc_slot",
        validate_vfunc_offset(byte_offset, vtable_size, &options.label),
    )?;
    Ok(External::new(VfuncSlot {
        vtable,
        byte_offset,
        vtable_size,
        label: options.label,
    }))
}

fn interface_pointer(
    instance_type: glib::Type,
    interface_type: glib::Type,
    vtable_size: u32,
    label: &str,
) -> anyhow::Result<Handle> {
    let class = class_pointer(instance_type, label)?;
    let vtable =
        unsafe { gobject_ffi::g_type_interface_peek(class.as_ptr(), interface_type.into_glib()) };
    anyhow::ensure!(
        !vtable.is_null(),
        "{label}: type '{}' does not implement interface '{}'",
        instance_type.name(),
        interface_type.name()
    );
    Ok(Handle::pointer(vtable, &class).with_allocated_bytes(vtable_size as usize))
}

fn default_interface_pointer(
    interface_type: glib::Type,
    vtable_size: u32,
    label: &str,
) -> anyhow::Result<Handle> {
    let vtable = unsafe { gobject_ffi::g_type_default_interface_ref(interface_type.into_glib()) };
    anyhow::ensure!(
        !vtable.is_null(),
        "{label}: interface '{}' has no default vtable",
        interface_type.name()
    );
    let owner = Handle::owned_struct_with_free_fn(
        vtable,
        Some(gobject_ffi::g_type_default_interface_unref),
    );
    Ok(Handle::pointer(vtable, &owner).with_allocated_bytes(vtable_size as usize))
}

impl VfuncSlot {
    fn read(&self) -> anyhow::Result<Handle> {
        let (vtable, source) = match self.vtable {
            VfuncVtable::Class(instance_type) => (
                class_pointer(instance_type, &self.label)?,
                format!("type '{}'", instance_type.name()),
            ),
            VfuncVtable::Interface {
                instance_type,
                interface_type,
            } => (
                interface_pointer(instance_type, interface_type, self.vtable_size, &self.label)?,
                format!("type '{}'", instance_type.name()),
            ),
            VfuncVtable::DefaultInterface(interface_type) => (
                default_interface_pointer(interface_type, self.vtable_size, &self.label)?,
                format!("interface '{}'", interface_type.name()),
            ),
        };
        vtable.check_range(self.byte_offset, size_of::<*mut c_void>())?;
        let ptr = unsafe {
            vtable
                .as_ptr()
                .byte_add(self.byte_offset)
                .cast::<*mut c_void>()
                .read()
        };
        anyhow::ensure!(
            !ptr.is_null(),
            "{}: {source} provides no implementation",
            self.label
        );
        Ok(Handle::function(ptr, Some(vtable), false, false))
    }
}

/// Reads a checked vtable slot into an executable handle retaining the class or interface ref.
/// An empty slot fails here, leaving signature compilation independent of target availability.
#[napi(catch_unwind)]
pub fn read_vfunc_slot(slot: &External<VfuncSlot>) -> Result<External<Handle>> {
    native_result("read_vfunc_slot", slot.read()).map(External::new)
}
