use std::collections::HashSet;
use std::ffi::{CStr, CString, c_char, c_void};

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
use crate::ffi::library_cache::FfiCache;
use crate::handle::Handle;
use crate::host::panic_handler::guard_ffi_boundary;
use crate::host::{error_reporter, node_env};
use crate::value::{self, ClosureHandle, pending_wrapper};

type SetCssNameFn = unsafe extern "C" fn(*mut gobject_ffi::GObjectClass, *const c_char);

const GTK_LIBRARY: &str = "libgtk-4.so.1";
const SET_CSS_NAME_SYMBOL: &str = "gtk_widget_class_set_css_name";

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

/// A signal the registered class creates on its type during class initialization.
#[napi(object, object_to_js = false)]
pub struct RegisterClassSignal {
    /// Name to create the signal under. Must satisfy `g_signal_is_valid_name`.
    pub name: String,
    /// `GSignalFlags` bit mask, defaulting to `G_SIGNAL_RUN_FIRST`.
    pub flags: Option<u32>,
    /// `GType` of each argument an emission carries, defaulting to none.
    pub param_types: Option<Vec<BigInt>>,
    /// `GType` of the value an emission returns, defaulting to `G_TYPE_NONE`.
    pub return_type: Option<BigInt>,
    /// Built-in accumulator combining handler returns: `"first-wins"` or `"true-handled"`.
    pub accumulator: Option<String>,
}

/// Optional configuration for `registerClass`: vfunc overrides, implemented interfaces, properties
/// and signals.
#[napi(object, object_to_js = false)]
pub struct RegisterClassOptions {
    /// Virtual function overrides for the class itself.
    pub vfuncs: Option<Vec<RegisterClassVfunc>>,
    /// Interfaces the class implements, each with its own vfuncs.
    pub interfaces: Option<Vec<RegisterClassInterface>>,
    /// Properties to install on the class.
    pub properties: Option<Vec<RegisterClassProperty>>,
    /// Signals to create on the class.
    pub signals: Option<Vec<RegisterClassSignal>>,
    /// Registers the type with `G_TYPE_FLAG_ABSTRACT`, so only its subtypes can be instantiated.
    #[napi(js_name = "abstract")]
    pub is_abstract: Option<bool>,
    /// Name instances of the class carry in CSS, applied through `gtk_widget_class_set_css_name`
    /// from inside the type's `class_init`. Requires `parentType` to be a `GtkWidget`.
    pub css_name: Option<String>,
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

fn signal_value_type(value: &BigInt, signal: &str, role: &str) -> Result<glib::ffi::GType> {
    let type_ = type_from_bigint(value, &format!("register_class: signal '{signal}' {role}"))?;
    let gtype = type_.into_glib();

    if unsafe { gobject_ffi::g_type_check_is_value_type(gtype) } == glib::ffi::GFALSE {
        return Err(Error::new(
            Status::InvalidArg,
            format!("register_class: signal '{signal}' {role} type '{type_}' cannot hold a value"),
        ));
    }

    Ok(gtype)
}

fn signal_accumulator(
    name: Option<&str>,
    signal: &str,
    return_type: glib::ffi::GType,
) -> Result<gobject_ffi::GSignalAccumulator> {
    match name {
        None => Ok(None),
        Some("first-wins") => Ok(Some(gobject_ffi::g_signal_accumulator_first_wins)),
        Some("true-handled") => {
            if return_type != glib::Type::BOOL.into_glib() {
                return Err(Error::new(
                    Status::InvalidArg,
                    format!(
                        "register_class: signal '{signal}' uses the 'true-handled' accumulator, \
                         which requires a boolean return type"
                    ),
                ));
            }

            Ok(Some(gobject_ffi::g_signal_accumulator_true_handled))
        }
        Some(other) => Err(Error::new(
            Status::InvalidArg,
            format!(
                "register_class: signal '{signal}' names unknown accumulator '{other}', \
                 expected 'first-wins' or 'true-handled'"
            ),
        )),
    }
}

impl TryFrom<RegisterClassSignal> for ResolvedSignal {
    type Error = Error;

    fn try_from(signal: RegisterClassSignal) -> Result<Self> {
        let label = signal.name.clone();
        let name = CString::new(signal.name).map_err(|_| {
            Error::new(
                Status::InvalidArg,
                format!("register_class: signal name '{label}' contains a nul byte"),
            )
        })?;

        if unsafe { gobject_ffi::g_signal_is_valid_name(name.as_ptr()) } == glib::ffi::GFALSE {
            return Err(Error::new(
                Status::InvalidArg,
                format!("register_class: '{label}' is not a valid signal name"),
            ));
        }

        let param_types = signal
            .param_types
            .unwrap_or_default()
            .iter()
            .enumerate()
            .map(|(index, param)| signal_value_type(param, &label, &format!("parameter {index}")))
            .collect::<Result<Vec<_>>>()?;

        let return_type = match &signal.return_type {
            Some(value) => signal_value_type(value, &label, "return")?,
            None => glib::Type::UNIT.into_glib(),
        };

        let accumulator = signal_accumulator(signal.accumulator.as_deref(), &label, return_type)?;
        let n_params = u32::try_from(param_types.len()).map_err(|_| {
            Error::new(
                Status::InvalidArg,
                format!("register_class: signal '{label}' declares too many parameters"),
            )
        })?;

        Ok(Self {
            name,
            flags: signal.flags.unwrap_or(gobject_ffi::G_SIGNAL_RUN_FIRST),
            n_params,
            param_types,
            return_type,
            accumulator,
        })
    }
}

#[derive(Default)]
struct ResolvedOptions {
    vfuncs: Vec<ResolvedVfunc>,
    interfaces: Vec<ResolvedInterface>,
    properties: Vec<ResolvedProperty>,
    signals: Vec<ResolvedSignal>,
    type_flags: gobject_ffi::GTypeFlags,
    css_name: Option<CString>,
}

fn css_name_from_string(name: String) -> Result<CString> {
    CString::new(name).map_err(|_| {
        Error::new(
            Status::InvalidArg,
            "register_class: cssName contains a nul byte",
        )
    })
}

impl TryFrom<RegisterClassOptions> for ResolvedOptions {
    type Error = Error;

    fn try_from(options: RegisterClassOptions) -> Result<Self> {
        Ok(Self {
            type_flags: if options.is_abstract.unwrap_or(false) {
                gobject_ffi::G_TYPE_FLAG_ABSTRACT
            } else {
                0
            },
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
            signals: options
                .signals
                .unwrap_or_default()
                .into_iter()
                .map(ResolvedSignal::try_from)
                .collect::<Result<_>>()?,
            css_name: options.css_name.map(css_name_from_string).transpose()?,
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

struct ResolvedSignal {
    name: CString,
    flags: gobject_ffi::GSignalFlags,
    n_params: u32,
    param_types: Vec<glib::ffi::GType>,
    return_type: glib::ffi::GType,
    accumulator: gobject_ffi::GSignalAccumulator,
}

impl ResolvedSignal {
    fn canonical_name(&self) -> Vec<u8> {
        self.name
            .as_bytes()
            .iter()
            .map(|&byte| if byte == b'_' { b'-' } else { byte })
            .collect()
    }

    fn display_name(&self) -> String {
        self.name.to_string_lossy().into_owned()
    }

    unsafe fn install_into(mut self, gtype: glib::ffi::GType) {
        unsafe {
            gobject_ffi::g_signal_newv(
                self.name.as_ptr(),
                gtype,
                self.flags,
                std::ptr::null_mut(),
                self.accumulator,
                std::ptr::null_mut(),
                None,
                self.return_type,
                self.n_params,
                self.param_types.as_mut_ptr(),
            );
        }
    }
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
    signals: Vec<ResolvedSignal>,
    interfaces: Vec<glib::Type>,
    css_name: Option<(SetCssNameFn, CString)>,
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
    let gtype = unsafe { (*class_ptr.cast::<gobject_ffi::GTypeClass>()).g_type };

    if let Some((set_css_name, name)) = &data.css_name {
        unsafe { set_css_name(class_ptr.cast::<gobject_ffi::GObjectClass>(), name.as_ptr()) };
    }

    for vfunc in std::mem::take(&mut data.vfuncs) {
        let state = unsafe { vfunc.install_into(class_ptr) };
        data.installed.push(state);
    }

    for signal in std::mem::take(&mut data.signals) {
        unsafe { signal.install_into(gtype) };
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
    signals: Vec<ResolvedSignal>,
    type_flags: gobject_ffi::GTypeFlags,
    css_name: Option<CString>,
}

fn resolve_css_name_setter() -> anyhow::Result<SetCssNameFn> {
    FfiCache::with(|cache| unsafe {
        cache.resolve_symbol::<SetCssNameFn>(GTK_LIBRARY, SET_CSS_NAME_SYMBOL)
    })
}

fn signal_known_on_type(name: &CStr, type_: glib::Type) -> bool {
    unsafe { gobject_ffi::g_signal_lookup(name.as_ptr(), type_.into_glib()) != 0 }
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

    fn validate_css_name(&self) -> anyhow::Result<()> {
        if self.css_name.is_none() {
            return Ok(());
        }

        let is_widget =
            glib::Type::from_name("GtkWidget").is_some_and(|widget| self.parent_type.is_a(widget));

        if !is_widget {
            anyhow::bail!(
                "register_class: cssName requires a GtkWidget parent, and '{}' is not one",
                self.parent_type.name()
            );
        }

        Ok(())
    }

    fn find_conflicting_signal(&self) -> Option<(String, glib::Type)> {
        let parent_class = unsafe { gobject_ffi::g_type_class_ref(self.parent_type.into_glib()) };
        let mut conflict = self
            .signals
            .iter()
            .find(|signal| signal_known_on_type(&signal.name, self.parent_type))
            .map(|signal| (signal.display_name(), self.parent_type));
        unsafe { gobject_ffi::g_type_class_unref(parent_class) };

        for iface in &self.interfaces {
            if conflict.is_some() {
                break;
            }

            let vtable =
                unsafe { gobject_ffi::g_type_default_interface_ref(iface.type_.into_glib()) };
            conflict = self
                .signals
                .iter()
                .find(|signal| signal_known_on_type(&signal.name, iface.type_))
                .map(|signal| (signal.display_name(), iface.type_));
            unsafe { gobject_ffi::g_type_default_interface_unref(vtable) };
        }

        conflict
    }

    fn validate_signals(&self) -> anyhow::Result<()> {
        if self.signals.is_empty() {
            return Ok(());
        }

        let mut seen: HashSet<Vec<u8>> = HashSet::new();

        for signal in &self.signals {
            if !seen.insert(signal.canonical_name()) {
                anyhow::bail!(
                    "register_class: signal '{}' is declared more than once",
                    signal.display_name()
                );
            }
        }

        if let Some((name, type_)) = self.find_conflicting_signal() {
            anyhow::bail!(
                "register_class: signal '{}' already exists on type '{}'",
                name,
                type_.name()
            );
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
            signals,
            type_flags,
            css_name,
        } = self;

        let css_name = match css_name {
            Some(name) => Some((resolve_css_name_setter()?, name)),
            None => None,
        };

        let class_data = Box::into_raw(Box::new(ClassInit {
            vfuncs,
            properties,
            signals,
            interfaces: adopted_interface_types(&interfaces, parent_type),
            css_name,
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
        self.validate_signals()?;
        self.validate_css_name()?;
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
            signals: resolved.signals,
            type_flags: resolved.type_flags,
            css_name: resolved.css_name,
        }
        .execute(),
    )?;
    Ok(BigInt::from(type_))
}
