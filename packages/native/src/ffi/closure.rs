use std::cell::Cell;
use std::ffi::{c_char, c_void};

use ::libffi::low as libffi_low;
use ::libffi::middle as libffi;
use napi::Env;
use napi::bindgen_prelude::{
    Function, JsObjectValue, JsValue, JsValuesTupleIntoVec, Object, Unknown,
};

use crate::ffi::Stash;
use crate::ffi::codec::{
    Codec, Decoder as _, Encoder as _, PtrWriter as _, ReadSource, str_to_glib_full,
};
use crate::ffi::value::{self, JsHandle};
use crate::messaging::error_reporter::{ErrorReporter, ReportErr};
use crate::messaging::node_env;
use crate::messaging::panic_handler::guard_ffi_boundary;

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
    callback: &JsHandle,
    js_args: &[Unknown<'e>],
) -> Result<Unknown<'e>, CallbackError> {
    let raw_args: Vec<_> = js_args.iter().map(JsValue::raw).collect();
    let function: Function<CallbackArgs, Unknown> = callback.get(env).map_err(|e| {
        CallbackError::Infrastructure(anyhow::anyhow!("retrieving callback function: {e}"))
    })?;
    function
        .call(CallbackArgs(raw_args))
        .map_err(CallbackError::Thrown)
}

pub struct ClosureData {
    pub js_fn: JsHandle,
    pub arg_codecs: Vec<Codec>,
    pub return_codec: Codec,
    pub user_data_index: Option<usize>,
    pub is_oneshot: bool,
    pub oneshot_state_ptr: Cell<*mut ClosureState>,
    pub retained_string_return: Cell<*mut c_char>,
    pub retained_container_return: Cell<*mut Stash>,
}

impl ClosureData {
    pub fn new(
        js_fn: JsHandle,
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
            oneshot_state_ptr: Cell::new(std::ptr::null_mut()),
            retained_string_return: Cell::new(std::ptr::null_mut()),
            retained_container_return: Cell::new(std::ptr::null_mut()),
        }
    }
}

impl Drop for ClosureData {
    fn drop(&mut self) {
        self.replace_string_return(std::ptr::null_mut());
        self.replace_container_return(std::ptr::null_mut());
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
    _closure: libffi::Closure<'static>,
    pub code_ptr: *mut c_void,
    data: Box<ClosureData>,
}

impl std::fmt::Debug for ClosureState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ClosureState")
            .field("code_ptr", &self.code_ptr)
            .finish_non_exhaustive()
    }
}

impl ClosureState {
    pub fn data_ref(&self) -> &ClosureData {
        &self.data
    }

    pub fn new(data: ClosureData) -> Self {
        let data = Box::new(data);
        let data_ptr: *const ClosureData = &*data;
        let data_ref: &'static ClosureData = unsafe { &*data_ptr };

        let mut cif_arg_types: Vec<libffi::Type> = Vec::with_capacity(data_ref.arg_codecs.len());
        for codec in &data_ref.arg_codecs {
            cif_arg_types.push(codec.libffi_type());
        }

        let cif_return_type: libffi::Type = data_ref.return_codec.libffi_type();
        let cif = libffi::Cif::new(cif_arg_types, cif_return_type);

        let closure = libffi::Closure::new(cif, closure_entry, data_ref);
        let code_ptr = *closure.code_ptr() as *mut c_void;

        Self {
            _closure: closure,
            code_ptr,
            data,
        }
    }

    pub fn boxed(
        js_fn: JsHandle,
        arg_codecs: Vec<Codec>,
        return_codec: Codec,
        user_data_index: Option<usize>,
        is_oneshot: bool,
    ) -> Box<Self> {
        let data = ClosureData::new(js_fn, arg_codecs, return_codec, user_data_index, is_oneshot);
        let boxed = Box::new(Self::new(data));
        if is_oneshot {
            let state_ptr = std::ptr::from_ref::<Self>(&*boxed) as *mut Self;
            boxed.data_ref().oneshot_state_ptr.set(state_ptr);
        }
        boxed
    }
}

impl ClosureState {
    pub unsafe extern "C" fn destroy(user_data: *mut c_void) {
        guard_ffi_boundary("callback destroy notify", || {
            if node_env::is_installed_on_current_thread() {
                drop(unsafe { Box::from_raw(user_data as *mut Self) });
                return;
            }

            let state_ptr = user_data as usize;
            node_env::invoke_on_install_thread("callback destroy notify", move || {
                drop(unsafe { Box::from_raw(state_ptr as *mut Self) });
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
}

impl ClosureData {
    unsafe fn read_args<'e>(
        &'e self,
        env: &'e Env,
        args: *const *const c_void,
    ) -> anyhow::Result<ClosureArgs<'e>> {
        let mut js_args = Vec::with_capacity(self.arg_codecs.len());
        let mut ref_slots: Vec<RefSlot<'e>> = Vec::new();

        for (i, codec) in self.arg_codecs.iter().enumerate() {
            if self.user_data_index == Some(i) {
                continue;
            }

            let arg_ptr = unsafe { *args.add(i) };
            if let Codec::Ref(ref_codec) = codec {
                let inner_ptr = unsafe { *(arg_ptr as *const *mut c_void) };
                let seed = seed_ref(env, inner_ptr, &ref_codec.inner_codec)?;
                let ref_obj = wrap_ref(env, seed)?;
                ref_slots.push(RefSlot {
                    obj: ref_obj,
                    inner_ptr,
                    inner_codec: &ref_codec.inner_codec,
                });
                js_args.push(ref_obj);
                continue;
            }
            let val = match unsafe { codec.read(env, ReadSource::Slot(arg_ptr, "callback arg")) } {
                Ok(val) => val,
                Err(e) => {
                    ErrorReporter::global()
                        .report(&e.context(format!("callback: failed to read arg {i}")));
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
        let env = node_env::env();

        let capture_result = !matches!(self.return_codec, Codec::Void(_));

        let state_ptr = if self.is_oneshot {
            let ptr = self.oneshot_state_ptr.replace(std::ptr::null_mut());
            if ptr.is_null() { None } else { Some(ptr) }
        } else {
            None
        };

        let outcome: Result<(), CallbackError> = (|| {
            let ClosureArgs { js_args, ref_slots } =
                unsafe { self.read_args(&env, args) }.map_err(CallbackError::Infrastructure)?;
            let return_value = call_js_function(&env, &self.js_fn, &js_args)?;
            flush_refs(&env, &ref_slots);
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
                ErrorReporter::global().report(&anyhow::anyhow!(
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
            self.write_retained_string_return(env, result, value);
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

    fn replace_container_return(&self, new_ptr: *mut Stash) {
        let previous = self.retained_container_return.replace(new_ptr);
        if !previous.is_null() {
            drop(unsafe { Box::from_raw(previous) });
        }
    }

    fn replace_string_return(&self, new_ptr: *mut c_char) {
        let previous = self.retained_string_return.replace(new_ptr);
        if !previous.is_null() {
            unsafe { glib::ffi::g_free(previous.cast()) };
        }
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
        let new_ptr = built.map_or(std::ptr::null_mut(), |stash| Box::into_raw(Box::new(stash)));
        self.replace_container_return(new_ptr);
        unsafe { crate::ffi::Slot::new(result).store(ptr) };
    }

    fn write_retained_string_return(
        &self,
        env: &Env,
        result: *mut c_void,
        value: &Result<Unknown<'_>, ()>,
    ) {
        let new_ptr: *mut c_char = match value {
            Ok(unknown) => string_from_unknown(env, *unknown)
                .and_then(|s| str_to_glib_full(&s).ok())
                .unwrap_or(std::ptr::null_mut()),
            Err(()) => std::ptr::null_mut(),
        };
        self.replace_string_return(new_ptr);
        unsafe { crate::ffi::Slot::new(result).store(new_ptr.cast()) };
    }
}

fn string_from_unknown(env: &Env, value: Unknown<'_>) -> Option<String> {
    match value.get_type().ok()? {
        napi::ValueType::String => value::read_napi::<String>(env, value).ok(),
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
                inner_codec.read(
                    env,
                    ReadSource::Slot(inner_ptr.cast_const(), "inout ref seed"),
                )
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

fn flush_refs(env: &Env, ref_slots: &[RefSlot<'_>]) {
    for slot in ref_slots {
        if slot.inner_ptr.is_null() {
            continue;
        }
        let Some(new_value) = read_ref_value(env, slot.obj) else {
            continue;
        };
        slot.inner_codec
            .write_value_to_ptr(
                env,
                unsafe { crate::ffi::Slot::new(slot.inner_ptr) },
                new_value,
            )
            .report_err("callback: failed to write out-parameter");
    }
}

fn read_ref_value<'e>(env: &'e Env, ref_obj: Unknown<'e>) -> Option<Unknown<'e>> {
    let obj = Object::from_raw(env.raw(), ref_obj.raw());
    obj.get_named_property::<Unknown>("value").ok()
}

unsafe extern "C" fn closure_entry(
    _cif: &libffi_low::ffi_cif,
    result: &mut u64,
    args: *const *const c_void,
    data: &ClosureData,
) {
    *result = 0;
    let state_ptr = guard_ffi_boundary("callback entry", || unsafe {
        data.handle_call(args, result as *mut u64 as *mut c_void)
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
