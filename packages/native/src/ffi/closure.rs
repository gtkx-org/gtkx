use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::ffi::{CString, c_char, c_void};

use ::libffi::{low as libffi_low, middle as libffi};
use napi::Env;
use napi::bindgen_prelude::{
    Function, JsObjectValue, JsValue, JsValuesTupleIntoVec, Object, Unknown,
};

use crate::ffi::Stash;
use crate::ffi::codec::{
    Codec, Decoder as _, Encoder as _, PtrWriter as _, ReadCtx, SlotInit, str_to_glib_full,
};
use crate::host::error_reporter::{self, ReportErr};
use crate::host::node_env;
use crate::host::panic_handler::guard_ffi_boundary;
use crate::value::{self, ClosureHandle};

struct CallbackArgs(Vec<napi::sys::napi_value>);

impl JsValuesTupleIntoVec for CallbackArgs {
    fn into_vec(self, _env: napi::sys::napi_env) -> napi::Result<Vec<napi::sys::napi_value>> {
        Ok(self.0)
    }
}

fn wrap_ref<'e>(env: &'e Env, value: Unknown<'e>) -> anyhow::Result<Unknown<'e>> {
    let mut ref_obj: Object<'e> = Object::new(env)?;
    ref_obj.set_named_property("value", value)?;
    Ok(ref_obj.to_unknown())
}

enum CallbackError {
    Thrown(napi::Error),
    Infrastructure(anyhow::Error),
}

fn call_js_function<'e>(
    env: &'e Env,
    callback: &ClosureHandle,
    js_args: &[Unknown<'e>],
) -> Result<Unknown<'e>, CallbackError> {
    let raw_args: Vec<_> = js_args.iter().map(JsValue::raw).collect();
    let function: Function<'_, CallbackArgs, Unknown<'_>> = callback.get(env).map_err(|e| {
        CallbackError::Infrastructure(anyhow::anyhow!("retrieving callback function: {e}"))
    })?;
    function
        .call(CallbackArgs(raw_args))
        .map_err(CallbackError::Thrown)
}

pub struct ClosureData {
    pub js_fn: ClosureHandle,
    pub arg_codecs: Vec<Codec>,
    pub return_codec: Codec,
    pub user_data_index: Option<usize>,
    pub is_oneshot: bool,
    pub state_ptr: Cell<*mut ClosureState>,
    pub oneshot_fired: Cell<bool>,
    in_flight: Cell<u32>,
    pending_destroy: Cell<bool>,
    retained_strings: RefCell<HashMap<CString, *mut c_char>>,
    retained_containers: RefCell<Vec<Stash>>,
    retained_transfers: RefCell<Vec<crate::ffi::PendingTransfer>>,
}

impl ClosureData {
    #[must_use]
    pub fn new(
        js_fn: ClosureHandle,
        arg_codecs: Vec<Codec>,
        return_codec: Codec,
        user_data_index: Option<usize>,
        is_oneshot: bool,
    ) -> Self {
        Self {
            js_fn,
            arg_codecs,
            return_codec,
            user_data_index,
            is_oneshot,
            state_ptr: Cell::new(std::ptr::null_mut()),
            oneshot_fired: Cell::new(false),
            in_flight: Cell::new(0),
            pending_destroy: Cell::new(false),
            retained_strings: RefCell::new(HashMap::new()),
            retained_containers: RefCell::new(Vec::new()),
            retained_transfers: RefCell::new(Vec::new()),
        }
    }
}

impl Drop for ClosureData {
    fn drop(&mut self) {
        for (_, ptr) in self.retained_strings.get_mut().drain() {
            unsafe { glib::ffi::g_free(ptr.cast()) };
        }
        for transfer in self.retained_transfers.get_mut().drain(..) {
            transfer.release_now();
        }
    }
}

impl std::fmt::Debug for ClosureData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ClosureData")
            .field("arg_codecs", &self.arg_codecs)
            .field("return_codec", &self.return_codec)
            .field("user_data_index", &self.user_data_index)
            .field("is_oneshot", &self.is_oneshot)
            .finish_non_exhaustive()
    }
}

pub struct ClosureState {
    closure: std::mem::ManuallyDrop<libffi::Closure<'static>>,
    pub code_ptr: *mut c_void,
    data: *mut ClosureData,
}

impl std::fmt::Debug for ClosureState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ClosureState")
            .field("code_ptr", &self.code_ptr)
            .finish_non_exhaustive()
    }
}

impl Drop for ClosureState {
    fn drop(&mut self) {
        unsafe { std::mem::ManuallyDrop::drop(&mut self.closure) };
        drop(unsafe { Box::from_raw(self.data) });
    }
}

impl ClosureState {
    #[must_use]
    pub fn data_ref(&self) -> &ClosureData {
        unsafe { &*self.data }
    }

    pub fn new(data: ClosureData) -> Self {
        let data = Box::into_raw(Box::new(data));
        let data_ref: &'static ClosureData = unsafe { &*data };

        let mut cif_arg_types: Vec<libffi::Type> = Vec::with_capacity(data_ref.arg_codecs.len());
        for codec in &data_ref.arg_codecs {
            cif_arg_types.push(codec.libffi_type());
        }

        let cif_return_type: libffi::Type = data_ref.return_codec.libffi_type();
        let cif = libffi::Cif::new(cif_arg_types, cif_return_type);

        let closure = libffi::Closure::new(cif, closure_entry, data_ref);
        let code_ptr = *closure.code_ptr() as *mut c_void;

        Self {
            closure: std::mem::ManuallyDrop::new(closure),
            code_ptr,
            data,
        }
    }

    #[must_use]
    pub fn boxed(
        js_fn: ClosureHandle,
        arg_codecs: Vec<Codec>,
        return_codec: Codec,
        user_data_index: Option<usize>,
        is_oneshot: bool,
    ) -> Box<Self> {
        let data = ClosureData::new(js_fn, arg_codecs, return_codec, user_data_index, is_oneshot);
        Box::new(Self::new(data))
    }
}

impl ClosureState {
    /// # Safety
    ///
    /// `user_data` must be a pointer obtained from `Box::into_raw` on a `Box<ClosureState>` (which
    /// is what `ClosureState::boxed` produces) and must still be live. This takes ownership of that
    /// box and frees it, along with the `ClosureData` and the libffi closure it owns, so the caller
    /// must not use `user_data`, the closure's code pointer, or any trampoline installed from it
    /// afterwards, and must invoke this at most once per pointer. Invoking it from inside the
    /// callback itself is allowed: the release is then deferred until the invocation returns. When
    /// called off the thread the Node environment was installed on, the drop is deferred onto that
    /// thread, so the pointer must stay valid until it runs.
    pub unsafe extern "C" fn destroy(user_data: *mut c_void) {
        guard_ffi_boundary("callback destroy notify", || {
            let state_ptr = user_data.cast::<Self>();
            if !state_ptr.is_null() && unsafe { (*state_ptr).data_ref() }.defer_destroy() {
                return;
            }

            if node_env::is_installed_on_current_thread() {
                drop(unsafe { Box::from_raw(state_ptr) });
                return;
            }

            let state_address = user_data as usize;
            node_env::invoke_on_install_thread("callback destroy notify", move || {
                drop(unsafe { Box::from_raw(state_address as *mut Self) });
            });
        });
    }
}

struct ClosureArgs<'e> {
    js_args: Vec<Unknown<'e>>,
    ref_slots: Vec<RefSlot<'e>>,
}

struct RefSlot<'e> {
    obj: Unknown<'e>,
    inner_ptr: *mut c_void,
    inner_codec: &'e Codec,
    init: SlotInit,
}

struct InFlightGuard<'a>(&'a ClosureData);

impl<'a> InFlightGuard<'a> {
    fn enter(data: &'a ClosureData) -> Self {
        data.in_flight.set(data.in_flight.get() + 1);
        Self(data)
    }
}

impl Drop for InFlightGuard<'_> {
    fn drop(&mut self) {
        self.0
            .in_flight
            .set(self.0.in_flight.get().saturating_sub(1));
    }
}

impl ClosureData {
    fn defer_destroy(&self) -> bool {
        if self.in_flight.get() == 0 {
            return false;
        }
        self.pending_destroy.set(true);
        true
    }

    fn release_after_call(&self, oneshot: Option<*mut ClosureState>) -> Option<*mut ClosureState> {
        if self.in_flight.get() != 0 {
            return oneshot;
        }
        if !self.pending_destroy.replace(false) || oneshot.is_some() {
            return oneshot;
        }
        let ptr = self.state_ptr.get();

        (!ptr.is_null()).then_some(ptr)
    }

    fn take_oneshot_state(&self) -> Option<*mut ClosureState> {
        if !self.is_oneshot || self.oneshot_fired.replace(true) {
            return None;
        }
        let ptr = self.state_ptr.get();

        (!ptr.is_null()).then_some(ptr)
    }

    unsafe fn sibling_stashes(&self, args: *const *const c_void) -> Vec<Stash> {
        self.arg_codecs
            .iter()
            .enumerate()
            .map(|(i, codec)| {
                let arg_ptr = unsafe { *args.add(i) };
                match codec {
                    Codec::Integer(kind) => {
                        kind.to_stash(unsafe { kind.read_ptr(arg_ptr.cast::<u8>()) })
                    }
                    _ => Stash::Void,
                }
            })
            .collect()
    }

    unsafe fn read_arg<'e>(
        &'e self,
        env: &'e Env,
        codec: &'e Codec,
        arg_ptr: *const c_void,
        siblings: &[Stash],
    ) -> anyhow::Result<Unknown<'e>> {
        if !matches!(codec, Codec::Array(_)) {
            return unsafe {
                codec.read(
                    env,
                    ReadCtx::slot(arg_ptr, "callback arg").with_transfer(codec.transfer()),
                )
            };
        }
        let value_ptr = unsafe { arg_ptr.cast::<*mut c_void>().read_unaligned() };

        codec.decode_with_context(env, &Stash::Ptr(value_ptr), siblings, &self.arg_codecs)
    }

    unsafe fn read_ref_arg<'e>(
        env: &'e Env,
        ref_codec: &'e crate::ffi::codec::RefCodec,
        arg_ptr: *const c_void,
    ) -> anyhow::Result<RefSlot<'e>> {
        let inner_ptr = unsafe { arg_ptr.cast::<*mut c_void>().read_unaligned() };
        let seed = if ref_codec.inout {
            seed_ref(env, inner_ptr, &ref_codec.inner_codec)?
        } else {
            value::js_null(env)?
        };

        Ok(RefSlot {
            obj: wrap_ref(env, seed)?,
            inner_ptr,
            inner_codec: &ref_codec.inner_codec,
            init: if ref_codec.inout {
                SlotInit::Initialized
            } else {
                SlotInit::Uninitialized
            },
        })
    }

    unsafe fn read_args<'e>(
        &'e self,
        env: &'e Env,
        args: *const *const c_void,
    ) -> anyhow::Result<ClosureArgs<'e>> {
        let mut js_args = Vec::with_capacity(self.arg_codecs.len());
        let mut ref_slots: Vec<RefSlot<'e>> = Vec::new();
        let siblings = unsafe { self.sibling_stashes(args) };

        for (i, codec) in self.arg_codecs.iter().enumerate() {
            if self.user_data_index == Some(i) {
                continue;
            }

            let arg_ptr = unsafe { *args.add(i) };
            if let Codec::Ref(ref_codec) = codec {
                let slot = unsafe { Self::read_ref_arg(env, ref_codec, arg_ptr) }?;
                js_args.push(slot.obj);
                ref_slots.push(slot);
                continue;
            }
            let val = match unsafe { self.read_arg(env, codec, arg_ptr, &siblings) } {
                Ok(val) => val,
                Err(e) => {
                    error_reporter::report(&e.context(format!("callback: failed to read arg {i}")));
                    value::js_null(env)?
                }
            };
            js_args.push(val);
        }

        Ok(ClosureArgs { js_args, ref_slots })
    }

    unsafe fn handle_call(
        &self,
        args: *const *const c_void,
        result: *mut c_void,
    ) -> Option<*mut ClosureState> {
        let oneshot = {
            let _guard = InFlightGuard::enter(self);
            unsafe { self.dispatch(args, result) }
        };

        self.release_after_call(oneshot)
    }

    unsafe fn dispatch(
        &self,
        args: *const *const c_void,
        result: *mut c_void,
    ) -> Option<*mut ClosureState> {
        let env = node_env::env();

        let capture_result = !matches!(self.return_codec, Codec::Void(_));

        let state_ptr = self.take_oneshot_state();

        let outcome: Result<(), CallbackError> = (|| {
            let ClosureArgs { js_args, ref_slots } =
                unsafe { self.read_args(&env, args) }.map_err(CallbackError::Infrastructure)?;
            let return_value = call_js_function(&env, &self.js_fn, &js_args)?;
            self.flush_refs(&env, &ref_slots);
            let ret = if capture_result {
                Ok(return_value)
            } else {
                Ok(value::js_undefined(&env)
                    .map_err(|e| CallbackError::Infrastructure(e.into()))?)
            };
            self.write_return(&env, result, &ret);
            Ok(())
        })();

        match outcome {
            Ok(()) => {}
            Err(CallbackError::Thrown(error)) => {
                self.write_return(&env, result, &Err(()));
                unsafe { napi::JsError::from(error).throw_into(env.raw()) };
            }
            Err(CallbackError::Infrastructure(e)) => {
                error_reporter::report(&anyhow::anyhow!(
                    "callback: JS callback error (return type: {}): {e:#}",
                    self.return_codec
                ));
                self.write_return(&env, result, &Err(()));
            }
        }

        state_ptr
    }

    fn write_return(&self, env: &Env, result: *mut c_void, value: &Result<Unknown<'_>, ()>) {
        if let Codec::String(string_codec) = &self.return_codec
            && string_codec.ownership.is_borrowed()
        {
            self.write_retained_string_return(result, value);
            return;
        }
        if self.return_type_is_borrowed_container() {
            self.write_retained_container_return(env, result, value);
            return;
        }
        self.return_codec
            .write_return_to_ptr(env, unsafe { crate::ffi::Slot::new(result) }, value);
    }

    fn return_type_is_borrowed_container(&self) -> bool {
        match &self.return_codec {
            Codec::Array(array_codec) => array_codec.ownership.is_borrowed(),
            Codec::HashTable(hash_table_codec) => hash_table_codec.ownership.is_borrowed(),
            _ => false,
        }
    }

    pub fn retain_container(&self, stash: Stash) {
        self.retained_containers.borrow_mut().push(stash);
    }

    fn retain_transfer(&self, transfer: crate::ffi::PendingTransfer) {
        self.retained_transfers.borrow_mut().push(transfer);
    }

    fn flush_refs(&self, env: &Env, ref_slots: &[RefSlot<'_>]) {
        for slot in ref_slots {
            if slot.inner_ptr.is_null() {
                continue;
            }
            let Some(new_value) = read_ref_value(env, slot.obj) else {
                continue;
            };
            let written = slot
                .inner_codec
                .write_value_to_ptr(
                    env,
                    unsafe { crate::ffi::Slot::new(slot.inner_ptr) },
                    new_value,
                    slot.init,
                )
                .report_err("callback: failed to write out-parameter");
            if let Some(Some(transfer)) = written {
                self.retain_transfer(transfer);
            }
        }
    }

    #[must_use]
    pub fn retained_string(&self, text: &str) -> *mut c_char {
        let Ok(key) = CString::new(text.as_bytes()) else {
            return std::ptr::null_mut();
        };

        self.retained_strings
            .borrow()
            .get(&key)
            .copied()
            .unwrap_or(std::ptr::null_mut())
    }

    fn write_retained_container_return(
        &self,
        env: &Env,
        result: *mut c_void,
        value: &Result<Unknown<'_>, ()>,
    ) {
        let built = match value {
            Ok(value) => self.return_codec.encode(env, *value).ok(),
            Err(()) => None,
        };
        let ptr = built
            .as_ref()
            .and_then(|stash| stash.as_ptr("container return").ok())
            .unwrap_or(std::ptr::null_mut());
        if let Some(stash) = built {
            self.retain_container(stash);
        }
        unsafe { crate::ffi::Slot::new(result).store(ptr) };
    }

    fn intern_string_return(&self, value: &Result<Unknown<'_>, ()>) -> *mut c_char {
        let Ok(unknown) = value else {
            return std::ptr::null_mut();
        };
        let Some(text) = string_from_unknown(*unknown) else {
            return std::ptr::null_mut();
        };
        let Ok(key) = CString::new(text.as_bytes()) else {
            return std::ptr::null_mut();
        };
        let mut retained = self.retained_strings.borrow_mut();
        if let Some(&existing) = retained.get(&key) {
            return existing;
        }
        let Ok(ptr) = str_to_glib_full(&text) else {
            return std::ptr::null_mut();
        };
        retained.insert(key, ptr);

        ptr
    }

    fn write_retained_string_return(&self, result: *mut c_void, value: &Result<Unknown<'_>, ()>) {
        let ptr = self.intern_string_return(value);
        unsafe { crate::ffi::Slot::new(result).store(ptr.cast()) };
    }
}

fn string_from_unknown(value: Unknown<'_>) -> Option<String> {
    match value.get_type().ok()? {
        napi::ValueType::String => value::read_napi::<String>(value).ok(),
        _ => None,
    }
}

fn seed_ref<'e>(
    env: &'e Env,
    inner_ptr: *mut c_void,
    inner_codec: &Codec,
) -> anyhow::Result<Unknown<'e>> {
    if inner_ptr.is_null() {
        return Ok(value::js_null(env)?);
    }
    match inner_codec {
        Codec::Integer(_)
        | Codec::BigInt(_)
        | Codec::Float(_)
        | Codec::EnumFlags(_)
        | Codec::Boolean(_)
        | Codec::Unichar(_) => {
            let seeded = unsafe {
                inner_codec.read(env, ReadCtx::slot(inner_ptr.cast_const(), "inout ref seed"))
            }
            .report_err("callback: failed to seed inout ref");
            match seeded {
                Some(unknown) => Ok(unknown),
                None => Ok(value::js_null(env)?),
            }
        }
        _ => Ok(value::js_null(env)?),
    }
}

fn read_ref_value<'e>(env: &'e Env, ref_obj: Unknown<'e>) -> Option<Unknown<'e>> {
    let obj = Object::from_raw(env.raw(), ref_obj.raw());
    obj.get_named_property::<Unknown<'_>>("value").ok()
}

unsafe extern "C" fn closure_entry(
    _cif: &libffi_low::ffi_cif,
    result: &mut u64,
    args: *const *const c_void,
    data: &ClosureData,
) {
    *result = 0;
    let state_ptr = guard_ffi_boundary("callback entry", || unsafe {
        data.handle_call(args, (&raw mut *result).cast::<c_void>())
    })
    .flatten();
    if let Some(ptr) = state_ptr {
        glib::idle_add_local_once(move || {
            guard_ffi_boundary("callback one-shot cleanup", || {
                drop(unsafe { Box::from_raw(ptr) });
            });
        });
    }
}
