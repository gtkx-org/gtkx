#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::{c_char, c_void};
use std::mem::ManuallyDrop;
use std::sync::Arc;
use std::sync::atomic::{AtomicPtr, Ordering};

use ::libffi::low as libffi_low;
use ::libffi::middle as libffi;
use napi::JsFunction;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;
use crate::ffi::FfiValue;
use crate::types::{
    FfiDecoder as _, FfiEncoder as _, RawPtrCodec as _, ReadSource, Type, str_to_glib_full,
};
use crate::value::{JsRef, Value};

pub struct TrampolineData {
    pub js_func: Arc<JsRef<JsFunction>>,
    pub arg_types: Vec<Type>,
    pub return_type: Type,
    pub user_data_index: Option<usize>,
    pub is_oneshot: bool,
    pub oneshot_state_ptr: AtomicPtr<TrampolineState>,
    pub retained_string_return: AtomicPtr<c_char>,
    pub retained_container_return: AtomicPtr<FfiValue>,
}

impl TrampolineData {
    #[must_use]
    pub fn new(
        js_func: Arc<JsRef<JsFunction>>,
        arg_types: Vec<Type>,
        return_type: Type,
        user_data_index: Option<usize>,
        is_oneshot: bool,
    ) -> Self {
        Self {
            js_func,
            arg_types,
            return_type,
            user_data_index,
            is_oneshot,
            oneshot_state_ptr: AtomicPtr::new(std::ptr::null_mut()),
            retained_string_return: AtomicPtr::new(std::ptr::null_mut()),
            retained_container_return: AtomicPtr::new(std::ptr::null_mut()),
        }
    }
}

impl Drop for TrampolineData {
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

impl std::fmt::Debug for TrampolineData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TrampolineData")
            .field("arg_types", &self.arg_types)
            .field("return_type", &self.return_type)
            .field("user_data_index", &self.user_data_index)
            .field("is_oneshot", &self.is_oneshot)
            .finish_non_exhaustive()
    }
}

pub struct TrampolineState {
    closure: ManuallyDrop<libffi::Closure<'static>>,
    pub code_ptr: *mut c_void,
    data: ManuallyDrop<Box<TrampolineData>>,
}

impl std::fmt::Debug for TrampolineState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TrampolineState")
            .field("code_ptr", &self.code_ptr)
            .finish_non_exhaustive()
    }
}

impl Drop for TrampolineState {
    fn drop(&mut self) {
        unsafe { ManuallyDrop::drop(&mut self.closure) };
        unsafe { ManuallyDrop::drop(&mut self.data) };
    }
}

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
    arg_types: Vec<Type>,
    return_type: Type,
    user_data_index: Option<usize>,
    is_oneshot: bool,
) -> (*mut c_void, Box<TrampolineState>) {
    let data = TrampolineData::new(js_func, arg_types, return_type, user_data_index, is_oneshot);
    let state = Box::new(TrampolineState::create(data));
    let code_ptr = state.code_ptr;
    (code_ptr, state)
}

impl TrampolineState {
    pub unsafe extern "C" fn destroy(user_data: *mut c_void) {
        if !user_data.is_null() {
            drop(unsafe { Box::from_raw(user_data as *mut Self) });
        }
    }
}

impl TrampolineData {
    unsafe fn handle_call(
        &self,
        args: *const *const c_void,
        result: *mut c_void,
    ) -> Option<*mut TrampolineState> {
        let mut values = Vec::with_capacity(self.arg_types.len());
        let mut out_cell_indices: Vec<usize> = Vec::new();
        let mut out_targets: Vec<(*mut c_void, &Type)> = Vec::new();

        for (i, ty) in self.arg_types.iter().enumerate() {
            if self.user_data_index == Some(i) {
                continue;
            }

            let arg_ptr = unsafe { *args.add(i) };
            if let Type::Ref(ref_type) = ty {
                let inner_ptr = unsafe { *(arg_ptr as *const *mut c_void) };
                out_cell_indices.push(values.len());
                out_targets.push((inner_ptr, &ref_type.inner_type));
                values.push(seed_ref_cell(inner_ptr, &ref_type.inner_type));
                continue;
            }
            match unsafe { ty.read(ReadSource::Slot(arg_ptr, "trampoline arg")) } {
                Ok(val) => values.push(val),
                Err(e) => {
                    NativeErrorReporter::global()
                        .report(&e.context(format!("trampoline: failed to read arg {i}")));
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
                NativeErrorReporter::global().report(&anyhow::anyhow!(
                    "trampoline: JS callback error (return type: {}): {e:#}",
                    self.return_type
                ));
                self.write_return(result, &Err(()));
            }
        }

        state_ptr
    }

    fn write_return(&self, result: *mut c_void, value: &Result<Value, ()>) {
        if let Type::String(string_type) = &self.return_type
            && string_type.ownership.is_borrowed()
        {
            self.write_retained_string_return(result, value);
            return;
        }
        if self.return_type_is_borrowed_container() {
            self.write_retained_container_return(result, value);
            return;
        }
        unsafe { self.return_type.write_return_to_raw_ptr(result, value) };
    }

    fn return_type_is_borrowed_container(&self) -> bool {
        match &self.return_type {
            Type::Array(array_type) => array_type.ownership.is_borrowed(),
            Type::HashTable(hash_type) => hash_type.ownership.is_borrowed(),
            _ => false,
        }
    }

    fn write_retained_container_return(&self, result: *mut c_void, value: &Result<Value, ()>) {
        let built = match value {
            Ok(value) => self.return_type.encode(value).ok(),
            Err(()) => None,
        };
        let ptr = built
            .as_ref()
            .and_then(|ffi_value| ffi_value.as_ptr("container return").ok())
            .unwrap_or(std::ptr::null_mut());
        let new_ptr = built.map_or(std::ptr::null_mut(), |ffi_value| {
            Box::into_raw(Box::new(ffi_value))
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

pub(crate) fn seed_ref_cell(inner_ptr: *mut c_void, inner_type: &Type) -> Value {
    if inner_ptr.is_null() {
        return Value::Null;
    }
    match inner_type {
        Type::Integer(_)
        | Type::BigInt(_)
        | Type::Float(_)
        | Type::Tagged(_)
        | Type::Boolean(_)
        | Type::Unichar(_) => {
            unsafe { inner_type.read(ReadSource::Slot(inner_ptr.cast_const(), "inout cell seed")) }
                .unwrap_or(Value::Null)
        }
        _ => Value::Null,
    }
}

pub(crate) fn flush_out_cells(cells: &[(usize, Value)], out_targets: &[(*mut c_void, &Type)]) {
    for ((_, new_value), (ptr, inner_type)) in cells.iter().zip(out_targets.iter()) {
        if ptr.is_null() {
            continue;
        }
        if let Err(e) = unsafe { inner_type.write_value_to_raw_ptr(*ptr, new_value) } {
            NativeErrorReporter::global()
                .report(&e.context("trampoline: failed to write out-parameter"));
        }
    }
}

unsafe fn defer_oneshot_free(state_ptr: *mut TrampolineState) {
    glib::idle_add_local_once(move || {
        drop(unsafe { Box::from_raw(state_ptr) });
    });
}

unsafe extern "C" fn trampoline_handler(
    _cif: &libffi_low::ffi_cif,
    result: &mut u64,
    args: *const *const c_void,
    data: &TrampolineData,
) {
    let state_ptr = unsafe { data.handle_call(args, result as *mut u64 as *mut c_void) };
    if let Some(ptr) = state_ptr {
        unsafe { defer_oneshot_free(ptr) };
    }
}
