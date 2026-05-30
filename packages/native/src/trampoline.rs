//! libffi closures that route native callbacks into JavaScript.
//!
//! A [`TrampolineState`] owns a libffi closure whose handler reads the native
//! arguments, invokes the captured JS function through [`Mailbox`], and writes
//! the JS return value back into the native result slot.
//!
//! Every type here holds a [`JsRef`] to a JavaScript function and dispatches
//! into the JavaScript runtime, so the module is excluded from coverage
//! instrumentation — a `cargo test` process has no runtime to invoke.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::c_void;
use std::mem::ManuallyDrop;
use std::sync::Arc;
use std::sync::atomic::{AtomicPtr, Ordering};

use ::libffi::low as libffi_low;
use ::libffi::middle as libffi;
use napi::JsFunction;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;
use crate::types::{FfiEncoder as _, RawPtrCodec as _, Type};
use crate::value::{JsRef, Value};

pub struct TrampolineData {
    pub js_func: Arc<JsRef<JsFunction>>,
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

impl TrampolineState {
    /// # Safety
    /// `user_data` must be a valid pointer to a `TrampolineState` allocated via `Box::new`,
    /// or null.
    pub unsafe extern "C" fn destroy(user_data: *mut c_void) {
        if !user_data.is_null() {
            drop(unsafe { Box::from_raw(user_data as *mut Self) });
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
            match ty.read_from_raw_ptr(arg_ptr, "trampoline arg") {
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
                self.return_type.write_return_to_raw_ptr(result, &Ok(value));
            }
            Err(ref e) => {
                NativeErrorReporter::global().report(&anyhow::anyhow!(
                    "trampoline: JS callback error (return type: {}): {e:#}",
                    self.return_type
                ));
                self.return_type.write_return_to_raw_ptr(result, &Err(()));
            }
        }

        state_ptr
    }
}

/// Seeds a trampoline out/inout cell with the value currently behind its C
/// pointer.
///
/// Scalar inner types (integer, float, enum/flags, boolean, unichar) are read
/// directly so an `inout` parameter exposes its incoming value to the JS
/// handler; the codegen wrapper passes that value in and writes the handler's
/// result back. Pointer-typed inner types are left `Null`: a pure-out slot may
/// be uninitialized, so dereferencing it to read a pointer would be unsound,
/// and the handler overwrites the cell regardless.
fn seed_ref_cell(inner_ptr: *mut c_void, inner_type: &Type) -> Value {
    if inner_ptr.is_null() {
        return Value::Null;
    }
    match inner_type {
        Type::Integer(_)
        | Type::Float(_)
        | Type::Tagged(_)
        | Type::Boolean(_)
        | Type::Unichar(_) => inner_type
            .read_from_raw_ptr(inner_ptr.cast_const(), "inout cell seed")
            .unwrap_or(Value::Null),
        _ => Value::Null,
    }
}

/// Writes each `{ value }` cell the JS handler populated back through its `Ref`
/// out-parameter's C pointer. The codegen-side `invoke` closure owns the
/// tuple-to-cell mapping; native only flushes the cells, so its behaviour stays
/// a generic out-parameter write-back independent of any signal-specific return
/// shape.
///
/// `cells` arrive in the same order as the `Ref` arguments were collected, so
/// they pair positionally with `out_targets`; null target pointers are skipped.
fn flush_out_cells(cells: &[(usize, Value)], out_targets: &[(*mut c_void, &Type)]) {
    for ((_, new_value), (ptr, inner_type)) in cells.iter().zip(out_targets.iter()) {
        if ptr.is_null() {
            continue;
        }
        if let Err(e) = inner_type.write_value_to_raw_ptr(*ptr, new_value) {
            NativeErrorReporter::global()
                .report(&e.context("trampoline: failed to write out-parameter"));
        }
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
