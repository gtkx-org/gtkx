use std::ffi::c_void;
use std::sync::atomic::{AtomicPtr, Ordering};

use libffi::middle as libffi;
use neon::prelude::*;

use crate::ffi;
use crate::trampoline::{TrampolineData, TrampolineState, destroy_handler};
use crate::types::{FfiCodec, NeonContextExt as _, Type};
use crate::value;

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
            "call" => Ok(TrampolineScope::Call),
            "notified" => Ok(TrampolineScope::Notified),
            "async" => Ok(TrampolineScope::Async),
            "forever" => Ok(TrampolineScope::Forever),
            other => Err(format!(
                "'scope' must be 'call', 'notified', 'async', or 'forever'; got '{}'",
                other
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
    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;

        let arg_types_prop: Handle<'_, JsValue> = obj.prop(cx, "argTypes").get()?;
        let arg_types_arr = arg_types_prop.downcast::<JsArray, _>(cx).or_else(|_| {
            cx.throw_type_error("'argTypes' property is required for trampoline types")
        })?;
        let arg_types_vec = arg_types_arr.to_vec(cx)?;
        let mut arg_types = Vec::with_capacity(arg_types_vec.len());
        for item in arg_types_vec {
            arg_types.push(Type::from_js_value(cx, item)?);
        }

        let return_type_prop: Handle<'_, JsValue> = obj.prop(cx, "returnType").get()?;
        let return_type = Box::new(Type::from_js_value(cx, return_type_prop).or_else(|_| {
            cx.throw_type_error("'returnType' property is required for trampoline types")
        })?);

        let has_destroy: Option<Handle<JsBoolean>> = obj.get_opt(cx, "hasDestroy")?;
        let has_destroy = has_destroy.is_some_and(|v| v.value(cx));

        let user_data_index: Option<Handle<JsNumber>> = obj.get_opt(cx, "userDataIndex")?;
        let user_data_index = user_data_index.map(|v| v.value(cx) as usize);

        let scope_prop: Option<Handle<JsString>> = obj.get_opt(cx, "scope")?;
        let scope = match scope_prop {
            Some(s) => {
                let scope_str = s.value(cx);
                scope_str
                    .parse()
                    .map_err(|e: String| cx.throw_str_error(e))?
            }
            None => {
                if has_destroy {
                    TrampolineScope::Notified
                } else {
                    TrampolineScope::Call
                }
            }
        };

        Ok(TrampolineType {
            arg_types,
            return_type,
            has_destroy,
            user_data_index,
            scope,
        })
    }
}

impl FfiCodec for TrampolineType {
    fn call_cif(
        &self,
        _cif: &libffi::Cif,
        _ptr: libffi::CodePtr,
        _args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::FfiValue> {
        anyhow::bail!("Trampolines cannot be return types")
    }

    fn append_ffi_arg_types(&self, types: &mut Vec<libffi::Type>) {
        types.push(libffi::Type::pointer());
        types.push(libffi::Type::pointer());
        if self.has_destroy {
            types.push(libffi::Type::pointer());
        }
    }

    fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        use anyhow::bail;

        let callback = match val {
            value::Value::Callback(callback) => callback,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(self.build_null_ffi_value());
            }
            _ => bail!("Expected a Callback for trampoline type, got {:?}", val),
        };

        let is_oneshot = self.scope == TrampolineScope::Async;

        let data = TrampolineData {
            channel: callback.channel.clone(),
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
                Ok(ffi::FfiValue::Trampoline(ffi::TrampolineValue {
                    fn_ptr,
                    state_ptr,
                    destroy_ptr: None,
                    _owned_state: None,
                }))
            }
            TrampolineScope::Notified => {
                let state_ptr = Box::into_raw(Box::new(state)) as *mut c_void;
                Ok(ffi::FfiValue::Trampoline(ffi::TrampolineValue {
                    fn_ptr,
                    state_ptr,
                    destroy_ptr: Some(destroy_handler as *mut c_void),
                    _owned_state: None,
                }))
            }
            TrampolineScope::Async => {
                let raw_ptr = Box::into_raw(Box::new(state));
                unsafe {
                    (*raw_ptr)
                        .data_ref()
                        .oneshot_state_ptr
                        .store(raw_ptr, Ordering::Release);
                }
                Ok(ffi::FfiValue::Trampoline(ffi::TrampolineValue {
                    fn_ptr,
                    state_ptr: raw_ptr as *mut c_void,
                    destroy_ptr: None,
                    _owned_state: None,
                }))
            }
            TrampolineScope::Call => {
                let state = Box::new(state);
                let state_ptr = &*state as *const TrampolineState as *mut c_void;
                Ok(ffi::FfiValue::Trampoline(ffi::TrampolineValue {
                    fn_ptr,
                    state_ptr,
                    destroy_ptr: None,
                    _owned_state: Some(state),
                }))
            }
        }
    }
}

impl TrampolineType {
    fn build_null_ffi_value(&self) -> ffi::FfiValue {
        ffi::FfiValue::Trampoline(ffi::TrampolineValue {
            fn_ptr: std::ptr::null_mut(),
            state_ptr: std::ptr::null_mut(),
            destroy_ptr: if self.has_destroy {
                Some(std::ptr::null_mut())
            } else {
                None
            },
            _owned_state: None,
        })
    }
}
