//! Internal prelude for the [`super`] type-module siblings.
//!
//! Re-exports the symbols every codec submodule reaches for so that each
//! `types/*.rs` file opens with a single `use super::prelude::*;` instead of
//! the same five-line import block.

pub(super) use std::ffi::c_void;

pub(super) use super::raw_ptr::{
    full_transfer_storage, null_guarded, write_object_ptr, write_return_object_ptr,
    write_return_with_ownership,
};
pub(super) use super::{FfiDecoder, FfiEncoder, Ownership, RawPtrCodec};
pub(super) use crate::{ffi, value};

/// Stamps out an [`FfiEncoder::call_cif`] override that bails with
/// `"{kind} cannot be return types"`.
///
/// `Trampoline` and `Ref` are argument-only shapes. The dispatch
/// site in [`crate::module::call`] rejects them through
/// [`super::Type::can_be_return_type`] before they would ever reach
/// `call_cif`, so this body is the unreachable defensive branch.
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

/// Stamps the [`super::FfiEncoder::libffi_type`] and
/// [`super::FfiEncoder::call_cif`] overrides for a codec whose ABI
/// representation is the [`super::IntegerKind`] returned by its `$wire`
/// accessor, delegating both to that kind's own encoder.
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
