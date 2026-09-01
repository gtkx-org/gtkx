use std::ffi::{CString, c_char};

use glib::translate::IntoGlib as _;
use glib::{self, gobject_ffi};
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::{handle_newtype, native_result, type_from_bigint};
use crate::ffi::codec::{
    Ownership, acquire_construction_ref, release_construction_ref, tracked_gobject_value,
};
use crate::host::log_writer::CriticalTrap;
use crate::value::{pending_wrapper, wrapper};

type Associator<'a> = Function<'a, FnArgs<(Unknown<'a>, Unknown<'a>)>, ()>;

handle_newtype!(ValueHandle, *const gobject_ffi::GValue);

struct ConstructProperties {
    names: Vec<CString>,
    values: Vec<gobject_ffi::GValue>,
}

impl ConstructProperties {
    fn new(names: Vec<String>, values: &[ValueHandle]) -> Result<Self> {
        if names.len() != values.len() {
            return Err(Error::new(
                Status::InvalidArg,
                "new_object: property names and values must have the same length",
            ));
        }

        Ok(Self {
            names: names
                .into_iter()
                .map(|name| {
                    CString::new(name).map_err(|error| {
                        Error::new(
                            Status::InvalidArg,
                            format!("new_object: invalid property name: {error}"),
                        )
                    })
                })
                .collect::<Result<_>>()?,
            values: values
                .iter()
                .map(|value| {
                    if value.0.is_null() {
                        return Err(Error::new(
                            Status::InvalidArg,
                            "new_object: property value handle must not be null",
                        ));
                    }

                    Ok(unsafe { std::ptr::read(value.0) })
                })
                .collect::<Result<_>>()?,
        })
    }

    fn count(&self) -> Result<u32> {
        u32::try_from(self.names.len()).map_err(|_| {
            Error::new(
                Status::InvalidArg,
                "new_object: too many construct properties",
            )
        })
    }
}

/// Everything here speaks `GObject`: the constructor, the construction reference and the wrapper
/// the instance carries. A classed, instantiatable type is not enough, since a `GParamSpec` is both
/// and its class is not a `GObjectClass`, so reading properties out of it is a type confusion.
fn ensure_instantiable(type_: glib::Type) -> Result<()> {
    if !type_.is_a(glib::Type::OBJECT) {
        return Err(Error::new(
            Status::InvalidArg,
            format!("new_object: type '{type_}' does not derive from GObject"),
        ));
    }

    let raw = type_.into_glib();
    let is_abstract =
        unsafe { gobject_ffi::g_type_test_flags(raw, gobject_ffi::G_TYPE_FLAG_ABSTRACT) != 0 };

    if is_abstract {
        return Err(Error::new(
            Status::InvalidArg,
            format!("new_object: cannot instantiate abstract type '{type_}'"),
        ));
    }

    Ok(())
}

/// Rejects a construct property the type does not declare before anything is built. Left to
/// `g_object_new_with_properties`, an unknown name only logs a critical and is then ignored, so the
/// caller would receive an instance quietly missing the state it asked for.
fn ensure_properties_exist(type_: glib::Type, properties: &ConstructProperties) -> Result<()> {
    let class = unsafe { gobject_ffi::g_type_class_ref(type_.into_glib()) };

    if class.is_null() {
        return Err(Error::new(
            Status::InvalidArg,
            format!("new_object: type '{type_}' carries no class to look properties up in"),
        ));
    }

    let missing = properties
        .names
        .iter()
        .find(|name| {
            unsafe { gobject_ffi::g_object_class_find_property(class.cast(), name.as_ptr()) }
                .is_null()
        })
        .map(|name| name.to_string_lossy().into_owned());
    unsafe { gobject_ffi::g_type_class_unref(class) };

    match missing {
        Some(name) => Err(Error::new(
            Status::InvalidArg,
            format!("new_object: '{type_}' has no property named '{name}'"),
        )),
        None => Ok(()),
    }
}

unsafe fn construct(
    type_: glib::Type,
    properties: &ConstructProperties,
) -> Result<*mut gobject_ffi::GObject> {
    let count = properties.count()?;
    let mut name_ptrs: Vec<*const c_char> =
        properties.names.iter().map(|name| name.as_ptr()).collect();

    let trap = CriticalTrap::arm();
    let ptr = unsafe {
        gobject_ffi::g_object_new_with_properties(
            type_.into_glib(),
            count,
            name_ptrs.as_mut_ptr(),
            properties.values.as_ptr(),
        )
    };

    let critical = trap.disarm();

    if ptr.is_null() {
        return Err(Error::new(
            Status::GenericFailure,
            critical.map_or_else(
                || format!("new_object: could not construct an instance of '{type_}'"),
                |critical| format!("new_object: {critical}"),
            ),
        ));
    }

    Ok(ptr)
}

fn associate_constructed(
    env: &Env,
    ptr: *mut gobject_ffi::GObject,
    wrapper: &Object<'_>,
    associate: &Associator<'_>,
) -> Result<()> {
    unsafe { acquire_construction_ref(ptr) };
    let handle = native_result("new_object", unsafe {
        tracked_gobject_value(env, ptr, Ownership::Full)
    })?;
    let wrapper = unsafe { Unknown::from_napi_value(env.raw(), wrapper.raw()) }?;

    associate.call(FnArgs::from((handle, wrapper)))
}

fn finish_construction<'env>(
    env: &'env Env,
    ptr: *mut gobject_ffi::GObject,
    guard: &pending_wrapper::PendingGuard,
    type_: glib::Type,
    wrapper: &Object<'_>,
    associate: &Associator<'_>,
) -> Result<Option<Object<'env>>> {
    match guard.claimed_instance() {
        Some(claimed) if claimed == ptr => {
            unsafe { release_construction_ref(ptr) };

            Ok(None)
        }
        Some(_) => Err(Error::new(
            Status::GenericFailure,
            format!("new_object: another instance claimed the wrapper waiting for '{type_}'"),
        )),
        None => {
            if let Some(existing) = unsafe { wrapper::wrapper_value(env, ptr) } {
                unsafe { release_construction_ref(ptr) };

                return Ok(Some(existing));
            }

            associate_constructed(env, ptr, wrapper, associate)?;

            Ok(None)
        }
    }
}

/// Constructs a new instance of `gtype` with the given construct properties and binds `wrapper` to
/// it by calling `associate` with the instance's handle and the wrapper. A type registered through
/// `registerClass` binds them from its `instance_init`, before `constructed` runs, so a
/// `constructed` override already sees a fully usable wrapper; any other type binds them once
/// construction has returned. An abstract `gtype` is rejected before anything is constructed.
/// When construction hands back an instance that already carries a
/// wrapper — it reached JavaScript and was wrapped before `g_object_new` returned — that existing
/// wrapper is returned instead of binding `wrapper`, so the caller can adopt it; otherwise the
/// call returns `null`.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn new_object<'env>(
    env: &'env Env,
    gtype: BigInt,
    names: Vec<String>,
    #[napi(ts_arg_type = "ExternalObject<Handle>[]")] values: Vec<ValueHandle>,
    wrapper: Object<'env>,
    #[napi(ts_arg_type = "(handle: ExternalObject<Handle>, wrapper: object) => void")]
    associate: Associator<'env>,
) -> Result<Option<Object<'env>>> {
    let type_ = type_from_bigint(&gtype, "new_object:")?;
    ensure_instantiable(type_)?;
    let properties = ConstructProperties::new(names, &values)?;
    ensure_properties_exist(type_, &properties)?;
    let guard = unsafe { pending_wrapper::push(type_.into_glib(), wrapper.raw(), associate.raw()) };
    let ptr = unsafe { construct(type_, &properties) }?;

    finish_construction(env, ptr, &guard, type_, &wrapper, &associate)
}
