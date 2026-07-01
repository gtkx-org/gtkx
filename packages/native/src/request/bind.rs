use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::Codec;
use crate::ffi::descriptor::Descriptor;

pub struct CallDescriptor {
    pub(crate) library_name: String,
    pub(crate) symbol_name: String,
    pub(crate) arg_codecs: Vec<Codec>,
    pub(crate) return_codec: Codec,
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
        let arg_codecs = arg_descriptors
            .into_iter()
            .map(|wire| {
                let codec = wire.into_codec()?;
                Ok(codec)
            })
            .collect::<napi::Result<Vec<_>>>()?;
        let return_codec = return_descriptor.into_codec()?;
        Ok(External::new(Arc::new(CallDescriptor {
            library_name: shared_library,
            symbol_name: symbol,
            arg_codecs,
            return_codec,
        })))
    }
}
