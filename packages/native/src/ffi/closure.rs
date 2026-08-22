use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::ffi::{CString, c_char, c_void};

use ::libffi::{low as libffi_low, middle as libffi};
use glib::prelude::StaticType as _;
use glib::translate::IntoGlib as _;
use napi::bindgen_prelude::{
    BigInt, FromNapiValue as _, Function, JsObjectValue, JsValue, JsValuesTupleIntoVec, Object,
    Unknown,
};
use napi::{Env, ValueType};

use crate::ffi::Stash;
use crate::ffi::codec::{
    CallbackCodec, Codec, Decoder as _, Encoder as _, Ownership, PtrWriter as _, ReadCtx, SlotInit,
    str_to_glib_full,
};
use crate::handle::{BorrowScope, Handle};
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

/// The memory a C caller lends for the length of one invocation, as the handles the arguments were
/// built over. Dropping it ends every one of those borrows, on the way out of a panic as much as on
/// the way out of a normal return, so nothing reaches that memory once the invocation is over.
struct LentMemory(Vec<Handle>);

impl Drop for LentMemory {
    fn drop(&mut self) {
        for handle in &self.0 {
            handle.invalidate();
        }
    }
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
    can_throw: bool,
    is_oneshot: bool,
    pub state_ptr: Cell<*mut ClosureState>,
    oneshot_fired: Cell<bool>,
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
        can_throw: bool,
        is_oneshot: bool,
    ) -> Self {
        Self {
            js_fn,
            arg_codecs,
            return_codec,
            user_data_index,
            can_throw,
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
    holds: Cell<u32>,
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
            codec.append_ffi_arg_types(&mut cif_arg_types);
        }

        if data_ref.can_throw {
            cif_arg_types.push(libffi::Type::pointer());
        }

        let cif_return_type: libffi::Type = data_ref.return_codec.libffi_type();
        let cif = libffi::Cif::new(cif_arg_types, cif_return_type);

        let closure = libffi::Closure::new(cif, closure_entry, data_ref);
        let code_ptr = *closure.code_ptr() as *mut c_void;

        Self {
            closure: std::mem::ManuallyDrop::new(closure),
            code_ptr,
            data,
            holds: Cell::new(1),
        }
    }

    pub(crate) fn hold(&self) {
        self.holds.set(self.holds.get() + 1);
    }

    pub(crate) unsafe fn release(state: *mut Self) {
        if state.is_null() {
            return;
        }
        let holds = unsafe { (*state).holds.get() }.saturating_sub(1);
        unsafe { (*state).holds.set(holds) };
        if holds == 0 {
            drop(unsafe { Box::from_raw(state) });
        }
    }

    #[must_use]
    pub fn boxed(
        js_fn: ClosureHandle,
        arg_codecs: Vec<Codec>,
        return_codec: Codec,
        user_data_index: Option<usize>,
        can_throw: bool,
        is_oneshot: bool,
    ) -> Box<Self> {
        let data = ClosureData::new(
            js_fn,
            arg_codecs,
            return_codec,
            user_data_index,
            can_throw,
            is_oneshot,
        );
        Box::new(Self::new(data))
    }
}

impl ClosureState {
    /// # Safety
    ///
    /// `user_data` must be a pointer obtained from `Box::into_raw` on a `Box<ClosureState>` (which
    /// is what `ClosureState::boxed` produces) and must still be live. This drops the hold the
    /// callee was given, freeing the box along with the `ClosureData` and the libffi closure it
    /// owns once no other hold is left, so the caller must not use `user_data`, the closure's code
    /// pointer, or any trampoline installed from it afterwards, and must invoke this at most once
    /// per pointer. Invoking it from inside the callback itself is allowed: the release is then
    /// deferred until the invocation returns. When called off the thread the Node environment was
    /// installed on, the release is deferred onto that thread, so the pointer must stay valid until
    /// it runs.
    pub unsafe extern "C" fn destroy(user_data: *mut c_void) {
        guard_ffi_boundary("callback destroy notify", || {
            let state_ptr = user_data.cast::<Self>();
            if !state_ptr.is_null() && unsafe { (*state_ptr).data_ref() }.defer_destroy() {
                return;
            }

            if node_env::is_installed_on_current_thread() {
                unsafe { Self::release(state_ptr) };
                return;
            }

            let state_address = user_data as usize;
            node_env::invoke_on_install_thread("callback destroy notify", move || {
                unsafe { Self::release(state_address as *mut Self) };
            });
        });
    }

    /// The same release as [`ClosureState::destroy`], shaped as a `GClosureNotify`,
    /// `void (*) (gpointer data, GClosure *closure)`, for the notifier slots `g_cclosure_new`,
    /// `g_closure_add_finalize_notifier` and `g_closure_add_invalidate_notifier` type that way.
    ///
    /// # Safety
    ///
    /// `user_data` carries every requirement [`ClosureState::destroy`] states, and this forwards to
    /// it unchanged, so the in-flight and off-thread deferrals hold exactly as documented there.
    /// `closure` is the `GClosure` being finalized; it is never read, so any value is accepted.
    pub unsafe extern "C" fn destroy_as_closure_notify(
        user_data: *mut c_void,
        _closure: *mut c_void,
    ) {
        unsafe { Self::destroy(user_data) };
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

    fn total_ffi_slots(&self) -> usize {
        self.arg_codecs.iter().map(ffi_slot_count).sum()
    }

    unsafe fn sibling_stashes(&self, args: *const *const c_void) -> Vec<Stash> {
        let mut slot = 0usize;

        self.arg_codecs
            .iter()
            .map(|codec| {
                let arg_ptr = unsafe { *args.add(slot) };
                slot += ffi_slot_count(codec);
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
                    ReadCtx::slot(arg_ptr, "callback arg")
                        .with_transfer(codec.transfer())
                        .lent(),
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
        let is_seeded = ref_codec.is_inout();
        let seed = if is_seeded {
            seed_ref(env, inner_ptr, ref_codec.inner_codec())?
        } else {
            value::js_null(env)?
        };

        Ok(RefSlot {
            obj: wrap_ref(env, seed)?,
            inner_ptr,
            inner_codec: ref_codec.inner_codec(),
            init: if ref_codec.is_inout() {
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
        let mut slot_index = 0usize;

        for (i, codec) in self.arg_codecs.iter().enumerate() {
            let arg_slot = slot_index;
            slot_index += ffi_slot_count(codec);

            if self.user_data_index == Some(i) {
                continue;
            }

            if let Codec::Callback(callback_codec) = codec {
                let val = match unsafe { read_callback_arg(env, callback_codec, args, arg_slot) } {
                    Ok(val) => val,
                    Err(e) => {
                        error_reporter::report(
                            &e.context(format!("callback: failed to read arg {i}")),
                        );
                        value::js_null(env)?
                    }
                };
                js_args.push(val);
                continue;
            }

            let arg_ptr = unsafe { *args.add(arg_slot) };
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

        let scope = BorrowScope::open();
        let read = unsafe { self.read_args(&env, args) };
        let _lent = LentMemory(scope.close());

        let outcome: Result<(), CallbackError> = (|| {
            let ClosureArgs { js_args, ref_slots } = read.map_err(CallbackError::Infrastructure)?;
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
                unsafe { self.deliver_thrown(&env, error, args) };
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

    unsafe fn deliver_thrown(&self, env: &Env, error: napi::Error, args: *const *const c_void) {
        if !self.can_throw {
            unsafe { napi::JsError::from(error).throw_into(env.raw()) };
            return;
        }

        let error_arg = unsafe { *args.add(self.total_ffi_slots()) };
        let error_out = unsafe {
            error_arg
                .cast::<*mut *mut glib::ffi::GError>()
                .read_unaligned()
        };

        if error_out.is_null() || !unsafe { *error_out }.is_null() {
            unsafe { napi::JsError::from(error).throw_into(env.raw()) };
            return;
        }

        unsafe { *error_out = gerror_from_thrown(env, error) };
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
        ValueType::String => value::read_napi::<String>(value).ok(),
        _ => None,
    }
}

fn js_error_quark() -> u32 {
    glib::Quark::from_str("gtkx-js-error-quark").into_glib()
}

fn new_gerror(domain: u32, code: i32, message: &str) -> *mut glib::ffi::GError {
    let c_message = CString::new(message.as_bytes()).unwrap_or_default();
    unsafe { glib::ffi::g_error_new_literal(domain, code, c_message.as_ptr()) }
}

fn wrapped_gerror_parts(env: &Env, thrown: Unknown<'_>) -> Option<(u32, i32, String)> {
    if thrown.get_type().ok()? != ValueType::Object {
        return None;
    }
    let obj = Object::from_raw(env.raw(), thrown.raw());
    let type_tag: Unknown<'_> = obj.get_named_property("__type__").ok()?;
    if type_tag.get_type().ok()? != ValueType::BigInt {
        return None;
    }
    let (gtype, lossless) = value::read_napi::<BigInt>(type_tag).ok()?.get_i128();
    let gerror_gtype = i128::try_from(glib::Error::static_type().into_glib()).ok()?;
    if !lossless || gtype != gerror_gtype {
        return None;
    }
    let domain: u32 = obj.get_named_property("domain").ok()?;
    let code: i32 = obj.get_named_property("code").ok()?;
    let message: String = obj.get_named_property("message").ok()?;

    Some((domain, code, message))
}

fn thrown_message(env: &Env, thrown: Unknown<'_>) -> String {
    let value_type = thrown.get_type().unwrap_or(ValueType::Unknown);
    match value_type {
        ValueType::Object => Object::from_raw(env.raw(), thrown.raw())
            .get_named_property::<String>("message")
            .ok()
            .filter(|message| !message.is_empty())
            .unwrap_or_else(|| String::from("JavaScript exception with no message")),
        ValueType::String => value::read_napi::<String>(thrown)
            .unwrap_or_else(|_| String::from("JavaScript string exception")),
        _ => format!("JavaScript {value_type:?} value thrown"),
    }
}

fn gerror_from_thrown(env: &Env, error: napi::Error) -> *mut glib::ffi::GError {
    let raw = unsafe { napi::JsError::from(error).into_value(env.raw()) };
    match unsafe { Unknown::from_napi_value(env.raw(), raw) } {
        Ok(thrown) => match wrapped_gerror_parts(env, thrown) {
            Some((domain, code, message)) => new_gerror(domain, code, &message),
            None => new_gerror(js_error_quark(), 0, &thrown_message(env, thrown)),
        },
        Err(_) => new_gerror(
            js_error_quark(),
            0,
            "JavaScript exception could not be read",
        ),
    }
}

fn ffi_slot_count(codec: &Codec) -> usize {
    let mut types: Vec<libffi::Type> = Vec::with_capacity(3);
    codec.append_ffi_arg_types(&mut types);

    types.len()
}

unsafe fn read_callback_arg<'e>(
    env: &'e Env,
    codec: &CallbackCodec,
    args: *const *const c_void,
    slot: usize,
) -> anyhow::Result<Unknown<'e>> {
    let fn_ptr = unsafe { (*args.add(slot)).cast::<*mut c_void>().read_unaligned() };

    if fn_ptr.is_null() {
        return Ok(value::js_null(env)?);
    }

    let mut target: Object<'e> = Object::new(env)?;
    target.set_named_property("fnPtr", BigInt::from(fn_ptr as u64))?;

    if codec.has_user_data {
        let user_data = unsafe { (*args.add(slot + 1)).cast::<*mut c_void>().read_unaligned() };
        target.set_named_property("userData", BigInt::from(user_data as u64))?;
    }

    Ok(target.to_unknown())
}

fn seed_ref<'e>(
    env: &'e Env,
    inner_ptr: *mut c_void,
    inner_codec: &Codec,
) -> anyhow::Result<Unknown<'e>> {
    if inner_ptr.is_null() {
        return Ok(value::js_null(env)?);
    }
    let seeded = match inner_codec {
        codec if codec.is_scalar() => {
            unsafe { codec.read(env, ReadCtx::slot(inner_ptr.cast_const(), "ref seed")) }
                .report_err("callback: failed to seed ref")
        }
        Codec::Array(array_codec) if !array_codec.is_length_bounded() => {
            let value_ptr = unsafe { inner_ptr.cast::<*mut c_void>().read_unaligned() };
            unsafe { array_codec.read_value(env, value_ptr, "ref seed", Ownership::Borrowed) }
                .report_err("callback: failed to seed ref")
        }
        _ => None,
    };

    match seeded {
        Some(unknown) => Ok(unknown),
        None => Ok(value::js_null(env)?),
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
                unsafe { ClosureState::release(ptr) };
            });
        });
    }
}
