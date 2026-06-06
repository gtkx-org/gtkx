//! Internal prelude for the [`super`] type-module siblings.
//!
//! Re-exports the symbols every codec submodule reaches for so that each
//! `types/*.rs` file opens with a single `use super::prelude::*;` instead of
//! the same five-line import block.

pub(super) use std::ffi::c_void;

pub(super) use super::raw_ptr::{null_guarded, write_object_ptr, write_return_object_ptr};
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
