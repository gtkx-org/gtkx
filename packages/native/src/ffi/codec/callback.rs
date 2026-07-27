use libffi::middle as libffi;
use napi_derive::napi;

use super::prelude::*;
use crate::ffi::closure::ClosureState;
use crate::ffi::codec::Codec;
use crate::value::ClosureHandle;

/// Lifetime of a marshalled callback closure: `call` lasts only for the duration of the call,
/// `notified` is freed by a destroy notify, `async` spans a single async use, `forever` is never freed.
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
    reject_return_codec!("Callback");

    fn append_ffi_arg_types(&self, types: &mut Vec<libffi::Type>) {
        types.push(libffi::Type::pointer());
        if self.has_user_data() {
            types.push(libffi::Type::pointer());
        }
        if self.has_destroy {
            types.push(libffi::Type::pointer());
        }
    }

    fn encode(&self, env: &Env, value: Unknown<'_>) -> anyhow::Result<ffi::Stash> {
        let js_fn = match value.get_type()? {
            ValueType::Function => ClosureHandle::from_js_value(env, &value)?,
            ValueType::Null | ValueType::Undefined => {
                return Ok(self.null_callback_value());
            }
            _ => bail_expected!("a Callback", "callback"),
        };

        let is_oneshot = self.scope == CallbackScope::Async;

        let state = ClosureState::boxed(
            js_fn,
            self.arg_codecs.clone(),
            (*self.return_codec).clone(),
            self.user_data_index,
            is_oneshot,
        );
        let fn_ptr = state.code_ptr;

        let destroy = self.has_destroy.then(|| {
            if self.scope == CallbackScope::Notified {
                ClosureState::destroy as *mut c_void
            } else {
                std::ptr::null_mut()
            }
        });

        let has_user_data = self.has_user_data();

        match self.scope {
            CallbackScope::Call => {
                let state_ptr = (&raw const *state).cast::<c_void>().cast_mut();
                Ok(ffi::Stash::Callback(ffi::CallbackValue::new(
                    fn_ptr,
                    state_ptr,
                    has_user_data,
                    destroy,
                    Some(state),
                )))
            }
            _ => Ok(ffi::Stash::Callback(
                ffi::CallbackValue::new_pending_transfer(fn_ptr, has_user_data, destroy, state),
            )),
        }
    }
}

impl Decoder for CallbackCodec {}

impl PtrWriter for CallbackCodec {}

impl CallbackCodec {
    // A `user_data` slot in the callback's own signature is what tells us the C function that
    // receives it takes a closure argument, so it is also what decides how many words the call
    // pushes: the trampoline alone, or the trampoline plus the state pointer.
    fn has_user_data(&self) -> bool {
        self.user_data_index.is_some()
    }

    fn null_callback_value(&self) -> ffi::Stash {
        ffi::Stash::Callback(ffi::CallbackValue::new(
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            self.has_user_data(),
            if self.has_destroy {
                Some(std::ptr::null_mut())
            } else {
                None
            },
            None,
        ))
    }
}
