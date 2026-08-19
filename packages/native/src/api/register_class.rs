use std::collections::HashSet;
use std::ffi::c_void;

use glib::translate::{IntoGlib as _, from_glib_none};
use glib::{self, gobject_ffi};
use napi::bindgen_prelude::*;
use napi::{Env, sys};
use napi_derive::napi;

use crate::api::vtable::{query_type, validate_vfunc_offset};
use crate::api::{handle_newtype, native_result, type_from_bigint};
use crate::ffi::closure::{ClosureData, ClosureState};
use crate::ffi::codec::Codec;
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;
use crate::host::panic_handler::guard_ffi_boundary;
use crate::host::{error_reporter, node_env};
use crate::value::{self, ClosureHandle, pending_wrapper};

pub struct VfuncCallback(ClosureHandle);

impl FromNapiValue for VfuncCallback {
    unsafe fn from_napi_value(env: sys::napi_env, napi_val: sys::napi_value) -> Result<Self> {
        let env_wrapper = Env::from(env);
        let value = unsafe { Unknown::from_napi_value(env, napi_val)? };
        if !matches!(value.get_type()?, ValueType::Function) {
            return Err(Error::new(
                Status::InvalidArg,
                "register_class: vfunc 'fn' must be a function",
            ));
        }
        Ok(Self(ClosureHandle::from_js_value(&env_wrapper, &value)?))
    }
}

/// A single virtual function override for a registered class: which slot to patch and how its
/// arguments and return value are marshalled to and from the JavaScript implementation.
#[napi(object, object_to_js = false)]
pub struct RegisterClassVfunc {
    /// Byte offset of the vfunc slot within the class (or interface) struct.
    pub byte_offset: u32,
    /// Descriptor for each argument passed to the JavaScript implementation.
    pub arg_descriptors: Vec<Descriptor>,
    /// Descriptor for the value the JavaScript implementation returns.
    pub return_descriptor: Descriptor,
    /// The slot's C signature ends with a `GError**`, which receives a `GError` built from
    /// whatever the JavaScript implementation throws.
    pub can_throw: Option<bool>,
    /// The JavaScript function that implements the vfunc.
    #[napi(ts_type = "(...args: never[]) => unknown")]
    pub r#fn: VfuncCallback,
}

/// An interface a registered class implements, together with the interface vfuncs it provides.
#[napi(object, object_to_js = false)]
pub struct RegisterClassInterface {
    /// `GType` of the interface to implement.
    pub r#type: BigInt,
    /// Byte size of the interface's vtable struct, used to bounds-check each vfunc's `byteOffset`.
    /// `g_type_query` reports nothing for an interface type, so the size has to come from the same
    /// generated metadata the offsets do, and an interface declaring vfuncs is rejected without it.
    pub vtable_size: Option<u32>,
    /// Interface vfunc implementations to install.
    pub vfuncs: Vec<RegisterClassVfunc>,
}

handle_newtype!(PspecHandle, *mut gobject_ffi::GParamSpec);

/// A property the registered class installs on its class structure.
#[napi(object, object_to_js = false)]
pub struct RegisterClassProperty {
    /// Property id the class's `get_property`/`set_property` vfuncs dispatch on. Must be non-zero.
    pub id: u32,
    /// Handle to the `GParamSpec` describing the property. Ownership transfers to the class.
    #[napi(ts_type = "ExternalObject<Handle>")]
    pub pspec: PspecHandle,
}

/// Optional configuration for `registerClass`: vfunc overrides, implemented interfaces and properties.
#[napi(object, object_to_js = false)]
pub struct RegisterClassOptions {
    /// Virtual function overrides for the class itself.
    pub vfuncs: Option<Vec<RegisterClassVfunc>>,
    /// Interfaces the class implements, each with its own vfuncs.
    pub interfaces: Option<Vec<RegisterClassInterface>>,
    /// Properties to install on the class.
    pub properties: Option<Vec<RegisterClassProperty>>,
}

impl TryFrom<RegisterClassVfunc> for ResolvedVfunc {
    type Error = Error;

    fn try_from(vfunc: RegisterClassVfunc) -> Result<Self> {
        Ok(Self {
            byte_offset: vfunc.byte_offset as usize,
            js_fn: vfunc.r#fn.0,
            arg_codecs: vfunc
                .arg_descriptors
                .into_iter()
                .map(Descriptor::into_codec)
                .collect::<Result<_>>()?,
            return_codec: vfunc.return_descriptor.into_codec()?,
            can_throw: vfunc.can_throw.unwrap_or(false),
        })
    }
}

impl TryFrom<RegisterClassInterface> for ResolvedInterface {
    type Error = Error;

    fn try_from(interface: RegisterClassInterface) -> Result<Self> {
        let type_ = type_from_bigint(&interface.r#type, "register_class: interface")?;
        Ok(Self {
            type_,
            vtable_size: interface.vtable_size,
            vfuncs: interface
                .vfuncs
                .into_iter()
                .map(ResolvedVfunc::try_from)
                .collect::<Result<_>>()?,
        })
    }
}

impl TryFrom<RegisterClassProperty> for ResolvedProperty {
    type Error = Error;

    fn try_from(property: RegisterClassProperty) -> Result<Self> {
        if property.id == 0 {
            return Err(Error::new(
                Status::InvalidArg,
                "register_class: property id must be non-zero",
            ));
        }

        let pspec = property.pspec.0;

        if pspec.is_null() {
            return Err(Error::new(
                Status::InvalidArg,
                "register_class: property pspec must not be null",
            ));
        }

        Ok(Self {
            id: property.id,
            pspec,
        })
    }
}

#[derive(Default)]
struct ResolvedOptions {
    vfuncs: Vec<ResolvedVfunc>,
    interfaces: Vec<ResolvedInterface>,
    properties: Vec<ResolvedProperty>,
}

impl TryFrom<RegisterClassOptions> for ResolvedOptions {
    type Error = Error;

    fn try_from(options: RegisterClassOptions) -> Result<Self> {
        Ok(Self {
            vfuncs: options
                .vfuncs
                .unwrap_or_default()
                .into_iter()
                .map(ResolvedVfunc::try_from)
                .collect::<Result<_>>()?,
            interfaces: options
                .interfaces
                .unwrap_or_default()
                .into_iter()
                .map(ResolvedInterface::try_from)
                .collect::<Result<_>>()?,
            properties: options
                .properties
                .unwrap_or_default()
                .into_iter()
                .map(ResolvedProperty::try_from)
                .collect::<Result<_>>()?,
        })
    }
}

struct ResolvedVfunc {
    byte_offset: usize,
    js_fn: ClosureHandle,
    arg_codecs: Vec<Codec>,
    return_codec: Codec,
    can_throw: bool,
}

struct ResolvedInterface {
    type_: glib::Type,
    vtable_size: Option<u32>,
    vfuncs: Vec<ResolvedVfunc>,
}

struct ResolvedProperty {
    id: u32,
    pspec: *mut gobject_ffi::GParamSpec,
}

impl ResolvedProperty {
    unsafe fn install_into(self, class_ptr: *mut c_void) {
        unsafe {
            gobject_ffi::g_object_class_install_property(
                class_ptr.cast::<gobject_ffi::GObjectClass>(),
                self.id,
                self.pspec,
            );
        }
    }
}

impl ResolvedVfunc {
    #[allow(clippy::cast_ptr_alignment)]
    unsafe fn install_into(self, vtable_base: *mut c_void) -> ClosureState {
        let Self {
            byte_offset,
            js_fn,
            arg_codecs,
            return_codec,
            can_throw,
        } = self;
        let state = ClosureState::new(ClosureData::new(
            js_fn,
            arg_codecs,
            return_codec,
            None,
            can_throw,
            false,
        ));
        unsafe {
            let slot = vtable_base
                .cast::<u8>()
                .add(byte_offset)
                .cast::<*mut c_void>();
            slot.write(state.code_ptr);
        }
        state
    }
}

struct InterfaceInit {
    vfuncs: Option<Vec<ResolvedVfunc>>,
    installed: Vec<ClosureState>,
}

unsafe extern "C" fn init_interface_vtable(vtable: *mut c_void, iface_data: *mut c_void) {
    let data = unsafe { &mut *iface_data.cast::<InterfaceInit>() };

    let Some(vfuncs) = data.vfuncs.take() else {
        return;
    };

    for vfunc in vfuncs {
        let state = unsafe { vfunc.install_into(vtable) };
        data.installed.push(state);
    }
}

unsafe extern "C" fn finalize_interface_vtable(_vtable: *mut c_void, iface_data: *mut c_void) {
    drop(unsafe { Box::from_raw(iface_data.cast::<InterfaceInit>()) });
}

impl ResolvedInterface {
    unsafe fn add_to(self, instance_type: glib::ffi::GType) {
        let data = Box::into_raw(Box::new(InterfaceInit {
            vfuncs: Some(self.vfuncs),
            installed: Vec::new(),
        }));

        let info = gobject_ffi::GInterfaceInfo {
            interface_init: Some(init_interface_vtable),
            interface_finalize: Some(finalize_interface_vtable),
            interface_data: data.cast::<c_void>(),
        };

        unsafe {
            gobject_ffi::g_type_add_interface_static(
                instance_type,
                self.type_.into_glib(),
                &raw const info,
            );
        }
    }
}

unsafe fn associate_pending_wrapper(
    gobject: *mut gobject_ffi::GObject,
    wrapper: sys::napi_value,
    associate: sys::napi_value,
) -> Result<()> {
    let env = node_env::env();
    let object: glib::Object = unsafe { from_glib_none(gobject) };
    let handle = value::handle_to_unknown(&env, Handle::decoded_gobject(object))?;
    let wrapper = unsafe { Unknown::from_napi_value(env.raw(), wrapper) }?;
    let associate: Function<'_, FnArgs<(Unknown<'_>, Unknown<'_>)>, ()> =
        unsafe { Function::from_napi_value(env.raw(), associate) }?;

    associate.call(FnArgs::from((handle, wrapper)))
}

unsafe fn adopt_pending_wrapper(instance: *mut gobject_ffi::GTypeInstance) {
    let leaf_gtype = unsafe { (*(*instance).g_class).g_type };
    let gobject = instance.cast::<gobject_ffi::GObject>();

    let Some((wrapper, associate)) = pending_wrapper::claim(gobject, leaf_gtype) else {
        return;
    };

    if let Err(error) = unsafe { associate_pending_wrapper(gobject, wrapper, associate) } {
        error_reporter::report_str(&format!(
            "instance init: binding the wrapper failed: {error}"
        ));
    }
}

unsafe extern "C" fn init_instance(instance: *mut gobject_ffi::GTypeInstance, _class: *mut c_void) {
    guard_ffi_boundary("instance init", || unsafe {
        adopt_pending_wrapper(instance);
    });
}

struct ClassInit {
    vfuncs: Vec<ResolvedVfunc>,
    properties: Vec<ResolvedProperty>,
    interfaces: Vec<glib::Type>,
    installed: Vec<ClosureState>,
}

unsafe fn override_property(
    class_ptr: *mut gobject_ffi::GObjectClass,
    pspec: *mut gobject_ffi::GParamSpec,
    next_id: &mut u32,
) {
    let name = unsafe { gobject_ffi::g_param_spec_get_name(pspec) };

    if !unsafe { gobject_ffi::g_object_class_find_property(class_ptr, name) }.is_null() {
        return;
    }

    unsafe { gobject_ffi::g_object_class_override_property(class_ptr, *next_id, name) };

    *next_id += 1;
}

unsafe fn override_interface_properties(
    class_ptr: *mut c_void,
    interface_type: glib::Type,
    next_id: &mut u32,
) {
    let vtable = unsafe { gobject_ffi::g_type_default_interface_ref(interface_type.into_glib()) };

    if vtable.is_null() {
        return;
    }

    let mut count: u32 = 0;
    let pspecs = unsafe { gobject_ffi::g_object_interface_list_properties(vtable, &raw mut count) };
    let class_ptr = class_ptr.cast::<gobject_ffi::GObjectClass>();

    for index in 0..count as usize {
        unsafe { override_property(class_ptr, *pspecs.add(index), next_id) };
    }

    unsafe { glib::ffi::g_free(pspecs.cast::<c_void>()) };
    unsafe { gobject_ffi::g_type_default_interface_unref(vtable) };
}

unsafe fn install_properties(
    class_ptr: *mut c_void,
    properties: Vec<ResolvedProperty>,
    interfaces: &[glib::Type],
) {
    let mut next_id = properties
        .iter()
        .map(|property| property.id)
        .max()
        .unwrap_or(0)
        + 1;

    for property in properties {
        unsafe { property.install_into(class_ptr) };
    }

    for interface_type in interfaces {
        unsafe { override_interface_properties(class_ptr, *interface_type, &mut next_id) };
    }
}

unsafe fn apply_class_init(class_ptr: *mut c_void, class_data: *mut c_void) {
    let data = unsafe { &mut *class_data.cast::<ClassInit>() };

    for vfunc in std::mem::take(&mut data.vfuncs) {
        let state = unsafe { vfunc.install_into(class_ptr) };
        data.installed.push(state);
    }

    unsafe {
        install_properties(
            class_ptr,
            std::mem::take(&mut data.properties),
            &data.interfaces,
        );
    }
}

unsafe extern "C" fn init_class(class_ptr: *mut c_void, class_data: *mut c_void) {
    guard_ffi_boundary("class init", || unsafe {
        apply_class_init(class_ptr, class_data);
    });
}

struct ClassRegistration {
    name: glib::GString,
    parent_type: glib::Type,
    vfuncs: Vec<ResolvedVfunc>,
    interfaces: Vec<ResolvedInterface>,
    properties: Vec<ResolvedProperty>,
}

impl ClassRegistration {
    fn query_parent_type(&self) -> anyhow::Result<gobject_ffi::GTypeQuery> {
        if glib::Type::from_name(&self.name).is_some() {
            anyhow::bail!("Type name '{}' is already registered", self.name);
        }

        query_type(self.parent_type)
            .ok_or_else(|| anyhow::anyhow!("parent type could not be queried"))
    }

    fn validate_layout(&self, query: &gobject_ffi::GTypeQuery) -> anyhow::Result<()> {
        for vfunc in &self.vfuncs {
            validate_vfunc_offset(vfunc.byte_offset, query.class_size, "vfunc")?;
        }

        for iface in &self.interfaces {
            let Some(vtable_size) = iface.vtable_size else {
                if iface.vfuncs.is_empty() {
                    continue;
                }

                anyhow::bail!(
                    "interface {} declares vfuncs without a vtable size, which would leave their \
                     byte offsets bounded only by their alignment",
                    iface.type_
                );
            };

            for vfunc in &iface.vfuncs {
                validate_vfunc_offset(vfunc.byte_offset, vtable_size, "interface vfunc")?;
            }
        }
        Ok(())
    }

    fn validate_interface_types(&self) -> anyhow::Result<()> {
        for iface in &self.interfaces {
            if !iface.type_.is_a(glib::Type::INTERFACE) {
                anyhow::bail!(
                    "register_class: type '{}' is not an interface",
                    iface.type_.name()
                );
            }
        }
        Ok(())
    }

    fn register_type(self, class_size: u16, instance_size: u16) -> anyhow::Result<usize> {
        let Self {
            name,
            parent_type,
            vfuncs,
            interfaces,
            properties,
        } = self;

        let class_data = Box::into_raw(Box::new(ClassInit {
            vfuncs,
            properties,
            interfaces: adopted_interface_types(&interfaces, parent_type),
            installed: Vec::new(),
        }));

        let info = gobject_ffi::GTypeInfo {
            class_size,
            base_init: None,
            base_finalize: None,
            class_init: Some(init_class),
            class_finalize: None,
            class_data: class_data.cast::<c_void>(),
            instance_size,
            n_preallocs: 0,
            instance_init: Some(init_instance),
            value_table: std::ptr::null(),
        };

        let new_type = unsafe {
            gobject_ffi::g_type_register_static(
                parent_type.into_glib(),
                name.as_ptr(),
                &raw const info,
                0,
            )
        };

        if new_type == 0 {
            drop(unsafe { Box::from_raw(class_data) });
            anyhow::bail!("g_type_register_static returned G_TYPE_INVALID");
        }

        for iface in interfaces {
            unsafe { iface.add_to(new_type) };
        }

        unsafe { gobject_ffi::g_type_class_ref(new_type) };

        Ok(new_type)
    }
}

fn adopted_interface_types(
    interfaces: &[ResolvedInterface],
    parent_type: glib::Type,
) -> Vec<glib::Type> {
    interfaces
        .iter()
        .filter(|iface| !parent_type.is_a(iface.type_))
        .map(|iface| iface.type_)
        .collect()
}

struct UnmetPrerequisite {
    interface_type: glib::Type,
    prerequisite: glib::Type,
}

fn find_unmet_prerequisite(
    iface: &ResolvedInterface,
    parent_type: glib::Type,
    added: &HashSet<glib::Type>,
) -> Option<UnmetPrerequisite> {
    iface
        .type_
        .interface_prerequisites()
        .into_iter()
        .find(|prerequisite| !parent_type.is_a(*prerequisite) && !added.contains(prerequisite))
        .map(|prerequisite| UnmetPrerequisite {
            interface_type: iface.type_,
            prerequisite,
        })
}

fn take_ready_interfaces(
    pending: &mut Vec<ResolvedInterface>,
    parent_type: glib::Type,
    added: &HashSet<glib::Type>,
) -> (Vec<ResolvedInterface>, Option<UnmetPrerequisite>) {
    let mut ready = Vec::with_capacity(pending.len());
    let mut blocked = Vec::new();
    let mut unmet = None;

    for iface in std::mem::take(pending) {
        match find_unmet_prerequisite(&iface, parent_type, added) {
            Some(found) => {
                unmet.get_or_insert(found);
                blocked.push(iface);
            }
            None => ready.push(iface),
        }
    }

    *pending = blocked;

    (ready, unmet)
}

fn unmet_prerequisite_error(parent_type: glib::Type, unmet: &UnmetPrerequisite) -> anyhow::Error {
    anyhow::anyhow!(
        "register_class: parent type '{}' does not meet prerequisite '{}' of interface '{}'",
        parent_type.name(),
        unmet.prerequisite.name(),
        unmet.interface_type.name()
    )
}

fn sort_interfaces(
    interfaces: Vec<ResolvedInterface>,
    parent_type: glib::Type,
) -> anyhow::Result<Vec<ResolvedInterface>> {
    let mut pending = interfaces;
    let mut added: HashSet<glib::Type> = HashSet::new();
    let mut sorted: Vec<ResolvedInterface> = Vec::with_capacity(pending.len());

    while !pending.is_empty() {
        let (ready, unmet) = take_ready_interfaces(&mut pending, parent_type, &added);

        if let Some(unmet) = unmet.filter(|_| ready.is_empty()) {
            return Err(unmet_prerequisite_error(parent_type, &unmet));
        }

        added.extend(ready.iter().map(|iface| iface.type_));
        sorted.extend(ready);
    }

    Ok(sorted)
}

fn fits_in_type_info_size(size: u32, label: &str) -> anyhow::Result<u16> {
    u16::try_from(size).map_err(|_| {
        anyhow::anyhow!("parent {label} size {size} does not fit GTypeInfo's guint16 field")
    })
}

impl ClassRegistration {
    fn execute(mut self) -> anyhow::Result<u64> {
        let query = self.query_parent_type()?;
        self.validate_layout(&query)?;
        self.validate_interface_types()?;
        self.interfaces = sort_interfaces(std::mem::take(&mut self.interfaces), self.parent_type)?;

        let class_size = fits_in_type_info_size(query.class_size, "class")?;
        let instance_size = fits_in_type_info_size(query.instance_size, "instance")?;
        let new_type = self.register_type(class_size, instance_size)?;

        Ok(new_type as u64)
    }
}

/// Registers a new `GObject` subtype named `name` deriving from `parentType`, wiring up any vfunc
/// overrides and implemented interfaces, and returns the new `GType`.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn register_class(
    name: String,
    parent_type: BigInt,
    options: Option<RegisterClassOptions>,
) -> Result<BigInt> {
    let name = glib::GString::from_string_checked(name).map_err(|err| {
        Error::new(
            Status::InvalidArg,
            format!("register_class: invalid type name: {err}"),
        )
    })?;
    let parent_type = type_from_bigint(&parent_type, "register_class: parent")?;
    let resolved = match options {
        Some(options) => ResolvedOptions::try_from(options)?,
        None => ResolvedOptions::default(),
    };
    let type_ = native_result(
        "register_class",
        ClassRegistration {
            name,
            parent_type,
            vfuncs: resolved.vfuncs,
            interfaces: resolved.interfaces,
            properties: resolved.properties,
        }
        .execute(),
    )?;
    Ok(BigInt::from(type_))
}

#[cfg(test)]
mod tests {
    use std::mem::offset_of;

    use glib::prelude::StaticType as _;
    use glib::translate::FromGlib as _;

    use super::*;
    use crate::ffi::codec::release_construction_ref;

    fn gstring(name: &str) -> glib::GString {
        glib::GString::from_string_checked(name.to_owned()).expect("valid type name")
    }

    fn interface_entry(
        type_: glib::Type,
        vtable_size: Option<u32>,
        vfuncs: Vec<ResolvedVfunc>,
    ) -> ResolvedInterface {
        ResolvedInterface {
            type_,
            vtable_size,
            vfuncs,
        }
    }

    fn plain_interface(type_: glib::Type) -> ResolvedInterface {
        interface_entry(type_, None, Vec::new())
    }

    #[allow(clippy::cast_ptr_alignment)]
    fn interface_slot_pointers(
        type_: glib::Type,
        interface: glib::Type,
        byte_offsets: &[usize],
    ) -> Vec<*mut c_void> {
        let class_ptr = unsafe { gobject_ffi::g_type_class_ref(type_.into_glib()) };
        let vtable =
            unsafe { gobject_ffi::g_type_interface_peek(class_ptr, interface.into_glib()) };
        assert!(!vtable.is_null(), "the type should carry the interface");

        byte_offsets
            .iter()
            .map(|byte_offset| unsafe {
                vtable
                    .cast::<u8>()
                    .add(*byte_offset)
                    .cast::<*mut c_void>()
                    .read()
            })
            .collect()
    }

    #[test]
    fn execute_registers_a_new_subtype_of_gobject() {
        test_support::run(|| {
            let request = ClassRegistration {
                name: gstring("GtkxRegisterClassSmokeType"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: Vec::new(),
                properties: Vec::new(),
            };
            let type_ = request.execute().expect("registration should succeed");
            assert_ne!(type_, 0);
            assert_eq!(
                glib::Type::from_name("GtkxRegisterClassSmokeType").map(|t| t.into_glib() as u64),
                Some(type_)
            );
        });
    }

    #[test]
    fn execute_rejects_an_already_registered_name() {
        test_support::run(|| {
            let request = ClassRegistration {
                name: gstring("GObject"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: Vec::new(),
                properties: Vec::new(),
            };
            assert!(request.execute().is_err());
        });
    }

    #[test]
    fn execute_rejects_a_non_interface_type_without_registering() {
        test_support::run(|| {
            let request = ClassRegistration {
                name: gstring("GtkxRegisterClassNonInterfaceType"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: vec![plain_interface(glib::Object::static_type())],
                properties: Vec::new(),
            };
            let error = request
                .execute()
                .expect_err("non-interface type must be rejected");
            assert!(error.to_string().contains("is not an interface"));
            assert!(glib::Type::from_name("GtkxRegisterClassNonInterfaceType").is_none());
        });
    }

    #[test]
    fn execute_rejects_an_interface_whose_prerequisite_the_parent_misses() {
        test_support::run(|| {
            let request = ClassRegistration {
                name: gstring("GtkxRegisterClassMissingPrerequisiteType"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: vec![plain_interface(gtk4::Editable::static_type())],
                properties: Vec::new(),
            };
            let error = request
                .execute()
                .expect_err("an unmet prerequisite must be rejected");
            assert!(error.to_string().contains("does not meet prerequisite"));
            assert!(error.to_string().contains("GtkWidget"));
            assert!(glib::Type::from_name("GtkxRegisterClassMissingPrerequisiteType").is_none());
        });
    }

    #[test]
    fn execute_accepts_an_interface_whose_vtable_introspection_leaves_out() {
        test_support::run(|| {
            let plugin_type =
                unsafe { glib::Type::from_glib(gobject_ffi::g_type_plugin_get_type()) };
            let request = ClassRegistration {
                name: gstring("GtkxRegisterClassUnknownLayoutType"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: vec![plain_interface(plugin_type)],
                properties: Vec::new(),
            };
            let type_ = request
                .execute()
                .expect("an interface with no known vtable should register");
            let raw = glib::ffi::GType::try_from(type_).expect("GType fits in a usize");
            assert!(unsafe { glib::Type::from_glib(raw) }.is_a(plugin_type));
        });
    }

    #[test]
    fn execute_accepts_an_interface_the_parent_does_not_implement() {
        test_support::run(|| {
            let request = ClassRegistration {
                name: gstring("GtkxRegisterClassNewInterfaceType"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: vec![plain_interface(list_model_type())],
                properties: Vec::new(),
            };
            let type_ = request
                .execute()
                .expect("an interface the parent lacks should register");
            assert_ne!(type_, 0);
            let raw = glib::ffi::GType::try_from(type_).expect("GType fits in a usize");
            assert!(unsafe { glib::Type::from_glib(raw) }.is_a(list_model_type()));
        });
    }

    #[test]
    fn execute_accepts_an_interface_the_parent_conforms_to() {
        test_support::run(|| {
            let plugin_type =
                unsafe { glib::Type::from_glib(gobject_ffi::g_type_plugin_get_type()) };
            let request = ClassRegistration {
                name: gstring("GtkxRegisterClassConformingType"),
                parent_type: glib::TypeModule::static_type(),
                vfuncs: Vec::new(),
                interfaces: vec![plain_interface(plugin_type)],
                properties: Vec::new(),
            };
            let type_ = request
                .execute()
                .expect("conforming interface should register");
            assert_ne!(type_, 0);
            let raw = glib::ffi::GType::try_from(type_).expect("GType fits in a usize");
            assert!(unsafe { glib::Type::from_glib(raw) }.is_a(plugin_type));
        });
    }

    fn register_subtype(name: &str, parent_type: glib::Type) -> glib::Type {
        let type_ = ClassRegistration {
            name: gstring(name),
            parent_type,
            vfuncs: Vec::new(),
            interfaces: Vec::new(),
            properties: Vec::new(),
        }
        .execute()
        .expect("registration should succeed");
        let raw = glib::ffi::GType::try_from(type_).expect("GType fits in a usize");

        unsafe { glib::Type::from_glib(raw) }
    }

    fn register_plain_subtype(name: &str) -> glib::Type {
        register_subtype(name, glib::Object::static_type())
    }

    #[test]
    fn the_installed_instance_init_binds_a_pending_wrapper_before_construction_returns() {
        node_env::run_installed(|| {
            let type_ = register_plain_subtype("GtkxRegisterClassPendingWrapperType");
            let (wrapper, associate) = test_support::pending_values();
            let guard = unsafe { pending_wrapper::push(type_.into_glib(), wrapper, associate) };
            let object = glib::Object::with_type(type_);

            assert_eq!(
                guard.claimed_instance(),
                Some(glib::prelude::ObjectType::as_ptr(&object))
            );
            assert_eq!(test_support::napi_mock::count("napi_call_function"), 1);

            drop(guard);
            drop(object);
            test_support::napi_mock::reset();
            test_support::pump_default_context_until(|| false);
        });
    }

    #[test]
    fn the_installed_instance_init_leaves_an_instance_nobody_is_waiting_for_alone() {
        node_env::run_installed(|| {
            let type_ = register_plain_subtype("GtkxRegisterClassUnclaimedType");
            let object = glib::Object::with_type(type_);
            let object_ptr = glib::prelude::ObjectType::as_ptr(&object);

            assert!(!unsafe { value::wrapper::has_wrapper(object_ptr) });
            assert_eq!(test_support::napi_mock::count("napi_call_function"), 0);

            drop(object);
        });
    }

    #[test]
    fn the_wrapper_a_floating_instance_binds_owns_the_reference_construction_hands_back() {
        node_env::run_installed(|| {
            let type_ = register_subtype(
                "GtkxRegisterClassFloatingClaimType",
                glib::InitiallyUnowned::static_type(),
            );
            let (wrapper, associate) = test_support::pending_values();
            let guard = unsafe { pending_wrapper::push(type_.into_glib(), wrapper, associate) };
            let instance = unsafe {
                gobject_ffi::g_object_new_with_properties(
                    type_.into_glib(),
                    0,
                    std::ptr::null_mut(),
                    std::ptr::null(),
                )
            };

            assert_eq!(guard.claimed_instance(), Some(instance));
            assert_eq!(unsafe { gobject_ffi::g_object_is_floating(instance) }, 0);

            unsafe { release_construction_ref(instance) };

            assert_eq!(unsafe { test_support::get_gobject_refcount(instance) }, 1);

            drop(guard);
            test_support::napi_mock::reset();
            test_support::pump_default_context_until(|| false);
        });
    }

    fn void_vfunc(byte_offset: usize) -> ResolvedVfunc {
        ResolvedVfunc {
            byte_offset,
            js_fn: ClosureHandle::from_js_value(
                &test_support::fake_env(),
                &test_support::napi_mock::to_unknown(
                    &test_support::fake_env(),
                    test_support::napi_mock::fake_function(|_| {
                        test_support::napi_mock::fake_undefined()
                    }),
                ),
            )
            .expect("a reference to the callback"),
            arg_codecs: Vec::new(),
            return_codec: Codec::Void(crate::ffi::codec::VoidCodec),
            can_throw: false,
        }
    }

    fn interface_registration(
        name: &str,
        vtable_size: Option<u32>,
        vfuncs: Vec<ResolvedVfunc>,
    ) -> ClassRegistration {
        ClassRegistration {
            name: gstring(name),
            parent_type: glib::Object::static_type(),
            vfuncs: Vec::new(),
            interfaces: vec![interface_entry(
                glib::Object::static_type(),
                vtable_size,
                vfuncs,
            )],
            properties: Vec::new(),
        }
    }

    fn layout_query() -> gobject_ffi::GTypeQuery {
        gobject_ffi::GTypeQuery {
            type_: 1,
            type_name: std::ptr::null(),
            class_size: 128,
            instance_size: 128,
        }
    }

    #[test]
    fn validate_layout_bounds_interface_offsets_against_the_declared_vtable_size() {
        let registration = interface_registration(
            "GtkxRegisterClassBoundedInterfaceType",
            Some(16),
            vec![void_vfunc(24)],
        );

        let error = registration
            .validate_layout(&layout_query())
            .expect_err("an interface offset past the vtable must be rejected");
        assert!(error.to_string().contains("exceeds class size 16"));
    }

    #[test]
    fn validate_layout_rejects_interface_vfuncs_declared_without_a_vtable_size() {
        let registration = interface_registration(
            "GtkxRegisterClassUnboundedInterfaceType",
            None,
            vec![void_vfunc(4096)],
        );

        let error = registration
            .validate_layout(&layout_query())
            .expect_err("an interface vfunc with no vtable size must be rejected");
        assert!(error.to_string().contains("without a vtable size"));
    }

    #[test]
    fn validate_layout_allows_an_interface_that_declares_no_vfuncs_without_a_vtable_size() {
        let registration =
            interface_registration("GtkxRegisterClassEmptyInterfaceType", None, Vec::new());

        registration
            .validate_layout(&layout_query())
            .expect("an interface with no vfuncs needs no vtable size");
    }

    fn list_model_vtable_size() -> u32 {
        u32::try_from(size_of::<gtk4::gio::ffi::GListModelInterface>())
            .expect("the vtable size fits in a u32")
    }

    fn list_model_slot_offsets() -> [usize; 3] {
        [
            offset_of!(gtk4::gio::ffi::GListModelInterface, get_item_type),
            offset_of!(gtk4::gio::ffi::GListModelInterface, get_n_items),
            offset_of!(gtk4::gio::ffi::GListModelInterface, get_item),
        ]
    }

    fn selection_model_slot_offsets() -> [usize; 2] {
        [
            offset_of!(gtk4::ffi::GtkSelectionModelInterface, is_selected),
            offset_of!(
                gtk4::ffi::GtkSelectionModelInterface,
                get_selection_in_range
            ),
        ]
    }

    fn list_model_type() -> glib::Type {
        gtk4::gio::ListModel::static_type()
    }

    #[test]
    fn execute_adds_a_prerequisite_interface_before_the_interface_that_requires_it() {
        test_support::run(|| {
            let request = ClassRegistration {
                name: gstring("GtkxRegisterClassPrerequisiteOrderType"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: vec![
                    plain_interface(gtk4::SelectionModel::static_type()),
                    plain_interface(list_model_type()),
                ],
                properties: Vec::new(),
            };
            let type_ = request
                .execute()
                .expect("an interface listed before its prerequisite should still register");
            let raw = glib::ffi::GType::try_from(type_).expect("GType fits in a usize");
            let registered = unsafe { glib::Type::from_glib(raw) };
            assert!(registered.is_a(list_model_type()));
            assert!(registered.is_a(gtk4::SelectionModel::static_type()));
        });
    }

    #[test]
    fn execute_rejects_a_prerequisite_neither_the_parent_nor_the_other_interfaces_meet() {
        test_support::run(|| {
            let request = ClassRegistration {
                name: gstring("GtkxRegisterClassUnlistedPrerequisiteType"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: vec![plain_interface(gtk4::SelectionModel::static_type())],
                properties: Vec::new(),
            };
            let error = request
                .execute()
                .expect_err("a prerequisite nothing provides must be rejected");
            assert!(error.to_string().contains("does not meet prerequisite"));
            assert!(error.to_string().contains("GListModel"));
            assert!(glib::Type::from_name("GtkxRegisterClassUnlistedPrerequisiteType").is_none());
        });
    }

    fn registered_type(name: &str, interfaces: Vec<ResolvedInterface>) -> glib::Type {
        let type_ = ClassRegistration {
            name: gstring(name),
            parent_type: glib::Object::static_type(),
            vfuncs: Vec::new(),
            interfaces,
            properties: Vec::new(),
        }
        .execute()
        .expect("an adopted interface should register");
        let raw = glib::ffi::GType::try_from(type_).expect("GType fits in a usize");

        unsafe { glib::Type::from_glib(raw) }
    }

    #[test]
    fn execute_leaves_a_slot_the_class_fills_nowhere_as_null() {
        test_support::run(|| {
            let registered = registered_type(
                "GtkxRegisterClassEmptySlotType",
                vec![plain_interface(list_model_type())],
            );

            let slots =
                interface_slot_pointers(registered, list_model_type(), &list_model_slot_offsets());

            assert!(slots.iter().all(|slot| slot.is_null()));
        });
    }

    #[test]
    fn execute_installs_the_slots_the_class_fills_and_only_those() {
        test_support::run(|| {
            let registered = registered_type(
                "GtkxRegisterClassFilledSlotsType",
                vec![interface_entry(
                    list_model_type(),
                    Some(list_model_vtable_size()),
                    vec![void_vfunc(offset_of!(
                        gtk4::gio::ffi::GListModelInterface,
                        get_n_items
                    ))],
                )],
            );
            assert!(registered.is_a(list_model_type()));

            let slots =
                interface_slot_pointers(registered, list_model_type(), &list_model_slot_offsets());

            assert!(slots[0].is_null());
            assert!(!slots[1].is_null());
            assert!(slots[2].is_null());
        });
    }

    #[test]
    fn execute_keeps_the_implementations_an_interface_installs_by_default() {
        test_support::run(|| {
            let registered = registered_type(
                "GtkxRegisterClassDefaultsType",
                vec![
                    plain_interface(list_model_type()),
                    plain_interface(gtk4::SelectionModel::static_type()),
                ],
            );

            let slots = interface_slot_pointers(
                registered,
                gtk4::SelectionModel::static_type(),
                &selection_model_slot_offsets(),
            );

            assert!(slots.iter().all(|slot| !slot.is_null()));
        });
    }
}
