use std::{
    any::Any,
    ffi::{CString, c_void},
};

use anyhow::bail;
use gtk4::glib;
use libffi::middle as ffi;
use neon::prelude::*;

use crate::{
    arg::{self, Arg},
    async_callback,
    types::*,
    value,
};

#[derive(Debug)]
#[repr(C)]
pub struct OwnedPtr {
    pub ptr: *mut c_void,
    pub value: Box<dyn Any>,
}

#[derive(Debug)]
pub enum Value {
    U8(u8),
    I8(i8),
    U32(u32),
    I32(i32),
    U64(u64),
    I64(i64),
    F32(f32),
    F64(f64),
    Ptr(*mut c_void),
    OwnedPtr(OwnedPtr),
    AsyncCallback(AsyncCallbackValue),
    Void,
}

#[derive(Debug)]
pub struct AsyncCallbackValue {
    pub trampoline_ptr: *mut c_void,
    pub closure: OwnedPtr,
}

impl OwnedPtr {
    pub fn new<T: 'static>(value: T, ptr: *mut c_void) -> Self {
        OwnedPtr {
            value: Box::new(value),
            ptr,
        }
    }
}

impl TryFrom<arg::Arg> for Value {
    type Error = anyhow::Error;

    fn try_from(arg: arg::Arg) -> anyhow::Result<Value> {
        match &arg.type_ {
            Type::Integer(type_) => {
                let number = match arg.value {
                    value::Value::Number(n) => n,
                    _ => bail!("Expected a Number for integer type, got {:?}", arg.value),
                };

                match type_.size {
                    IntegerSize::_8 => match type_.sign {
                        IntegerSign::Unsigned => Ok(Value::U8(number as u8)),
                        IntegerSign::Signed => Ok(Value::I8(number as i8)),
                    },
                    IntegerSize::_32 => match type_.sign {
                        IntegerSign::Unsigned => Ok(Value::U32(number as u32)),
                        IntegerSign::Signed => Ok(Value::I32(number as i32)),
                    },
                    IntegerSize::_64 => match type_.sign {
                        IntegerSign::Unsigned => Ok(Value::U64(number as u64)),
                        IntegerSign::Signed => Ok(Value::I64(number as i64)),
                    },
                }
            }
            Type::Float(type_) => {
                let number = match arg.value {
                    value::Value::Number(n) => n,
                    _ => bail!("Expected a Number for float type, got {:?}", arg.value),
                };

                match type_.size {
                    FloatSize::_32 => Ok(Value::F32(number as f32)),
                    FloatSize::_64 => Ok(Value::F64(number)),
                }
            }
            Type::String => {
                match &arg.value {
                    value::Value::String(s) => {
                        let cstring = CString::new(s.as_bytes())?;
                        let ptr = cstring.as_ptr() as *mut c_void;
                        Ok(Value::OwnedPtr(OwnedPtr::new(cstring, ptr)))
                    }
                    value::Value::Null | value::Value::Undefined => {
                        // NULL string for varargs termination
                        Ok(Value::Ptr(std::ptr::null_mut()))
                    }
                    _ => bail!("Expected a String for string type, got {:?}", arg.value),
                }
            }
            Type::Boolean => {
                let boolean = match arg.value {
                    value::Value::Boolean(b) => b,
                    _ => bail!("Expected a Boolean for boolean type, got {:?}", arg.value),
                };

                Ok(Value::U8(if boolean { 1 } else { 0 }))
            }
            Type::Null => Ok(Value::Ptr(std::ptr::null_mut())),
            Type::Undefined => Ok(Value::Ptr(std::ptr::null_mut())),
            Type::GObject(_) => {
                let object_id = match &arg.value {
                    value::Value::Object(id) => Some(id),
                    value::Value::Null | value::Value::Undefined => None,
                    _ => bail!("Expected an Object for gobject type, got {:?}", arg.value),
                };

                Ok(Value::Ptr(
                    object_id.map_or(std::ptr::null_mut(), |id| id.as_ptr()),
                ))
            }
            Type::Boxed(_) => {
                let object_id = match &arg.value {
                    value::Value::Object(id) => Some(id),
                    value::Value::Null | value::Value::Undefined => None,
                    _ => bail!("Expected an Object for boxed type, got {:?}", arg.value),
                };

                Ok(Value::Ptr(
                    object_id.map_or(std::ptr::null_mut(), |id| id.as_ptr()),
                ))
            }
            Type::Array(type_) => Value::try_from_array(&arg, type_),
            Type::Callback(type_) => Value::try_from_callback(&arg, type_),
            Type::AsyncCallback(type_) => Value::try_from_async_callback(&arg, type_),
            Type::Ref(type_) => Value::try_from_ref(&arg, type_),
        }
    }
}

impl Value {
    pub fn as_ptr(&self) -> *mut c_void {
        match self {
            Value::U8(value) => value as *const u8 as *mut c_void,
            Value::I8(value) => value as *const i8 as *mut c_void,
            Value::U32(value) => value as *const u32 as *mut c_void,
            Value::I32(value) => value as *const i32 as *mut c_void,
            Value::U64(value) => value as *const u64 as *mut c_void,
            Value::I64(value) => value as *const i64 as *mut c_void,
            Value::F32(value) => value as *const f32 as *mut c_void,
            Value::F64(value) => value as *const f64 as *mut c_void,
            Value::Ptr(ptr) => ptr as *const *mut c_void as *mut c_void,
            Value::OwnedPtr(owned_ptr) => owned_ptr as *const OwnedPtr as *mut c_void,
            Value::AsyncCallback(_) => {
                panic!("AsyncCallback should not be converted to a single pointer")
            }
            Value::Void => std::ptr::null_mut(),
        }
    }

    fn try_from_array(arg: &arg::Arg, type_: &ArrayType) -> anyhow::Result<Value> {
        let array = match &arg.value {
            value::Value::Array(arr) => arr,
            _ => bail!("Expected an Array for array type, got {:?}", arg.value),
        };

        match *type_.item_type {
            Type::Integer(type_) => {
                let mut values = Vec::new();

                for value in array {
                    match value {
                        value::Value::Number(n) => values.push(n),
                        _ => bail!("Expected a Number for integer item type, got {:?}", value),
                    }
                }

                match (type_.size, type_.sign) {
                    (IntegerSize::_8, IntegerSign::Unsigned) => {
                        let values: Vec<u8> = values.iter().map(|&v| *v as u8).collect();
                        let ptr = values.as_ptr() as *mut c_void;

                        Ok(Value::OwnedPtr(OwnedPtr::new(values, ptr)))
                    }
                    (IntegerSize::_8, IntegerSign::Signed) => {
                        let values: Vec<i8> = values.iter().map(|&v| *v as i8).collect();
                        let ptr = values.as_ptr() as *mut c_void;

                        Ok(Value::OwnedPtr(OwnedPtr::new(values, ptr)))
                    }
                    (IntegerSize::_32, IntegerSign::Unsigned) => {
                        let values: Vec<u32> = values.iter().map(|&v| *v as u32).collect();
                        let ptr = values.as_ptr() as *mut c_void;

                        Ok(Value::OwnedPtr(OwnedPtr::new(values, ptr)))
                    }
                    (IntegerSize::_32, IntegerSign::Signed) => {
                        let values: Vec<i32> = values.iter().map(|&v| *v as i32).collect();
                        let ptr = values.as_ptr() as *mut c_void;

                        Ok(Value::OwnedPtr(OwnedPtr::new(values, ptr)))
                    }
                    (IntegerSize::_64, IntegerSign::Unsigned) => {
                        let values: Vec<u64> = values.iter().map(|&v| *v as u64).collect();
                        let ptr = values.as_ptr() as *mut c_void;

                        Ok(Value::OwnedPtr(OwnedPtr::new(values, ptr)))
                    }
                    (IntegerSize::_64, IntegerSign::Signed) => {
                        let values: Vec<i64> = values.iter().map(|&v| *v as i64).collect();
                        let ptr = values.as_ptr() as *mut c_void;

                        Ok(Value::OwnedPtr(OwnedPtr::new(values, ptr)))
                    }
                }
            }
            Type::Float(type_) => {
                let mut values = Vec::new();

                for value in array {
                    match value {
                        value::Value::Number(n) => values.push(n),
                        _ => bail!("Expected a Number for float item type, got {:?}", value),
                    }
                }

                match type_.size {
                    FloatSize::_32 => {
                        let values: Vec<f32> = values.iter().map(|&v| *v as f32).collect();
                        let ptr = values.as_ptr() as *mut c_void;

                        Ok(Value::OwnedPtr(OwnedPtr::new(values, ptr)))
                    }
                    FloatSize::_64 => {
                        let values: Vec<f64> = values.iter().map(|&v| *v).collect();
                        let ptr = values.as_ptr() as *mut c_void;

                        Ok(Value::OwnedPtr(OwnedPtr::new(values, ptr)))
                    }
                }
            }
            Type::String => {
                let mut cstrings = Vec::new();

                for v in array {
                    match v {
                        value::Value::String(s) => {
                            cstrings.push(CString::new(s.as_bytes())?);
                        }
                        _ => bail!("Expected a String for string item type, got {:?}", v),
                    }
                }

                let mut ptrs: Vec<*mut c_void> =
                    cstrings.iter().map(|s| s.as_ptr() as *mut c_void).collect();

                ptrs.push(std::ptr::null_mut());

                let ptr = ptrs.as_ptr() as *mut c_void;

                Ok(Value::OwnedPtr(OwnedPtr::new((cstrings, ptrs), ptr)))
            }
            Type::GObject(_) | Type::Boxed(_) => {
                let mut ids = Vec::new();

                for value in array {
                    match value {
                        value::Value::Object(id) => ids.push(*id),
                        _ => bail!("Expected an Object for gobject item type, got {:?}", value),
                    }
                }

                let ptrs: Vec<*mut c_void> = ids.iter().map(|id| id.as_ptr()).collect();
                let ptr = ptrs.as_ptr() as *mut c_void;

                Ok(Value::OwnedPtr(OwnedPtr::new((ids, ptrs), ptr)))
            }
            Type::Boolean => {
                let mut values = Vec::new();

                for value in array {
                    match value {
                        value::Value::Boolean(b) => values.push(if *b { 1u8 } else { 0u8 }),
                        _ => bail!("Expected a Boolean for boolean item type, got {:?}", value),
                    }
                }

                let ptr = values.as_ptr() as *mut c_void;

                Ok(Value::OwnedPtr(OwnedPtr::new(values, ptr)))
            }
            _ => bail!("Unsupported array item type: {:?}", type_.item_type),
        }
    }

    fn try_from_callback(arg: &arg::Arg, type_: &CallbackType) -> anyhow::Result<Value> {
        let callback = match &arg.value {
            value::Value::Callback(callback) => callback,
            _ => bail!("Expected a Callback for callback type, got {:?}", arg.value),
        };

        let channel = callback.channel.clone();
        let callback = callback.js_func.clone();
        let arg_types = type_.arg_types.clone();

        let closure = glib::Closure::new(move |args: &[glib::Value]| {
            let args_values: Vec<value::Value> = match &arg_types {
                Some(types) => args
                    .iter()
                    .zip(types.iter())
                    .map(|(gval, type_)| value::Value::from_glib_value(gval, type_))
                    .collect(),
                None => args.iter().map(Into::into).collect(),
            };
            let callback = callback.clone();

            let result = channel.send(move |mut cx| {
                let js_args: Vec<Handle<JsValue>> = args_values
                    .into_iter()
                    .map(|v| v.to_js_value(&mut cx))
                    .collect::<NeonResult<Vec<Handle<JsValue>>>>()?;

                let js_this = cx.undefined();
                let js_callback = callback.clone().to_inner(&mut cx);
                let js_result = js_callback.call(&mut cx, js_this, js_args)?;

                value::Value::from_js_value(&mut cx, js_result)
            });

            let join_handle = result;
            let main_context = glib::MainContext::default();

            let rx: std::sync::mpsc::Receiver<Result<value::Value, neon::result::Throw>> =
                unsafe { std::mem::transmute(join_handle) };

            loop {
                match rx.try_recv() {
                    Ok(result) => {
                        return match result {
                            Ok(value) => value.into(),
                            Err(_) => {
                                eprintln!("JS callback threw an error");
                                None
                            }
                        };
                    }
                    Err(std::sync::mpsc::TryRecvError::Empty) => {
                        main_context.iteration(false);
                    }
                    Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                        panic!("JS thread disconnected while waiting for callback result");
                    }
                }
            }
        });

        let ptr = closure.as_ptr() as *mut c_void;

        Ok(Value::OwnedPtr(OwnedPtr::new(closure, ptr)))
    }

    fn try_from_async_callback(arg: &arg::Arg, type_: &AsyncCallbackType) -> anyhow::Result<Value> {
        let callback = match &arg.value {
            value::Value::Callback(callback) => callback,
            _ => bail!(
                "Expected a Callback for async callback type, got {:?}",
                arg.value
            ),
        };

        let channel = callback.channel.clone();
        let callback = callback.js_func.clone();
        let source_type = type_.source_type.clone();
        let result_type = type_.result_type.clone();

        let closure = glib::Closure::new(move |args: &[glib::Value]| {
            let source_value = args
                .first()
                .map(|gval| value::Value::from_glib_value(gval, &source_type))
                .unwrap_or(value::Value::Null);
            let result_value = args
                .get(1)
                .map(|gval| value::Value::from_glib_value(gval, &result_type))
                .unwrap_or(value::Value::Null);

            let args_values = vec![source_value, result_value];
            let callback = callback.clone();

            let result = channel.send(move |mut cx| {
                let js_args: Vec<Handle<JsValue>> = args_values
                    .into_iter()
                    .map(|v| v.to_js_value(&mut cx))
                    .collect::<NeonResult<Vec<Handle<JsValue>>>>()?;

                let js_this = cx.undefined();
                let js_callback = callback.clone().to_inner(&mut cx);
                js_callback.call(&mut cx, js_this, js_args)?;

                Ok(value::Value::Undefined)
            });

            let join_handle = result;
            let main_context = glib::MainContext::default();

            let rx: std::sync::mpsc::Receiver<Result<value::Value, neon::result::Throw>> =
                unsafe { std::mem::transmute(join_handle) };

            loop {
                match rx.try_recv() {
                    Ok(result) => {
                        if let Err(_) = result {
                            eprintln!("JS async callback threw an error");
                        }
                        return None::<glib::Value>;
                    }
                    Err(std::sync::mpsc::TryRecvError::Empty) => {
                        main_context.iteration(false);
                    }
                    Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                        panic!("JS thread disconnected while waiting for async callback");
                    }
                }
            }
        });

        let closure_ptr = unsafe {
            use glib::translate::ToGlibPtr as _;
            let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_none().0;
            glib::gobject_ffi::g_closure_ref(ptr);
            glib::gobject_ffi::g_closure_sink(ptr);
            ptr as *mut c_void
        };

        let trampoline_ptr = async_callback::get_async_ready_trampoline_ptr();

        Ok(Value::AsyncCallback(AsyncCallbackValue {
            trampoline_ptr,
            closure: OwnedPtr::new(closure, closure_ptr),
        }))
    }

    fn try_from_ref(arg: &arg::Arg, type_: &RefType) -> anyhow::Result<Value> {
        let r#ref = match &arg.value {
            value::Value::Ref(r#ref) => r#ref,
            _ => bail!("Expected a Ref for ref type, got {:?}", arg.value),
        };

        let ref_arg = Arg::new(*type_.inner_type.clone(), *r#ref.value.clone());
        let inner_value = Value::try_from(ref_arg)?;

        // Get the pointer value from the inner value
        let inner_ptr: *mut c_void = match &inner_value {
            Value::Ptr(ptr) => *ptr,
            Value::OwnedPtr(owned) => owned.ptr,
            _ => bail!("Ref inner type must resolve to a pointer"),
        };

        // Allocate stable storage for the pointer - this is what the native function writes to
        // For out parameters like GError**, we pass the ADDRESS of this storage
        let mut storage: Box<*mut c_void> = Box::new(inner_ptr);
        let ref_ptr: *mut c_void = storage.as_mut() as *mut *mut c_void as *mut c_void;

        Ok(Value::OwnedPtr(OwnedPtr {
            value: Box::new((inner_value, storage)),
            ptr: ref_ptr,
        }))
    }
}

impl<'a> From<&'a Value> for ffi::Arg<'a> {
    fn from(arg: &'a Value) -> Self {
        match arg {
            Value::U8(value) => ffi::arg(value),
            Value::I8(value) => ffi::arg(value),
            Value::U32(value) => ffi::arg(value),
            Value::I32(value) => ffi::arg(value),
            Value::U64(value) => ffi::arg(value),
            Value::I64(value) => ffi::arg(value),
            Value::F32(value) => ffi::arg(value),
            Value::F64(value) => ffi::arg(value),
            Value::Ptr(ptr) => ffi::arg(ptr),
            Value::OwnedPtr(owned_ptr) => ffi::arg(&owned_ptr.ptr),
            Value::AsyncCallback(_) => {
                panic!("AsyncCallback should be handled specially in call.rs")
            }
            Value::Void => ffi::arg(&()),
        }
    }
}
