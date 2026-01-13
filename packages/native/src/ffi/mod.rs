//! FFI value encoding and decoding.
//!
//! This module provides the infrastructure for converting between JavaScript values
//! and FFI-compatible representations. It handles encoding values for native calls
//! and decoding return values back to JavaScript.
//!
//! # Key Components
//!
//! - [`FfiValue`]: Raw FFI-compatible value representation
//! - [`FfiEncode`]: Trait for encoding JavaScript values to FFI
//! - [`FfiDecode`]: Trait for decoding FFI values to JavaScript
//! - [`FfiStorage`]: Temporary storage for FFI call arguments

mod encode;
mod storage;
mod value;

pub use encode::{FfiDecode, FfiEncode};
pub use storage::{FfiStorage, FfiStorageKind, HashTableData, HashTableStorage};
pub use value::{FfiValue, TrampolineCallbackValue};

use crate::arg::Arg;
use crate::state::GtkThreadState;
use gtk4::glib::translate::FromGlib as _;

impl TryFrom<Arg> for FfiValue {
    type Error = anyhow::Error;

    fn try_from(arg: Arg) -> anyhow::Result<Self> {
        arg.ty.encode(&arg.value, arg.optional)
    }
}

pub fn get_gtype_from_lib(
    lib_name: &str,
    get_type_fn_name: &str,
) -> anyhow::Result<gtk4::glib::Type> {
    GtkThreadState::with(|state| {
        let lib = state.library(lib_name)?;

        type GetTypeFn = unsafe extern "C" fn() -> gtk4::glib::ffi::GType;

        let func = unsafe {
            lib.get::<GetTypeFn>(get_type_fn_name.as_bytes())
                .map_err(|e| {
                    anyhow::anyhow!("Failed to find symbol '{}': {}", get_type_fn_name, e)
                })?
        };

        let gtype_raw = unsafe { func() };
        Ok(unsafe { gtk4::glib::Type::from_glib(gtype_raw) })
    })
}
