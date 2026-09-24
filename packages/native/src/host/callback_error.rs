use std::cell::RefCell;

use napi::Env;

use super::error_reporter::ReportErr as _;

#[derive(Default)]
struct ErrorSlot {
    armed: bool,
    error: Option<napi::Error>,
}

thread_local! {
    static CALLBACK_ERROR: RefCell<ErrorSlot> = const {
        RefCell::new(ErrorSlot { armed: false, error: None })
    };
}

pub(crate) struct CallbackErrorScope {
    env: Env,
    outer: ErrorSlot,
}

impl CallbackErrorScope {
    pub(crate) fn open(env: Env) -> Self {
        let active = ErrorSlot {
            armed: true,
            error: None,
        };
        Self {
            env,
            outer: CALLBACK_ERROR.with(|slot| slot.replace(active)),
        }
    }

    pub(crate) fn has_error() -> bool {
        CALLBACK_ERROR.with_borrow(|slot| slot.error.is_some())
    }

    pub(crate) fn deliver(env: Env, error: napi::Error) {
        let unscoped = CALLBACK_ERROR.with_borrow_mut(|slot| {
            if !slot.armed {
                return Some(error);
            }
            if slot.error.is_none() {
                slot.error = Some(error);
            }
            None
        });
        if let Some(error) = unscoped {
            env.throw(error)
                .map_err(anyhow::Error::from)
                .report_err("propagating callback failure");
        }
    }
}

impl Drop for CallbackErrorScope {
    fn drop(&mut self) {
        let active = CALLBACK_ERROR.with(|slot| slot.replace(std::mem::take(&mut self.outer)));
        if let Some(error) = active.error {
            self.env
                .throw(error)
                .map_err(anyhow::Error::from)
                .report_err("propagating callback failure");
        }
    }
}
