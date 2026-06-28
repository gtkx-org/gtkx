#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::{c_char, c_void};
use std::mem::ManuallyDrop;
use std::sync::Arc;
use std::sync::atomic::{AtomicPtr, Ordering};

use ::libffi::low as libffi_low;
use ::libffi::middle as libffi;
use napi::JsFunction;

use crate::ffi::StashedValue;
use crate::ffi::descriptor::{
    Codec, FfiDecoder as _, FfiEncoder as _, PointerWriter as _, ReadSource, str_to_glib_full,
};
use crate::ffi::value::{JsRef, Value};
use crate::messaging::Mailbox;
use crate::messaging::error_reporter::ErrorReporter;

pub struct CallbackData {
    pub js_func: Arc<JsRef<JsFunction>>,
    pub arg_descriptors: Vec<Codec>,
    pub return_descriptor: Codec,
    pub user_data_index: Option<usize>,
    pub is_oneshot: bool,
    pub oneshot_state_ptr: AtomicPtr<CallbackState>,
    pub retained_string_return: AtomicPtr<c_char>,
    pub retained_container_return: AtomicPtr<StashedValue>,
}

impl CallbackData {
    #[must_use]
    pub fn new(
        js_func: Arc<JsRef<JsFunction>>,
        arg_descriptors: Vec<Codec>,
        return_descriptor: Codec,
        user_data_index: Option<usize>,
        is_oneshot: bool,
    ) -> Self {
        Self {
            js_func,
            arg_descriptors,
            return_descriptor,
            user_data_index,
            is_oneshot,
            oneshot_state_ptr: AtomicPtr::new(std::ptr::null_mut()),
            retained_string_return: AtomicPtr::new(std::ptr::null_mut()),
            retained_container_return: AtomicPtr::new(std::ptr::null_mut()),
        }
    }
}

impl Drop for CallbackData {
    fn drop(&mut self) {
        let retained = self
            .retained_string_return
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        if !retained.is_null() {
            unsafe { glib::ffi::g_free(retained.cast()) };
        }
        let container = self
            .retained_container_return
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        if !container.is_null() {
            drop(unsafe { Box::from_raw(container) });
        }
    }
}

impl std::fmt::Debug for CallbackData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CallbackData")
            .field("arg_descriptors", &self.arg_descriptors)
            .field("return_descriptor", &self.return_descriptor)
            .field("user_data_index", &self.user_data_index)
            .field("is_oneshot", &self.is_oneshot)
            .finish_non_exhaustive()
    }
}

pub struct CallbackState {
    closure: ManuallyDrop<libffi::Closure<'static>>,
    pub code_ptr: *mut c_void,
    data: ManuallyDrop<Box<CallbackData>>,
}

impl std::fmt::Debug for CallbackState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CallbackState")
            .field("code_ptr", &self.code_ptr)
            .finish_non_exhaustive()
    }
}

impl Drop for CallbackState {
    fn drop(&mut self) {
        unsafe { ManuallyDrop::drop(&mut self.closure) };
        unsafe { ManuallyDrop::drop(&mut self.data) };
    }
}

impl CallbackState {
    #[must_use]
    pub fn data_ref(&self) -> &CallbackData {
        &self.data
    }

    pub fn create(data: CallbackData) -> Self {
        let data = ManuallyDrop::new(Box::new(data));
        let data_ptr: *const CallbackData = &**data;
        let data_ref: &'static CallbackData = unsafe { &*data_ptr };

        let mut cif_arg_types: Vec<libffi::Type> =
            Vec::with_capacity(data_ref.arg_descriptors.len());
        for descriptor in &data_ref.arg_descriptors {
            cif_arg_types.push(descriptor.libffi_type());
        }

        let cif_return_type: libffi::Type = data_ref.return_descriptor.libffi_type();
        let cif = libffi::Cif::new(cif_arg_types, cif_return_type);

        let closure = libffi::Closure::new(cif, closure_entry, data_ref);
        let code_ptr = *closure.code_ptr() as *mut c_void;

        Self {
            closure: ManuallyDrop::new(closure),
            code_ptr,
            data,
        }
    }
}

#[must_use]
pub fn build_trampoline(
    js_func: Arc<JsRef<JsFunction>>,
    arg_descriptors: Vec<Codec>,
    return_descriptor: Codec,
    user_data_index: Option<usize>,
    is_oneshot: bool,
) -> (*mut c_void, Box<CallbackState>) {
    let data = CallbackData::new(
        js_func,
        arg_descriptors,
        return_descriptor,
        user_data_index,
        is_oneshot,
    );
    let state = Box::new(CallbackState::create(data));
    let code_ptr = state.code_ptr;
    (code_ptr, state)
}

impl CallbackState {
    pub unsafe extern "C" fn destroy(user_data: *mut c_void) {
        if !user_data.is_null() {
            drop(unsafe { Box::from_raw(user_data as *mut Self) });
        }
    }
}

impl CallbackData {
    unsafe fn handle_call(
        &self,
        args: *const *const c_void,
        result: *mut c_void,
    ) -> Option<*mut CallbackState> {
        let mut values = Vec::with_capacity(self.arg_descriptors.len());
        let mut out_cell_indices: Vec<usize> = Vec::new();
        let mut out_targets: Vec<(*mut c_void, &Codec)> = Vec::new();

        for (i, descriptor) in self.arg_descriptors.iter().enumerate() {
            if self.user_data_index == Some(i) {
                continue;
            }

            let arg_ptr = unsafe { *args.add(i) };
            if let Codec::Ref(ref_type) = descriptor {
                let inner_ptr = unsafe { *(arg_ptr as *const *mut c_void) };
                out_cell_indices.push(values.len());
                out_targets.push((inner_ptr, &ref_type.inner_descriptor));
                values.push(seed_ref_cell(inner_ptr, &ref_type.inner_descriptor));
                continue;
            }
            match unsafe { descriptor.read(ReadSource::Slot(arg_ptr, "callback arg")) } {
                Ok(val) => values.push(val),
                Err(e) => {
                    ErrorReporter::global()
                        .report(&e.context(format!("callback: failed to read arg {i}")));
                    values.push(Value::Null);
                }
            }
        }

        let capture_result = !matches!(self.return_descriptor, Codec::Void(_));

        let state_ptr = if self.is_oneshot {
            let ptr = self
                .oneshot_state_ptr
                .swap(std::ptr::null_mut(), Ordering::AcqRel);
            if ptr.is_null() { None } else { Some(ptr) }
        } else {
            None
        };

        let js_result = Mailbox::global().invoke_node_and_wait_with_cells(
            &self.js_func,
            values,
            capture_result,
            out_cell_indices,
        );

        match js_result {
            Ok((value, cells)) => {
                flush_out_cells(&cells, &out_targets);
                self.write_return(result, &Ok(value));
            }
            Err(ref e) => {
                ErrorReporter::global().report(&anyhow::anyhow!(
                    "callback: JS callback error (return type: {}): {e:#}",
                    self.return_descriptor
                ));
                self.write_return(result, &Err(()));
            }
        }

        state_ptr
    }

    fn write_return(&self, result: *mut c_void, value: &Result<Value, ()>) {
        if let Codec::String(string_type) = &self.return_descriptor
            && string_type.ownership.is_borrowed()
        {
            self.write_retained_string_return(result, value);
            return;
        }
        if self.return_type_is_borrowed_container() {
            self.write_retained_container_return(result, value);
            return;
        }
        unsafe {
            self.return_descriptor
                .write_return_to_pointer(result, value);
        };
    }

    fn return_type_is_borrowed_container(&self) -> bool {
        match &self.return_descriptor {
            Codec::Array(array_type) => array_type.ownership.is_borrowed(),
            Codec::HashTable(hash_type) => hash_type.ownership.is_borrowed(),
            _ => false,
        }
    }

    fn write_retained_container_return(&self, result: *mut c_void, value: &Result<Value, ()>) {
        let built = match value {
            Ok(value) => self.return_descriptor.encode(value).ok(),
            Err(()) => None,
        };
        let ptr = built
            .as_ref()
            .and_then(|stashed_value| stashed_value.as_ptr("container return").ok())
            .unwrap_or(std::ptr::null_mut());
        let new_ptr = built.map_or(std::ptr::null_mut(), |stashed_value| {
            Box::into_raw(Box::new(stashed_value))
        });
        let previous = self
            .retained_container_return
            .swap(new_ptr, Ordering::AcqRel);
        if !previous.is_null() {
            drop(unsafe { Box::from_raw(previous) });
        }
        unsafe { (result as *mut *mut c_void).write_unaligned(ptr) };
    }

    fn write_retained_string_return(&self, result: *mut c_void, value: &Result<Value, ()>) {
        let new_ptr: *mut c_char = match value {
            Ok(Value::String(s)) => str_to_glib_full(s).unwrap_or(std::ptr::null_mut()),
            _ => std::ptr::null_mut(),
        };
        let previous = self.retained_string_return.swap(new_ptr, Ordering::AcqRel);
        if !previous.is_null() {
            unsafe { glib::ffi::g_free(previous.cast()) };
        }
        unsafe { (result as *mut *mut c_char).write_unaligned(new_ptr) };
    }
}

pub(crate) fn seed_ref_cell(inner_ptr: *mut c_void, inner_descriptor: &Codec) -> Value {
    if inner_ptr.is_null() {
        return Value::Null;
    }
    match inner_descriptor {
        Codec::Integer(_)
        | Codec::BigInt(_)
        | Codec::Float(_)
        | Codec::EnumFlags(_)
        | Codec::Boolean(_)
        | Codec::Unichar(_) => unsafe {
            inner_descriptor.read(ReadSource::Slot(inner_ptr.cast_const(), "inout cell seed"))
        }
        .unwrap_or(Value::Null),
        _ => Value::Null,
    }
}

pub(crate) fn flush_out_cells(cells: &[(usize, Value)], out_targets: &[(*mut c_void, &Codec)]) {
    for ((_, new_value), (ptr, inner_descriptor)) in cells.iter().zip(out_targets.iter()) {
        if ptr.is_null() {
            continue;
        }
        if let Err(e) = unsafe { inner_descriptor.write_value_to_pointer(*ptr, new_value) } {
            ErrorReporter::global().report(&e.context("callback: failed to write out-parameter"));
        }
    }
}

unsafe fn defer_oneshot_free(state_ptr: *mut CallbackState) {
    glib::idle_add_local_once(move || {
        drop(unsafe { Box::from_raw(state_ptr) });
    });
}

unsafe extern "C" fn closure_entry(
    _cif: &libffi_low::ffi_cif,
    result: &mut u64,
    args: *const *const c_void,
    data: &CallbackData,
) {
    let state_ptr = unsafe { data.handle_call(args, result as *mut u64 as *mut c_void) };
    if let Some(ptr) = state_ptr {
        unsafe { defer_oneshot_free(ptr) };
    }
}
