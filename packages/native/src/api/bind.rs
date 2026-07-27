use std::cell::OnceCell;

use libffi::middle::Cif;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::ffi::codec::Codec;
use crate::ffi::descriptor::Descriptor;

pub struct CallDescriptor {
    pub(crate) library_name: String,
    pub(crate) symbol_name: String,
    pub(crate) arg_codecs: Vec<Codec>,
    pub(crate) return_codec: Codec,
    pub(crate) cif: OnceCell<Cif>,
}

/// Resolves `symbolName` in `sharedLibrary` and precompiles its argument and return marshalling
/// into a reusable call descriptor that `call` can invoke.
#[napi(catch_unwind)]
pub fn bind(
    shared_library: String,
    symbol_name: String,
    arg_descriptors: Vec<Descriptor>,
    return_descriptor: Descriptor,
) -> Result<External<CallDescriptor>> {
    let arg_codecs = arg_descriptors
        .into_iter()
        .map(Descriptor::into_codec)
        .collect::<Result<Vec<_>>>()?;
    let return_codec = return_descriptor.into_codec()?;
    Ok(External::new(CallDescriptor {
        library_name: shared_library,
        symbol_name,
        arg_codecs,
        return_codec,
        cif: OnceCell::new(),
    }))
}
