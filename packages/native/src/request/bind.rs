use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::Codec;
use crate::ffi::descriptor::Descriptor;

static NEXT_DESCRIPTOR_ID: AtomicU64 = AtomicU64::new(0);

pub struct CallDescriptor {
    pub(crate) id: u64,
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
        symbol_name: String,
        arg_descriptors: Vec<Descriptor>,
        return_descriptor: Descriptor,
    ) -> napi::Result<External<Arc<CallDescriptor>>> {
        let arg_codecs = arg_descriptors
            .into_iter()
            .map(Descriptor::into_codec)
            .collect::<napi::Result<Vec<_>>>()?;
        let return_codec = return_descriptor.into_codec()?;
        Ok(External::new(Arc::new(CallDescriptor {
            id: NEXT_DESCRIPTOR_ID.fetch_add(1, Ordering::Relaxed),
            library_name: shared_library,
            symbol_name,
            arg_codecs,
            return_codec,
        })))
    }
}
