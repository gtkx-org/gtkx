use std::ffi::c_void;
use std::mem::ManuallyDrop;
use std::sync::Arc;
use std::sync::atomic::{AtomicPtr, Ordering};

use ::libffi::low as libffi_low;
use ::libffi::middle as libffi;
use neon::event::Channel;
use neon::handle::Root;
use neon::types::JsFunction;

use crate::js_dispatch::JsDispatcher;
use crate::types::{IntegerKind, Type};
use crate::value::Value;

pub struct TrampolineData {
    pub channel: Channel,
    pub js_func: Arc<Root<JsFunction>>,
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
            .finish()
    }
}

pub struct TrampolineState {
    _closure: ManuallyDrop<libffi::Closure<'static>>,
    pub code_ptr: *mut c_void,
    data: ManuallyDrop<Box<TrampolineData>>,
}

impl std::fmt::Debug for TrampolineState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TrampolineState")
            .field("code_ptr", &self.code_ptr)
            .finish()
    }
}

impl Drop for TrampolineState {
    fn drop(&mut self) {
        unsafe { ManuallyDrop::drop(&mut self._closure) };
        unsafe { ManuallyDrop::drop(&mut self.data) };
    }
}

unsafe impl Send for TrampolineState {}

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
            cif_arg_types.push(ty.into());
        }

        let cif_return_type: libffi::Type = (&data_ref.return_type).into();
        let cif = libffi::Cif::new(cif_arg_types, cif_return_type);

        let closure = libffi::Closure::new(cif, trampoline_handler, data_ref);
        let code_ptr = *closure.code_ptr() as *mut c_void;

        TrampolineState {
            _closure: ManuallyDrop::new(closure),
            code_ptr,
            data,
        }
    }
}

/// # Safety
/// `user_data` must be a valid pointer to a `TrampolineState` allocated via `Box::new`,
/// or null.
pub unsafe extern "C" fn destroy_handler(user_data: *mut c_void) {
    if !user_data.is_null() {
        drop(unsafe { Box::from_raw(user_data as *mut TrampolineState) });
    }
}

unsafe extern "C" fn trampoline_handler(
    _cif: &libffi_low::ffi_cif,
    result: &mut u64,
    args: *const *const c_void,
    data: &TrampolineData,
) {
    let mut values = Vec::with_capacity(data.arg_types.len());

    for (i, ty) in data.arg_types.iter().enumerate() {
        if data.user_data_index == Some(i) {
            continue;
        }

        let arg_ptr = unsafe { *args.add(i) };
        match unsafe { read_arg(arg_ptr, ty) } {
            Ok(val) => values.push(val),
            Err(e) => {
                gtkx_warn!("trampoline_handler: failed to read arg {i}: {e}");
                values.push(Value::Null);
            }
        }
    }

    let capture_result = !matches!(data.return_type, Type::Void);

    let channel = data.channel.clone();
    let js_func = data.js_func.clone();

    let state_ptr = if data.is_oneshot {
        let ptr = data
            .oneshot_state_ptr
            .swap(std::ptr::null_mut(), Ordering::AcqRel);
        if ptr.is_null() { None } else { Some(ptr) }
    } else {
        None
    };

    let js_result = JsDispatcher::global().invoke_and_wait(
        &channel,
        &js_func,
        values,
        capture_result,
        |result| result,
    );

    write_return_value(
        result as *mut u64 as *mut c_void,
        js_result,
        &data.return_type,
    );

    if let Some(ptr) = state_ptr {
        drop(unsafe { Box::from_raw(ptr) });
    }
}

fn read_scalar(ptr: *const c_void, ty: &Type) -> anyhow::Result<Value> {
    match ty {
        Type::Integer(int_kind) => Ok(Value::Number(int_kind.read_ptr(ptr as *const u8))),
        Type::Enum(_) => Ok(Value::Number(IntegerKind::I32.read_ptr(ptr as *const u8))),
        Type::Flags(_) => Ok(Value::Number(IntegerKind::U32.read_ptr(ptr as *const u8))),
        Type::Float(float_kind) => Ok(Value::Number(float_kind.read_ptr(ptr as *const u8))),
        Type::Boolean => {
            let val = unsafe { *(ptr as *const i32) };
            Ok(Value::Boolean(val != 0))
        }
        Type::Unichar => {
            let val = unsafe { *(ptr as *const u32) };
            let ch = char::from_u32(val).unwrap_or('\u{FFFD}');
            Ok(Value::String(ch.to_string()))
        }
        Type::GObject(_)
        | Type::Boxed(_)
        | Type::Struct(_)
        | Type::Fundamental(_)
        | Type::String(_)
        | Type::Void
        | Type::Array(_)
        | Type::HashTable(_)
        | Type::Callback(_)
        | Type::Trampoline(_)
        | Type::Ref(_) => {
            anyhow::bail!("Unsupported scalar type in trampoline: {ty}")
        }
    }
}

unsafe fn read_arg(arg_ptr: *const c_void, ty: &Type) -> anyhow::Result<Value> {
    match ty {
        Type::Integer(_)
        | Type::Enum(_)
        | Type::Flags(_)
        | Type::Float(_)
        | Type::Boolean
        | Type::Unichar => read_scalar(arg_ptr, ty),

        Type::GObject(_)
        | Type::Boxed(_)
        | Type::Struct(_)
        | Type::Fundamental(_)
        | Type::String(_) => {
            let ptr = unsafe { *(arg_ptr as *const *mut c_void) };
            unsafe { ty.ptr_to_value(ptr, "trampoline arg") }
        }

        Type::Void => Ok(Value::Null),

        Type::Ref(ref_type) => {
            let ptr = unsafe { *(arg_ptr as *const *mut c_void) };
            if ptr.is_null() {
                return Ok(Value::Null);
            }
            read_scalar(ptr, &ref_type.inner_type)
        }

        Type::Array(_) | Type::HashTable(_) | Type::Callback(_) | Type::Trampoline(_) => {
            anyhow::bail!("Unsupported type in trampoline arg: {ty}")
        }
    }
}

fn extract_number(js_result: &Result<Value, ()>) -> f64 {
    match js_result {
        Ok(Value::Number(n)) => *n,
        _ => 0.0,
    }
}

fn extract_object_ptr(js_result: &Result<Value, ()>) -> *mut c_void {
    match js_result {
        Ok(Value::Object(handle)) => handle.get_ptr().unwrap_or(std::ptr::null_mut()),
        _ => std::ptr::null_mut(),
    }
}

fn write_return_value(ret: *mut c_void, js_result: Result<Value, ()>, return_type: &Type) {
    match return_type {
        Type::Void => {}
        Type::Boolean => {
            let val = matches!(js_result, Ok(Value::Boolean(true)));
            unsafe { *(ret as *mut i32) = val as i32 };
        }
        Type::Integer(int_kind) => {
            int_kind.write_ptr(ret as *mut u8, extract_number(&js_result));
        }
        Type::Enum(_) => {
            IntegerKind::I32.write_ptr(ret as *mut u8, extract_number(&js_result));
        }
        Type::Flags(_) => {
            IntegerKind::U32.write_ptr(ret as *mut u8, extract_number(&js_result));
        }
        Type::Float(float_kind) => {
            float_kind.write_ptr(ret as *mut u8, extract_number(&js_result));
        }
        Type::Unichar => {
            let val = match js_result {
                Ok(Value::String(s)) => s.chars().next().map(|c| c as u32).unwrap_or(0),
                Ok(Value::Number(n)) => n as u32,
                _ => 0,
            };
            unsafe { *(ret as *mut u32) = val };
        }
        Type::GObject(_) => unsafe {
            crate::types::GObjectType::write_return_ptr(ret, extract_object_ptr(&js_result));
        },
        Type::Boxed(t) => unsafe { t.write_return_ptr(ret, extract_object_ptr(&js_result)) },
        Type::Fundamental(t) => unsafe {
            t.write_return_ptr(ret, extract_object_ptr(&js_result));
        },
        Type::String(_) => unsafe {
            crate::types::StringType::write_return_value(ret, &js_result);
        },
        Type::Struct(_) => unsafe {
            *(ret as *mut *mut c_void) = extract_object_ptr(&js_result);
        },
        Type::Ref(_)
        | Type::Array(_)
        | Type::HashTable(_)
        | Type::Callback(_)
        | Type::Trampoline(_) => {
            gtkx_warn!("write_return_value: unsupported return type {return_type}, writing null");
            unsafe { *(ret as *mut *mut c_void) = std::ptr::null_mut() };
        }
    }
}
