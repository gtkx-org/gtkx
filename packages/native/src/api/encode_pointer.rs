use std::ffi::c_void;

use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::native_result;
use crate::ffi::Stash;
use crate::ffi::codec::{CallbackScope, Codec, Encoder as _};
use crate::ffi::descriptor::Descriptor;
use crate::handle::Handle;

unsafe extern "C" fn release_encoded(ptr: *mut c_void) {
    unsafe { drop(Box::from_raw(ptr.cast::<Stash>())) };
}

/// Encodes a pointer-shaped value into owned argument storage and returns a handle that keeps
/// every allocation alive until it is collected. The pointer is borrowed when passed onward;
/// the receiving API must copy anything it keeps beyond the handle's lifetime. Callback
/// functions use weak JavaScript references; the property owner retains the function in JavaScript.
#[napi(catch_unwind)]
pub fn encode_pointer(
    env: Env,
    descriptor: Descriptor,
    value: Unknown<'_>,
) -> Result<External<Handle>> {
    let codec = descriptor.into_codec()?;
    let is_callback = matches!(&codec, Codec::Callback(callback) if callback.scope == CallbackScope::Call && !callback.has_user_data && !callback.has_destroy);
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
        return Err(Error::new(
            Status::InvalidArg,
            "encode_pointer requires a pointer-shaped descriptor",
        ));
    }
    let encoded = native_result(
        "encode_pointer",
        match &codec {
            Codec::Callback(callback) => callback.encode_weak(env, value),
            _ => codec.encode_owned(&env, value),
        },
    )?;
    let ptr = match &encoded {
        Stash::Callback(callback) => callback.function_pointer(),
        _ => native_result("encode_pointer", encoded.as_ptr("encoded pointer"))?,
    };
    let owner = Handle::callback_data(Box::into_raw(Box::new(encoded)).cast(), release_encoded);
    let handle = Handle::pointer(ptr, &owner);

    Ok(External::new(handle))
}

unsafe extern "C" fn release_property_pointer(ptr: *mut c_void) {
    unsafe { drop(Box::from_raw(ptr.cast::<Handle>())) };
}

/// Retains encoded callback storage until its object is finalized or the property is replaced.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn retain_property_pointer(
    object: &External<Handle>,
    name: String,
    pointer: Option<&External<Handle>>,
) -> Result<()> {
    let _lease = native_result("retain_property_pointer", object.acquire_lease())?;
    let object = object
        .as_gobject_ptr()
        .ok_or_else(|| Error::from_reason("Property pointer owner must be a GObject"))?;
    let name = std::ffi::CString::new(format!("gtkx-property-pointer::{name}"))
        .map_err(|error| Error::from_reason(error.to_string()))?;
    let data = pointer.map_or(std::ptr::null_mut(), |pointer| {
        Box::into_raw(Box::new((**pointer).clone())).cast()
    });
    unsafe {
        let key = glib::ffi::g_quark_from_string(name.as_ptr());
        glib::gobject_ffi::g_object_set_qdata_full(
            object,
            key,
            data,
            Some(release_property_pointer),
        );
    }
    Ok(())
}
