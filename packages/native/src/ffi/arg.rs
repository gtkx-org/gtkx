use crate::ffi::descriptor::Descriptor;
use crate::ffi::value::Value;

#[derive(Debug, Clone)]
pub struct Arg {
    pub ty: Descriptor,
    pub value: Value,
}

impl Arg {
    #[must_use]
    pub fn new(ty: Descriptor, value: Value) -> Self {
        Self { ty, value }
    }
}
