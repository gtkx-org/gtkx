use std::ffi::c_void;
use std::mem::ManuallyDrop;
use std::sync::Arc;
use std::sync::atomic::{AtomicPtr, Ordering};

use ::libffi::low as libffi_low;
use ::libffi::middle as libffi;
use neon::event::Channel;
use neon::handle::Root;
use neon::types::JsFunction;

use crate::js_dispatch::JsDispatcher;
use crate::types::{FfiEncoder as _, RawPtrCodec as _, Type};
use crate::value::Value;

pub struct TrampolineData {
    pub channel: Channel,
    pub js_func: Arc<Root<JsFunction>>,
    pub arg_types: Vec<Type>,
    pub return_type: Type,
    pub user_data_index: Option<usize>,
    pub is_oneshot: bool,
    pub oneshot_state_ptr: AtomicPtr<TrampolineState>,
}

impl std::fmt::Debug for TrampolineData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TrampolineData")
            .field("arg_types", &self.arg_types)
            .field("return_type", &self.return_type)
            .field("user_data_index", &self.user_data_index)
            .field("is_oneshot", &self.is_oneshot)
            .finish()
    }
}

pub struct TrampolineState {
    _closure: ManuallyDrop<libffi::Closure<'static>>,
    pub code_ptr: *mut c_void,
    data: ManuallyDrop<Box<TrampolineData>>,
}

impl std::fmt::Debug for TrampolineState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TrampolineState")
            .field("code_ptr", &self.code_ptr)
            .finish()
    }
}

impl Drop for TrampolineState {
    fn drop(&mut self) {
        unsafe { ManuallyDrop::drop(&mut self._closure) };
        unsafe { ManuallyDrop::drop(&mut self.data) };
    }
}

unsafe impl Send for TrampolineState {}

impl TrampolineState {
    #[must_use]
    pub fn data_ref(&self) -> &TrampolineData {
        &self.data
    }

    pub fn create(data: TrampolineData) -> Self {
        let data = ManuallyDrop::new(Box::new(data));
        let data_ptr: *const TrampolineData = &**data;
        let data_ref: &'static TrampolineData = unsafe { &*data_ptr };

        let mut cif_arg_types: Vec<libffi::Type> = Vec::with_capacity(data_ref.arg_types.len());
        for ty in &data_ref.arg_types {
            cif_arg_types.push(ty.libffi_type());
        }

        let cif_return_type: libffi::Type = data_ref.return_type.libffi_type();
        let cif = libffi::Cif::new(cif_arg_types, cif_return_type);

        let closure = libffi::Closure::new(cif, trampoline_handler, data_ref);
        let code_ptr = *closure.code_ptr() as *mut c_void;

        TrampolineState {
            _closure: ManuallyDrop::new(closure),
            code_ptr,
            data,
        }
    }
}

impl TrampolineState {
    /// # Safety
    /// `user_data` must be a valid pointer to a `TrampolineState` allocated via `Box::new`,
    /// or null.
    pub unsafe extern "C" fn destroy(user_data: *mut c_void) {
        if !user_data.is_null() {
            drop(unsafe { Box::from_raw(user_data as *mut TrampolineState) });
        }
    }
}

impl TrampolineData {
    /// # Safety
    /// `args` must be a valid array of `self.arg_types.len()` argument pointers,
    /// each pointing to a value of the corresponding type.
    unsafe fn handle_call(
        &self,
        args: *const *const c_void,
        result: *mut c_void,
    ) -> Option<*mut TrampolineState> {
        let mut values = Vec::with_capacity(self.arg_types.len());

        for (i, ty) in self.arg_types.iter().enumerate() {
            if self.user_data_index == Some(i) {
                continue;
            }

            let arg_ptr = unsafe { *args.add(i) };
            match ty.read_from_raw_ptr(arg_ptr, "trampoline arg") {
                Ok(val) => values.push(val),
                Err(e) => {
                    gtkx_warn!("trampoline: failed to read arg {i}: {e}");
                    values.push(Value::Null);
                }
            }
        }

        let capture_result = !matches!(self.return_type, Type::Void(_));

        let state_ptr = if self.is_oneshot {
            let ptr = self
                .oneshot_state_ptr
                .swap(std::ptr::null_mut(), Ordering::AcqRel);
            if ptr.is_null() { None } else { Some(ptr) }
        } else {
            None
        };

        let js_result = JsDispatcher::global().invoke_and_wait(
            &self.channel,
            &self.js_func,
            values,
            capture_result,
            |result| result,
        );

        if js_result.is_err() {
            gtkx_warn!(
                "trampoline: JS callback threw an exception (return type: {})",
                self.return_type
            );
        }

        self.return_type.write_return_to_raw_ptr(result, &js_result);

        state_ptr
    }
}

unsafe extern "C" fn trampoline_handler(
    _cif: &libffi_low::ffi_cif,
    result: &mut u64,
    args: *const *const c_void,
    data: &TrampolineData,
) {
    let state_ptr = unsafe { data.handle_call(args, result as *mut u64 as *mut c_void) };
    if let Some(ptr) = state_ptr {
        drop(unsafe { Box::from_raw(ptr) });
    }
}
