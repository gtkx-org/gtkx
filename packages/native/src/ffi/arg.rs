use crate::ffi::descriptor::Codec;
use crate::ffi::value::Value;

#[derive(Debug, Clone)]
pub struct Arg {
    pub descriptor: Codec,
    pub value: Value,
}

impl Arg {
    #[must_use]
    pub fn new(descriptor: Codec, value: Value) -> Self {
        Self { descriptor, value }
    }
}
