use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::ffi::{CStr, c_char, c_int, c_void};
use std::rc::Rc;

use napi::Env;
use napi::sys;

pub type FnImpl = Rc<dyn Fn(&[sys::napi_value]) -> sys::napi_value>;

pub enum FakeValue {
    Undefined,
    Null,
    Boolean(bool),
    Double(f64),
    Int32(i32),
    Uint32(u32),
    Int64(i64),
    String(String),
    BigInt {
        sign_bit: bool,
        words: Vec<u64>,
    },
    Object(RefCell<HashMap<String, sys::napi_value>>),
    Array(RefCell<Vec<sys::napi_value>>),
    External(*mut c_void),
    Function(FnImpl),
    TypedArray {
        kind: sys::napi_typedarray_type,
        data: *mut c_void,
        length: usize,
        byte_offset: usize,
        shared: bool,
    },
    DataView {
        data: *mut c_void,
        byte_length: usize,
        byte_offset: usize,
        shared: bool,
    },
    ArrayBuffer,
    SharedArrayBuffer,
}

struct RefEntry {
    value: sys::napi_value,
    count: Cell<u32>,
    deleted: Cell<bool>,
}

struct Finalizer {
    value: sys::napi_value,
    cb: sys::napi_finalize,
    data: *mut c_void,
    hint: *mut c_void,
}

#[derive(Default)]
pub struct Recorder {
    calls: Vec<String>,
    counts: HashMap<String, usize>,
}

impl Recorder {
    fn record(&mut self, name: &str) {
        self.calls.push(name.to_owned());
        *self.counts.entry(name.to_owned()).or_insert(0) += 1;
    }
}

struct State {
    values: Vec<*mut FakeValue>,
    refs: Vec<*mut RefEntry>,
    finalizers: Vec<Finalizer>,
    global: Option<sys::napi_value>,
    pending_exception: Option<sys::napi_value>,
    thrown_exceptions: Vec<sys::napi_value>,
    error_values: Vec<sys::napi_value>,
    fatal_exceptions: Vec<sys::napi_value>,
    recorder: Recorder,
}

impl State {
    fn release_allocations(&mut self) {
        for ptr in self.values.drain(..) {
            drop(unsafe { Box::from_raw(ptr) });
        }
        for ptr in self.refs.drain(..) {
            drop(unsafe { Box::from_raw(ptr) });
        }
    }
}

impl Default for State {
    fn default() -> Self {
        Self {
            values: Vec::new(),
            refs: Vec::new(),
            finalizers: Vec::new(),
            global: None,
            pending_exception: None,
            thrown_exceptions: Vec::new(),
            error_values: Vec::new(),
            fatal_exceptions: Vec::new(),
            recorder: Recorder::default(),
        }
    }
}

impl Drop for State {
    fn drop(&mut self) {
        self.release_allocations();
    }
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

const SENTINEL_ENV: sys::napi_env = std::ptr::without_provenance_mut(0x1);
const SENTINEL_SCOPE: *mut c_void = std::ptr::without_provenance_mut(0x2);
const SENTINEL_ASYNC: *mut c_void = std::ptr::without_provenance_mut(0x3);
const SENTINEL_UV_LOOP: *mut sys::uv_loop_s = std::ptr::without_provenance_mut(0x4);

pub fn fake_env() -> Env {
    Env::from_raw(SENTINEL_ENV)
}

pub fn fake_uv_loop() -> *mut sys::uv_loop_s {
    SENTINEL_UV_LOOP
}

pub fn to_unknown<'e>(env: &'e Env, value: sys::napi_value) -> napi::bindgen_prelude::Unknown<'e> {
    unsafe { napi::bindgen_prelude::Unknown::from_raw_unchecked(env.raw(), value) }
}

fn record(name: &str) {
    STATE.with_borrow_mut(|state| state.recorder.record(name));
}

fn alloc(value: FakeValue) -> sys::napi_value {
    let ptr = Box::into_raw(Box::new(value));
    STATE.with_borrow_mut(|state| state.values.push(ptr));
    ptr.cast()
}

fn fv<'a>(value: sys::napi_value) -> Option<&'a FakeValue> {
    if value.is_null() {
        return None;
    }
    let ptr = value.cast::<FakeValue>();
    let live = STATE.with_borrow(|state| state.values.contains(&ptr));
    assert!(live, "napi_mock: unknown or stale napi_value handle {value:?}");
    Some(unsafe { &*ptr })
}

fn expected_status(value: sys::napi_value, expected: sys::napi_status) -> sys::napi_status {
    if fv(value).is_none() {
        sys::Status::napi_invalid_arg
    } else {
        expected
    }
}

pub fn reset() {
    let finalizers = STATE.with_borrow_mut(|state| std::mem::take(&mut state.finalizers));
    run_finalizers(finalizers);
    STATE.with_borrow_mut(|state| {
        state.release_allocations();
        state.global = None;
        state.pending_exception = None;
        state.thrown_exceptions.clear();
        state.error_values.clear();
        state.fatal_exceptions.clear();
        state.recorder = Recorder::default();
    });
}

fn run_finalizers(finalizers: Vec<Finalizer>) {
    for f in finalizers {
        if let Some(cb) = f.cb {
            unsafe { cb(SENTINEL_ENV, f.data, f.hint) };
        }
    }
}

pub fn collect(value: sys::napi_value) {
    let dead = STATE.with_borrow_mut(|state| {
        let (dead, kept): (Vec<Finalizer>, Vec<Finalizer>) =
            state.finalizers.drain(..).partition(|f| f.value == value);
        state.finalizers = kept;
        dead
    });
    run_finalizers(dead);
}

pub fn set_pending_exception(value: sys::napi_value) {
    STATE.with_borrow_mut(|state| state.pending_exception = Some(value));
}

pub fn pending_exception() -> Option<sys::napi_value> {
    STATE.with_borrow(|state| state.pending_exception)
}

pub fn take_pending_exception() -> Option<sys::napi_value> {
    STATE.with_borrow_mut(|state| state.pending_exception.take())
}

pub fn thrown_exceptions() -> Vec<sys::napi_value> {
    STATE.with_borrow(|state| state.thrown_exceptions.clone())
}

fn exception_blocks_call() -> bool {
    STATE.with_borrow(|state| state.pending_exception.is_some())
}

fn is_error_value(value: sys::napi_value) -> bool {
    STATE.with_borrow(|state| state.error_values.contains(&value))
}

fn register_error_value(value: sys::napi_value) {
    STATE.with_borrow_mut(|state| state.error_values.push(value));
}

pub fn fatal_exceptions() -> Vec<sys::napi_value> {
    STATE.with_borrow(|state| state.fatal_exceptions.clone())
}

pub fn calls() -> Vec<String> {
    STATE.with_borrow(|state| state.recorder.calls.clone())
}

pub fn count(name: &str) -> usize {
    STATE.with_borrow(|state| state.recorder.counts.get(name).copied().unwrap_or(0))
}

pub fn calls_matching(prefix: &str) -> Vec<String> {
    STATE.with_borrow(|state| {
        state
            .recorder
            .calls
            .iter()
            .filter(|c| c.starts_with(prefix))
            .cloned()
            .collect()
    })
}

pub fn fake_undefined() -> sys::napi_value {
    alloc(FakeValue::Undefined)
}

pub fn fake_null() -> sys::napi_value {
    alloc(FakeValue::Null)
}

pub fn fake_bool(value: bool) -> sys::napi_value {
    alloc(FakeValue::Boolean(value))
}

pub fn fake_double(value: f64) -> sys::napi_value {
    alloc(FakeValue::Double(value))
}

pub fn fake_string(value: &str) -> sys::napi_value {
    alloc(FakeValue::String(value.to_owned()))
}

pub fn fake_bigint_i128(value: i128) -> sys::napi_value {
    let sign_bit = value < 0;
    let magnitude = value.unsigned_abs();
    let low = magnitude as u64;
    let high = (magnitude >> 64) as u64;
    alloc(FakeValue::BigInt {
        sign_bit,
        words: vec![low, high],
    })
}

pub fn fake_external(data: *mut c_void) -> sys::napi_value {
    alloc(FakeValue::External(data))
}

pub fn fake_reference() -> sys::napi_ref {
    let object = fake_object(&[]);
    let mut result: sys::napi_ref = std::ptr::null_mut();
    unsafe { napi_create_reference(SENTINEL_ENV, object, 1, &mut result) };
    result
}

pub fn reference_count(napi_ref: sys::napi_ref) -> Option<u32> {
    ref_entry(napi_ref).map(|entry| entry.count.get())
}

pub fn reference_is_deleted(napi_ref: sys::napi_ref) -> bool {
    ref_entry(napi_ref).is_some_and(|entry| entry.deleted.get())
}

pub fn fake_object(entries: &[(&str, sys::napi_value)]) -> sys::napi_value {
    let map = entries
        .iter()
        .map(|(k, v)| ((*k).to_owned(), *v))
        .collect::<HashMap<_, _>>();
    alloc(FakeValue::Object(RefCell::new(map)))
}

pub fn fake_array(items: &[sys::napi_value]) -> sys::napi_value {
    alloc(FakeValue::Array(RefCell::new(items.to_vec())))
}

pub fn fake_typed_array(
    kind: sys::napi_typedarray_type,
    data: *mut c_void,
    length: usize,
    byte_offset: usize,
) -> sys::napi_value {
    alloc(FakeValue::TypedArray {
        kind,
        data,
        length,
        byte_offset,
        shared: false,
    })
}

pub fn fake_shared_typed_array(
    kind: sys::napi_typedarray_type,
    data: *mut c_void,
    length: usize,
    byte_offset: usize,
) -> sys::napi_value {
    alloc(FakeValue::TypedArray {
        kind,
        data,
        length,
        byte_offset,
        shared: true,
    })
}

pub fn fake_data_view(
    data: *mut c_void,
    byte_length: usize,
    byte_offset: usize,
) -> sys::napi_value {
    alloc(FakeValue::DataView {
        data,
        byte_length,
        byte_offset,
        shared: false,
    })
}

pub fn fake_shared_data_view(
    data: *mut c_void,
    byte_length: usize,
    byte_offset: usize,
) -> sys::napi_value {
    alloc(FakeValue::DataView {
        data,
        byte_length,
        byte_offset,
        shared: true,
    })
}

pub fn fake_function(
    implementation: impl Fn(&[sys::napi_value]) -> sys::napi_value + 'static,
) -> sys::napi_value {
    alloc(FakeValue::Function(Rc::new(implementation)))
}

pub fn fake_error(message: &str) -> sys::napi_value {
    let error = fake_object(&[("message", fake_string(message))]);
    register_error_value(error);
    error
}

pub fn fake_throwing_function(exception: sys::napi_value) -> sys::napi_value {
    fake_function(move |_| {
        set_pending_exception(exception);
        fake_undefined()
    })
}

pub fn set_object_property(object: sys::napi_value, key: &str, value: sys::napi_value) {
    if let Some(FakeValue::Object(map)) = fv(object) {
        map.borrow_mut().insert(key.to_owned(), value);
    }
}

pub fn read_double(value: sys::napi_value) -> Option<f64> {
    match fv(value)? {
        FakeValue::Double(v) => Some(*v),
        FakeValue::Int32(v) => Some(f64::from(*v)),
        FakeValue::Uint32(v) => Some(f64::from(*v)),
        FakeValue::Int64(v) => Some(*v as f64),
        _ => None,
    }
}

pub fn read_bool(value: sys::napi_value) -> Option<bool> {
    match fv(value)? {
        FakeValue::Boolean(v) => Some(*v),
        _ => None,
    }
}

pub fn read_string(value: sys::napi_value) -> Option<String> {
    match fv(value)? {
        FakeValue::String(v) => Some(v.clone()),
        _ => None,
    }
}

pub fn read_bigint_i128(value: sys::napi_value) -> Option<i128> {
    match fv(value)? {
        FakeValue::BigInt { sign_bit, words } => {
            if words.iter().skip(2).any(|word| *word != 0) {
                return None;
            }
            let low = u128::from(words.first().copied().unwrap_or(0));
            let high = u128::from(words.get(1).copied().unwrap_or(0));
            let magnitude = low | (high << 64);
            if *sign_bit {
                if magnitude > i128::MIN.unsigned_abs() {
                    return None;
                }
                Some((magnitude as i128).wrapping_neg())
            } else {
                i128::try_from(magnitude).ok()
            }
        }
        _ => None,
    }
}

fn bigint_low_word(value: sys::napi_value) -> Option<(bool, u64, bool)> {
    match fv(value)? {
        FakeValue::BigInt { sign_bit, words } => Some((
            *sign_bit,
            words.first().copied().unwrap_or(0),
            words.iter().skip(1).all(|word| *word == 0),
        )),
        _ => None,
    }
}

pub fn read_external(value: sys::napi_value) -> Option<*mut c_void> {
    match fv(value)? {
        FakeValue::External(ptr) => Some(*ptr),
        _ => None,
    }
}

pub fn read_object_property(value: sys::napi_value, key: &str) -> Option<sys::napi_value> {
    match fv(value)? {
        FakeValue::Object(map) => map.borrow().get(key).copied(),
        _ => None,
    }
}

pub fn read_array(value: sys::napi_value) -> Option<Vec<sys::napi_value>> {
    match fv(value)? {
        FakeValue::Array(items) => Some(items.borrow().clone()),
        _ => None,
    }
}

pub fn value_type(value: sys::napi_value) -> Option<sys::napi_valuetype> {
    Some(typeof_of(fv(value)?))
}

pub fn is_null(value: sys::napi_value) -> bool {
    matches!(fv(value), Some(FakeValue::Null))
}

pub fn is_undefined(value: sys::napi_value) -> bool {
    matches!(fv(value), Some(FakeValue::Undefined))
}

fn typeof_of(value: &FakeValue) -> sys::napi_valuetype {
    match value {
        FakeValue::Undefined => sys::ValueType::napi_undefined,
        FakeValue::Null => sys::ValueType::napi_null,
        FakeValue::Boolean(_) => sys::ValueType::napi_boolean,
        FakeValue::Double(_) | FakeValue::Int32(_) | FakeValue::Uint32(_) | FakeValue::Int64(_) => {
            sys::ValueType::napi_number
        }
        FakeValue::String(_) => sys::ValueType::napi_string,
        FakeValue::BigInt { .. } => sys::ValueType::napi_bigint,
        FakeValue::External(_) => sys::ValueType::napi_external,
        FakeValue::Function(_) => sys::ValueType::napi_function,
        FakeValue::Object(_)
        | FakeValue::Array(_)
        | FakeValue::TypedArray { .. }
        | FakeValue::DataView { .. }
        | FakeValue::ArrayBuffer
        | FakeValue::SharedArrayBuffer => sys::ValueType::napi_object,
    }
}

macro_rules! ok {
    () => {
        sys::Status::napi_ok
    };
}

macro_rules! pending_guard {
    () => {
        if exception_blocks_call() {
            return sys::Status::napi_pending_exception;
        }
    };
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_double(
    _env: sys::napi_env,
    value: f64,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_double");
    unsafe { *result = fake_double(value) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_value_double(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut f64,
) -> sys::napi_status {
    record("napi_get_value_double");
    let Some(number) = read_double(value) else {
        return expected_status(value, sys::Status::napi_number_expected);
    };
    unsafe { *result = number };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_int32(
    _env: sys::napi_env,
    value: i32,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_int32");
    unsafe { *result = alloc(FakeValue::Int32(value)) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_value_int32(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut i32,
) -> sys::napi_status {
    record("napi_get_value_int32");
    let Some(number) = read_double(value) else {
        return expected_status(value, sys::Status::napi_number_expected);
    };
    unsafe { *result = number as i32 };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_uint32(
    _env: sys::napi_env,
    value: u32,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_uint32");
    unsafe { *result = alloc(FakeValue::Uint32(value)) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_value_uint32(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut u32,
) -> sys::napi_status {
    record("napi_get_value_uint32");
    let Some(number) = read_double(value) else {
        return expected_status(value, sys::Status::napi_number_expected);
    };
    unsafe { *result = number as u32 };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_int64(
    _env: sys::napi_env,
    value: i64,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_int64");
    unsafe { *result = alloc(FakeValue::Int64(value)) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_boolean(
    _env: sys::napi_env,
    value: bool,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_get_boolean");
    unsafe { *result = fake_bool(value) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_value_bool(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut bool,
) -> sys::napi_status {
    record("napi_get_value_bool");
    let Some(boolean) = read_bool(value) else {
        return expected_status(value, sys::Status::napi_boolean_expected);
    };
    unsafe { *result = boolean };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_string_utf8(
    _env: sys::napi_env,
    str_: *const c_char,
    length: isize,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_string_utf8");
    let string = unsafe { read_c_string(str_, length) };
    unsafe { *result = fake_string(&string) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_string_latin1(
    _env: sys::napi_env,
    str_: *const c_char,
    length: isize,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_string_latin1");
    let string = unsafe { read_c_string(str_, length) };
    unsafe { *result = fake_string(&string) };
    ok!()
}

unsafe fn read_c_string(str_: *const c_char, length: isize) -> String {
    if str_.is_null() {
        return String::new();
    }
    if length < 0 {
        unsafe { CStr::from_ptr(str_) }
            .to_string_lossy()
            .into_owned()
    } else {
        let bytes = unsafe { std::slice::from_raw_parts(str_.cast::<u8>(), length as usize) };
        String::from_utf8_lossy(bytes).into_owned()
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_value_string_utf8(
    _env: sys::napi_env,
    value: sys::napi_value,
    buf: *mut c_char,
    bufsize: usize,
    result: *mut usize,
) -> sys::napi_status {
    record("napi_get_value_string_utf8");
    let Some(string) = read_string(value) else {
        return expected_status(value, sys::Status::napi_string_expected);
    };
    let bytes = string.as_bytes();
    if buf.is_null() {
        unsafe { *result = bytes.len() };
    } else if bufsize == 0 {
        if !result.is_null() {
            unsafe { *result = 0 };
        }
    } else {
        let copy = bytes.len().min(bufsize - 1);
        unsafe {
            std::ptr::copy_nonoverlapping(bytes.as_ptr().cast::<c_char>(), buf, copy);
            *buf.add(copy) = 0;
            if !result.is_null() {
                *result = copy;
            }
        }
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_bigint_int64(
    _env: sys::napi_env,
    value: i64,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_bigint_int64");
    unsafe { *result = fake_bigint_i128(i128::from(value)) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_bigint_uint64(
    _env: sys::napi_env,
    value: u64,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_bigint_uint64");
    unsafe { *result = fake_bigint_i128(i128::from(value)) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_bigint_words(
    _env: sys::napi_env,
    sign_bit: c_int,
    word_count: usize,
    words: *const u64,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_bigint_words");
    let words = if words.is_null() || word_count == 0 {
        Vec::new()
    } else {
        unsafe { std::slice::from_raw_parts(words, word_count) }.to_vec()
    };
    unsafe {
        *result = alloc(FakeValue::BigInt {
            sign_bit: sign_bit != 0,
            words,
        })
    };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_value_bigint_words(
    _env: sys::napi_env,
    value: sys::napi_value,
    sign_bit: *mut c_int,
    word_count: *mut usize,
    words: *mut u64,
) -> sys::napi_status {
    record("napi_get_value_bigint_words");
    let (sign, source) = match fv(value) {
        Some(FakeValue::BigInt { sign_bit, words }) => (*sign_bit, words.clone()),
        None => return sys::Status::napi_invalid_arg,
        Some(_) => return sys::Status::napi_bigint_expected,
    };
    if word_count.is_null() || words.is_null() != sign_bit.is_null() {
        return sys::Status::napi_invalid_arg;
    }
    if !words.is_null() {
        let capacity = unsafe { *word_count };
        let copy = capacity.min(source.len());
        unsafe {
            std::ptr::copy_nonoverlapping(source.as_ptr(), words, copy);
            *sign_bit = c_int::from(sign);
        }
    }
    unsafe { *word_count = source.len() };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_value_bigint_int64(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut i64,
    lossless: *mut bool,
) -> sys::napi_status {
    record("napi_get_value_bigint_int64");
    let Some((sign, low, rest_zero)) = bigint_low_word(value) else {
        return expected_status(value, sys::Status::napi_bigint_expected);
    };
    let wrapped = if sign { low.wrapping_neg() } else { low };
    unsafe {
        *result = wrapped as i64;
        if !lossless.is_null() {
            *lossless = rest_zero
                && if sign {
                    low <= i64::MIN.unsigned_abs()
                } else {
                    low <= i64::MAX as u64
                };
        }
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_value_bigint_uint64(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut u64,
    lossless: *mut bool,
) -> sys::napi_status {
    record("napi_get_value_bigint_uint64");
    let Some((sign, low, rest_zero)) = bigint_low_word(value) else {
        return expected_status(value, sys::Status::napi_bigint_expected);
    };
    unsafe {
        *result = if sign { low.wrapping_neg() } else { low };
        if !lossless.is_null() {
            *lossless = rest_zero && (!sign || low == 0);
        }
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_null(
    _env: sys::napi_env,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_get_null");
    unsafe { *result = fake_null() };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_undefined(
    _env: sys::napi_env,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_get_undefined");
    unsafe { *result = fake_undefined() };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_typeof(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut sys::napi_valuetype,
) -> sys::napi_status {
    record("napi_typeof");
    let ty = fv(value).map_or(sys::ValueType::napi_undefined, typeof_of);
    unsafe { *result = ty };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_object(
    _env: sys::napi_env,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_object");
    unsafe { *result = alloc(FakeValue::Object(RefCell::new(HashMap::new()))) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_coerce_to_object(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_coerce_to_object");
    pending_guard!();
    let coerced = match fv(value) {
        None | Some(FakeValue::Undefined | FakeValue::Null) => {
            return sys::Status::napi_object_expected;
        }
        Some(FakeValue::Object(_) | FakeValue::Array(_)) => value,
        Some(_) => alloc(FakeValue::Object(RefCell::new(HashMap::new()))),
    };
    unsafe { *result = coerced };
    ok!()
}

fn named_property_key(
    object: sys::napi_value,
    utf8name: *const c_char,
) -> Result<String, sys::napi_status> {
    if matches!(
        fv(object),
        None | Some(FakeValue::Undefined | FakeValue::Null)
    ) {
        return Err(sys::Status::napi_object_expected);
    }
    Ok(unsafe { CStr::from_ptr(utf8name) }
        .to_string_lossy()
        .into_owned())
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_named_property(
    _env: sys::napi_env,
    object: sys::napi_value,
    utf8name: *const c_char,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_get_named_property");
    pending_guard!();
    let key = match named_property_key(object, utf8name) {
        Ok(key) => key,
        Err(status) => return status,
    };
    let found = read_object_property(object, &key);
    unsafe { *result = found.unwrap_or_else(fake_undefined) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_set_named_property(
    _env: sys::napi_env,
    object: sys::napi_value,
    utf8name: *const c_char,
    value: sys::napi_value,
) -> sys::napi_status {
    record("napi_set_named_property");
    pending_guard!();
    let key = match named_property_key(object, utf8name) {
        Ok(key) => key,
        Err(status) => return status,
    };
    if let Some(FakeValue::Object(map)) = fv(object) {
        map.borrow_mut().insert(key, value);
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_array(
    _env: sys::napi_env,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_array");
    unsafe { *result = alloc(FakeValue::Array(RefCell::new(Vec::new()))) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_array_with_length(
    _env: sys::napi_env,
    length: usize,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_array_with_length");
    unsafe {
        *result = alloc(FakeValue::Array(RefCell::new(vec![
            fake_undefined();
            length
        ])))
    };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_array_length(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut u32,
) -> sys::napi_status {
    record("napi_get_array_length");
    pending_guard!();
    let Some(FakeValue::Array(items)) = fv(value)  else {
        return expected_status(value, sys::Status::napi_array_expected);
    };
    unsafe { *result = items.borrow().len() as u32 };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_element(
    _env: sys::napi_env,
    object: sys::napi_value,
    index: u32,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_get_element");
    pending_guard!();
    let element = match fv(object) {
        None | Some(FakeValue::Undefined | FakeValue::Null) => {
            return sys::Status::napi_object_expected;
        }
        Some(FakeValue::Array(items)) => items.borrow().get(index as usize).copied(),
        Some(_) => None,
    };
    unsafe { *result = element.unwrap_or_else(fake_undefined) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_set_element(
    _env: sys::napi_env,
    object: sys::napi_value,
    index: u32,
    value: sys::napi_value,
) -> sys::napi_status {
    record("napi_set_element");
    pending_guard!();
    match fv(object) {
        None | Some(FakeValue::Undefined | FakeValue::Null) => {
            return sys::Status::napi_object_expected;
        }
        Some(FakeValue::Array(items)) => {
            let mut items = items.borrow_mut();
            let index = index as usize;
            if index >= items.len() {
                items.resize(index + 1, fake_undefined());
            }
            items[index] = value;
        }
        Some(_) => {}
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_is_array(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut bool,
) -> sys::napi_status {
    record("napi_is_array");
    unsafe { *result = matches!(fv(value), Some(FakeValue::Array(_))) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_is_typedarray(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut bool,
) -> sys::napi_status {
    record("napi_is_typedarray");
    unsafe { *result = matches!(fv(value), Some(FakeValue::TypedArray { .. })) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_is_dataview(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut bool,
) -> sys::napi_status {
    record("napi_is_dataview");
    unsafe { *result = matches!(fv(value), Some(FakeValue::DataView { .. })) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_is_arraybuffer(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut bool,
) -> sys::napi_status {
    record("napi_is_arraybuffer");
    unsafe { *result = matches!(fv(value), Some(FakeValue::ArrayBuffer)) };
    ok!()
}

unsafe fn write_view_info(
    length: *mut usize,
    data: *mut *mut c_void,
    arraybuffer: *mut sys::napi_value,
    byte_offset: *mut usize,
    view_data: *mut c_void,
    view_length: usize,
    view_offset: usize,
    view_shared: bool,
) {
    unsafe {
        if !length.is_null() {
            *length = view_length;
        }
        if !data.is_null() {
            *data = view_data;
        }
        if !arraybuffer.is_null() {
            *arraybuffer = alloc(if view_shared {
                FakeValue::SharedArrayBuffer
            } else {
                FakeValue::ArrayBuffer
            });
        }
        if !byte_offset.is_null() {
            *byte_offset = view_offset;
        }
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_typedarray_info(
    _env: sys::napi_env,
    typedarray: sys::napi_value,
    type_: *mut sys::napi_typedarray_type,
    length: *mut usize,
    data: *mut *mut c_void,
    arraybuffer: *mut sys::napi_value,
    byte_offset: *mut usize,
) -> sys::napi_status {
    record("napi_get_typedarray_info");
    let Some(FakeValue::TypedArray {
        kind,
        data: view_data,
        length: view_len,
        byte_offset: view_off,
        shared,
    }) = fv(typedarray) 
    else {
        return sys::Status::napi_invalid_arg;
    };
    unsafe {
        if !type_.is_null() {
            *type_ = *kind;
        }
        write_view_info(
            length,
            data,
            arraybuffer,
            byte_offset,
            *view_data,
            *view_len,
            *view_off,
            *shared,
        );
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_dataview_info(
    _env: sys::napi_env,
    dataview: sys::napi_value,
    bytelength: *mut usize,
    data: *mut *mut c_void,
    arraybuffer: *mut sys::napi_value,
    byte_offset: *mut usize,
) -> sys::napi_status {
    record("napi_get_dataview_info");
    let Some(FakeValue::DataView {
        data: view_data,
        byte_length,
        byte_offset: view_off,
        shared,
    }) = fv(dataview) 
    else {
        return sys::Status::napi_invalid_arg;
    };
    unsafe {
        write_view_info(
            bytelength,
            data,
            arraybuffer,
            byte_offset,
            *view_data,
            *byte_length,
            *view_off,
            *shared,
        );
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_external(
    _env: sys::napi_env,
    data: *mut c_void,
    finalize_cb: sys::napi_finalize,
    finalize_hint: *mut c_void,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_external");
    let external = fake_external(data);
    STATE.with_borrow_mut(|state| {
        state.finalizers.push(Finalizer {
            value: external,
            cb: finalize_cb,
            data,
            hint: finalize_hint,
        });
    });
    unsafe { *result = external };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_value_external(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut *mut c_void,
) -> sys::napi_status {
    record("napi_get_value_external");
    let Some(data) = read_external(value) else {
        return sys::Status::napi_invalid_arg;
    };
    unsafe { *result = data };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_adjust_external_memory(
    _env: sys::napi_env,
    change_in_bytes: i64,
    adjusted_value: *mut i64,
) -> sys::napi_status {
    record("napi_adjust_external_memory");
    if !adjusted_value.is_null() {
        unsafe { *adjusted_value = change_in_bytes };
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_reference(
    _env: sys::napi_env,
    value: sys::napi_value,
    initial_refcount: u32,
    result: *mut sys::napi_ref,
) -> sys::napi_status {
    record("napi_create_reference");
    STATE.with_borrow_mut(|state| {
        let ref_ = register_ref(state, value, initial_refcount);
        unsafe { *result = ref_ };
    });
    ok!()
}

fn register_ref(state: &mut State, value: sys::napi_value, initial_count: u32) -> sys::napi_ref {
    let ptr = Box::into_raw(Box::new(RefEntry {
        value,
        count: Cell::new(initial_count),
        deleted: Cell::new(false),
    }));
    state.refs.push(ptr);
    ptr.cast()
}

fn ref_entry<'a>(ref_: sys::napi_ref) -> Option<&'a RefEntry> {
    if ref_.is_null() {
        return None;
    }
    let ptr = ref_.cast::<RefEntry>();
    let live = STATE.with_borrow(|state| state.refs.contains(&ptr));
    assert!(live, "napi_mock: unknown or stale napi_ref handle {ref_:?}");
    Some(unsafe { &*ptr })
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_delete_reference(
    _env: sys::napi_env,
    ref_: sys::napi_ref,
) -> sys::napi_status {
    record("napi_delete_reference");
    if let Some(entry) = ref_entry(ref_) {
        entry.deleted.set(true);
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_reference_value(
    _env: sys::napi_env,
    ref_: sys::napi_ref,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_get_reference_value");
    let value = ref_entry(ref_)
        .filter(|entry| !entry.deleted.get())
        .map_or(std::ptr::null_mut(), |entry| entry.value);
    unsafe { *result = value };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_reference_ref(
    _env: sys::napi_env,
    ref_: sys::napi_ref,
    result: *mut u32,
) -> sys::napi_status {
    record("napi_reference_ref");
    let count = ref_entry(ref_).map_or(0, |entry| {
        let next = entry.count.get() + 1;
        entry.count.set(next);
        next
    });
    if !result.is_null() {
        unsafe { *result = count };
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_reference_unref(
    _env: sys::napi_env,
    ref_: sys::napi_ref,
    result: *mut u32,
) -> sys::napi_status {
    record("napi_reference_unref");
    let Some(entry) = ref_entry(ref_)  else {
        return sys::Status::napi_invalid_arg;
    };
    if entry.count.get() == 0 {
        return sys::Status::napi_generic_failure;
    }
    let next = entry.count.get() - 1;
    entry.count.set(next);
    if !result.is_null() {
        unsafe { *result = next };
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_add_finalizer(
    _env: sys::napi_env,
    js_object: sys::napi_value,
    native_object: *mut c_void,
    finalize_cb: sys::napi_finalize,
    finalize_hint: *mut c_void,
    result: *mut sys::napi_ref,
) -> sys::napi_status {
    record("napi_add_finalizer");
    STATE.with_borrow_mut(|state| {
        state.finalizers.push(Finalizer {
            value: js_object,
            cb: finalize_cb,
            data: native_object,
            hint: finalize_hint,
        });
        if !result.is_null() {
            let ref_ = register_ref(state, js_object, 1);
            unsafe { *result = ref_ };
        }
    });
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_async_init(
    _env: sys::napi_env,
    _async_resource: sys::napi_value,
    _async_resource_name: sys::napi_value,
    result: *mut sys::napi_async_context,
) -> sys::napi_status {
    record("napi_async_init");
    unsafe { *result = SENTINEL_ASYNC.cast() };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_open_handle_scope(
    _env: sys::napi_env,
    result: *mut sys::napi_handle_scope,
) -> sys::napi_status {
    record("napi_open_handle_scope");
    unsafe { *result = SENTINEL_SCOPE.cast() };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_close_handle_scope(
    _env: sys::napi_env,
    _scope: sys::napi_handle_scope,
) -> sys::napi_status {
    record("napi_close_handle_scope");
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_open_callback_scope(
    _env: sys::napi_env,
    _resource_object: sys::napi_value,
    _context: sys::napi_async_context,
    result: *mut sys::napi_callback_scope,
) -> sys::napi_status {
    record("napi_open_callback_scope");
    unsafe { *result = SENTINEL_SCOPE.cast() };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_close_callback_scope(
    _env: sys::napi_env,
    _scope: sys::napi_callback_scope,
) -> sys::napi_status {
    record("napi_close_callback_scope");
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_global(
    _env: sys::napi_env,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_get_global");
    let global = STATE.with_borrow(|state| state.global);
    let global = global.unwrap_or_else(|| {
        let value = alloc(FakeValue::Object(RefCell::new(HashMap::new())));
        STATE.with_borrow_mut(|state| state.global = Some(value));
        value
    });
    unsafe { *result = global };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_error(
    _env: sys::napi_env,
    _code: sys::napi_value,
    msg: sys::napi_value,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_error");
    let mut map = HashMap::new();
    map.insert("message".to_owned(), msg);
    let error = alloc(FakeValue::Object(RefCell::new(map)));
    register_error_value(error);
    unsafe { *result = error };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_call_function(
    _env: sys::napi_env,
    _recv: sys::napi_value,
    func: sys::napi_value,
    argc: usize,
    argv: *const sys::napi_value,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_call_function");
    pending_guard!();
    let implementation = match fv(func) {
        Some(FakeValue::Function(implementation)) => Rc::clone(implementation),
        None => return sys::Status::napi_invalid_arg,
        Some(_) => return sys::Status::napi_function_expected,
    };
    let args = if argv.is_null() || argc == 0 {
        Vec::new()
    } else {
        unsafe { std::slice::from_raw_parts(argv, argc) }.to_vec()
    };
    let returned = implementation(&args);
    if exception_blocks_call() {
        return sys::Status::napi_pending_exception;
    }
    if !result.is_null() {
        unsafe { *result = returned };
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_throw(
    _env: sys::napi_env,
    error: sys::napi_value,
) -> sys::napi_status {
    record("napi_throw");
    pending_guard!();
    STATE.with_borrow_mut(|state| {
        state.pending_exception = Some(error);
        state.thrown_exceptions.push(error);
    });
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_is_error(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut bool,
) -> sys::napi_status {
    record("napi_is_error");
    unsafe { *result = is_error_value(value) };
    ok!()
}

fn format_js_number(value: f64) -> String {
    if value.is_finite() && value.fract() == 0.0 {
        format!("{}", value as i64)
    } else {
        value.to_string()
    }
}

fn coerced_string_content(value: sys::napi_value) -> String {
    match fv(value) {
        None | Some(FakeValue::Undefined) => "undefined".to_owned(),
        Some(FakeValue::Null) => "null".to_owned(),
        Some(FakeValue::Boolean(v)) => v.to_string(),
        Some(
            FakeValue::Double(_) | FakeValue::Int32(_) | FakeValue::Uint32(_) | FakeValue::Int64(_),
        ) => format_js_number(read_double(value).unwrap_or(f64::NAN)),
        Some(FakeValue::BigInt { .. }) => read_bigint_i128(value).unwrap_or(0).to_string(),
        Some(FakeValue::String(v)) => v.clone(),
        Some(FakeValue::Function(_)) => "function () {}".to_owned(),
        Some(FakeValue::Object(map)) if is_error_value(value) => {
            let message = map
                .borrow()
                .get("message")
                .copied()
                .and_then(read_string)
                .unwrap_or_default();
            format!("Error: {message}")
        }
        Some(
            FakeValue::Object(_)
            | FakeValue::Array(_)
            | FakeValue::External(_)
            | FakeValue::TypedArray { .. }
            | FakeValue::DataView { .. }
            | FakeValue::ArrayBuffer
            | FakeValue::SharedArrayBuffer,
        ) => "[object Object]".to_owned(),
    }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_coerce_to_string(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_coerce_to_string");
    pending_guard!();
    let coerced = match fv(value) {
        Some(FakeValue::String(_)) => value,
        _ => fake_string(&coerced_string_content(value)),
    };
    unsafe { *result = coerced };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_fatal_exception(
    _env: sys::napi_env,
    err: sys::napi_value,
) -> sys::napi_status {
    record("napi_fatal_exception");
    STATE.with_borrow_mut(|state| state.fatal_exceptions.push(err));
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_is_exception_pending(
    _env: sys::napi_env,
    result: *mut bool,
) -> sys::napi_status {
    record("napi_is_exception_pending");
    let pending = STATE.with_borrow(|state| state.pending_exception.is_some());
    unsafe { *result = pending };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_and_clear_last_exception(
    _env: sys::napi_env,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_get_and_clear_last_exception");
    let exception = STATE.with_borrow_mut(|state| state.pending_exception.take());
    unsafe { *result = exception.unwrap_or_else(fake_undefined) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_uv_event_loop(
    _env: sys::napi_env,
    loop_: *mut *mut sys::uv_loop_s,
) -> sys::napi_status {
    record("napi_get_uv_event_loop");
    unsafe { *loop_ = SENTINEL_UV_LOOP };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_create_function(
    _env: sys::napi_env,
    _utf8name: *const c_char,
    _length: isize,
    _cb: sys::napi_callback,
    _data: *mut c_void,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_create_function");
    unsafe { *result = fake_function(|_| std::ptr::null_mut()) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_last_error_info(
    _env: sys::napi_env,
    result: *mut *const sys::napi_extended_error_info,
) -> sys::napi_status {
    record("napi_get_last_error_info");
    thread_local! {
        static INFO: sys::napi_extended_error_info = sys::napi_extended_error_info {
            error_message: c"gtkx-mock".as_ptr(),
            engine_reserved: std::ptr::null_mut(),
            engine_error_code: 0,
            error_code: sys::Status::napi_ok,
        };
    }
    INFO.with(|info| unsafe { *result = std::ptr::from_ref(info) });
    ok!()
}

fn reference_symbols() {
    keep_symbols!(
        napi_create_double,
        napi_get_value_double,
        napi_create_int32,
        napi_get_value_int32,
        napi_create_uint32,
        napi_get_value_uint32,
        napi_create_int64,
        napi_get_boolean,
        napi_get_value_bool,
        napi_create_string_utf8,
        napi_create_string_latin1,
        napi_get_value_string_utf8,
        napi_create_bigint_int64,
        napi_create_bigint_uint64,
        napi_create_bigint_words,
        napi_get_value_bigint_words,
        napi_get_value_bigint_int64,
        napi_get_value_bigint_uint64,
        napi_get_null,
        napi_get_undefined,
        napi_typeof,
        napi_create_object,
        napi_coerce_to_object,
        napi_get_named_property,
        napi_set_named_property,
        napi_create_array,
        napi_create_array_with_length,
        napi_get_array_length,
        napi_get_element,
        napi_set_element,
        napi_is_array,
        napi_is_typedarray,
        napi_is_dataview,
        napi_is_arraybuffer,
        napi_get_typedarray_info,
        napi_get_dataview_info,
        napi_create_external,
        napi_get_value_external,
        napi_adjust_external_memory,
        napi_create_reference,
        napi_delete_reference,
        napi_get_reference_value,
        napi_reference_ref,
        napi_reference_unref,
        napi_add_finalizer,
        napi_async_init,
        napi_open_handle_scope,
        napi_close_handle_scope,
        napi_open_callback_scope,
        napi_close_callback_scope,
        napi_get_global,
        napi_create_error,
        napi_call_function,
        napi_throw,
        napi_is_error,
        napi_coerce_to_string,
        napi_fatal_exception,
        napi_is_exception_pending,
        napi_get_and_clear_last_exception,
        napi_get_uv_event_loop,
        napi_create_function,
        napi_get_last_error_info,
    );
}

pub fn install_napi_mock() {
    reference_symbols();
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let library = unsafe { sys::setup() };
        std::mem::forget(library);
    });
}
