use std::{
    any::Any,
    ffi::{CString, c_void},
    sync::Arc,
};

use anyhow::bail;
use gtk4::glib::{self, translate::IntoGlib as _};
use libffi::middle as ffi;
use neon::prelude::*;

use crate::{
    arg::{self, Arg},
    callback,
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
    U16(u16),
    I16(i16),
    U32(u32),
    I32(i32),
    U64(u64),
    I64(i64),
    F32(f32),
    F64(f64),
    Ptr(*mut c_void),
    OwnedPtr(OwnedPtr),
    TrampolineCallback(TrampolineCallbackValue),
    Void,
}

#[derive(Debug)]
pub struct TrampolineCallbackValue {
    pub trampoline_ptr: *mut c_void,
    pub closure: OwnedPtr,
    pub destroy_ptr: Option<*mut c_void>,
}

impl OwnedPtr {
    pub fn new<T: 'static>(value: T, ptr: *mut c_void) -> Self {
        Self {
            value: Box::new(value),
            ptr,
        }
    }
}

fn wait_for_js_result<T, F>(
    rx: std::sync::mpsc::Receiver<Result<value::Value, neon::result::Throw>>,
    error_message: &str,
    on_result: F,
) -> T
where
    F: FnOnce(Result<value::Value, neon::result::Throw>) -> T,
{
    let main_context = glib::MainContext::default();

    loop {
        match rx.try_recv() {
            Ok(result) => return on_result(result),
            Err(std::sync::mpsc::TryRecvError::Empty) => {
                main_context.iteration(false);
            }
            Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                panic!("{}", error_message);
            }
        }
    }
}

fn create_trampoline_closure_ptr(closure: &glib::Closure) -> *mut c_void {
    unsafe {
        use glib::translate::ToGlibPtr as _;
        let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_none().0;
        glib::gobject_ffi::g_closure_ref(ptr);
        glib::gobject_ffi::g_closure_sink(ptr);
        ptr as *mut c_void
    }
}

fn convert_glib_args(args: &[glib::Value], arg_types: &Option<Vec<Type>>) -> Vec<value::Value> {
    match arg_types {
        Some(types) => args
            .iter()
            .zip(types.iter())
            .map(|(gval, type_)| value::Value::from_glib_value(gval, type_))
            .collect(),
        None => args.iter().map(Into::into).collect(),
    }
}

fn invoke_js_callback(
    channel: &Channel,
    callback: &Arc<Root<JsFunction>>,
    args_values: Vec<value::Value>,
    capture_result: bool,
) -> std::sync::mpsc::Receiver<Result<value::Value, neon::result::Throw>> {
    let callback = callback.clone();

    let result = channel.send(move |mut cx| {
        let result = (|| {
            let js_args: Vec<Handle<JsValue>> = args_values
                .into_iter()
                .map(|v| v.to_js_value(&mut cx))
                .collect::<NeonResult<Vec<Handle<JsValue>>>>()?;

            let js_this = cx.undefined();
            let js_callback = callback.to_inner(&mut cx);

            if capture_result {
                let js_result = js_callback.call(&mut cx, js_this, js_args)?;
                value::Value::from_js_value(&mut cx, js_result)
            } else {
                js_callback.call(&mut cx, js_this, js_args)?;
                Ok(value::Value::Undefined)
            }
        })();

        result
    });

    unsafe { std::mem::transmute(result) }
}

impl TryFrom<arg::Arg> for Value {
    type Error = anyhow::Error;

    fn try_from(arg: arg::Arg) -> anyhow::Result<Value> {
        match &arg.type_ {
            Type::Integer(type_) => {
                let number = match arg.value {
                    value::Value::Number(n) => n,
                    value::Value::Null | value::Value::Undefined if arg.optional => 0.0,
                    _ => bail!("Expected a Number for integer type, got {:?}", arg.value),
                };

                match type_.size {
                    IntegerSize::_8 => match type_.sign {
                        IntegerSign::Unsigned => Ok(Value::U8(number as u8)),
                        IntegerSign::Signed => Ok(Value::I8(number as i8)),
                    },
                    IntegerSize::_16 => match type_.sign {
                        IntegerSign::Unsigned => Ok(Value::U16(number as u16)),
                        IntegerSign::Signed => Ok(Value::I16(number as i16)),
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
            Type::String(_) => match &arg.value {
                value::Value::String(s) => {
                    let cstring = CString::new(s.as_bytes())?;
                    let ptr = cstring.as_ptr() as *mut c_void;
                    Ok(Value::OwnedPtr(OwnedPtr::new(cstring, ptr)))
                }
                value::Value::Null | value::Value::Undefined => {
                    Ok(Value::Ptr(std::ptr::null_mut()))
                }
                _ => bail!("Expected a String for string type, got {:?}", arg.value),
            },
            Type::Boolean => {
                let boolean = match arg.value {
                    value::Value::Boolean(b) => b,
                    _ => bail!("Expected a Boolean for boolean type, got {:?}", arg.value),
                };

                Ok(Value::U8(u8::from(boolean)))
            }
            Type::Null => Ok(Value::Ptr(std::ptr::null_mut())),
            Type::Undefined => Ok(Value::Ptr(std::ptr::null_mut())),
            Type::GObject(type_) => {
                let object_id = match &arg.value {
                    value::Value::Object(id) => Some(id),
                    value::Value::Null | value::Value::Undefined => None,
                    _ => bail!("Expected an Object for gobject type, got {:?}", arg.value),
                };

                let ptr = object_id.map_or(std::ptr::null_mut(), |id| id.as_ptr());
                let is_transfer_full = !type_.is_borrowed && !ptr.is_null();

                if is_transfer_full {
                    unsafe {
                        glib::gobject_ffi::g_object_ref(ptr as *mut glib::gobject_ffi::GObject);
                    }
                }

                Ok(Value::Ptr(ptr))
            }
            Type::Boxed(type_) => {
                let object_id = match &arg.value {
                    value::Value::Object(id) => Some(id),
                    value::Value::Null | value::Value::Undefined => None,
                    _ => bail!("Expected an Object for boxed type, got {:?}", arg.value),
                };

                let ptr = object_id.map_or(std::ptr::null_mut(), |id| id.as_ptr());
                let is_transfer_full = !type_.is_borrowed && !ptr.is_null();

                if is_transfer_full {
                    if let Some(gtype) = type_.get_gtype() {
                        unsafe {
                            let copied =
                                glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _);
                            return Ok(Value::Ptr(copied as *mut c_void));
                        }
                    }
                }

                Ok(Value::Ptr(ptr))
            }
            Type::Array(type_) => Value::try_from_array(&arg, type_),
            Type::Callback(type_) => Value::try_from_callback(&arg, type_),
            Type::Ref(type_) => Value::try_from_ref(&arg, type_),
        }
    }
}

impl Value {
    pub fn as_ptr(&self) -> *mut c_void {
        match self {
            Value::U8(value) => value as *const u8 as *mut c_void,
            Value::I8(value) => value as *const i8 as *mut c_void,
            Value::U16(value) => value as *const u16 as *mut c_void,
            Value::I16(value) => value as *const i16 as *mut c_void,
            Value::U32(value) => value as *const u32 as *mut c_void,
            Value::I32(value) => value as *const i32 as *mut c_void,
            Value::U64(value) => value as *const u64 as *mut c_void,
            Value::I64(value) => value as *const i64 as *mut c_void,
            Value::F32(value) => value as *const f32 as *mut c_void,
            Value::F64(value) => value as *const f64 as *mut c_void,
            Value::Ptr(ptr) => ptr as *const *mut c_void as *mut c_void,
            Value::OwnedPtr(owned_ptr) => owned_ptr as *const OwnedPtr as *mut c_void,
            Value::TrampolineCallback(_) => {
                unreachable!("TrampolineCallback should not be converted to a single pointer - it requires special handling in call.rs")
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
                    (IntegerSize::_16, IntegerSign::Unsigned) => {
                        let values: Vec<u16> = values.iter().map(|&v| *v as u16).collect();
                        let ptr = values.as_ptr() as *mut c_void;

                        Ok(Value::OwnedPtr(OwnedPtr::new(values, ptr)))
                    }
                    (IntegerSize::_16, IntegerSign::Signed) => {
                        let values: Vec<i16> = values.iter().map(|&v| *v as i16).collect();
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
            Type::String(_) => {
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
                        value::Value::Boolean(b) => values.push(u8::from(*b)),
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
            value::Value::Null | value::Value::Undefined if arg.optional => {
                return Ok(Value::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected a Callback for callback type, got {:?}", arg.value),
        };

        let channel = callback.channel.clone();
        let callback = callback.js_func.clone();

        match type_.trampoline {
            CallbackTrampoline::Closure => {
                let arg_types = type_.arg_types.clone();
                let return_type = type_.return_type.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = convert_glib_args(args, &arg_types);
                    let return_type = *return_type.clone().unwrap_or(Box::new(Type::Undefined));

                    let rx = invoke_js_callback(&channel, &callback, args_values, true);

                    wait_for_js_result(
                        rx,
                        "JS thread disconnected while waiting for callback result",
                        |result| match result {
                            Ok(value) => value::Value::into_glib_value_with_default(
                                value,
                                Some(&return_type),
                            ),
                            Err(_) => {
                                eprintln!("JS callback threw an error");
                                value::Value::into_glib_value_with_default(
                                    value::Value::Undefined,
                                    Some(&return_type),
                                )
                            }
                        },
                    )
                });

                let ptr = closure.as_ptr() as *mut c_void;
                Ok(Value::OwnedPtr(OwnedPtr::new(closure, ptr)))
            }

            CallbackTrampoline::AsyncReady => {
                let source_type = type_.source_type.clone().unwrap_or(Box::new(Type::Null));
                let result_type = type_.result_type.clone().unwrap_or(Box::new(Type::Null));

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
                    let rx = invoke_js_callback(&channel, &callback, args_values, false);

                    wait_for_js_result(
                        rx,
                        "JS thread disconnected while waiting for async callback",
                        |result| {
                            if result.is_err() {
                                eprintln!("JS async callback threw an error");
                            }
                            None::<glib::Value>
                        },
                    )
                });

                let closure_ptr = create_trampoline_closure_ptr(&closure);
                let trampoline_ptr = callback::get_async_ready_trampoline_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new(closure, closure_ptr),
                    destroy_ptr: None,
                }))
            }

            CallbackTrampoline::Destroy => {
                let closure = glib::Closure::new(move |_args: &[glib::Value]| {
                    let rx = invoke_js_callback(&channel, &callback, vec![], false);

                    wait_for_js_result(
                        rx,
                        "JS thread disconnected while waiting for destroy callback",
                        |result| {
                            if result.is_err() {
                                eprintln!("JS destroy callback threw an error");
                            }
                            None::<glib::Value>
                        },
                    )
                });

                let closure_ptr = create_trampoline_closure_ptr(&closure);
                let trampoline_ptr = callback::get_destroy_trampoline_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new(closure, closure_ptr),
                    destroy_ptr: None,
                }))
            }

            CallbackTrampoline::SourceFunc => {
                let closure = glib::Closure::new(move |_args: &[glib::Value]| {
                    let rx = invoke_js_callback(&channel, &callback, vec![], true);

                    wait_for_js_result(
                        rx,
                        "JS thread disconnected while waiting for source func callback",
                        |result| match result {
                            Ok(value) => value.into(),
                            Err(_) => {
                                eprintln!("JS source func callback threw an error");
                                Some(false.into())
                            }
                        },
                    )
                });

                let closure_ptr = create_trampoline_closure_ptr(&closure);
                let trampoline_ptr = callback::get_source_func_trampoline_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new(closure, closure_ptr),
                    destroy_ptr: None,
                }))
            }

            CallbackTrampoline::DrawFunc => {
                let arg_types = type_.arg_types.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = convert_glib_args(args, &arg_types);
                    let rx = invoke_js_callback(&channel, &callback, args_values, false);

                    wait_for_js_result(
                        rx,
                        "JS thread disconnected while waiting for draw func callback",
                        |result| {
                            if result.is_err() {
                                eprintln!("JS draw func callback threw an error");
                            }
                            None::<glib::Value>
                        },
                    )
                });

                let closure_ptr = create_trampoline_closure_ptr(&closure);
                let trampoline_ptr = callback::get_draw_func_trampoline_ptr();
                let destroy_ptr = callback::get_unref_closure_trampoline_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new(closure, closure_ptr),
                    destroy_ptr: Some(destroy_ptr),
                }))
            }

            CallbackTrampoline::CompareDataFunc => {
                let arg_types = type_.arg_types.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = convert_glib_args(args, &arg_types);
                    let rx = invoke_js_callback(&channel, &callback, args_values, true);

                    wait_for_js_result(
                        rx,
                        "JS thread disconnected while waiting for compare func callback",
                        |result| match result {
                            Ok(value) => {
                                let ordering = match value {
                                    value::Value::Number(n) => n as i32,
                                    _ => 0,
                                };
                                Some(ordering.into())
                            }
                            Err(_) => {
                                eprintln!("JS compare func callback threw an error");
                                Some(0i32.into())
                            }
                        },
                    )
                });

                let closure_ptr = create_trampoline_closure_ptr(&closure);
                let trampoline_ptr = callback::get_compare_data_func_trampoline_ptr();
                let destroy_ptr = callback::get_unref_closure_trampoline_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new(closure, closure_ptr),
                    destroy_ptr: Some(destroy_ptr),
                }))
            }
        }
    }

    fn try_from_ref(arg: &arg::Arg, type_: &RefType) -> anyhow::Result<Value> {
        let r#ref = match &arg.value {
            value::Value::Ref(r#ref) => r#ref,
            value::Value::Null | value::Value::Undefined => {
                return Ok(Value::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected a Ref for ref type, got {:?}", arg.value),
        };

        // For Boxed and GObject types, check if caller allocated the memory.
        // - If value is an ObjectId: caller-allocates, pass pointer directly (GTK writes INTO memory)
        // - If value is null/undefined: GTK-allocates, pass pointer-to-pointer (GTK writes pointer back)
        match &*type_.inner_type {
            Type::Boxed(_) | Type::GObject(_) => {
                match &*r#ref.value {
                    value::Value::Object(id) => {
                        // Caller-allocates: pass the pointer directly
                        let ptr = id.as_ptr();
                        Ok(Value::Ptr(ptr))
                    }
                    value::Value::Null | value::Value::Undefined => {
                        // GTK-allocates: need pointer-to-pointer semantics
                        // OwnedPtr.ptr will be passed by address to FFI (&owned_ptr.ptr)
                        // GTK writes the allocated pointer into that location
                        Ok(Value::OwnedPtr(OwnedPtr {
                            ptr: std::ptr::null_mut(),
                            value: Box::new(()), // Just need to keep OwnedPtr alive
                        }))
                    }
                    _ => bail!(
                        "Expected an Object or Null for Ref<Boxed/GObject>, got {:?}",
                        r#ref.value
                    ),
                }
            }
            _ => {
                // For primitive types, create storage and pass pointer to it
                let ref_arg = Arg::new(*type_.inner_type.clone(), *r#ref.value.clone());
                let ref_value = Box::new(Value::try_from(ref_arg)?);
                let ref_ptr = ref_value.as_ptr();

                Ok(Value::OwnedPtr(OwnedPtr {
                    value: ref_value,
                    ptr: ref_ptr,
                }))
            }
        }
    }
}

impl<'a> From<&'a Value> for ffi::Arg<'a> {
    fn from(arg: &'a Value) -> Self {
        match arg {
            Value::U8(value) => ffi::arg(value),
            Value::I8(value) => ffi::arg(value),
            Value::U16(value) => ffi::arg(value),
            Value::I16(value) => ffi::arg(value),
            Value::U32(value) => ffi::arg(value),
            Value::I32(value) => ffi::arg(value),
            Value::U64(value) => ffi::arg(value),
            Value::I64(value) => ffi::arg(value),
            Value::F32(value) => ffi::arg(value),
            Value::F64(value) => ffi::arg(value),
            Value::Ptr(ptr) => ffi::arg(ptr),
            Value::OwnedPtr(owned_ptr) => ffi::arg(&owned_ptr.ptr),
            Value::TrampolineCallback(_) => {
                unreachable!("TrampolineCallback should be handled specially in call.rs")
            }
            Value::Void => ffi::arg(&()),
        }
    }
}
