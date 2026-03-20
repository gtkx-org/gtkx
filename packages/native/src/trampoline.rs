use std::ffi::c_void;
use std::mem::ManuallyDrop;
use std::sync::Arc;

use ::libffi::low as libffi_low;
use ::libffi::middle as libffi;
use neon::event::Channel;
use neon::handle::Root;
use neon::types::JsFunction;

use crate::js_dispatch::JsDispatcher;
use crate::types::{FloatKind, Type};
use crate::value::Value;

pub struct TrampolineData {
    pub channel: Channel,
    pub js_func: Arc<Root<JsFunction>>,
    pub arg_types: Vec<Type>,
    pub return_type: Type,
    pub user_data_index: Option<usize>,
}

pub struct TrampolineState {
    _closure: ManuallyDrop<libffi::Closure<'static>>,
    pub code_ptr: *mut c_void,
    data: ManuallyDrop<Box<TrampolineData>>,
}

impl Drop for TrampolineState {
    fn drop(&mut self) {
        unsafe { ManuallyDrop::drop(&mut self._closure) };
        unsafe { ManuallyDrop::drop(&mut self.data) };
    }
}

unsafe impl Send for TrampolineState {}

impl TrampolineState {
    pub fn create(data: TrampolineData) -> Self {
        let data = ManuallyDrop::new(Box::new(data));
        let data_ptr: *const TrampolineData = &**data;
        let data_ref: &'static TrampolineData = unsafe { &*data_ptr };

        let mut cif_arg_types: Vec<libffi::Type> = Vec::with_capacity(data_ref.arg_types.len());
        for ty in &data_ref.arg_types {
            cif_arg_types.push(ty.into());
        }

        let cif_return_type: libffi::Type = (&data_ref.return_type).into();
        let cif = libffi::Cif::new(cif_arg_types.into_iter(), cif_return_type);

        let closure = libffi::Closure::new(cif, universal_handler, data_ref);
        let code_ptr = closure.code_ptr() as *const _ as *mut c_void;

        TrampolineState {
            _closure: ManuallyDrop::new(closure),
            code_ptr,
            data,
        }
    }
}

pub unsafe extern "C" fn destroy_handler(user_data: *mut c_void) {
    if !user_data.is_null() {
        drop(unsafe { Box::from_raw(user_data as *mut TrampolineState) });
    }
}

unsafe extern "C" fn universal_handler(
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
                eprintln!("[gtkx] WARNING: universal_handler: failed to read arg {i}: {e}");
                values.push(Value::Null);
            }
        }
    }

    let capture_result = !matches!(data.return_type, Type::Undefined);

    let channel = data.channel.clone();
    let js_func = data.js_func.clone();

    let js_result = JsDispatcher::global().invoke_and_wait(
        &channel,
        &js_func,
        values,
        capture_result,
        |result| result,
    );

    write_return_value(result as *mut u64 as *mut c_void, js_result, &data.return_type);
}

unsafe fn read_arg(arg_ptr: *const c_void, ty: &Type) -> anyhow::Result<Value> {
    match ty {
        Type::Integer(int_type) => {
            let val = int_type.kind.read_ptr(arg_ptr as *const u8);
            Ok(Value::Number(val))
        }
        Type::Float(FloatKind::F32) => {
            let val = unsafe { *(arg_ptr as *const f32) };
            Ok(Value::Number(val as f64))
        }
        Type::Float(FloatKind::F64) => {
            let val = unsafe { *(arg_ptr as *const f64) };
            Ok(Value::Number(val))
        }
        Type::Boolean => {
            let val = unsafe { *(arg_ptr as *const i32) };
            Ok(Value::Boolean(val != 0))
        }
        Type::GObject(_) | Type::Boxed(_) | Type::Struct(_) | Type::Fundamental(_) => {
            let ptr = unsafe { *(arg_ptr as *const *mut c_void) };
            ty.ptr_to_value(ptr, "trampoline arg")
        }
        Type::String(_) => {
            let ptr = unsafe { *(arg_ptr as *const *mut c_void) };
            ty.ptr_to_value(ptr, "trampoline arg")
        }
        Type::Null | Type::Undefined => Ok(Value::Null),
        Type::Ref(ref_type) => {
            let ptr = unsafe { *(arg_ptr as *const *mut c_void) };
            if ptr.is_null() {
                return Ok(Value::Null);
            }
            match &*ref_type.inner_type {
                Type::Float(float_kind) => {
                    let val = float_kind.read_ptr(ptr as *const u8);
                    Ok(Value::Number(val))
                }
                Type::Integer(int_type) => {
                    let val = int_type.kind.read_ptr(ptr as *const u8);
                    Ok(Value::Number(val))
                }
                Type::Boolean => {
                    let val = unsafe { *(ptr as *const i32) };
                    Ok(Value::Boolean(val != 0))
                }
                _ => {
                    anyhow::bail!(
                        "Unsupported Ref inner type in trampoline: {:?}",
                        ref_type.inner_type
                    )
                }
            }
        }
        _ => {
            anyhow::bail!("Unsupported type in trampoline arg: {ty}")
        }
    }
}

fn write_return_value(ret: *mut c_void, js_result: Result<Value, ()>, return_type: &Type) {
    match return_type {
        Type::Undefined => {}
        Type::Boolean => {
            let val = match js_result {
                Ok(Value::Boolean(b)) => b,
                _ => false,
            };
            unsafe { *(ret as *mut i32) = val as i32 };
        }
        Type::Integer(int_type) => {
            let val = match js_result {
                Ok(Value::Number(n)) => n,
                _ => 0.0,
            };
            int_type.kind.write_ptr(ret as *mut u8, val);
        }
        Type::Float(FloatKind::F32) => {
            let val = match js_result {
                Ok(Value::Number(n)) => n as f32,
                _ => 0.0,
            };
            unsafe { *(ret as *mut f32) = val };
        }
        Type::Float(FloatKind::F64) => {
            let val = match js_result {
                Ok(Value::Number(n)) => n,
                _ => 0.0,
            };
            unsafe { *(ret as *mut f64) = val };
        }
        Type::GObject(_) | Type::Boxed(_) | Type::Fundamental(_) => {
            let ptr = match js_result {
                Ok(Value::Object(handle)) => handle.get_ptr().unwrap_or(std::ptr::null_mut()),
                _ => std::ptr::null_mut(),
            };
            unsafe { *(ret as *mut *mut c_void) = ptr };
        }
        Type::String(_) => {
            let ptr = match js_result {
                Ok(Value::String(s)) => {
                    let c_str = std::ffi::CString::new(s).ok();
                    c_str
                        .map(|cs| unsafe {
                            gtk4::glib::ffi::g_strdup(cs.as_ptr()) as *mut c_void
                        })
                        .unwrap_or(std::ptr::null_mut())
                }
                _ => std::ptr::null_mut(),
            };
            unsafe { *(ret as *mut *mut c_void) = ptr };
        }
        _ => {
            unsafe { *(ret as *mut *mut c_void) = std::ptr::null_mut() };
        }
    }
}
