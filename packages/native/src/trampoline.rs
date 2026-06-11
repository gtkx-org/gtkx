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

use std::ffi::{c_char, c_void};
use std::mem::ManuallyDrop;
use std::sync::Arc;
use std::sync::atomic::{AtomicPtr, Ordering};

use ::libffi::low as libffi_low;
use ::libffi::middle as libffi;
use gtk4::glib;
use napi::JsFunction;

use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;
use crate::types::{FfiEncoder as _, RawPtrCodec as _, Type, str_to_glib_full};
use crate::value::{JsRef, Value};

pub struct TrampolineData {
    pub js_func: Arc<JsRef<JsFunction>>,
    pub arg_types: Vec<Type>,
    pub return_type: Type,
    pub user_data_index: Option<usize>,
    pub is_oneshot: bool,
    pub oneshot_state_ptr: AtomicPtr<TrampolineState>,
    pub retained_string_return: AtomicPtr<c_char>,
}

impl TrampolineData {
    /// Creates trampoline data with empty oneshot-state and retained-return
    /// slots, the starting state of every trampoline.
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
        }
    }
}

impl Drop for TrampolineData {
    fn drop(&mut self) {
        let retained = self
            .retained_string_return
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        if !retained.is_null() {
            // SAFETY: The swap took the one retained duplicate out of the
            // atomic slot, so this is its only release.
            unsafe { glib::ffi::g_free(retained.cast()) };
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
        // SAFETY: Each ManuallyDrop field is dropped exactly once, here;
        // the closure goes first so its handler can never observe dropped
        // data.
        unsafe { ManuallyDrop::drop(&mut self.closure) };
        // SAFETY: Same single-drop ordering as the closure above.
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
        // SAFETY: The data lives in a heap Box whose address is stable for
        // the state's lifetime, and the Drop impl drops the closure before
        // the data, so the closure never outlives this reference's target.
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
            // SAFETY: The caller's contract makes `user_data` a unique
            // boxed TrampolineState handed to the destroy notify exactly
            // once.
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

            // SAFETY: The caller guarantees `args` holds one pointer per
            // declared argument, so index `i` is in bounds.
            let arg_ptr = unsafe { *args.add(i) };
            if let Type::Ref(ref_type) = ty {
                // SAFETY: A Ref argument's slot holds the out-parameter
                // target pointer, readable per the caller's contract.
                let inner_ptr = unsafe { *(arg_ptr as *const *mut c_void) };
                out_cell_indices.push(values.len());
                out_targets.push((inner_ptr, &ref_type.inner_type));
                values.push(seed_ref_cell(inner_ptr, &ref_type.inner_type));
                continue;
            }
            // SAFETY: libffi materialized `arg_ptr` for the argument of
            // type `ty`, so it is valid for that codec's read.
            match unsafe { ty.read_from_raw_ptr(arg_ptr, "trampoline arg") } {
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
        // SAFETY: `result` is the libffi closure return slot, which libffi
        // sizes for the declared return type.
        unsafe { self.return_type.write_return_to_raw_ptr(result, value) };
    }

    /// Writes a transfer-none string return through a per-trampoline retained
    /// duplicate. The C caller only borrows the result, so the duplicate must
    /// outlive the call; it is freed when the next return replaces it or when
    /// the trampoline is destroyed.
    fn write_retained_string_return(&self, result: *mut c_void, value: &Result<Value, ()>) {
        let new_ptr: *mut c_char = match value {
            Ok(Value::String(s)) => str_to_glib_full(s).unwrap_or(std::ptr::null_mut()),
            _ => std::ptr::null_mut(),
        };
        let previous = self.retained_string_return.swap(new_ptr, Ordering::AcqRel);
        if !previous.is_null() {
            // SAFETY: The swap took the one previously retained duplicate
            // out of the atomic slot, so this is its only release.
            unsafe { glib::ffi::g_free(previous.cast()) };
        }
        // SAFETY: `result` is the libffi closure return slot, wide enough
        // for a pointer result.
        unsafe { (result as *mut *mut c_char).write_unaligned(new_ptr) };
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
            // SAFETY: A non-null inout target for a scalar inner type
            // addresses the caller-initialized scalar slot, readable at
            // the codec's width.
            unsafe { inner_type.read_from_raw_ptr(inner_ptr.cast_const(), "inout cell seed") }
                .unwrap_or(Value::Null)
        }
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
pub(crate) fn flush_out_cells(cells: &[(usize, Value)], out_targets: &[(*mut c_void, &Type)]) {
    for ((_, new_value), (ptr, inner_type)) in cells.iter().zip(out_targets.iter()) {
        if ptr.is_null() {
            continue;
        }
        // SAFETY: The non-null target is the caller-provided out-parameter
        // slot for `inner_type`, valid for that codec's write.
        if let Err(e) = unsafe { inner_type.write_value_to_raw_ptr(*ptr, new_value) } {
            NativeErrorReporter::global()
                .report(&e.context("trampoline: failed to write out-parameter"));
        }
    }
}

/// Posts the drop of a consumed one-shot trampoline state onto a `GLib` idle
/// source so it runs after the current handler unwinds.
///
/// The async scope hands its [`TrampolineState`] back from
/// [`TrampolineData::handle_call`] once the JavaScript callback has run.
/// Dropping it inline would free the libffi closure whose handler is still on
/// the stack, returning execution into freed executable memory once the handler
/// returns. The idle source runs on the `GLib` thread after the trampoline stub
/// is no longer live, making the free safe.
/// # Safety
///
/// `state_ptr` must come from `Box::into_raw` and be passed to this function
/// at most once.
unsafe fn defer_oneshot_free(state_ptr: *mut TrampolineState) {
    glib::idle_add_local_once(move || {
        // SAFETY: The caller's contract makes `state_ptr` a unique
        // `Box::into_raw` pointer reaching this idle source exactly once,
        // after the trampoline stub is no longer on the stack.
        drop(unsafe { Box::from_raw(state_ptr) });
    });
}

unsafe extern "C" fn trampoline_handler(
    _cif: &libffi_low::ffi_cif,
    result: &mut u64,
    args: *const *const c_void,
    data: &TrampolineData,
) {
    // SAFETY: libffi invokes this handler with an argument array matching
    // the CIF built from `data.arg_types` and a return slot for its return
    // type, exactly `handle_call`'s contract.
    let state_ptr = unsafe { data.handle_call(args, result as *mut u64 as *mut c_void) };
    if let Some(ptr) = state_ptr {
        // SAFETY: `handle_call` swapped the one-shot state pointer out of
        // its atomic slot, so this is the pointer's only consumer.
        unsafe { defer_oneshot_free(ptr) };
    }
}
