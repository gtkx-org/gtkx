use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::Codec;
use crate::ffi::descriptor::Descriptor;

pub struct CallDescriptor {
    pub(crate) library_name: String,
    pub(crate) symbol_name: String,
    pub(crate) arg_descriptors: Vec<Codec>,
    pub(crate) return_descriptor: Codec,
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn bind(
        shared_library: String,
        symbol: String,
        arg_descriptors: Vec<Descriptor>,
        return_descriptor: Descriptor,
    ) -> napi::Result<External<Arc<CallDescriptor>>> {
        let parsed_arg_descriptors = arg_descriptors
            .into_iter()
            .map(|wire| {
                let descriptor = wire.into_codec()?;
                Ok(descriptor)
            })
            .collect::<napi::Result<Vec<_>>>()?;
        let return_descriptor = return_descriptor.into_codec()?;
        Ok(External::new(Arc::new(CallDescriptor {
            library_name: shared_library,
            symbol_name: symbol,
            arg_descriptors: parsed_arg_descriptors,
            return_descriptor,
        })))
    }
}
