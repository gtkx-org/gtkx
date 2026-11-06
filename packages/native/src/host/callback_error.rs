use std::cell::RefCell;

use napi::Env;

use super::error_reporter::ReportErr as _;
use super::node_env::report_pending_exception;

#[derive(Default)]
struct ErrorSlot {
    armed: bool,
    reporting: bool,
    error: Option<napi::Error>,
}

thread_local! {
    static CALLBACK_ERROR: RefCell<ErrorSlot> = const {
        RefCell::new(ErrorSlot { armed: false, reporting: false, error: None })
    };
}

pub(crate) struct CallbackErrorScope {
    env: Env,
    outer: ErrorSlot,
}

impl CallbackErrorScope {
    pub(crate) fn open(env: Env) -> Self {
        Self::arm(env, false)
    }

    pub(crate) fn open_reporting(env: Env) -> Self {
        Self::arm(env, true)
    }

    fn arm(env: Env, reporting: bool) -> Self {
        let active = ErrorSlot {
            armed: true,
            reporting,
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
        let (unstored, reporting) = CALLBACK_ERROR.with_borrow_mut(|slot| {
            if !slot.armed || slot.reporting {
                return (Some(error), slot.reporting);
            }
            if slot.error.is_none() {
                slot.error = Some(error);
            }
            (None, false)
        });
        if let Some(error) = unstored {
            env.throw(error)
                .map_err(anyhow::Error::from)
                .report_err("propagating callback failure");
            if reporting {
                report_pending_exception(env.raw());
            }
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
