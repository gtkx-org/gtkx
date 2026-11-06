use std::cell::RefCell;
use std::ffi::{CStr, CString, c_void};
use std::marker::PhantomData;
use std::rc::Rc;

use glib::prelude::StaticType as _;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::descriptor::CompiledDescriptor;
use crate::api::{handle_memory_range, native_result};
use crate::ffi::Stash;
use crate::ffi::closure::DecodedCallback;
use crate::ffi::codec::{CallbackScope, Codec, Encoder as _};
use crate::handle::{Handle, LeaseScope};
use crate::host::callback_error::CallbackErrorScope;
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

pub(crate) fn value_ptr(value: &Handle) -> Result<*mut glib::gobject_ffi::GValue> {
    if value.boxed_type() != Some(glib::BoxedValue::static_type()) {
        return Err(Error::from_reason("Expected a GValue handle"));
    }
    handle_memory_range(value, 0, size_of::<glib::gobject_ffi::GValue>(), "GValue")
        .map(<*mut c_void>::cast)
}

pub(crate) fn create_callback<'e>(
    env: &'e Env,
    codec: &Codec,
    callback: Unknown<'e>,
) -> Result<Unknown<'e>> {
    let (storage, _) = encode(env, codec, callback)?;
    let function = Handle::function(storage.as_ptr(), Some(storage), false, false);
    let handle = crate::value::handle_to_unknown(env, function)?;
    roots::set(*env, handle, "callback", callback)?;
    Ok(handle)
}

/// Writes a pointer `GValue` together with the backing storage and callback roots it borrows.
#[napi(catch_unwind)]
pub fn set_value_pointer<'e>(
    env: &'e Env,
    #[napi(ts_arg_type = "ExternalObject<Handle>")] value_handle: Unknown<'e>,
    descriptor: &External<CompiledDescriptor>,
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
    let (storage, is_callback) = encode(env, descriptor, value)?;
    roots::set(*env, value_handle, "pointer", value)?;
    unsafe { glib::gobject_ffi::g_value_set_pointer(target, storage.as_ptr()) };
    handle.set_pointer_storage(storage, is_callback);
    Ok(())
}

unsafe extern "C" fn release_property_pointer(ptr: *mut c_void) {
    unsafe { drop(Box::from_raw(ptr.cast::<PropertyPointer>())) };
}

struct PropertyPointer {
    generation: Rc<()>,
    storage: Vec<Handle>,
}

type RetainedCallback<'e> = (Handle, Unknown<'e>);

struct PropertyCallbacks<'e> {
    generation: Option<Rc<()>>,
    values: Vec<RetainedCallback<'e>>,
}

struct ActivePropertyValue {
    env: sys::napi_env,
    storage: Handle,
    root: sys::napi_value,
}

thread_local! {
    static ACTIVE_VALUES: RefCell<Vec<ActivePropertyValue>> = const { RefCell::new(Vec::new()) };
    static PROPERTY_READS: RefCell<Vec<(usize, String)>> = const { RefCell::new(Vec::new()) };
}

struct PropertyReadScope {
    depth: usize,
}

impl PropertyReadScope {
    fn open(object: *mut glib::gobject_ffi::GObject, name: &str) -> Option<Self> {
        PROPERTY_READS.with_borrow_mut(|reads| {
            if reads
                .iter()
                .any(|(current, property)| *current == object as usize && property == name)
            {
                return None;
            }
            let depth = reads.len();
            reads.push((object as usize, name.to_owned()));
            Some(Self { depth })
        })
    }
}

impl Drop for PropertyReadScope {
    fn drop(&mut self) {
        PROPERTY_READS.with_borrow_mut(|reads| reads.truncate(self.depth));
    }
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
    if ptr.is_null() {
        return Ok(None);
    }
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

fn property_callbacks<'e>(
    env: &'e Env,
    object: *mut glib::gobject_ffi::GObject,
    name: &str,
) -> Result<PropertyCallbacks<'e>> {
    let slot = format!("gtkx-property-pointer::{name}");
    let key = CString::new(slot.as_str()).map_err(|error| Error::from_reason(error.to_string()))?;
    let retained = unsafe {
        let quark = glib::ffi::g_quark_try_string(key.as_ptr());
        if quark == 0 {
            None
        } else {
            glib::gobject_ffi::g_object_get_qdata(object, quark)
                .cast::<PropertyPointer>()
                .as_ref()
                .map(|property| (property.generation.clone(), property.storage.clone()))
        }
    };
    let Some((generation, storage)) = retained else {
        return Ok(PropertyCallbacks {
            generation: None,
            values: Vec::new(),
        });
    };
    let root = match unsafe { wrapper::wrapper_value(env, object) } {
        Some(wrapper) => roots::get(env, wrapper.into_unknown(env)?, &slot)?,
        None => ().into_unknown(env)?,
    };
    let roots: Option<Array<'e>> = if root.is_array()? {
        Some(crate::value::read_napi(root)?)
    } else {
        None
    };
    let mut values = Vec::with_capacity(storage.len());
    for (index, storage) in storage.into_iter().enumerate() {
        let index = u32::try_from(index).map_err(|error| Error::from_reason(error.to_string()))?;
        let root = roots
            .as_ref()
            .map(|roots| roots.get::<Unknown<'e>>(index))
            .transpose()?
            .flatten()
            .unwrap_or(().into_unknown(env)?);
        values.push((storage, root));
    }
    Ok(PropertyCallbacks {
        generation: Some(generation),
        values,
    })
}

fn merge_callbacks<'e>(
    retained: &mut Vec<RetainedCallback<'e>>,
    values: impl IntoIterator<Item = RetainedCallback<'e>>,
) {
    for (storage, root) in values {
        if !storage.as_ptr().is_null()
            && !retained
                .iter()
                .any(|(current, _)| current.as_ptr() == storage.as_ptr())
        {
            retained.push((storage, root));
        }
    }
}

fn store_property_callbacks<'e>(
    env: &'e Env,
    object: *mut glib::gobject_ffi::GObject,
    name: &str,
    values: &[RetainedCallback<'e>],
) -> Result<()> {
    let slot = format!("gtkx-property-pointer::{name}");
    let key = CString::new(slot.as_str()).map_err(|error| Error::from_reason(error.to_string()))?;
    if let Some(wrapper) = unsafe { wrapper::wrapper_value(env, object) } {
        let wrapper = wrapper.into_unknown(env)?;
        if values.is_empty() {
            roots::remove(*env, wrapper, &slot)?;
        } else {
            let length = u32::try_from(values.len())
                .map_err(|error| Error::from_reason(error.to_string()))?;
            let mut retained = env.create_array(length)?;
            for (index, (_, root)) in (0..length).zip(values) {
                retained.set(index, *root)?;
            }
            roots::set(*env, wrapper, &slot, retained.into_unknown(env)?)?;
        }
    }
    let data = Box::into_raw(Box::new(PropertyPointer {
        generation: Rc::new(()),
        storage: values.iter().map(|(storage, _)| storage.clone()).collect(),
    }))
    .cast();
    unsafe {
        glib::gobject_ffi::g_object_set_qdata_full(
            object,
            glib::ffi::g_quark_from_string(key.as_ptr()),
            data,
            Some(release_property_pointer),
        );
    }
    Ok(())
}

fn reconcile_property_callbacks<'e>(
    env: &'e Env,
    object: *mut glib::gobject_ffi::GObject,
    name: &str,
    candidates: &[RetainedCallback<'e>],
) -> Result<()> {
    let before = property_callbacks(env, object, name)?;
    let mut retained = before.values;
    merge_callbacks(&mut retained, candidates.iter().cloned());
    if retained.is_empty() {
        return Ok(());
    }
    let name_c = CString::new(name).map_err(|error| Error::from_reason(error.to_string()))?;
    let property = unsafe {
        glib::gobject_ffi::g_object_class_find_property(
            (*object).g_type_instance.g_class.cast(),
            name_c.as_ptr(),
        )
        .as_ref()
    };
    let readable = property.is_some_and(|property| {
        property.flags & glib::gobject_ffi::G_PARAM_READABLE != 0
            && unsafe { glib::gobject_ffi::g_type_fundamental(property.value_type) }
                == glib::gobject_ffi::G_TYPE_POINTER
    });
    if !readable {
        return store_property_callbacks(env, object, name, &retained);
    }
    store_property_callbacks(env, object, name, &retained)?;
    if CallbackErrorScope::has_error() {
        return Ok(());
    }
    let Some(_reading) = PropertyReadScope::open(object, name) else {
        return Ok(());
    };
    let generation = property_callbacks(env, object, name)?.generation;
    let _retained = PropertyValueScope::push(env, retained.iter().cloned());
    let mut value = glib::Value::from_type(glib::Type::POINTER);
    let target = glib::translate::ToGlibPtrMut::to_glib_none_mut(&mut value).0;
    unsafe { glib::gobject_ffi::g_object_get_property(object, name_c.as_ptr(), target) };
    let after = property_callbacks(env, object, name)?;
    let unchanged = match (&generation, &after.generation) {
        (Some(before), Some(after)) => Rc::ptr_eq(before, after),
        (None, None) => true,
        _ => false,
    };
    merge_callbacks(&mut retained, after.values);
    if !CallbackErrorScope::has_error() && unchanged {
        let ptr = unsafe { glib::gobject_ffi::g_value_get_pointer(target) };
        let current = match retained
            .into_iter()
            .find(|(storage, _)| storage.as_ptr() == ptr)
        {
            Some(current) => Some(current),
            None => active_property_callback(env, ptr)?,
        };
        retained = current.into_iter().collect();
    }
    store_property_callbacks(env, object, name, &retained)
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
    let previous = property_callbacks(env, object, &name)?;
    let _reading = PropertyReadScope::open(object, &name);
    unsafe { glib::gobject_ffi::g_object_get_property(object, name_c.as_ptr(), target) };
    if unsafe { glib::gobject_ffi::g_type_fundamental((*target).g_type) }
        != glib::gobject_ffi::G_TYPE_POINTER
    {
        return ().into_unknown(env);
    }
    let ptr = unsafe { glib::gobject_ffi::g_value_get_pointer(target) };
    let after = property_callbacks(env, object, &name)?;
    let unchanged = match (&previous.generation, &after.generation) {
        (Some(previous), Some(after)) => Rc::ptr_eq(previous, after),
        (None, None) => true,
        _ => false,
    };
    let managed = previous.generation.is_some() || after.generation.is_some();
    let mut candidates = previous.values;
    merge_callbacks(&mut candidates, after.values);
    let retained = candidates
        .into_iter()
        .find(|(storage, _)| storage.as_ptr() == ptr);
    let retained = match retained {
        Some(retained) => Some(retained),
        None => active_property_callback(env, ptr)?,
    };
    if managed && unchanged && !CallbackErrorScope::has_error() {
        store_property_callbacks(
            env,
            object,
            &name,
            &retained.iter().cloned().collect::<Vec<_>>(),
        )?;
    }
    if ptr.is_null() {
        return ().into_unknown(env);
    }
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
) -> Result<()> {
    let handle: &External<Handle> = crate::value::read_napi(value)?;
    let storage = handle.pointer_storage();
    let previous = property_callbacks(env, object, name)?;
    let mut candidates = previous.values;
    if let Some(storage) = storage {
        merge_callbacks(
            &mut candidates,
            [(storage, roots::get(env, value, "pointer")?)],
        );
    }
    if candidates.is_empty() {
        return Ok(());
    }
    store_property_callbacks(env, object, name, &candidates)?;
    reconcile_property_callbacks(env, object, name, &candidates)
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
    let previous = property_callbacks(env, object, &name)?;
    let mut candidates = previous.values;
    if let Some(storage) = handle.pointer_storage() {
        merge_callbacks(
            &mut candidates,
            [(storage, roots::get(env, value, "pointer")?)],
        );
    }
    let _retained = PropertyValueScope::push(env, candidates.iter().cloned());
    if !candidates.is_empty() || previous.generation.is_some() {
        store_property_callbacks(env, object, &name, &candidates)?;
    }
    unsafe { glib::gobject_ffi::g_object_set_property(object, name_c.as_ptr(), value_ptr) };
    reconcile_property_callbacks(env, object, &name, &candidates)
}
