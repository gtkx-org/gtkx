use crate::ffi::descriptor::Descriptor;
use crate::ffi::value::Value;

#[derive(Debug, Clone)]
pub struct Arg {
    pub descriptor: Descriptor,
    pub value: Value,
}

impl Arg {
    #[must_use]
    pub fn new(descriptor: Descriptor, value: Value) -> Self {
        Self { descriptor, value }
    }
}
