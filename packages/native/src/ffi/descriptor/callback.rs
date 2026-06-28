use std::sync::atomic::Ordering;

use libffi::middle as libffi;

use super::prelude::*;
use crate::ffi::callback::{CallbackState, build_trampoline};
use crate::ffi::descriptor::Codec;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub enum CallbackScope {
    #[default]
    Call,
    Notified,
    Async,
    Forever,
}

impl std::str::FromStr for CallbackScope {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "call" => Ok(Self::Call),
            "notified" => Ok(Self::Notified),
            "async" => Ok(Self::Async),
            "forever" => Ok(Self::Forever),
            other => Err(format!(
                "'scope' must be 'call', 'notified', 'async', or 'forever'; got '{other}'"
            )),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CallbackDescriptor {
    pub arg_descriptors: Vec<Codec>,
    pub return_descriptor: Box<Codec>,
    pub has_destroy: bool,
    pub user_data_index: Option<usize>,
    pub scope: CallbackScope,
}

impl FfiEncoder for CallbackDescriptor {
    arg_only_call_cif!("Callbacks");

    fn append_ffi_arg_types(&self, types: &mut Vec<libffi::Type>) {
        types.push(libffi::Type::pointer());
        types.push(libffi::Type::pointer());
        if self.has_destroy {
            types.push(libffi::Type::pointer());
        }
    }

    fn encode(&self, val: &value::Value) -> anyhow::Result<ffi::StashedValue> {
        use anyhow::bail;

        let callback = match val {
            value::Value::Callback(callback) => callback,
            value::Value::Null | value::Value::Undefined => {
                return Ok(self.build_null_stashed_value());
            }
            _ => bail!("Expected a Callback for the callback descriptor, got {val:?}"),
        };

        let is_oneshot = self.scope == CallbackScope::Async;

        let (fn_ptr, state) = build_trampoline(
            callback.js_func.clone(),
            self.arg_descriptors.clone(),
            (*self.return_descriptor).clone(),
            self.user_data_index,
            is_oneshot,
        );

        match self.scope {
            CallbackScope::Forever => Ok(ffi::StashedValue::Callback(
                ffi::CallbackValue::new_armed(fn_ptr, None, state),
            )),
            CallbackScope::Notified => {
                Ok(ffi::StashedValue::Callback(ffi::CallbackValue::new_armed(
                    fn_ptr,
                    Some(CallbackState::destroy as *mut c_void),
                    state,
                )))
            }
            CallbackScope::Async => {
                let state_ptr = std::ptr::from_ref::<CallbackState>(&state) as *mut CallbackState;
                state
                    .data_ref()
                    .oneshot_state_ptr
                    .store(state_ptr, Ordering::Release);
                Ok(ffi::StashedValue::Callback(ffi::CallbackValue::new_armed(
                    fn_ptr, None, state,
                )))
            }
            CallbackScope::Call => {
                let state_ptr = &*state as *const CallbackState as *mut c_void;
                Ok(ffi::StashedValue::Callback(ffi::CallbackValue::new(
                    fn_ptr,
                    state_ptr,
                    None,
                    Some(state),
                )))
            }
        }
    }
}

impl FfiDecoder for CallbackDescriptor {}

impl PointerWriter for CallbackDescriptor {}

impl CallbackDescriptor {
    fn build_null_stashed_value(&self) -> ffi::StashedValue {
        ffi::StashedValue::Callback(ffi::CallbackValue::new(
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            if self.has_destroy {
                Some(std::ptr::null_mut())
            } else {
                None
            },
            None,
        ))
    }
}
