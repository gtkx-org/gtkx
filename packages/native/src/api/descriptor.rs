use std::ops::Deref;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::Codec;
use crate::ffi::descriptor::Descriptor;

#[derive(Clone, Debug)]
pub struct CompiledDescriptor(Codec);

impl FromNapiValue for CompiledDescriptor {
    unsafe fn from_napi_value(env: sys::napi_env, value: sys::napi_value) -> Result<Self> {
        let descriptor = unsafe { <&External<Self>>::from_napi_value(env, value)? };
        Ok((**descriptor).clone())
    }
}

impl Deref for CompiledDescriptor {
    type Target = Codec;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl CompiledDescriptor {
    pub(crate) fn into_codec(self) -> Codec {
        self.0
    }
}

/// Validates and compiles one descriptor tree into reusable native marshalling metadata.
/// Compilation does not resolve lazy native types or functions or prepare a function CIF.
#[napi(catch_unwind)]
pub fn compile_descriptor(descriptor: Descriptor) -> Result<External<CompiledDescriptor>> {
    Ok(External::new(CompiledDescriptor(descriptor.into_codec()?)))
}
