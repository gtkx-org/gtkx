use std::cell::Cell;
use std::ptr;

use glib::gobject_ffi;
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use crate::api::value_pointer::value_ptr;
use crate::handle::{Handle, LeaseScope};
use crate::host::callback_error::CallbackErrorScope;

thread_local! {
    static EMISSION_VALUES: Cell<*const gobject_ffi::GValue> = const { Cell::new(ptr::null()) };
}

struct EmissionScope {
    previous: *const gobject_ffi::GValue,
}

impl EmissionScope {
    fn open(values: *const gobject_ffi::GValue) -> Self {
        Self {
            previous: EMISSION_VALUES.with(|active| active.replace(values)),
        }
    }
}

impl Drop for EmissionScope {
    fn drop(&mut self) {
        EMISSION_VALUES.with(|active| active.set(self.previous));
    }
}

pub(crate) fn is_synthetic_emission(values: *const gobject_ffi::GValue) -> bool {
    EMISSION_VALUES.with(|active| !values.is_null() && active.get() == values)
}

/// Emits with an exact argument-array scope, distinguishing nested native emissions even when
/// they use the same signal and instance. Typed borrowed-object callbacks need an owned `GValue`
/// here because emitv does not perform the return-value copy used by `g_signal_emit`.
/// The contiguous argument copies borrow their contents from the rooted input handles and must
/// not unset them when the scope ends.
#[allow(clippy::needless_pass_by_value)]
#[napi(catch_unwind)]
pub fn emit_signal(
    env: Env,
    #[napi(ts_arg_type = "ExternalObject<Handle>[]")] values: Vec<Unknown<'_>>,
    signal_id: u32,
    detail: u32,
    #[napi(ts_arg_type = "ExternalObject<Handle> | undefined")] return_value: Option<Unknown<'_>>,
) -> Result<()> {
    let _errors = CallbackErrorScope::open(env);
    let _leases = LeaseScope::open();
    let mut query = unsafe { std::mem::zeroed::<gobject_ffi::GSignalQuery>() };
    unsafe { gobject_ffi::g_signal_query(signal_id, &raw mut query) };
    if query.signal_id == 0 || values.len() != query.n_params as usize + 1 {
        return Err(Error::from_reason(
            "Invalid signal or signal argument count",
        ));
    }
    let parameters = values
        .iter()
        .map(|value| {
            let handle: &External<Handle> = crate::value::read_napi(*value)?;
            let value = value_ptr(handle)?;
            Ok(unsafe { ptr::read(value) })
        })
        .collect::<Result<Vec<_>>>()?;
    let result = match return_value {
        Some(value) => {
            let handle: &External<Handle> = crate::value::read_napi(value)?;
            value_ptr(handle)?
        }
        None => ptr::null_mut(),
    };
    let _emission = EmissionScope::open(parameters.as_ptr());
    unsafe { gobject_ffi::g_signal_emitv(parameters.as_ptr(), signal_id, detail, result) };
    if CallbackErrorScope::has_error() {
        return Err(Error::from_reason("A signal callback threw an exception"));
    }
    Ok(())
}
