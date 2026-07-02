use std::ffi::{c_char, c_void};
use std::sync::Arc;
use std::sync::atomic::{AtomicPtr, Ordering};

use ::libffi::low as libffi_low;
use ::libffi::middle as libffi;

use crate::ffi::StashedValue;
use crate::ffi::codec::{
    Codec, Decoder as _, Encoder as _, PtrWriter as _, ReadSource, str_to_glib_full,
};
use crate::ffi::value::{JsRef, Value};
use crate::messaging::Mailbox;
use crate::messaging::error_reporter::{ErrorReporter, ReportErr};

pub struct CallbackData {
    pub js_fn: Arc<JsRef>,
    pub arg_codecs: Vec<Codec>,
    pub return_codec: Codec,
    pub user_data_index: Option<usize>,
    pub is_oneshot: bool,
    pub oneshot_state_ptr: AtomicPtr<CallbackState>,
    pub retained_string_return: AtomicPtr<c_char>,
    pub retained_container_return: AtomicPtr<StashedValue>,
}

impl CallbackData {
    pub fn new(
        js_fn: Arc<JsRef>,
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
            .field("arg_codecs", &self.arg_codecs)
            .field("return_codec", &self.return_codec)
            .field("user_data_index", &self.user_data_index)
            .field("is_oneshot", &self.is_oneshot)
            .finish_non_exhaustive()
    }
}

pub struct CallbackState {
    _closure: libffi::Closure<'static>,
    pub code_ptr: *mut c_void,
    data: Box<CallbackData>,
}

impl std::fmt::Debug for CallbackState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CallbackState")
            .field("code_ptr", &self.code_ptr)
            .finish_non_exhaustive()
    }
}

impl CallbackState {
    pub fn data_ref(&self) -> &CallbackData {
        &self.data
    }

    pub fn new(data: CallbackData) -> Self {
        let data = Box::new(data);
        let data_ptr: *const CallbackData = &*data;
        let data_ref: &'static CallbackData = unsafe { &*data_ptr };

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
        js_fn: Arc<JsRef>,
        arg_codecs: Vec<Codec>,
        return_codec: Codec,
        user_data_index: Option<usize>,
        is_oneshot: bool,
    ) -> Box<Self> {
        let data = CallbackData::new(js_fn, arg_codecs, return_codec, user_data_index, is_oneshot);
        Box::new(Self::new(data))
    }
}

impl CallbackState {
    pub unsafe extern "C" fn destroy(user_data: *mut c_void) {
        drop(unsafe { Box::from_raw(user_data as *mut Self) });
    }
}

struct CallbackArgs<'a> {
    values: Vec<Value>,
    ref_indices: Vec<usize>,
    ref_targets: Vec<(*mut c_void, &'a Codec)>,
}

impl CallbackData {
    unsafe fn read_args(&self, args: *const *const c_void) -> CallbackArgs<'_> {
        let mut values = Vec::with_capacity(self.arg_codecs.len());
        let mut ref_indices: Vec<usize> = Vec::new();
        let mut ref_targets: Vec<(*mut c_void, &Codec)> = Vec::new();

        for (i, codec) in self.arg_codecs.iter().enumerate() {
            if self.user_data_index == Some(i) {
                continue;
            }

            let arg_ptr = unsafe { *args.add(i) };
            if let Codec::Ref(ref_codec) = codec {
                let inner_ptr = unsafe { *(arg_ptr as *const *mut c_void) };
                ref_indices.push(values.len());
                ref_targets.push((inner_ptr, &ref_codec.inner_codec));
                values.push(seed_ref(inner_ptr, &ref_codec.inner_codec));
                continue;
            }
            match unsafe { codec.read(ReadSource::Slot(arg_ptr, "callback arg")) } {
                Ok(val) => values.push(val),
                Err(e) => {
                    ErrorReporter::global()
                        .report(&e.context(format!("callback: failed to read arg {i}")));
                    values.push(Value::Null);
                }
            }
        }

        CallbackArgs {
            values,
            ref_indices,
            ref_targets,
        }
    }

    unsafe fn handle_call(
        &self,
        args: *const *const c_void,
        result: *mut c_void,
    ) -> Option<*mut CallbackState> {
        let CallbackArgs {
            values,
            ref_indices,
            ref_targets,
        } = unsafe { self.read_args(args) };

        let capture_result = !matches!(self.return_codec, Codec::Void(_));

        let state_ptr = if self.is_oneshot {
            let ptr = self
                .oneshot_state_ptr
                .swap(std::ptr::null_mut(), Ordering::AcqRel);
            if ptr.is_null() { None } else { Some(ptr) }
        } else {
            None
        };

        let js_result = Mailbox::global().invoke_node_and_wait_with_refs(
            &self.js_fn,
            values,
            capture_result,
            ref_indices,
        );

        match js_result {
            Ok((value, refs)) => {
                flush_refs(&refs, &ref_targets);
                self.write_return(result, &Ok(value));
            }
            Err(ref e) => {
                ErrorReporter::global().report(&anyhow::anyhow!(
                    "callback: JS callback error (return type: {}): {e:#}",
                    self.return_codec
                ));
                self.write_return(result, &Err(()));
            }
        }

        state_ptr
    }

    fn write_return(&self, result: *mut c_void, value: &Result<Value, ()>) {
        if let Codec::String(string_codec) = &self.return_codec
            && string_codec.ownership.is_borrowed()
        {
            self.write_retained_string_return(result, value);
            return;
        }
        if self.return_type_is_borrowed_container() {
            self.write_retained_container_return(result, value);
            return;
        }
        unsafe {
            self.return_codec.write_return_to_ptr(result, value);
        };
    }

    fn return_type_is_borrowed_container(&self) -> bool {
        match &self.return_codec {
            Codec::Array(array_codec) => array_codec.ownership.is_borrowed(),
            Codec::HashTable(hash_table_codec) => hash_table_codec.ownership.is_borrowed(),
            _ => false,
        }
    }

    fn write_retained_container_return(&self, result: *mut c_void, value: &Result<Value, ()>) {
        let built = match value {
            Ok(value) => self.return_codec.encode(value).ok(),
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
        unsafe { crate::ffi::Slot::new(result).store(ptr) };
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
        unsafe { crate::ffi::Slot::new(result).store(new_ptr.cast()) };
    }
}

pub(crate) fn seed_ref(inner_ptr: *mut c_void, inner_codec: &Codec) -> Value {
    if inner_ptr.is_null() {
        return Value::Null;
    }
    match inner_codec {
        Codec::Integer(_)
        | Codec::BigInt(_)
        | Codec::Float(_)
        | Codec::EnumFlags(_)
        | Codec::Boolean(_)
        | Codec::Unichar(_) => {
            unsafe { inner_codec.read(ReadSource::Slot(inner_ptr.cast_const(), "inout ref seed")) }
                .report_err("callback: failed to seed inout ref")
                .unwrap_or(Value::Null)
        }
        _ => Value::Null,
    }
}

pub(crate) fn flush_refs(refs: &[(usize, Value)], ref_targets: &[(*mut c_void, &Codec)]) {
    for ((_, new_value), (ptr, inner_codec)) in refs.iter().zip(ref_targets.iter()) {
        if ptr.is_null() {
            continue;
        }
        unsafe { inner_codec.write_value_to_ptr(*ptr, new_value) }
            .report_err("callback: failed to write out-parameter");
    }
}

unsafe extern "C" fn closure_entry(
    _cif: &libffi_low::ffi_cif,
    result: &mut u64,
    args: *const *const c_void,
    data: &CallbackData,
) {
    let state_ptr = unsafe { data.handle_call(args, result as *mut u64 as *mut c_void) };
    if let Some(ptr) = state_ptr {
        glib::idle_add_local_once(move || drop(unsafe { Box::from_raw(ptr) }));
    }
}
