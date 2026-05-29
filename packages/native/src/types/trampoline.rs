use std::sync::atomic::{AtomicPtr, Ordering};

use libffi::middle as libffi;
use napi::{Env, JsObject};

use super::prelude::*;
use crate::trampoline::{TrampolineData, TrampolineState};
use crate::types::Type;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
#[non_exhaustive]
pub enum TrampolineScope {
    #[default]
    Call,
    Notified,
    Async,
    Forever,
}

impl std::str::FromStr for TrampolineScope {
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
pub struct TrampolineType {
    pub arg_types: Vec<Type>,
    pub return_type: Box<Type>,
    pub has_destroy: bool,
    pub user_data_index: Option<usize>,
    pub scope: TrampolineScope,
}

impl TrampolineType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let (arg_types, return_type) =
            super::parse_trampoline_arg_and_return_types(env, obj, "trampoline")?;

        let has_destroy = obj
            .get_named_property::<Option<bool>>("hasDestroy")
            .ok()
            .flatten()
            .unwrap_or(false);

        let user_data_index = obj
            .get_named_property::<Option<f64>>("userDataIndex")
            .ok()
            .flatten()
            .map(|v| v as usize);

        let scope_prop: Option<String> = obj
            .get_named_property::<Option<String>>("scope")
            .ok()
            .flatten();

        let scope = match scope_prop {
            Some(s) => s
                .parse()
                .map_err(|e: String| napi::Error::new(napi::Status::InvalidArg, e))?,
            None => {
                if has_destroy {
                    TrampolineScope::Notified
                } else {
                    TrampolineScope::Call
                }
            }
        };

        Ok(Self {
            arg_types,
            return_type,
            has_destroy,
            user_data_index,
            scope,
        })
    }
}

impl FfiEncoder for TrampolineType {
    arg_only_call_cif!("Trampolines");

    fn append_ffi_arg_types(&self, types: &mut Vec<libffi::Type>) {
        types.push(libffi::Type::pointer());
        types.push(libffi::Type::pointer());
        if self.has_destroy {
            types.push(libffi::Type::pointer());
        }
    }

    #[cfg_attr(coverage_nightly, coverage(off))]
    fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        use anyhow::bail;

        let callback = match val {
            value::Value::Callback(callback) => callback,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(self.build_null_ffi_value());
            }
            _ => bail!("Expected a Callback for trampoline type, got {val:?}"),
        };

        let is_oneshot = self.scope == TrampolineScope::Async;

        let data = TrampolineData {
            js_func: callback.js_func.clone(),
            arg_types: self.arg_types.clone(),
            return_type: (*self.return_type).clone(),
            user_data_index: self.user_data_index,
            is_oneshot,
            oneshot_state_ptr: AtomicPtr::new(std::ptr::null_mut()),
        };

        let state = TrampolineState::create(data);
        let fn_ptr = state.code_ptr;

        match self.scope {
            TrampolineScope::Forever => {
                let state_ptr = Box::into_raw(Box::new(state)) as *mut c_void;
                Ok(ffi::FfiValue::Trampoline(ffi::TrampolineValue::new(
                    fn_ptr, state_ptr, None, None,
                )))
            }
            TrampolineScope::Notified => {
                let state_ptr = Box::into_raw(Box::new(state)) as *mut c_void;
                Ok(ffi::FfiValue::Trampoline(ffi::TrampolineValue::new(
                    fn_ptr,
                    state_ptr,
                    Some(TrampolineState::destroy as *mut c_void),
                    None,
                )))
            }
            TrampolineScope::Async => {
                let raw_ptr = Box::into_raw(Box::new(state));
                unsafe {
                    (*raw_ptr)
                        .data_ref()
                        .oneshot_state_ptr
                        .store(raw_ptr, Ordering::Release);
                }
                Ok(ffi::FfiValue::Trampoline(ffi::TrampolineValue::new(
                    fn_ptr,
                    raw_ptr as *mut c_void,
                    None,
                    None,
                )))
            }
            TrampolineScope::Call => {
                let state = Box::new(state);
                let state_ptr = &*state as *const TrampolineState as *mut c_void;
                Ok(ffi::FfiValue::Trampoline(ffi::TrampolineValue::new(
                    fn_ptr,
                    state_ptr,
                    None,
                    Some(state),
                )))
            }
        }
    }
}

impl FfiDecoder for TrampolineType {}

impl RawPtrCodec for TrampolineType {}

impl GlibValueCodec for TrampolineType {}

impl TrampolineType {
    fn build_null_ffi_value(&self) -> ffi::FfiValue {
        ffi::FfiValue::Trampoline(ffi::TrampolineValue::new(
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
