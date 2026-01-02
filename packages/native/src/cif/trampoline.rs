use std::ffi::c_void;

use gtk4::glib;

use super::owned_ptr::OwnedPtr;
use super::Value;
use crate::callback;

#[derive(Debug)]
pub struct TrampolineCallbackValue {
    pub trampoline_ptr: *mut c_void,
    pub closure: OwnedPtr,
    pub destroy_ptr: Option<*mut c_void>,
    pub data_first: bool,
}

pub(super) fn build_trampoline_callback(
    closure: glib::Closure,
    arg_gtypes: Vec<glib::Type>,
    spec: &callback::TrampolineSpec,
) -> Value {
    let closure_ptr = super::helpers::closure_ptr_for_transfer(closure);

    let closure_nonnull = std::ptr::NonNull::new(closure_ptr as *mut glib::gobject_ffi::GClosure)
        .expect("closure pointer should not be null");

    let callback_data = Box::new(callback::CallbackData::new(closure_nonnull, arg_gtypes, spec.kind));
    let data_ptr = Box::into_raw(callback_data) as *mut c_void;

    Value::TrampolineCallback(TrampolineCallbackValue {
        trampoline_ptr: spec.trampoline_ptr,
        closure: OwnedPtr::new((), data_ptr),
        destroy_ptr: Some(spec.destroy_ptr),
        data_first: false,
    })
}
