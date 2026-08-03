use std::ffi::{c_char, c_void};

use glib::translate::{IntoGlib as _, from_glib_none};
use glib::{self, gobject_ffi};
use napi::bindgen_prelude::*;
use napi::{Env, sys};
use napi_derive::napi;

use crate::api::vtable::{query_type, validate_vfunc_offset};
use crate::api::{native_result, type_from_bigint};
use crate::ffi::closure::ClosureState;
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
    /// generated metadata the offsets do, and registering vfuncs without it is rejected.
    pub vtable_size: Option<u32>,
    /// Interface vfunc implementations to install.
    pub vfuncs: Vec<RegisterClassVfunc>,
}

pub struct PspecHandle(*mut gobject_ffi::GParamSpec);

impl FromNapiValue for PspecHandle {
    unsafe fn from_napi_value(env: sys::napi_env, napi_val: sys::napi_value) -> Result<Self> {
        let external = unsafe { <&External<Handle>>::from_napi_value(env, napi_val)? };
        Ok(Self(external.as_ptr().cast::<gobject_ffi::GParamSpec>()))
    }
}

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
    unsafe fn install_into(self, vtable_base: *mut c_void) {
        let Self {
            byte_offset,
            js_fn,
            arg_codecs,
            return_codec,
        } = self;
        let state = ClosureState::boxed(js_fn, arg_codecs, return_codec, None, false);
        unsafe {
            let slot = vtable_base
                .cast::<u8>()
                .add(byte_offset)
                .cast::<*mut c_void>();
            slot.write(state.code_ptr);
        }
        std::mem::forget(state);
    }
}

struct InterfaceInit {
    vfuncs: Option<Vec<ResolvedVfunc>>,
}

unsafe extern "C" fn init_interface_vtable(vtable: *mut c_void, iface_data: *mut c_void) {
    let data = unsafe { &mut *iface_data.cast::<InterfaceInit>() };

    let Some(vfuncs) = data.vfuncs.take() else {
        return;
    };

    for vfunc in vfuncs {
        unsafe { vfunc.install_into(vtable) };
    }
}

unsafe extern "C" fn finalize_interface_vtable(_vtable: *mut c_void, iface_data: *mut c_void) {
    drop(unsafe { Box::from_raw(iface_data.cast::<InterfaceInit>()) });
}

impl ResolvedInterface {
    unsafe fn add_to(self, instance_type: glib::ffi::GType) {
        let data = Box::into_raw(Box::new(InterfaceInit {
            vfuncs: Some(self.vfuncs),
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
            validate_vfunc_offset(vfunc.byte_offset, Some(query.class_size), "vfunc")?;
        }

        for iface in &self.interfaces {
            if iface.vtable_size.is_none() && !iface.vfuncs.is_empty() {
                anyhow::bail!(
                    "interface {} declares vfuncs without a vtable size, which would leave their \
                     byte offsets bounded only by their alignment",
                    iface.type_
                );
            }

            for vfunc in &iface.vfuncs {
                validate_vfunc_offset(vfunc.byte_offset, iface.vtable_size, "interface vfunc")?;
            }
        }
        Ok(())
    }

    fn validate_interfaces(&self) -> anyhow::Result<()> {
        for iface in &self.interfaces {
            if !iface.type_.is_a(glib::Type::INTERFACE) {
                anyhow::bail!(
                    "register_class: type '{}' is not an interface",
                    iface.type_.name()
                );
            }
            if !self.parent_type.is_a(iface.type_) {
                anyhow::bail!(
                    "register_class: parent type '{}' does not conform to interface '{}'",
                    self.parent_type.name(),
                    iface.type_.name()
                );
            }
        }
        Ok(())
    }

    fn register_type(
        parent_type: glib::Type,
        name_ptr: *const c_char,
        vfuncs: Vec<ResolvedVfunc>,
        interfaces: Vec<ResolvedInterface>,
        properties: Vec<ResolvedProperty>,
        class_size: u16,
        instance_size: u16,
    ) -> anyhow::Result<usize> {
        let info = gobject_ffi::GTypeInfo {
            class_size,
            base_init: None,
            base_finalize: None,
            class_init: None,
            class_finalize: None,
            class_data: std::ptr::null_mut(),
            instance_size,
            n_preallocs: 0,
            instance_init: Some(init_instance),
            value_table: std::ptr::null(),
        };

        let new_type = unsafe {
            gobject_ffi::g_type_register_static(
                parent_type.into_glib(),
                name_ptr,
                &raw const info,
                0,
            )
        };

        if new_type == 0 {
            anyhow::bail!("g_type_register_static returned G_TYPE_INVALID");
        }

        for iface in interfaces {
            unsafe { iface.add_to(new_type) };
        }

        let class_ptr = unsafe { gobject_ffi::g_type_class_ref(new_type) };

        for vfunc in vfuncs {
            unsafe { vfunc.install_into(class_ptr) };
        }

        for property in properties {
            unsafe { property.install_into(class_ptr) };
        }

        Ok(new_type)
    }
}

fn fits_in_type_info_size(size: u32, label: &str) -> anyhow::Result<u16> {
    u16::try_from(size).map_err(|_| {
        anyhow::anyhow!("parent {label} size {size} does not fit GTypeInfo's guint16 field")
    })
}

impl ClassRegistration {
    fn execute(self) -> anyhow::Result<u64> {
        let query = self.query_parent_type()?;
        self.validate_layout(&query)?;
        self.validate_interfaces()?;

        let class_size = fits_in_type_info_size(query.class_size, "class")?;
        let instance_size = fits_in_type_info_size(query.instance_size, "instance")?;

        let new_type = Self::register_type(
            self.parent_type,
            self.name.as_ptr(),
            self.vfuncs,
            self.interfaces,
            self.properties,
            class_size,
            instance_size,
        )?;

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
    use glib::prelude::StaticType as _;
    use glib::translate::FromGlib as _;

    use super::*;
    use crate::ffi::codec::release_construction_ref;

    fn gstring(name: &str) -> glib::GString {
        glib::GString::from_string_checked(name.to_owned()).expect("valid type name")
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
                interfaces: vec![ResolvedInterface {
                    vtable_size: None,
                    type_: glib::Object::static_type(),
                    vfuncs: Vec::new(),
                }],
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
    fn execute_rejects_a_nonconforming_interface_without_registering() {
        test_support::run(|| {
            let plugin_type =
                unsafe { glib::Type::from_glib(gobject_ffi::g_type_plugin_get_type()) };
            let request = ClassRegistration {
                name: gstring("GtkxRegisterClassNonConformingType"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: vec![ResolvedInterface {
                    vtable_size: None,
                    type_: plugin_type,
                    vfuncs: Vec::new(),
                }],
                properties: Vec::new(),
            };
            let error = request
                .execute()
                .expect_err("non-conforming parent must be rejected");
            assert!(error.to_string().contains("does not conform to interface"));
            assert!(glib::Type::from_name("GtkxRegisterClassNonConformingType").is_none());
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
                interfaces: vec![ResolvedInterface {
                    vtable_size: None,
                    type_: plugin_type,
                    vfuncs: Vec::new(),
                }],
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

    fn pending_values() -> (sys::napi_value, sys::napi_value) {
        (
            test_support::napi_mock::fake_object(&[]),
            test_support::napi_mock::fake_function(|_| test_support::napi_mock::fake_undefined()),
        )
    }

    #[test]
    fn the_installed_instance_init_binds_a_pending_wrapper_before_construction_returns() {
        node_env::run_installed(|| {
            let type_ = register_plain_subtype("GtkxRegisterClassPendingWrapperType");
            let (wrapper, associate) = pending_values();
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
            let (wrapper, associate) = pending_values();
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

    #[test]
    fn validate_layout_bounds_interface_offsets_against_the_declared_vtable_size() {
        let registration = ClassRegistration {
            name: gstring("GtkxRegisterClassBoundedInterfaceType"),
            parent_type: glib::Object::static_type(),
            vfuncs: Vec::new(),
            interfaces: vec![ResolvedInterface {
                type_: glib::Object::static_type(),
                vtable_size: Some(16),
                vfuncs: vec![ResolvedVfunc {
                    byte_offset: 24,
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
                }],
            }],
            properties: Vec::new(),
        };
        let query = gobject_ffi::GTypeQuery {
            type_: 1,
            type_name: std::ptr::null(),
            class_size: 128,
            instance_size: 128,
        };
        let error = registration
            .validate_layout(&query)
            .expect_err("an interface offset past the vtable must be rejected");
        assert!(error.to_string().contains("exceeds class size 16"));
    }

    #[test]
    fn validate_layout_rejects_interface_vfuncs_declared_without_a_vtable_size() {
        let registration = ClassRegistration {
            name: gstring("GtkxRegisterClassUnboundedInterfaceType"),
            parent_type: glib::Object::static_type(),
            vfuncs: Vec::new(),
            interfaces: vec![ResolvedInterface {
                type_: glib::Object::static_type(),
                vtable_size: None,
                vfuncs: vec![ResolvedVfunc {
                    byte_offset: 4096,
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
                }],
            }],
            properties: Vec::new(),
        };
        let query = gobject_ffi::GTypeQuery {
            type_: 1,
            type_name: std::ptr::null(),
            class_size: 128,
            instance_size: 128,
        };
        let error = registration
            .validate_layout(&query)
            .expect_err("an interface vfunc with no vtable size must be rejected");
        assert!(error.to_string().contains("without a vtable size"));
    }

    #[test]
    fn validate_layout_allows_an_interface_that_declares_no_vfuncs_without_a_vtable_size() {
        let registration = ClassRegistration {
            name: gstring("GtkxRegisterClassEmptyInterfaceType"),
            parent_type: glib::Object::static_type(),
            vfuncs: Vec::new(),
            interfaces: vec![ResolvedInterface {
                type_: glib::Object::static_type(),
                vtable_size: None,
                vfuncs: Vec::new(),
            }],
            properties: Vec::new(),
        };
        let query = gobject_ffi::GTypeQuery {
            type_: 1,
            type_name: std::ptr::null(),
            class_size: 128,
            instance_size: 128,
        };
        registration
            .validate_layout(&query)
            .expect("an interface with no vfuncs needs no vtable size");
    }
}
