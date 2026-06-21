pub(super) use std::ffi::c_void;

pub(super) use super::raw_ptr::{
    encode_and_leak_container, swap_owned_slot, write_object_ptr, write_return_object_ptr,
};
pub(super) use super::{
    FfiDecoder, FfiEncoder, FromDescriptor, Ownership, RawPtrCodec, ReadSource,
};
pub(super) use crate::{ffi, value};

macro_rules! arg_only_call_cif {
    ($kind:literal) => {
        fn call_cif(
            &self,
            _cif: &::libffi::middle::Cif,
            _ptr: ::libffi::middle::CodePtr,
            _args: &[::libffi::middle::Arg],
        ) -> ::anyhow::Result<crate::ffi::FfiValue> {
            ::anyhow::bail!(concat!($kind, " cannot be return types"))
        }
    };
}
pub(super) use arg_only_call_cif;

macro_rules! integer_wire_encoder {
    ($wire:ident) => {
        fn libffi_type(&self) -> ::libffi::middle::Type {
            FfiEncoder::libffi_type(&self.$wire())
        }

        fn call_cif(
            &self,
            cif: &::libffi::middle::Cif,
            ptr: ::libffi::middle::CodePtr,
            args: &[::libffi::middle::Arg],
        ) -> ::anyhow::Result<crate::ffi::FfiValue> {
            FfiEncoder::call_cif(&self.$wire(), cif, ptr, args)
        }
    };
}
pub(super) use integer_wire_encoder;
