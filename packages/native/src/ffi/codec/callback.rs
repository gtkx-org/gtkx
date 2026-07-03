use libffi::middle as libffi;
use napi_derive::napi;

use super::prelude::*;
use crate::ffi::closure::ClosureState;
use crate::ffi::codec::Codec;

#[napi(string_enum = "lowercase")]
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub enum CallbackScope {
    #[default]
    Call,
    Notified,
    Async,
    Forever,
}

#[derive(Debug, Clone)]
pub struct CallbackCodec {
    pub arg_codecs: Vec<Codec>,
    pub return_codec: Box<Codec>,
    pub has_destroy: bool,
    pub user_data_index: Option<usize>,
    pub scope: CallbackScope,
}

impl Encoder for CallbackCodec {
    fn call_cif(
        &self,
        _cif: &libffi::Cif,
        _ptr: libffi::CodePtr,
        _args: &[libffi::Arg],
    ) -> anyhow::Result<ffi::Stash> {
        anyhow::bail!("Callbacks cannot be return codecs")
    }

    fn append_ffi_arg_types(&self, types: &mut Vec<libffi::Type>) {
        types.push(libffi::Type::pointer());
        types.push(libffi::Type::pointer());
        if self.has_destroy {
            types.push(libffi::Type::pointer());
        }
    }

    fn encode(&self, value: &value::Value) -> anyhow::Result<ffi::Stash> {
        let callback = match value {
            value::Value::Callback(callback) => callback,
            value::Value::Null | value::Value::Undefined => {
                return Ok(self.null_callback_value());
            }
            _ => bail_expected!("a Callback", "callback", value),
        };

        let is_oneshot = self.scope == CallbackScope::Async;

        let state = ClosureState::boxed(
            callback.js_fn.clone(),
            self.arg_codecs.clone(),
            (*self.return_codec).clone(),
            self.user_data_index,
            is_oneshot,
        );
        let fn_ptr = state.code_ptr;

        let destroy =
            (self.scope == CallbackScope::Notified).then_some(ClosureState::destroy as *mut c_void);

        match self.scope {
            CallbackScope::Call => {
                let state_ptr = &*state as *const ClosureState as *mut c_void;
                Ok(ffi::Stash::Callback(ffi::CallbackValue::new(
                    fn_ptr,
                    state_ptr,
                    None,
                    Some(state),
                )))
            }
            _ => Ok(ffi::Stash::Callback(
                ffi::CallbackValue::new_pending_transfer(fn_ptr, destroy, state),
            )),
        }
    }
}

impl Decoder for CallbackCodec {}

impl PtrWriter for CallbackCodec {}

impl CallbackCodec {
    fn null_callback_value(&self) -> ffi::Stash {
        ffi::Stash::Callback(ffi::CallbackValue::new(
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
