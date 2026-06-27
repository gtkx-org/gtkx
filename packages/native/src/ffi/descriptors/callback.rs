use std::sync::atomic::Ordering;

use libffi::middle as libffi;
use napi::{Env, JsObject};

use super::prelude::*;
use crate::ffi::callback::{TrampolineState, build_trampoline};
use crate::ffi::descriptors::Descriptor;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[non_exhaustive]
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
    pub arg_descriptors: Vec<Descriptor>,
    pub return_descriptor: Box<Descriptor>,
    pub has_destroy: bool,
    pub user_data_index: Option<usize>,
    pub scope: CallbackScope,
}

impl CallbackDescriptor {
    #[allow(clippy::trivially_copy_pass_by_ref)]
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub(crate) fn from_descriptor(env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let (arg_descriptors, return_descriptor) =
            super::parse_callback_arg_and_return_types(env, obj, "callback")?;

        let has_destroy =
            super::optional_descriptor_property::<bool>(obj, "hasDestroy")?.unwrap_or(false);

        let user_data_index =
            super::optional_descriptor_property::<f64>(obj, "userDataIndex")?.map(|v| v as usize);

        let scope_prop: Option<String> = super::optional_descriptor_property(obj, "scope")?;

        let scope = match scope_prop {
            Some(s) => s
                .parse()
                .map_err(|e: String| napi::Error::new(napi::Status::InvalidArg, e))?,
            None => {
                if has_destroy {
                    CallbackScope::Notified
                } else {
                    CallbackScope::Call
                }
            }
        };

        Ok(Self {
            arg_descriptors,
            return_descriptor,
            has_destroy,
            user_data_index,
            scope,
        })
    }
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

    #[cfg_attr(coverage_nightly, coverage(off))]
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
            CallbackScope::Forever => Ok(ffi::StashedValue::Callback(ffi::CallbackValue::new_armed(
                fn_ptr, None, state,
            ))),
            CallbackScope::Notified => Ok(ffi::StashedValue::Callback(ffi::CallbackValue::new_armed(
                fn_ptr,
                Some(TrampolineState::destroy as *mut c_void),
                state,
            ))),
            CallbackScope::Async => {
                let state_ptr =
                    std::ptr::from_ref::<TrampolineState>(&state) as *mut TrampolineState;
                state
                    .data_ref()
                    .oneshot_state_ptr
                    .store(state_ptr, Ordering::Release);
                Ok(ffi::StashedValue::Callback(ffi::CallbackValue::new_armed(
                    fn_ptr, None, state,
                )))
            }
            CallbackScope::Call => {
                let state_ptr = &*state as *const TrampolineState as *mut c_void;
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
