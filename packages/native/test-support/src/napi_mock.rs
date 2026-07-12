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
    BigInt { sign_bit: bool, words: Vec<u64> },
    Object(RefCell<HashMap<String, sys::napi_value>>),
    Array(RefCell<Vec<sys::napi_value>>),
    External(*mut c_void),
    Function(FnImpl),
    TypedArray {
        kind: sys::napi_typedarray_type,
        data: *mut c_void,
        length: usize,
        byte_offset: usize,
    },
    DataView {
        data: *mut c_void,
        byte_length: usize,
        byte_offset: usize,
    },
    ArrayBuffer,
}

struct RefEntry {
    value: sys::napi_value,
    count: Cell<u32>,
    deleted: Cell<bool>,
}

struct Finalizer {
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
    values: Vec<Box<FakeValue>>,
    refs: Vec<Box<RefEntry>>,
    finalizers: Vec<Finalizer>,
    global: Option<sys::napi_value>,
    recorder: Recorder,
}

impl Default for State {
    fn default() -> Self {
        Self {
            values: Vec::new(),
            refs: Vec::new(),
            finalizers: Vec::new(),
            global: None,
            recorder: Recorder::default(),
        }
    }
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

const SENTINEL_ENV: sys::napi_env = std::ptr::without_provenance_mut(0x1);
const SENTINEL_SCOPE: *mut c_void = std::ptr::without_provenance_mut(0x2);
const SENTINEL_ASYNC: *mut c_void = std::ptr::without_provenance_mut(0x3);

pub fn fake_env() -> Env {
    Env::from_raw(SENTINEL_ENV)
}

pub fn to_unknown<'e>(env: &'e Env, value: sys::napi_value) -> napi::bindgen_prelude::Unknown<'e> {
    unsafe { napi::bindgen_prelude::Unknown::from_raw_unchecked(env.raw(), value) }
}

fn record(name: &str) {
    STATE.with_borrow_mut(|state| state.recorder.record(name));
}

fn alloc(value: FakeValue) -> sys::napi_value {
    STATE.with_borrow_mut(|state| {
        let boxed = Box::new(value);
        let ptr = std::ptr::from_ref(&*boxed) as *mut FakeValue;
        state.values.push(boxed);
        ptr.cast()
    })
}

unsafe fn fv<'a>(value: sys::napi_value) -> Option<&'a FakeValue> {
    if value.is_null() {
        return None;
    }
    Some(unsafe { &*value.cast::<FakeValue>() })
}

pub fn reset() {
    let finalizers = STATE.with_borrow_mut(|state| std::mem::take(&mut state.finalizers));
    for f in finalizers {
        if let Some(cb) = f.cb {
            unsafe { cb(SENTINEL_ENV, f.data, f.hint) };
        }
    }
    STATE.with_borrow_mut(|state| {
        state.values.clear();
        state.refs.clear();
        state.global = None;
        state.recorder = Recorder::default();
    });
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
    unsafe { ref_entry(napi_ref) }.map(|entry| entry.count.get())
}

pub fn reference_is_deleted(napi_ref: sys::napi_ref) -> bool {
    unsafe { ref_entry(napi_ref) }.is_some_and(|entry| entry.deleted.get())
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
    })
}

pub fn fake_data_view(data: *mut c_void, byte_length: usize, byte_offset: usize) -> sys::napi_value {
    alloc(FakeValue::DataView {
        data,
        byte_length,
        byte_offset,
    })
}

pub fn fake_function(implementation: impl Fn(&[sys::napi_value]) -> sys::napi_value + 'static) -> sys::napi_value {
    alloc(FakeValue::Function(Rc::new(implementation)))
}

pub fn read_double(value: sys::napi_value) -> Option<f64> {
    match unsafe { fv(value) }? {
        FakeValue::Double(v) => Some(*v),
        FakeValue::Int32(v) => Some(f64::from(*v)),
        FakeValue::Uint32(v) => Some(f64::from(*v)),
        FakeValue::Int64(v) => Some(*v as f64),
        _ => None,
    }
}

pub fn read_bool(value: sys::napi_value) -> Option<bool> {
    match unsafe { fv(value) }? {
        FakeValue::Boolean(v) => Some(*v),
        _ => None,
    }
}

pub fn read_string(value: sys::napi_value) -> Option<String> {
    match unsafe { fv(value) }? {
        FakeValue::String(v) => Some(v.clone()),
        _ => None,
    }
}

pub fn read_bigint_i128(value: sys::napi_value) -> Option<i128> {
    match unsafe { fv(value) }? {
        FakeValue::BigInt { sign_bit, words } => {
            let low = u128::from(words.first().copied().unwrap_or(0));
            let high = u128::from(words.get(1).copied().unwrap_or(0));
            let magnitude = low | (high << 64);
            let signed = magnitude as i128;
            Some(if *sign_bit { -signed } else { signed })
        }
        _ => None,
    }
}

pub fn read_external(value: sys::napi_value) -> Option<*mut c_void> {
    match unsafe { fv(value) }? {
        FakeValue::External(ptr) => Some(*ptr),
        _ => None,
    }
}

pub fn read_object_property(value: sys::napi_value, key: &str) -> Option<sys::napi_value> {
    match unsafe { fv(value) }? {
        FakeValue::Object(map) => map.borrow().get(key).copied(),
        _ => None,
    }
}

pub fn read_array(value: sys::napi_value) -> Option<Vec<sys::napi_value>> {
    match unsafe { fv(value) }? {
        FakeValue::Array(items) => Some(items.borrow().clone()),
        _ => None,
    }
}

pub fn value_type(value: sys::napi_value) -> Option<sys::napi_valuetype> {
    Some(typeof_of(unsafe { fv(value) }?))
}

pub fn is_null(value: sys::napi_value) -> bool {
    matches!(unsafe { fv(value) }, Some(FakeValue::Null))
}

pub fn is_undefined(value: sys::napi_value) -> bool {
    matches!(unsafe { fv(value) }, Some(FakeValue::Undefined))
}

fn typeof_of(value: &FakeValue) -> sys::napi_valuetype {
    match value {
        FakeValue::Undefined => sys::ValueType::napi_undefined,
        FakeValue::Null => sys::ValueType::napi_null,
        FakeValue::Boolean(_) => sys::ValueType::napi_boolean,
        FakeValue::Double(_)
        | FakeValue::Int32(_)
        | FakeValue::Uint32(_)
        | FakeValue::Int64(_) => sys::ValueType::napi_number,
        FakeValue::String(_) => sys::ValueType::napi_string,
        FakeValue::BigInt { .. } => sys::ValueType::napi_bigint,
        FakeValue::External(_) => sys::ValueType::napi_external,
        FakeValue::Function(_) => sys::ValueType::napi_function,
        FakeValue::Object(_)
        | FakeValue::Array(_)
        | FakeValue::TypedArray { .. }
        | FakeValue::DataView { .. }
        | FakeValue::ArrayBuffer => sys::ValueType::napi_object,
    }
}

// ---------------------------------------------------------------------------
// #[no_mangle] recording mocks. Signatures mirror napi_sys exactly.
// ---------------------------------------------------------------------------

macro_rules! ok {
    () => {
        sys::Status::napi_ok
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
    unsafe { *result = read_double(value).unwrap_or(0.0) };
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
    unsafe { *result = read_double(value).unwrap_or(0.0) as i32 };
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
    unsafe { *result = read_double(value).unwrap_or(0.0) as u32 };
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
    unsafe { *result = read_bool(value).unwrap_or(false) };
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
    let string = read_string(value).unwrap_or_default();
    let bytes = string.as_bytes();
    if buf.is_null() {
        unsafe { *result = bytes.len() };
    } else {
        let copy = bytes.len().min(bufsize.saturating_sub(1));
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
    let (sign, source) = match unsafe { fv(value) } {
        Some(FakeValue::BigInt { sign_bit, words }) => (*sign_bit, words.clone()),
        _ => (false, Vec::new()),
    };
    if !sign_bit.is_null() {
        unsafe { *sign_bit = c_int::from(sign) };
    }
    if words.is_null() {
        if !word_count.is_null() {
            unsafe { *word_count = source.len() };
        }
    } else {
        let capacity = if word_count.is_null() {
            source.len()
        } else {
            unsafe { *word_count }
        };
        let copy = capacity.min(source.len());
        unsafe {
            std::ptr::copy_nonoverlapping(source.as_ptr(), words, copy);
            if !word_count.is_null() {
                *word_count = copy;
            }
        }
    }
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
    let n = read_bigint_i128(value).unwrap_or(0);
    unsafe {
        *result = n as i64;
        if !lossless.is_null() {
            *lossless = i128::from(n as i64) == n;
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
    let n = read_bigint_i128(value).unwrap_or(0);
    unsafe {
        *result = n as u64;
        if !lossless.is_null() {
            *lossless = n >= 0 && i128::from(n as u64) == n;
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
    let ty = unsafe { fv(value) }.map_or(sys::ValueType::napi_undefined, typeof_of);
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
    let coerced = match unsafe { fv(value) } {
        Some(FakeValue::Object(_) | FakeValue::Array(_)) => value,
        _ => alloc(FakeValue::Object(RefCell::new(HashMap::new()))),
    };
    unsafe { *result = coerced };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_named_property(
    _env: sys::napi_env,
    object: sys::napi_value,
    utf8name: *const c_char,
    result: *mut sys::napi_value,
) -> sys::napi_status {
    record("napi_get_named_property");
    let key = unsafe { CStr::from_ptr(utf8name) }.to_string_lossy().into_owned();
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
    let key = unsafe { CStr::from_ptr(utf8name) }.to_string_lossy().into_owned();
    if let Some(FakeValue::Object(map)) = unsafe { fv(object) } {
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
        *result = alloc(FakeValue::Array(RefCell::new(vec![fake_undefined(); length])))
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
    let len = match unsafe { fv(value) } {
        Some(FakeValue::Array(items)) => items.borrow().len() as u32,
        _ => 0,
    };
    unsafe { *result = len };
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
    let element = match unsafe { fv(object) } {
        Some(FakeValue::Array(items)) => items.borrow().get(index as usize).copied(),
        _ => None,
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
    if let Some(FakeValue::Array(items)) = unsafe { fv(object) } {
        let mut items = items.borrow_mut();
        let index = index as usize;
        if index >= items.len() {
            items.resize(index + 1, fake_undefined());
        }
        items[index] = value;
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
) {
    unsafe {
        if !length.is_null() {
            *length = view_length;
        }
        if !data.is_null() {
            *data = view_data;
        }
        if !arraybuffer.is_null() {
            *arraybuffer = alloc(FakeValue::ArrayBuffer);
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
    if let Some(FakeValue::TypedArray {
        kind,
        data: view_data,
        length: view_len,
        byte_offset: view_off,
    }) = unsafe { fv(typedarray) }
    {
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
            );
        }
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
    if let Some(FakeValue::DataView {
        data: view_data,
        byte_length,
        byte_offset: view_off,
    }) = unsafe { fv(dataview) }
    {
        unsafe {
            write_view_info(
                bytelength,
                data,
                arraybuffer,
                byte_offset,
                *view_data,
                *byte_length,
                *view_off,
            );
        }
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
    STATE.with_borrow_mut(|state| {
        state.finalizers.push(Finalizer {
            cb: finalize_cb,
            data,
            hint: finalize_hint,
        });
    });
    unsafe { *result = fake_external(data) };
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_get_value_external(
    _env: sys::napi_env,
    value: sys::napi_value,
    result: *mut *mut c_void,
) -> sys::napi_status {
    record("napi_get_value_external");
    unsafe { *result = read_external(value).unwrap_or(std::ptr::null_mut()) };
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
    let entry = Box::new(RefEntry {
        value,
        count: Cell::new(initial_count),
        deleted: Cell::new(false),
    });
    let ptr = std::ptr::from_ref(&*entry) as *mut RefEntry;
    state.refs.push(entry);
    ptr.cast()
}

unsafe fn ref_entry<'a>(ref_: sys::napi_ref) -> Option<&'a RefEntry> {
    if ref_.is_null() {
        return None;
    }
    Some(unsafe { &*ref_.cast::<RefEntry>() })
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_delete_reference(
    _env: sys::napi_env,
    ref_: sys::napi_ref,
) -> sys::napi_status {
    record("napi_delete_reference");
    if let Some(entry) = unsafe { ref_entry(ref_) } {
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
    let value = unsafe { ref_entry(ref_) }
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
    let count = unsafe { ref_entry(ref_) }.map_or(0, |entry| {
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
    let count = unsafe { ref_entry(ref_) }.map_or(0, |entry| {
        let next = entry.count.get().saturating_sub(1);
        entry.count.set(next);
        next
    });
    if !result.is_null() {
        unsafe { *result = count };
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_add_finalizer(
    _env: sys::napi_env,
    _js_object: sys::napi_value,
    native_object: *mut c_void,
    finalize_cb: sys::napi_finalize,
    finalize_hint: *mut c_void,
    result: *mut sys::napi_ref,
) -> sys::napi_status {
    record("napi_add_finalizer");
    STATE.with_borrow_mut(|state| {
        state.finalizers.push(Finalizer {
            cb: finalize_cb,
            data: native_object,
            hint: finalize_hint,
        });
        if !result.is_null() {
            let ref_ = register_ref(state, _js_object, 1);
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
    unsafe { *result = alloc(FakeValue::Object(RefCell::new(map))) };
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
    let implementation = match unsafe { fv(func) } {
        Some(FakeValue::Function(implementation)) => Rc::clone(implementation),
        _ => {
            if !result.is_null() {
                unsafe { *result = fake_undefined() };
            }
            return ok!();
        }
    };
    let args = if argv.is_null() || argc == 0 {
        Vec::new()
    } else {
        unsafe { std::slice::from_raw_parts(argv, argc) }.to_vec()
    };
    let returned = implementation(&args);
    if !result.is_null() {
        unsafe { *result = returned };
    }
    ok!()
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn napi_fatal_exception(
    _env: sys::napi_env,
    _err: sys::napi_value,
) -> sys::napi_status {
    record("napi_fatal_exception");
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
    macro_rules! keep {
        ($($symbol:ident),* $(,)?) => {
            $( std::hint::black_box($symbol as *const ()); )*
        };
    }
    keep!(
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
        napi_fatal_exception,
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
