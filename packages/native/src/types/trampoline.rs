use std::ffi::c_void;

use neon::prelude::*;

use crate::ffi;
use crate::trampoline::{TrampolineData, TrampolineState, destroy_handler};
use crate::types::Type;
use crate::value;

#[derive(Debug, Clone)]
pub struct TrampolineType {
    pub arg_types: Vec<Type>,
    pub return_type: Box<Type>,
    pub has_destroy: bool,
    pub user_data_index: Option<usize>,
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

        Ok(TrampolineType {
            arg_types,
            return_type,
            has_destroy,
            user_data_index,
        })
    }
}

impl TrampolineType {
    pub fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        use anyhow::bail;

        let callback = match val {
            value::Value::Callback(callback) => callback,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(self.build_null_ffi_value());
            }
            _ => bail!("Expected a Callback for trampoline type, got {:?}", val),
        };

        let data = TrampolineData {
            channel: callback.channel.clone(),
            js_func: callback.js_func.clone(),
            arg_types: self.arg_types.clone(),
            return_type: *self.return_type.clone(),
            user_data_index: self.user_data_index,
        };

        let state = TrampolineState::create(data);
        let fn_ptr = state.code_ptr;

        if self.has_destroy {
            let state_ptr = Box::into_raw(Box::new(state)) as *mut c_void;
            let destroy_ptr = destroy_handler as *mut c_void;

            Ok(ffi::FfiValue::Trampoline(ffi::TrampolineValue {
                fn_ptr,
                state_ptr,
                destroy_ptr: Some(destroy_ptr),
                _owned_state: None,
            }))
        } else {
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
