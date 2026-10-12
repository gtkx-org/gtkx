use std::cell::RefCell;
use std::ffi::{CStr, CString, c_void};
use std::marker::PhantomData;

use glib::prelude::StaticType as _;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{handle_memory_range, native_result};
use crate::ffi::Stash;
use crate::ffi::closure::DecodedCallback;
use crate::ffi::codec::{CallbackScope, Codec, Encoder as _};
use crate::ffi::descriptor::Descriptor;
use crate::handle::{Handle, LeaseScope};
use crate::host::callback_error::CallbackErrorScope;
use crate::host::log_writer::CriticalTrap;
use crate::value::{roots, wrapper};

struct PointerStorage {
    encoded: Stash,
    _owners: Vec<Handle>,
}

unsafe extern "C" fn release_encoded(ptr: *mut c_void) {
    unsafe { drop(Box::from_raw(ptr.cast::<PointerStorage>())) };
}

fn encode(env: &Env, codec: &Codec, value: Unknown<'_>) -> Result<(Handle, bool)> {
    let is_callback = matches!(codec, Codec::Callback(callback) if callback.scope == CallbackScope::Call && !callback.has_user_data && !callback.has_destroy);
    if !is_callback
        && !matches!(
            codec,
            Codec::Array(_)
                | Codec::Bytes(_)
                | Codec::Object(_)
                | Codec::Boxed(_)
                | Codec::Struct(_)
                | Codec::Fundamental(_)
                | Codec::HashTable(_)
                | Codec::Buffer(_)
        )
    {
        return Err(Error::from_reason(
            "A pointer value needs a pointer-shaped descriptor",
        ));
    }
    let mut owners = Vec::new();
    native_result(
        "pointer owners",
        crate::api::reference::collect_seed_owners(codec, value, &mut owners, true),
    )?;
    let owners = native_result(
        "pointer owners",
        owners
            .iter()
            .map(Handle::retain_owned)
            .collect::<anyhow::Result<Vec<_>>>(),
    )?;
    let encoded = native_result(
        "pointer encoding",
        match codec {
            Codec::Callback(callback) => callback.encode_weak(*env, value),
            _ => codec.encode_owned(env, value),
        },
    )?;
    let storage = Box::new(PointerStorage {
        encoded,
        _owners: owners,
    });
    let ptr = match &storage.encoded {
        Stash::Callback(callback) => callback.function_pointer(),
        encoded => native_result("pointer encoding", encoded.as_ptr("encoded pointer"))?,
    };
    let owner = Handle::callback_data(Box::into_raw(storage).cast(), release_encoded);
    Ok((Handle::pointer(ptr, &owner), is_callback))
}

fn value_ptr(value: &Handle) -> Result<*mut glib::gobject_ffi::GValue> {
    if value.boxed_type() != Some(glib::BoxedValue::static_type()) {
        return Err(Error::from_reason("Expected a GValue handle"));
    }
    handle_memory_range(value, 0, size_of::<glib::gobject_ffi::GValue>(), "GValue")
        .map(<*mut c_void>::cast)
}

/// Writes a pointer `GValue` together with the backing storage and callback roots it borrows.
#[napi(catch_unwind)]
pub fn set_value_pointer<'e>(
    env: &'e Env,
    #[napi(ts_arg_type = "ExternalObject<Handle>")] value_handle: Unknown<'e>,
    descriptor: Descriptor,
    value: Unknown<'e>,
) -> Result<()> {
    let _errors = CallbackErrorScope::open(*env);
    let _leases = LeaseScope::open();
    let handle: &External<Handle> = crate::value::read_napi(value_handle)?;
    let target = value_ptr(handle)?;
    if unsafe { glib::gobject_ffi::g_type_fundamental((*target).g_type) }
        != glib::gobject_ffi::G_TYPE_POINTER
    {
        return Err(Error::from_reason("Expected an initialized pointer GValue"));
    }
    let codec = descriptor.into_codec()?;
    let (storage, is_callback) = encode(env, &codec, value)?;
    roots::set(*env, value_handle, "pointer", value)?;
    unsafe { glib::gobject_ffi::g_value_set_pointer(target, storage.as_ptr()) };
    handle.set_pointer_storage(storage, is_callback);
    Ok(())
}

unsafe extern "C" fn release_property_pointer(ptr: *mut c_void) {
    unsafe { drop(Box::from_raw(ptr.cast::<PropertyPointer>())) };
}

struct PropertyPointer {
    storage: Option<Handle>,
}

struct ActivePropertyValue {
    env: sys::napi_env,
    storage: Handle,
    root: sys::napi_value,
}

thread_local! {
    static ACTIVE_VALUES: RefCell<Vec<ActivePropertyValue>> = const { RefCell::new(Vec::new()) };
}

pub(crate) struct PropertyValueScope<'e> {
    depth: usize,
    _scope: PhantomData<Unknown<'e>>,
}

impl<'e> PropertyValueScope<'e> {
    fn push(env: &'e Env, values: impl IntoIterator<Item = (Handle, Unknown<'e>)>) -> Self {
        ACTIVE_VALUES.with_borrow_mut(|active| {
            let depth = active.len();
            active.extend(
                values
                    .into_iter()
                    .map(|(storage, root)| ActivePropertyValue {
                        env: env.raw(),
                        storage,
                        root: root.raw(),
                    }),
            );
            Self {
                depth,
                _scope: PhantomData,
            }
        })
    }

    pub(crate) fn for_values(env: &'e Env, values: &[Unknown<'e>]) -> Result<Self> {
        let mut retained = Vec::new();
        for value in values {
            let handle: &External<Handle> = crate::value::read_napi(*value)?;
            if let Some(storage) = handle.pointer_storage() {
                retained.push((storage, roots::get(env, *value, "pointer")?));
            }
        }
        Ok(Self::push(env, retained))
    }
}

impl Drop for PropertyValueScope<'_> {
    fn drop(&mut self) {
        let released = ACTIVE_VALUES.with_borrow_mut(|active| active.split_off(self.depth));
        drop(released);
    }
}

fn active_property_callback(env: &Env, ptr: *mut c_void) -> Result<Option<(Handle, Unknown<'_>)>> {
    let retained = ACTIVE_VALUES.with_borrow(|active| {
        active
            .iter()
            .rev()
            .find(|value| value.env == env.raw() && value.storage.as_ptr() == ptr)
            .map(|value| (value.storage.clone(), value.root))
    });
    retained
        .map(|(storage, root)| {
            Ok((storage, unsafe {
                Unknown::from_napi_value(env.raw(), root)
            }?))
        })
        .transpose()
}

fn property_callback<'e>(
    env: &'e Env,
    object: *mut glib::gobject_ffi::GObject,
    name: &str,
) -> Result<Option<(Handle, Unknown<'e>)>> {
    let slot = format!("gtkx-property-pointer::{name}");
    let key = CString::new(slot.as_str()).map_err(|error| Error::from_reason(error.to_string()))?;
    let storage = unsafe {
        let quark = glib::ffi::g_quark_try_string(key.as_ptr());
        if quark == 0 {
            None
        } else {
            glib::gobject_ffi::g_object_get_qdata(object, quark)
                .cast::<PropertyPointer>()
                .as_ref()
                .and_then(|property| property.storage.clone())
        }
    };
    let Some(storage) = storage else {
        return Ok(None);
    };
    let root = match unsafe { wrapper::wrapper_value(env, object) } {
        Some(wrapper) => roots::get(env, wrapper.into_unknown(env)?, &slot)?,
        None => ().into_unknown(env)?,
    };
    Ok(Some((storage, root)))
}

/// Reads a property and returns a callback target that owns any managed trampoline it exposes.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn get_object_property<'e>(
    env: &'e Env,
    object: &External<Handle>,
    name: String,
    value: &External<Handle>,
) -> Result<Unknown<'e>> {
    let _errors = CallbackErrorScope::open(*env);
    let _leases = LeaseScope::open();
    let _lease = native_result("get_object_property", object.acquire_lease())?;
    let object = object
        .as_gobject_ptr()
        .ok_or_else(|| Error::from_reason("Expected a live GObject"))?;
    let target = value_ptr(value)?;
    let name_c =
        CString::new(name.as_str()).map_err(|error| Error::from_reason(error.to_string()))?;
    let previous = property_callback(env, object, &name)?;
    let trap = CriticalTrap::arm();
    unsafe { glib::gobject_ffi::g_object_get_property(object, name_c.as_ptr(), target) };
    if let Some(message) = trap.disarm() {
        return Err(Error::from_reason(format!(
            "g_object_get_property: {message}"
        )));
    }
    if unsafe { glib::gobject_ffi::g_type_fundamental((*target).g_type) }
        != glib::gobject_ffi::G_TYPE_POINTER
    {
        return ().into_unknown(env);
    }
    let ptr = unsafe { glib::gobject_ffi::g_value_get_pointer(target) };
    if ptr.is_null() {
        return ().into_unknown(env);
    }
    let retained = match previous {
        Some((storage, root)) if storage.as_ptr() == ptr => Some((storage, root)),
        _ => property_callback(env, object, &name)?.filter(|(storage, _)| storage.as_ptr() == ptr),
    };
    let retained = match retained {
        Some(retained) => Some(retained),
        None => active_property_callback(env, ptr)?,
    };
    let Some((storage, root)) = retained else {
        return ().into_unknown(env);
    };
    let callback = DecodedCallback {
        function: External::new(Handle::function(ptr, Some(storage), false, false)),
        user_data: Either::B(Null),
    }
    .into_unknown(env)?;
    let decoded = Object::from_unknown(callback)?;
    roots::set(
        *env,
        decoded.get_named_property("function")?,
        "callback",
        root,
    )?;
    Ok(callback)
}

pub(crate) fn retain_property_value<'e>(
    env: &'e Env,
    object: *mut glib::gobject_ffi::GObject,
    name: &str,
    value: Unknown<'e>,
    replace: bool,
) -> Result<()> {
    let handle: &External<Handle> = crate::value::read_napi(value)?;
    let storage = handle.pointer_storage();
    let key = CString::new(format!("gtkx-property-pointer::{name}"))
        .map_err(|error| Error::from_reason(error.to_string()))?;
    let quark = unsafe { glib::ffi::g_quark_from_string(key.as_ptr()) };
    let previous = unsafe { glib::gobject_ffi::g_object_get_qdata(object, quark) };
    if !replace && !previous.is_null() {
        return Ok(());
    }
    if storage.is_none() && previous.is_null() {
        let target = value_ptr(handle)?;
        if !replace
            || unsafe { glib::gobject_ffi::g_type_fundamental((*target).g_type) }
                != glib::gobject_ffi::G_TYPE_POINTER
        {
            return Ok(());
        }
    }
    if let Some(wrapper) = unsafe { wrapper::wrapper_value(env, object) } {
        let slot = key
            .to_str()
            .map_err(|error| Error::from_reason(error.to_string()))?;
        if storage.is_some() {
            roots::set(
                *env,
                wrapper.into_unknown(env)?,
                slot,
                roots::get(env, value, "pointer")?,
            )?;
        } else {
            roots::remove(*env, wrapper.into_unknown(env)?, slot)?;
        }
    }
    let data = Box::into_raw(Box::new(PropertyPointer { storage })).cast();
    unsafe {
        glib::gobject_ffi::g_object_set_qdata_full(
            object,
            quark,
            data,
            Some(release_property_pointer),
        );
    }
    Ok(())
}

fn validate_property_write(
    object: *mut glib::gobject_ffi::GObject,
    name: &CStr,
    value: *const glib::gobject_ffi::GValue,
) -> Result<()> {
    let property = unsafe {
        glib::gobject_ffi::g_object_class_find_property(
            (*object).g_type_instance.g_class.cast(),
            name.as_ptr(),
        )
        .as_ref()
    }
    .ok_or_else(|| Error::from_reason(format!("Unknown property '{}'", name.to_string_lossy())))?;
    if property.flags & glib::gobject_ffi::G_PARAM_WRITABLE == 0
        || property.flags & glib::gobject_ffi::G_PARAM_CONSTRUCT_ONLY != 0
    {
        return Err(Error::from_reason(format!(
            "Property '{}' cannot be written after construction",
            name.to_string_lossy()
        )));
    }
    if unsafe { glib::gobject_ffi::g_value_type_compatible((*value).g_type, property.value_type) }
        == 0
    {
        return Err(Error::from_reason(format!(
            "GValue type is incompatible with property '{}'",
            name.to_string_lossy()
        )));
    }
    Ok(())
}

/// Sets a property from a compatible `GValue` and adopts callback backing storage for its lifetime.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn set_object_property<'e>(
    env: &'e Env,
    object: &External<Handle>,
    name: String,
    #[napi(ts_arg_type = "ExternalObject<Handle>")] value: Unknown<'e>,
) -> Result<()> {
    let _errors = CallbackErrorScope::open(*env);
    let _leases = LeaseScope::open();
    let _lease = native_result("set_object_property", object.acquire_lease())?;
    let object = object
        .as_gobject_ptr()
        .ok_or_else(|| Error::from_reason("Expected a live GObject"))?;
    let handle: &External<Handle> = crate::value::read_napi(value)?;
    let value_ptr = value_ptr(handle)?;
    let name_c =
        CString::new(name.as_str()).map_err(|error| Error::from_reason(error.to_string()))?;
    validate_property_write(object, &name_c, value_ptr)?;
    let previous = property_callback(env, object, &name)?;
    let _incoming = PropertyValueScope::for_values(env, &[value])?;
    let _previous = PropertyValueScope::push(env, previous);
    retain_property_value(env, object, &name, value, true)?;
    let trap = CriticalTrap::arm();
    unsafe { glib::gobject_ffi::g_object_set_property(object, name_c.as_ptr(), value_ptr) };
    let critical = trap.disarm();
    if let Some(message) = critical {
        return Err(Error::from_reason(format!(
            "g_object_set_property: {message}"
        )));
    }
    Ok(())
}
