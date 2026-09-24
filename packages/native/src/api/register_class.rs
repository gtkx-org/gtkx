use std::ffi::c_void;

use glib::translate::{IntoGlib as _, from_glib_none};
use glib::{self, gobject_ffi};
use napi::bindgen_prelude::*;
use napi::{Env, sys};
use napi_derive::napi;

use crate::api::vtable::{query_type, validate_vfunc_offset};
use crate::api::{native_result, type_from_bigint};
use crate::ffi::closure::{ClosureData, ClosureState};
use crate::ffi::codec::{Codec, validate_callback_signature};
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;
use crate::host::callback_error::CallbackErrorScope;
use crate::host::node_env;
use crate::host::panic_handler::guard_ffi_boundary;
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

#[napi(object, object_to_js = false)]
pub struct RegisterClassOptions {
    /// Virtual function overrides for the class itself.
    pub vfuncs: Option<Vec<RegisterClassVfunc>>,
    /// Interfaces the class implements, each with its own vfuncs.
    pub interfaces: Option<Vec<RegisterClassInterface>>,
    pub flags: Option<u32>,
    #[napi(ts_type = "(handle: ExternalObject<Handle>, gtype: bigint) => void")]
    pub initialize: Option<VfuncCallback>,
}

impl TryFrom<RegisterClassVfunc> for ResolvedVfunc {
    type Error = Error;

    fn try_from(vfunc: RegisterClassVfunc) -> Result<Self> {
        let resolved = Self {
            byte_offset: vfunc.byte_offset as usize,
            js_fn: vfunc.r#fn.0,
            arg_codecs: vfunc
                .arg_descriptors
                .into_iter()
                .map(Descriptor::into_codec)
                .collect::<Result<_>>()?,
            return_codec: vfunc.return_descriptor.into_codec()?,
            can_throw: vfunc.can_throw.unwrap_or(false),
        };
        validate_callback_signature(&resolved.arg_codecs, &resolved.return_codec)
            .map_err(|error| Error::from_reason(error.to_string()))?;
        Ok(resolved)
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

#[derive(Default)]
struct ResolvedOptions {
    vfuncs: Vec<ResolvedVfunc>,
    interfaces: Vec<ResolvedInterface>,
    type_flags: gobject_ffi::GTypeFlags,
    initialize: Option<ClosureHandle>,
}

impl TryFrom<RegisterClassOptions> for ResolvedOptions {
    type Error = Error;

    fn try_from(options: RegisterClassOptions) -> Result<Self> {
        Ok(Self {
            type_flags: options.flags.unwrap_or(0),
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
            initialize: options.initialize.map(|callback| callback.0),
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
            state.data_ref().set_native_parent(slot.read());
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
        CallbackErrorScope::deliver(node_env::env(), error);
    }
}

unsafe extern "C" fn init_instance(instance: *mut gobject_ffi::GTypeInstance, _class: *mut c_void) {
    guard_ffi_boundary("instance init", || unsafe {
        adopt_pending_wrapper(instance);
    });
}

struct ClassInit {
    class_size: usize,
    vfuncs: Vec<ResolvedVfunc>,
    initialize: Option<ClosureHandle>,
    error: Option<Error>,
    installed: Vec<ClosureState>,
}

unsafe extern "C" fn init_class(class_ptr: *mut c_void, class_data: *mut c_void) {
    guard_ffi_boundary("class init", || {
        let data = unsafe { &mut *class_data.cast::<ClassInit>() };
        for vfunc in std::mem::take(&mut data.vfuncs) {
            let state = unsafe { vfunc.install_into(class_ptr) };
            data.installed.push(state);
        }
        if let Some(initialize) = data.initialize.take() {
            data.error = initialize_class(class_ptr, data.class_size, &initialize).err();
        }
    });
}

fn initialize_class(
    class_ptr: *mut c_void,
    class_size: usize,
    initialize: &ClosureHandle,
) -> Result<()> {
    let env = node_env::env();
    let gtype = unsafe { (*class_ptr.cast::<gobject_ffi::GTypeClass>()).g_type };
    let handle = value::handle_to_unknown(
        &env,
        Handle::process_static(class_ptr).with_allocated_bytes(class_size),
    )?;
    let callback: Function<'_, FnArgs<(Unknown<'_>, BigInt)>, ()> = initialize.get(&env)?;
    callback.call(FnArgs::from((handle, BigInt::from(gtype as u64))))
}

struct ClassRegistration {
    name: glib::GString,
    parent_type: glib::Type,
    vfuncs: Vec<ResolvedVfunc>,
    interfaces: Vec<ResolvedInterface>,
    type_flags: gobject_ffi::GTypeFlags,
    initialize: Option<ClosureHandle>,
}

impl ClassRegistration {
    fn query_parent_type(&self) -> anyhow::Result<gobject_ffi::GTypeQuery> {
        anyhow::ensure!(
            self.parent_type.is_a(glib::Type::OBJECT),
            "register_class: the parent must derive from GObject"
        );
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
            type_flags,
            initialize,
        } = self;

        let class_data = Box::into_raw(Box::new(ClassInit {
            class_size: usize::from(class_size),
            vfuncs,
            initialize,
            error: None,
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
                type_flags,
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
        if let Some(error) = unsafe { (*class_data).error.take() } {
            return Err(error.into());
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
        self.validate_interface_types()?;

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
            type_flags: resolved.type_flags,
            initialize: resolved.initialize,
        }
        .execute(),
    )?;
    Ok(BigInt::from(type_))
}
