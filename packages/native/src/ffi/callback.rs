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
    Descriptor, FfiDecoder as _, FfiEncoder as _, PointerWriter as _, ReadSource, str_to_glib_full,
};
use crate::ffi::value::{JsRef, Value};
use crate::messaging::Mailbox;
use crate::messaging::error_reporter::ErrorReporter;

pub struct CallbackData {
    pub js_func: Arc<JsRef<JsFunction>>,
    pub arg_descriptors: Vec<Descriptor>,
    pub return_descriptor: Descriptor,
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
        arg_descriptors: Vec<Descriptor>,
        return_descriptor: Descriptor,
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
            // SAFETY: `retained` is non-null (checked) and was produced by `str_to_glib_full` in
            // `write_retained_string_return`, i.e. a `g_malloc`-allocated string this struct owns;
            // the atomic swap took exclusive ownership so `g_free` releases it exactly once.
            unsafe { glib::ffi::g_free(retained.cast()) };
        }
        let container = self
            .retained_container_return
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        if !container.is_null() {
            // SAFETY: `container` is non-null (checked) and was produced by `Box::into_raw` in
            // `write_retained_container_return`, so this struct owns the boxed `StashedValue`; the swap
            // took exclusive ownership so reconstructing and dropping the `Box` frees it once.
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
        // SAFETY: `drop` runs at most once, and these `ManuallyDrop` fields are only ever dropped
        // here, so each is moved out exactly once. The closure is destroyed before its `data`,
        // ensuring no in-flight call into the closure can still borrow the data being freed.
        unsafe { ManuallyDrop::drop(&mut self.closure) };
        // SAFETY: see above — `self.data` is dropped exactly once, after the closure that held a
        // `'static` reference to it has been torn down.
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
        // SAFETY: `data` is a boxed `CallbackData` that this `CallbackState` stores and keeps
        // alive (via `ManuallyDrop`) for as long as the closure exists; the box is never moved, so
        // its heap address is stable. Re-borrowing it as `'static` is sound because the closure and
        // the data are dropped together in `CallbackState::drop`, the closure first.
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
    arg_descriptors: Vec<Descriptor>,
    return_descriptor: Descriptor,
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
    /// `GDestroyNotify`-compatible callback that frees a `CallbackState` boxed for a `Notified`
    /// or `Async` callback.
    ///
    /// # Safety
    ///
    /// `user_data` must be either null or a pointer obtained from `Box::into_raw` for a
    /// `Box<CallbackState>` that has not yet been freed. `GLib` invokes this exactly once when the
    /// associated callback is destroyed, so the state is reclaimed and dropped exactly once.
    pub unsafe extern "C" fn destroy(user_data: *mut c_void) {
        if !user_data.is_null() {
            // SAFETY: `user_data` is non-null (checked) and, per the contract, a live
            // `Box<CallbackState>` raw pointer; reconstructing and dropping the box frees it once.
            drop(unsafe { Box::from_raw(user_data as *mut Self) });
        }
    }
}

impl CallbackData {
    /// # Safety
    ///
    /// Invoked from `closure_entry`, which libffi calls with the C ABI for the CIF built in
    /// `CallbackState::create`. `args` must point to an array of at least `self.arg_descriptors.len()`
    /// argument slots laid out per that CIF, and `result` must point to the CIF's return slot. The
    /// `Descriptor` descriptors in `self.arg_descriptors`/`self.return_descriptor` must match that ABI so each slot
    /// read/write touches a correctly typed location.
    unsafe fn handle_call(
        &self,
        args: *const *const c_void,
        result: *mut c_void,
    ) -> Option<*mut CallbackState> {
        let mut values = Vec::with_capacity(self.arg_descriptors.len());
        let mut out_cell_indices: Vec<usize> = Vec::new();
        let mut out_targets: Vec<(*mut c_void, &Descriptor)> = Vec::new();

        for (i, descriptor) in self.arg_descriptors.iter().enumerate() {
            if self.user_data_index == Some(i) {
                continue;
            }

            // SAFETY: `i` is in `0..self.arg_descriptors.len()`, and per the contract `args` addresses at
            // least that many argument slots, so `args.add(i)` is in bounds and points to the i-th
            // argument pointer.
            let arg_ptr = unsafe { *args.add(i) };
            if let Descriptor::Ref(ref_type) = descriptor {
                // SAFETY: a `Ref` argument is passed as a pointer-to-pointer; `arg_ptr` is the
                // i-th slot which holds that outer pointer, so reading it as `*mut *mut c_void`
                // yields the inner cell pointer the callee can write through.
                let inner_ptr = unsafe { *(arg_ptr as *const *mut c_void) };
                out_cell_indices.push(values.len());
                out_targets.push((inner_ptr, &ref_type.inner_descriptor));
                values.push(seed_ref_cell(inner_ptr, &ref_type.inner_descriptor));
                continue;
            }
            // SAFETY: `arg_ptr` is the i-th argument slot and `descriptor` is the matching descriptor for
            // it (per the CIF/ABI contract), so reading that slot as `descriptor` is well typed.
            match unsafe { descriptor.read(ReadSource::Slot(arg_ptr, "callback arg")) } {
                Ok(val) => values.push(val),
                Err(e) => {
                    ErrorReporter::global()
                        .report(&e.context(format!("callback: failed to read arg {i}")));
                    values.push(Value::Null);
                }
            }
        }

        let capture_result = !matches!(self.return_descriptor, Descriptor::Void(_));

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
        if let Descriptor::String(string_type) = &self.return_descriptor
            && string_type.ownership.is_borrowed()
        {
            self.write_retained_string_return(result, value);
            return;
        }
        if self.return_type_is_borrowed_container() {
            self.write_retained_container_return(result, value);
            return;
        }
        // SAFETY: `result` is the CIF return slot supplied by libffi for this callback, and
        // `self.return_descriptor` is the descriptor that matches that slot's ABI, so writing the encoded
        // return value through it targets a correctly typed, writable location.
        unsafe {
            self.return_descriptor
                .write_return_to_pointer(result, value);
        };
    }

    fn return_type_is_borrowed_container(&self) -> bool {
        match &self.return_descriptor {
            Descriptor::Array(array_type) => array_type.ownership.is_borrowed(),
            Descriptor::HashTable(hash_type) => hash_type.ownership.is_borrowed(),
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
            // SAFETY: `previous` is non-null (checked) and is the value this struct previously
            // stored via `Box::into_raw`; the swap transferred ownership of it to us, so
            // reconstructing and dropping the `Box` frees the prior container exactly once.
            drop(unsafe { Box::from_raw(previous) });
        }
        // SAFETY: `result` is the CIF return slot for a pointer-returning container; writing the
        // container pointer there with `write_unaligned` stores it without an alignment requirement.
        unsafe { (result as *mut *mut c_void).write_unaligned(ptr) };
    }

    fn write_retained_string_return(&self, result: *mut c_void, value: &Result<Value, ()>) {
        let new_ptr: *mut c_char = match value {
            Ok(Value::String(s)) => str_to_glib_full(s).unwrap_or(std::ptr::null_mut()),
            _ => std::ptr::null_mut(),
        };
        let previous = self.retained_string_return.swap(new_ptr, Ordering::AcqRel);
        if !previous.is_null() {
            // SAFETY: `previous` is non-null (checked) and is the `g_malloc`-allocated string this
            // struct previously stored via `str_to_glib_full`; the swap transferred ownership to us,
            // so `g_free` releases the prior string exactly once.
            unsafe { glib::ffi::g_free(previous.cast()) };
        }
        // SAFETY: `result` is the CIF return slot for a `char*`-returning callback; writing the
        // new string pointer there with `write_unaligned` stores it without an alignment requirement.
        unsafe { (result as *mut *mut c_char).write_unaligned(new_ptr) };
    }
}

pub(crate) fn seed_ref_cell(inner_ptr: *mut c_void, inner_descriptor: &Descriptor) -> Value {
    if inner_ptr.is_null() {
        return Value::Null;
    }
    match inner_descriptor {
        Descriptor::Integer(_)
        | Descriptor::BigInt(_)
        | Descriptor::Float(_)
        | Descriptor::EnumFlags(_)
        | Descriptor::Boolean(_)
        | Descriptor::Unichar(_) => {
            // SAFETY: `inner_ptr` is non-null (checked above) and points to the inout cell for a
            // scalar `inner_descriptor` (the match restricts this branch to fixed-size scalar kinds), so
            // reading that slot as `inner_descriptor` reads a correctly typed, in-bounds location.
            unsafe { inner_descriptor.read(ReadSource::Slot(inner_ptr.cast_const(), "inout cell seed")) }
                .unwrap_or(Value::Null)
        }
        _ => Value::Null,
    }
}

pub(crate) fn flush_out_cells(
    cells: &[(usize, Value)],
    out_targets: &[(*mut c_void, &Descriptor)],
) {
    for ((_, new_value), (ptr, inner_descriptor)) in cells.iter().zip(out_targets.iter()) {
        if ptr.is_null() {
            continue;
        }
        // SAFETY: `ptr` is non-null (checked) and is the inout cell pointer captured in
        // `handle_call` for this `inner_descriptor`; the cell was supplied by the C caller for the
        // matching `Ref` argument, so writing `new_value` back through `inner_descriptor` targets a
        // correctly typed, writable location.
        if let Err(e) = unsafe { inner_descriptor.write_value_to_pointer(*ptr, new_value) } {
            ErrorReporter::global().report(&e.context("callback: failed to write out-parameter"));
        }
    }
}

/// Schedules a one-shot callback's `CallbackState` to be freed on the next main-loop idle.
///
/// # Safety
///
/// `state_ptr` must be a pointer obtained from `Box::into_raw` for a `Box<CallbackState>` that
/// has not yet been freed and is no longer in use; deferring the free to an idle ensures the
/// closure is not still executing when the box is dropped. It is reclaimed exactly once.
unsafe fn defer_oneshot_free(state_ptr: *mut CallbackState) {
    glib::idle_add_local_once(move || {
        // SAFETY: `state_ptr` is the live `Box<CallbackState>` raw pointer from the contract;
        // by the time this idle runs the closure invocation has returned, so reconstructing and
        // dropping the box frees the state exactly once.
        drop(unsafe { Box::from_raw(state_ptr) });
    });
}

/// libffi closure entry point for a JS-backed callback.
///
/// # Safety
///
/// Called by libffi through the closure created in `CallbackState::create`. `result` is the
/// CIF's return slot and `args` points to the CIF's argument slots, both laid out per that CIF;
/// `data` is the `'static` borrow of the `CallbackData` the closure was built with. The slot
/// layout must match `data`'s argument/return descriptors.
unsafe extern "C" fn closure_entry(
    _cif: &libffi_low::ffi_cif,
    result: &mut u64,
    args: *const *const c_void,
    data: &CallbackData,
) {
    // SAFETY: `args`/`result` satisfy `handle_call`'s contract (CIF-laid-out argument and return
    // slots matching `data`'s descriptors); `result` is reinterpreted as the raw return slot.
    let state_ptr = unsafe { data.handle_call(args, result as *mut u64 as *mut c_void) };
    if let Some(ptr) = state_ptr {
        // SAFETY: `ptr` is the one-shot state's `Box::into_raw` pointer returned by `handle_call`,
        // still live and no longer needed, so deferring its free upholds `defer_oneshot_free`.
        unsafe { defer_oneshot_free(ptr) };
    }
}
