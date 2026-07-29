use std::ffi::{c_char, c_void};

use glib::{self, gobject_ffi, translate::IntoGlib as _};
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{native_result, type_from_bigint};
use crate::ffi::closure::ClosureState;
use crate::ffi::codec::Codec;
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;
use crate::value::ClosureHandle;

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
    /// generated metadata the offsets do; when it is omitted the offsets are only alignment-checked.
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

impl RegisterClassVfunc {
    fn into_raw(self) -> Result<RawVfunc> {
        Ok(RawVfunc {
            byte_offset: self.byte_offset as usize,
            js_fn: self.r#fn.0,
            arg_codecs: self
                .arg_descriptors
                .into_iter()
                .map(Descriptor::into_codec)
                .collect::<Result<_>>()?,
            return_codec: self.return_descriptor.into_codec()?,
        })
    }
}

impl RegisterClassInterface {
    fn into_raw(self) -> Result<RawInterface> {
        let type_ = type_from_bigint(&self.r#type, "register_class: interface")?;
        Ok(RawInterface {
            type_,
            vtable_size: self.vtable_size,
            vfuncs: self
                .vfuncs
                .into_iter()
                .map(RegisterClassVfunc::into_raw)
                .collect::<Result<_>>()?,
        })
    }
}

impl RegisterClassProperty {
    fn into_raw(self) -> Result<RawProperty> {
        if self.id == 0 {
            return Err(Error::new(
                Status::InvalidArg,
                "register_class: property id must be non-zero",
            ));
        }

        let pspec = self.pspec.0;

        if pspec.is_null() {
            return Err(Error::new(
                Status::InvalidArg,
                "register_class: property pspec must not be null",
            ));
        }

        Ok(RawProperty { id: self.id, pspec })
    }
}

impl RegisterClassOptions {
    fn into_raw(self) -> Result<(Vec<RawVfunc>, Vec<RawInterface>, Vec<RawProperty>)> {
        let vfuncs = self
            .vfuncs
            .unwrap_or_default()
            .into_iter()
            .map(RegisterClassVfunc::into_raw)
            .collect::<Result<_>>()?;
        let interfaces = self
            .interfaces
            .unwrap_or_default()
            .into_iter()
            .map(RegisterClassInterface::into_raw)
            .collect::<Result<_>>()?;
        let properties = self
            .properties
            .unwrap_or_default()
            .into_iter()
            .map(RegisterClassProperty::into_raw)
            .collect::<Result<_>>()?;
        Ok((vfuncs, interfaces, properties))
    }
}

struct RawVfunc {
    byte_offset: usize,
    js_fn: ClosureHandle,
    arg_codecs: Vec<Codec>,
    return_codec: Codec,
}

struct RawInterface {
    type_: glib::Type,
    vtable_size: Option<u32>,
    vfuncs: Vec<RawVfunc>,
}

struct RawProperty {
    id: u32,
    pspec: *mut gobject_ffi::GParamSpec,
}

impl RawProperty {
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

impl RawVfunc {
    // `vtable_base` is a GTypeClass/GTypeInterface vtable allocated by GLib, so it carries at least
    // pointer alignment, and `validate_vfunc_offset` has already rejected any `byte_offset` that is
    // not a multiple of `align_of::<*mut c_void>()`. The resulting slot pointer is therefore
    // aligned for the `*mut c_void` it writes.
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
    vfuncs: Option<Vec<RawVfunc>>,
}

// GLib hands `iface_data` back untouched from the `GInterfaceInfo` the registration passed in, so it is
// the `InterfaceInit` allocated below and no other thread can reach it. The vfuncs are taken out on the
// first call so a second initialization of the same interface installs nothing twice.
unsafe extern "C" fn init_interface_vtable(vtable: *mut c_void, iface_data: *mut c_void) {
    let data = unsafe { &mut *iface_data.cast::<InterfaceInit>() };

    let Some(vfuncs) = data.vfuncs.take() else {
        return;
    };

    for vfunc in vfuncs {
        unsafe { vfunc.install_into(vtable) };
    }
}

// Runs when GLib tears the interface vtable down, which returns the allocation `add_to` handed over.
unsafe extern "C" fn finalize_interface_vtable(_vtable: *mut c_void, iface_data: *mut c_void) {
    drop(unsafe { Box::from_raw(iface_data.cast::<InterfaceInit>()) });
}

impl RawInterface {
    // An interface inherited from the parent shares the parent's vtable until the derived type adds
    // its own implementation, so the vfuncs must go in through `g_type_add_interface_static` rather
    // than be written into the peeked vtable, which would patch every instance of the parent type.
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

struct ClassRegistration {
    name: glib::GString,
    parent_type: glib::Type,
    vfuncs: Vec<RawVfunc>,
    interfaces: Vec<RawInterface>,
    properties: Vec<RawProperty>,
}

impl ClassRegistration {
    fn query_parent_type(&self) -> anyhow::Result<gobject_ffi::GTypeQuery> {
        if glib::Type::from_name(&self.name).is_some() {
            anyhow::bail!("Type name '{}' is already registered", self.name);
        }

        let mut query = gobject_ffi::GTypeQuery {
            type_: 0,
            type_name: std::ptr::null(),
            class_size: 0,
            instance_size: 0,
        };
        unsafe { gobject_ffi::g_type_query(self.parent_type.into_glib(), &raw mut query) };
        if query.type_ == 0 {
            anyhow::bail!("parent type could not be queried");
        }
        Ok(query)
    }

    fn validate_vfunc_offset(
        byte_offset: usize,
        pointer_align: usize,
        pointer_size: usize,
        class_size: Option<u32>,
        label: &str,
    ) -> anyhow::Result<()> {
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

    fn validate_layout(&self, query: &gobject_ffi::GTypeQuery) -> anyhow::Result<()> {
        let pointer_align = align_of::<*mut c_void>();
        let pointer_size = size_of::<*mut c_void>();

        for vfunc in &self.vfuncs {
            Self::validate_vfunc_offset(
                vfunc.byte_offset,
                pointer_align,
                pointer_size,
                Some(query.class_size),
                "vfunc",
            )?;
        }

        for iface in &self.interfaces {
            for vfunc in &iface.vfuncs {
                Self::validate_vfunc_offset(
                    vfunc.byte_offset,
                    pointer_align,
                    pointer_size,
                    iface.vtable_size,
                    "interface vfunc",
                )?;
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
        vfuncs: Vec<RawVfunc>,
        interfaces: Vec<RawInterface>,
        properties: Vec<RawProperty>,
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
            instance_init: None,
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
    let (vfuncs, interfaces, properties) = match options {
        Some(options) => options.into_raw()?,
        None => (Vec::new(), Vec::new(), Vec::new()),
    };
    let type_ = native_result(
        "register_class",
        ClassRegistration {
            name,
            parent_type,
            vfuncs,
            interfaces,
            properties,
        }
        .execute(),
    )?;
    Ok(BigInt::from(type_))
}

#[cfg(test)]
mod tests {
    use super::*;
    use glib::prelude::StaticType as _;
    use glib::translate::FromGlib as _;

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
                interfaces: vec![RawInterface {
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
                interfaces: vec![RawInterface {
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
                interfaces: vec![RawInterface {
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

    #[test]
    fn validate_vfunc_offset_accepts_aligned_offset_within_bounds() {
        ClassRegistration::validate_vfunc_offset(8, 8, 8, Some(64), "vfunc")
            .expect("aligned in-bounds offset should validate");
    }

    #[test]
    fn validate_vfunc_offset_rejects_unaligned_offset() {
        assert!(ClassRegistration::validate_vfunc_offset(4, 8, 8, Some(64), "vfunc").is_err());
    }

    #[test]
    fn validate_vfunc_offset_rejects_offset_beyond_class_size() {
        assert!(ClassRegistration::validate_vfunc_offset(64, 8, 8, Some(64), "vfunc").is_err());
    }

    #[test]
    fn validate_layout_bounds_interface_offsets_against_the_declared_vtable_size() {
        let registration = ClassRegistration {
            name: gstring("GtkxRegisterClassBoundedInterfaceType"),
            parent_type: glib::Object::static_type(),
            vfuncs: Vec::new(),
            interfaces: vec![RawInterface {
                type_: glib::Object::static_type(),
                vtable_size: Some(16),
                vfuncs: vec![RawVfunc {
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
    fn validate_vfunc_offset_rejects_end_overflow() {
        assert!(ClassRegistration::validate_vfunc_offset(usize::MAX, 8, 8, None, "vfunc").is_err());
    }
}
