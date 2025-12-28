//! Low-level C FFI value representation for libffi calls.
//!
//! This module defines [`Value`], which represents typed values suitable for
//! passing to native functions via libffi. It handles the conversion from
//! high-level [`crate::arg::Arg`] to raw pointers and properly-typed primitives.
//!
//! ## Key Types
//!
//! - [`Value`]: Enum representing all possible FFI argument types
//! - [`OwnedPtr`]: Pointer with associated owned data to keep values alive
//! - [`TrampolineCallbackValue`]: Special callback representation for trampolines
//!
//! ## Ownership
//!
//! The [`OwnedPtr`] variant is critical for memory safety. It holds both:
//! - A raw pointer to pass to native code
//! - A `Box<dyn Any>` keeping the underlying data alive during the FFI call
//!
//! This prevents use-after-free when passing strings, arrays, or other heap data.

use std::{
    any::Any,
    ffi::{CString, c_void},
    sync::Arc,
};

use anyhow::bail;
use gtk4::glib::{self, translate::{FromGlibPtrNone as _, IntoGlib as _}, value::ToValue as _};
use libffi::middle as libffi;
use neon::prelude::*;

use crate::{
    arg::{self, Arg},
    callback, gtk_dispatch, js_dispatch,
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

    pub data_first: bool,
}

impl OwnedPtr {

    pub fn new<T: 'static>(value: T, ptr: *mut c_void) -> Self {
        Self {
            value: Box::new(value),
            ptr,
        }
    }

    pub fn from_vec<T: 'static>(vec: Vec<T>) -> Self {
        let boxed: Box<Vec<T>> = Box::new(vec);
        let ptr = boxed.as_ptr() as *mut c_void;
        Self {
            value: boxed,
            ptr,
        }
    }
}

fn wait_for_js_result<T, F>(
    rx: std::sync::mpsc::Receiver<Result<value::Value, ()>>,
    on_result: F,
) -> T
where
    F: FnOnce(Result<value::Value, ()>) -> T,
{
    loop {
        gtk_dispatch::dispatch_pending();

        match rx.try_recv() {
            Ok(result) => return on_result(result),
            Err(std::sync::mpsc::TryRecvError::Empty) => {
                std::thread::yield_now();
            }
            Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                return on_result(Err(()));
            }
        }
    }
}

fn invoke_and_wait_for_js_result<T, F>(
    channel: &Channel,
    callback: &Arc<Root<JsFunction>>,
    args_values: Vec<value::Value>,
    capture_result: bool,
    on_result: F,
) -> T
where
    F: FnOnce(Result<value::Value, ()>) -> T,
{
    let rx = if gtk_dispatch::is_js_waiting() {
        js_dispatch::queue(callback.clone(), args_values, capture_result)
    } else {
        js_dispatch::queue_with_wakeup(channel, callback.clone(), args_values, capture_result)
    };

    wait_for_js_result(rx, on_result)
}

fn closure_to_glib_full(closure: &glib::Closure) -> *mut c_void {
    use glib::translate::ToGlibPtr as _;
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    ptr as *mut c_void
}

fn closure_ptr_for_transfer(closure: glib::Closure) -> *mut c_void {
    use glib::translate::ToGlibPtr as _;
    let stash: glib::translate::Stash<*mut glib::gobject_ffi::GClosure, _> = closure.to_glib_none();
    let ptr = stash.0 as *mut c_void;
    std::mem::forget(closure);
    ptr
}

fn convert_glib_args(
    args: &[glib::Value],
    arg_types: &Option<Vec<Type>>,
) -> anyhow::Result<Vec<value::Value>> {
    match arg_types {
        Some(types) => args
            .iter()
            .zip(types.iter())
            .map(|(gval, type_)| value::Value::from_glib_value(gval, type_))
            .collect(),
        None => args.iter().map(value::Value::try_from).collect(),
    }
}

fn type_to_glib_type(type_: &Type) -> glib::Type {
    use crate::types::{FloatSize, IntegerSign, IntegerSize};

    match type_ {
        Type::GObject(_) => glib::types::Type::OBJECT,
        Type::Boxed(boxed) => boxed.get_gtype().unwrap_or(glib::types::Type::POINTER),
        Type::GVariant(_) => glib::types::Type::VARIANT,
        Type::Integer(int_type) => match (&int_type.size, &int_type.sign) {
            (IntegerSize::_8, IntegerSign::Signed) => glib::types::Type::I8,
            (IntegerSize::_8, IntegerSign::Unsigned) => glib::types::Type::U8,
            (IntegerSize::_16, IntegerSign::Signed) => glib::types::Type::I32,
            (IntegerSize::_16, IntegerSign::Unsigned) => glib::types::Type::U32,
            (IntegerSize::_32, IntegerSign::Signed) => glib::types::Type::I32,
            (IntegerSize::_32, IntegerSign::Unsigned) => glib::types::Type::U32,
            (IntegerSize::_64, IntegerSign::Signed) => glib::types::Type::I64,
            (IntegerSize::_64, IntegerSign::Unsigned) => glib::types::Type::U64,
        },
        Type::Float(float_type) => match &float_type.size {
            FloatSize::_32 => glib::types::Type::F32,
            FloatSize::_64 => glib::types::Type::F64,
        },
        Type::Boolean => glib::types::Type::BOOL,
        Type::String(_) => glib::types::Type::STRING,
        _ => glib::types::Type::POINTER,
    }
}

fn arg_types_to_glib_types(arg_types: &Option<Vec<Type>>) -> Vec<glib::Type> {
    arg_types
        .as_ref()
        .map(|types| types.iter().map(type_to_glib_type).collect())
        .unwrap_or_default()
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

                dispatch_integer_to_cif!(type_, number)
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
            Type::GObject(_) => {
                let object_id = match &arg.value {
                    value::Value::Object(id) => Some(id),
                    value::Value::Null | value::Value::Undefined => None,
                    _ => bail!("Expected an Object for gobject type, got {:?}", arg.value),
                };

                let ptr = match object_id {
                    Some(id) => id
                        .as_ptr()
                        .ok_or_else(|| anyhow::anyhow!("GObject has been garbage collected"))?,
                    None => std::ptr::null_mut(),
                };

                Ok(Value::Ptr(ptr))
            }
            Type::Boxed(type_) => {
                let object_id = match &arg.value {
                    value::Value::Object(id) => Some(id),
                    value::Value::Null | value::Value::Undefined => None,
                    _ => bail!("Expected an Object for boxed type, got {:?}", arg.value),
                };

                let ptr = match object_id {
                    Some(id) => id.as_ptr().ok_or_else(|| {
                        anyhow::anyhow!("Boxed object has been garbage collected")
                    })?,
                    None => std::ptr::null_mut(),
                };

                let is_transfer_full = !type_.is_borrowed && !ptr.is_null();

                if is_transfer_full && let Some(gtype) = type_.get_gtype() {
                    unsafe {
                        let copied =
                            glib::gobject_ffi::g_boxed_copy(gtype.into_glib(), ptr as *const _);
                        return Ok(Value::Ptr(copied));
                    }
                }

                Ok(Value::Ptr(ptr))
            }
            Type::GVariant(type_) => {
                let object_id = match &arg.value {
                    value::Value::Object(id) => Some(id),
                    value::Value::Null | value::Value::Undefined => None,
                    _ => bail!("Expected an Object for GVariant type, got {:?}", arg.value),
                };

                let ptr = match object_id {
                    Some(id) => id.as_ptr().ok_or_else(|| {
                        anyhow::anyhow!("GVariant object has been garbage collected")
                    })?,
                    None => std::ptr::null_mut(),
                };

                let is_transfer_full = !type_.is_borrowed && !ptr.is_null();

                if is_transfer_full {
                    unsafe {
                        glib::ffi::g_variant_ref(ptr as *mut glib::ffi::GVariant);
                    }
                }

                Ok(Value::Ptr(ptr))
            }
            Type::Array(type_) => match &arg.value {
                value::Value::Null | value::Value::Undefined if arg.optional => {
                    Ok(Value::Ptr(std::ptr::null_mut()))
                }
                _ => Value::try_from_array(&arg, type_),
            },
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
                unreachable!(
                    "TrampolineCallback should not be converted to a single pointer - it requires special handling in call.rs"
                )
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
                        Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
                    }
                    (IntegerSize::_8, IntegerSign::Signed) => {
                        let values: Vec<i8> = values.iter().map(|&v| *v as i8).collect();
                        Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
                    }
                    (IntegerSize::_16, IntegerSign::Unsigned) => {
                        let values: Vec<u16> = values.iter().map(|&v| *v as u16).collect();
                        Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
                    }
                    (IntegerSize::_16, IntegerSign::Signed) => {
                        let values: Vec<i16> = values.iter().map(|&v| *v as i16).collect();
                        Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
                    }
                    (IntegerSize::_32, IntegerSign::Unsigned) => {
                        let values: Vec<u32> = values.iter().map(|&v| *v as u32).collect();
                        Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
                    }
                    (IntegerSize::_32, IntegerSign::Signed) => {
                        let values: Vec<i32> = values.iter().map(|&v| *v as i32).collect();
                        Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
                    }
                    (IntegerSize::_64, IntegerSign::Unsigned) => {
                        let values: Vec<u64> = values.iter().map(|&v| *v as u64).collect();
                        Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
                    }
                    (IntegerSize::_64, IntegerSign::Signed) => {
                        let values: Vec<i64> = values.iter().map(|&v| *v as i64).collect();
                        Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
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
                        Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
                    }
                    FloatSize::_64 => {
                        let values: Vec<f64> = values.iter().map(|&v| *v).collect();
                        Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
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
            Type::GObject(_) | Type::Boxed(_) | Type::GVariant(_) => {
                let mut ids = Vec::new();

                for value in array {
                    match value {
                        value::Value::Object(id) => ids.push(*id),
                        _ => bail!("Expected an Object for gobject item type, got {:?}", value),
                    }
                }

                let mut ptrs: Vec<*mut c_void> = Vec::with_capacity(ids.len());
                for id in &ids {
                    match id.as_ptr() {
                        Some(ptr) => ptrs.push(ptr),
                        None => bail!("GObject in array has been garbage collected"),
                    }
                }
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

                Ok(Value::OwnedPtr(OwnedPtr::from_vec(values)))
            }
            _ => bail!("Unsupported array item type: {:?}", type_.item_type),
        }
    }

    fn try_from_callback(arg: &arg::Arg, type_: &CallbackType) -> anyhow::Result<Value> {
        let cb = match &arg.value {
            value::Value::Callback(callback) => callback,
            value::Value::Null | value::Value::Undefined if arg.optional => {
                return Ok(Value::Ptr(std::ptr::null_mut()));
            }
            _ => bail!("Expected a Callback for callback type, got {:?}", arg.value),
        };

        let channel = cb.channel.clone();
        let callback = cb.js_func.clone();

        match type_.trampoline {
            CallbackTrampoline::Closure => {
                let arg_types = type_.arg_types.clone();
                let return_type = type_.return_type.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = convert_glib_args(args, &arg_types)
                        .expect("Failed to convert GLib callback arguments");
                    let return_type = *return_type.clone().unwrap_or(Box::new(Type::Undefined));

                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        args_values,
                        true,
                        |result| match result {
                            Ok(value) => value::Value::into_glib_value_with_default(
                                value,
                                Some(&return_type),
                            ),
                            Err(_) => value::Value::into_glib_value_with_default(
                                value::Value::Undefined,
                                Some(&return_type),
                            ),
                        },
                    )
                });

                let closure_ptr = closure_to_glib_full(&closure);
                Ok(Value::OwnedPtr(OwnedPtr::new(closure, closure_ptr)))
            }

            CallbackTrampoline::AsyncReady => {
                let source_type = type_.source_type.clone().unwrap_or(Box::new(Type::Null));
                let result_type = type_.result_type.clone().unwrap_or(Box::new(Type::Null));

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let source_value = args
                        .first()
                        .map(|gval| {
                            value::Value::from_glib_value(gval, &source_type)
                                .expect("Failed to convert async source value")
                        })
                        .unwrap_or(value::Value::Null);

                    let result_value = args
                        .get(1)
                        .map(|gval| {
                            value::Value::from_glib_value(gval, &result_type)
                                .expect("Failed to convert async result value")
                        })
                        .unwrap_or(value::Value::Null);

                    let args_values = vec![source_value, result_value];

                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        args_values,
                        false,
                        |_| None::<glib::Value>,
                    )
                });

                let closure_ptr = closure_ptr_for_transfer(closure);
                let trampoline_ptr = callback::get_async_ready_trampoline_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new((), closure_ptr),
                    destroy_ptr: None,
                    data_first: false,
                }))
            }

            CallbackTrampoline::Destroy => {
                let closure = glib::Closure::new(move |_args: &[glib::Value]| {
                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        vec![],
                        false,
                        |_| None::<glib::Value>,
                    )
                });

                let closure_ptr = closure_ptr_for_transfer(closure);
                let trampoline_ptr = callback::get_destroy_trampoline_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new((), closure_ptr),
                    destroy_ptr: None,
                    data_first: true,
                }))
            }

            CallbackTrampoline::DrawFunc => {
                let arg_types = type_.arg_types.clone();
                let arg_gtypes = arg_types_to_glib_types(&arg_types);

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = convert_glib_args(args, &arg_types)
                        .expect("Failed to convert GLib draw callback arguments");

                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        args_values,
                        false,
                        |_| None::<glib::Value>,
                    )
                });

                let closure_ptr = closure_ptr_for_transfer(closure);

                let draw_func_data = Box::new(callback::DrawFuncData {
                    closure: closure_ptr as *mut glib::gobject_ffi::GClosure,
                    arg_gtypes,
                });
                let data_ptr = Box::into_raw(draw_func_data) as *mut c_void;

                let trampoline_ptr = callback::get_draw_func_trampoline_ptr();
                let destroy_ptr = callback::get_draw_func_data_destroy_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new((), data_ptr),
                    destroy_ptr: Some(destroy_ptr),
                    data_first: false,
                }))
            }

            CallbackTrampoline::ShortcutFunc => {
                let arg_types = type_.arg_types.clone();
                let arg_gtypes = arg_types_to_glib_types(&arg_types);

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = convert_glib_args(args, &arg_types)
                        .expect("Failed to convert GLib shortcut callback arguments");

                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        args_values,
                        true,
                        |result| match result {
                            Ok(value::Value::Boolean(b)) => Some(b.to_value()),
                            _ => Some(false.to_value()),
                        },
                    )
                });

                let closure_ptr = closure_ptr_for_transfer(closure);

                let shortcut_func_data = Box::new(callback::ShortcutFuncData {
                    closure: closure_ptr as *mut glib::gobject_ffi::GClosure,
                    arg_gtypes,
                });
                let data_ptr = Box::into_raw(shortcut_func_data) as *mut c_void;

                let trampoline_ptr = callback::get_shortcut_func_trampoline_ptr();
                let destroy_ptr = callback::get_shortcut_func_data_destroy_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new((), data_ptr),
                    destroy_ptr: Some(destroy_ptr),
                    data_first: false,
                }))
            }

            CallbackTrampoline::TreeListModelCreateFunc => {
                let arg_types = type_.arg_types.clone();
                let arg_gtypes = arg_types_to_glib_types(&arg_types);

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = convert_glib_args(args, &arg_types)
                        .expect("Failed to convert GLib tree list model callback arguments");

                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        args_values,
                        true,
                        |result| match result {
                            Ok(value::Value::Object(obj_id)) => {
                                if let Some(ptr) = obj_id.as_ptr() {
                                    let obj: glib::Object = unsafe {
                                        glib::Object::from_glib_none(ptr as *mut glib::gobject_ffi::GObject)
                                    };
                                    Some(obj.to_value())
                                } else {
                                    Some(None::<glib::Object>.to_value())
                                }
                            }
                            _ => Some(None::<glib::Object>.to_value()),
                        },
                    )
                });

                let closure_ptr = closure_ptr_for_transfer(closure);

                let create_func_data = Box::new(callback::TreeListModelCreateFuncData {
                    closure: closure_ptr as *mut glib::gobject_ffi::GClosure,
                    arg_gtypes,
                });
                let data_ptr = Box::into_raw(create_func_data) as *mut c_void;

                let trampoline_ptr = callback::get_tree_list_model_create_func_trampoline_ptr();
                let destroy_ptr = callback::get_tree_list_model_create_func_data_destroy_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new((), data_ptr),
                    destroy_ptr: Some(destroy_ptr),
                    data_first: false,
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

        match &*type_.inner_type {
            Type::Boxed(_) | Type::GObject(_) | Type::GVariant(_) => {
                match &*r#ref.value {
                    value::Value::Object(id) => {

                        let ptr = id.as_ptr().ok_or_else(|| {
                            anyhow::anyhow!("Ref object has been garbage collected")
                        })?;
                        Ok(Value::Ptr(ptr))
                    }
                    value::Value::Null | value::Value::Undefined => {

                        let ptr_storage: Box<*mut c_void> = Box::new(std::ptr::null_mut());
                        let ptr = ptr_storage.as_ref() as *const *mut c_void as *mut c_void;
                        Ok(Value::OwnedPtr(OwnedPtr {
                            ptr,
                            value: ptr_storage,
                        }))
                    }
                    _ => bail!(
                        "Expected an Object or Null for Ref<Boxed/GObject>, got {:?}",
                        r#ref.value
                    ),
                }
            }
            _ => {

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

impl<'a> From<&'a Value> for libffi::Arg<'a> {
    fn from(arg: &'a Value) -> Self {
        match arg {
            Value::U8(value) => libffi::arg(value),
            Value::I8(value) => libffi::arg(value),
            Value::U16(value) => libffi::arg(value),
            Value::I16(value) => libffi::arg(value),
            Value::U32(value) => libffi::arg(value),
            Value::I32(value) => libffi::arg(value),
            Value::U64(value) => libffi::arg(value),
            Value::I64(value) => libffi::arg(value),
            Value::F32(value) => libffi::arg(value),
            Value::F64(value) => libffi::arg(value),
            Value::Ptr(ptr) => libffi::arg(ptr),
            Value::OwnedPtr(owned_ptr) => libffi::arg(&owned_ptr.ptr),
            Value::TrampolineCallback(_) => {
                unreachable!("TrampolineCallback should be handled specially in call.rs")
            }
            Value::Void => libffi::arg(&()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils;
    use std::ffi::CString;
    use std::sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    };

    #[test]
    fn owned_ptr_new_stores_value_and_ptr() {
        let data = vec![1u32, 2, 3, 4, 5];
        let ptr = data.as_ptr() as *mut c_void;
        let owned = OwnedPtr::new(data, ptr);

        assert_eq!(owned.ptr, ptr);
    }

    #[test]
    fn owned_ptr_from_vec_captures_correct_pointer() {
        let data = vec![10u64, 20, 30];
        let owned = OwnedPtr::from_vec(data);

        unsafe {
            let slice = std::slice::from_raw_parts(owned.ptr as *const u64, 3);
            assert_eq!(slice, &[10, 20, 30]);
        }
    }

    #[test]
    fn owned_ptr_keeps_cstring_alive() {
        let cstring = CString::new("test string").unwrap();
        let ptr = cstring.as_ptr() as *mut c_void;
        let owned = OwnedPtr::new(cstring, ptr);

        unsafe {
            let s = std::ffi::CStr::from_ptr(owned.ptr as *const i8);
            assert_eq!(s.to_str().unwrap(), "test string");
        }
    }

    #[test]
    fn owned_ptr_tuple_keeps_both_alive() {
        let strings = vec![
            CString::new("hello").unwrap(),
            CString::new("world").unwrap(),
        ];
        let ptrs: Vec<*mut c_void> = strings.iter().map(|s| s.as_ptr() as *mut c_void).collect();
        let tuple_ptr = ptrs.as_ptr() as *mut c_void;

        let owned = OwnedPtr::new((strings, ptrs), tuple_ptr);

        unsafe {
            let ptr_slice = std::slice::from_raw_parts(owned.ptr as *const *const i8, 2);
            let s0 = std::ffi::CStr::from_ptr(ptr_slice[0]);
            let s1 = std::ffi::CStr::from_ptr(ptr_slice[1]);
            assert_eq!(s0.to_str().unwrap(), "hello");
            assert_eq!(s1.to_str().unwrap(), "world");
        }
    }

    #[test]
    fn owned_ptr_drops_value_when_dropped() {
        let drop_counter = Arc::new(AtomicUsize::new(0));

        struct DropTracker {
            counter: Arc<AtomicUsize>,
        }

        impl Drop for DropTracker {
            fn drop(&mut self) {
                self.counter.fetch_add(1, Ordering::SeqCst);
            }
        }

        {
            let tracker = DropTracker {
                counter: Arc::clone(&drop_counter),
            };
            let _owned = OwnedPtr::new(tracker, std::ptr::null_mut());
        }

        assert_eq!(drop_counter.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn closure_to_glib_full_increments_refcount() {
        test_utils::ensure_gtk_init();

        let closure = glib::Closure::new(|_| None::<glib::Value>);

        let initial_ref = {
            use glib::translate::ToGlibPtr as _;
            let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_none().0;
            unsafe { (*ptr).ref_count }
        };

        let ptr = closure_to_glib_full(&closure);

        let after_ref = unsafe { (*(ptr as *mut glib::gobject_ffi::GClosure)).ref_count };

        assert!(after_ref > initial_ref);

        unsafe {
            glib::gobject_ffi::g_closure_unref(ptr as *mut _);
        }
    }

    #[test]
    fn closure_ptr_for_transfer_returns_valid_ptr() {
        test_utils::ensure_gtk_init();

        let invoked = Arc::new(AtomicBool::new(false));
        let invoked_clone = invoked.clone();

        let closure = glib::Closure::new(move |_| {
            invoked_clone.store(true, Ordering::SeqCst);
            None::<glib::Value>
        });

        let ptr = closure_ptr_for_transfer(closure);

        assert!(!ptr.is_null());

        unsafe {
            glib::gobject_ffi::g_closure_invoke(
                ptr as *mut glib::gobject_ffi::GClosure,
                std::ptr::null_mut(),
                0,
                std::ptr::null(),
                std::ptr::null_mut(),
            );
        }

        assert!(invoked.load(Ordering::SeqCst));

        unsafe {
            glib::gobject_ffi::g_closure_unref(ptr as *mut _);
        }
    }

    #[test]
    fn closure_captured_values_survive_transfer() {
        test_utils::ensure_gtk_init();

        let data = Arc::new(AtomicUsize::new(0));
        let data_clone = data.clone();

        let closure = glib::Closure::new(move |_| {
            data_clone.fetch_add(1, Ordering::SeqCst);
            None::<glib::Value>
        });

        let ptr = closure_ptr_for_transfer(closure);

        for _ in 0..5 {
            unsafe {
                glib::gobject_ffi::g_closure_invoke(
                    ptr as *mut glib::gobject_ffi::GClosure,
                    std::ptr::null_mut(),
                    0,
                    std::ptr::null(),
                    std::ptr::null_mut(),
                );
            }
        }

        assert_eq!(data.load(Ordering::SeqCst), 5);

        unsafe {
            glib::gobject_ffi::g_closure_unref(ptr as *mut _);
        }
    }

    #[test]
    fn try_from_integer_i8() {
        let arg = arg::Arg::new(
            Type::Integer(IntegerType {
                size: IntegerSize::_8,
                sign: IntegerSign::Signed,
            }),
            value::Value::Number(-42.0),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::I8(v) = result.unwrap() {
            assert_eq!(v, -42);
        } else {
            panic!("Expected Value::I8");
        }
    }

    #[test]
    fn try_from_integer_u8() {
        let arg = arg::Arg::new(
            Type::Integer(IntegerType {
                size: IntegerSize::_8,
                sign: IntegerSign::Unsigned,
            }),
            value::Value::Number(200.0),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::U8(v) = result.unwrap() {
            assert_eq!(v, 200);
        } else {
            panic!("Expected Value::U8");
        }
    }

    #[test]
    fn try_from_integer_i32() {
        let arg = arg::Arg::new(
            Type::Integer(IntegerType {
                size: IntegerSize::_32,
                sign: IntegerSign::Signed,
            }),
            value::Value::Number(-123456.0),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::I32(v) = result.unwrap() {
            assert_eq!(v, -123456);
        } else {
            panic!("Expected Value::I32");
        }
    }

    #[test]
    fn try_from_integer_u64() {
        let arg = arg::Arg::new(
            Type::Integer(IntegerType {
                size: IntegerSize::_64,
                sign: IntegerSign::Unsigned,
            }),
            value::Value::Number(9999999999.0),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::U64(v) = result.unwrap() {
            assert_eq!(v, 9999999999);
        } else {
            panic!("Expected Value::U64");
        }
    }

    #[test]
    fn try_from_integer_optional_null() {
        let arg = arg::Arg {
            type_: Type::Integer(IntegerType {
                size: IntegerSize::_32,
                sign: IntegerSign::Signed,
            }),
            value: value::Value::Null,
            optional: true,
        };

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::I32(v) = result.unwrap() {
            assert_eq!(v, 0);
        } else {
            panic!("Expected Value::I32");
        }
    }

    #[test]
    fn try_from_float_f32() {
        let arg = arg::Arg::new(
            Type::Float(FloatType { size: FloatSize::_32 }),
            value::Value::Number(3.14),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::F32(v) = result.unwrap() {
            assert!((v - 3.14).abs() < 0.001);
        } else {
            panic!("Expected Value::F32");
        }
    }

    #[test]
    fn try_from_float_f64() {
        let arg = arg::Arg::new(
            Type::Float(FloatType { size: FloatSize::_64 }),
            value::Value::Number(2.718281828),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::F64(v) = result.unwrap() {
            assert!((v - 2.718281828).abs() < 0.0000001);
        } else {
            panic!("Expected Value::F64");
        }
    }

    #[test]
    fn try_from_string() {
        let arg = arg::Arg::new(
            Type::String(StringType { is_borrowed: false }),
            value::Value::String("hello world".to_string()),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::OwnedPtr(owned) = result.unwrap() {
            unsafe {
                let s = std::ffi::CStr::from_ptr(owned.ptr as *const i8);
                assert_eq!(s.to_str().unwrap(), "hello world");
            }
        } else {
            panic!("Expected Value::OwnedPtr");
        }
    }

    #[test]
    fn try_from_string_null() {
        let arg = arg::Arg::new(
            Type::String(StringType { is_borrowed: false }),
            value::Value::Null,
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::Ptr(ptr) = result.unwrap() {
            assert!(ptr.is_null());
        } else {
            panic!("Expected Value::Ptr");
        }
    }

    #[test]
    fn try_from_boolean_true() {
        let arg = arg::Arg::new(Type::Boolean, value::Value::Boolean(true));

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::U8(v) = result.unwrap() {
            assert_eq!(v, 1);
        } else {
            panic!("Expected Value::U8");
        }
    }

    #[test]
    fn try_from_boolean_false() {
        let arg = arg::Arg::new(Type::Boolean, value::Value::Boolean(false));

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::U8(v) = result.unwrap() {
            assert_eq!(v, 0);
        } else {
            panic!("Expected Value::U8");
        }
    }

    #[test]
    fn try_from_null() {
        let arg = arg::Arg::new(Type::Null, value::Value::Null);

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::Ptr(ptr) = result.unwrap() {
            assert!(ptr.is_null());
        } else {
            panic!("Expected Value::Ptr");
        }
    }

    #[test]
    fn try_from_undefined() {
        let arg = arg::Arg::new(Type::Undefined, value::Value::Undefined);

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::Ptr(ptr) = result.unwrap() {
            assert!(ptr.is_null());
        } else {
            panic!("Expected Value::Ptr");
        }
    }

    #[test]
    fn try_from_array_u8() {
        let arg = arg::Arg::new(
            Type::Array(ArrayType {
                item_type: Box::new(Type::Integer(IntegerType {
                    size: IntegerSize::_8,
                    sign: IntegerSign::Unsigned,
                })),
                list_type: ListType::Array,
                is_borrowed: false,
            }),
            value::Value::Array(vec![
                value::Value::Number(1.0),
                value::Value::Number(2.0),
                value::Value::Number(3.0),
            ]),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::OwnedPtr(owned) = result.unwrap() {
            unsafe {
                let slice = std::slice::from_raw_parts(owned.ptr as *const u8, 3);
                assert_eq!(slice, &[1, 2, 3]);
            }
        } else {
            panic!("Expected Value::OwnedPtr");
        }
    }

    #[test]
    fn try_from_array_i32() {
        let arg = arg::Arg::new(
            Type::Array(ArrayType {
                item_type: Box::new(Type::Integer(IntegerType {
                    size: IntegerSize::_32,
                    sign: IntegerSign::Signed,
                })),
                list_type: ListType::Array,
                is_borrowed: false,
            }),
            value::Value::Array(vec![
                value::Value::Number(-10.0),
                value::Value::Number(0.0),
                value::Value::Number(10.0),
            ]),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::OwnedPtr(owned) = result.unwrap() {
            unsafe {
                let slice = std::slice::from_raw_parts(owned.ptr as *const i32, 3);
                assert_eq!(slice, &[-10, 0, 10]);
            }
        } else {
            panic!("Expected Value::OwnedPtr");
        }
    }

    #[test]
    fn try_from_array_f64() {
        let arg = arg::Arg::new(
            Type::Array(ArrayType {
                item_type: Box::new(Type::Float(FloatType {
                    size: FloatSize::_64,
                })),
                list_type: ListType::Array,
                is_borrowed: false,
            }),
            value::Value::Array(vec![
                value::Value::Number(1.1),
                value::Value::Number(2.2),
            ]),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::OwnedPtr(owned) = result.unwrap() {
            unsafe {
                let slice = std::slice::from_raw_parts(owned.ptr as *const f64, 2);
                assert!((slice[0] - 1.1).abs() < 0.001);
                assert!((slice[1] - 2.2).abs() < 0.001);
            }
        } else {
            panic!("Expected Value::OwnedPtr");
        }
    }

    #[test]
    fn try_from_array_string() {
        let arg = arg::Arg::new(
            Type::Array(ArrayType {
                item_type: Box::new(Type::String(StringType { is_borrowed: false })),
                list_type: ListType::Array,
                is_borrowed: false,
            }),
            value::Value::Array(vec![
                value::Value::String("foo".to_string()),
                value::Value::String("bar".to_string()),
            ]),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::OwnedPtr(owned) = result.unwrap() {
            unsafe {
                let ptrs = std::slice::from_raw_parts(owned.ptr as *const *const i8, 3);
                let s0 = std::ffi::CStr::from_ptr(ptrs[0]);
                let s1 = std::ffi::CStr::from_ptr(ptrs[1]);
                assert_eq!(s0.to_str().unwrap(), "foo");
                assert_eq!(s1.to_str().unwrap(), "bar");
                assert!(ptrs[2].is_null());
            }
        } else {
            panic!("Expected Value::OwnedPtr");
        }
    }

    #[test]
    fn try_from_array_boolean() {
        let arg = arg::Arg::new(
            Type::Array(ArrayType {
                item_type: Box::new(Type::Boolean),
                list_type: ListType::Array,
                is_borrowed: false,
            }),
            value::Value::Array(vec![
                value::Value::Boolean(true),
                value::Value::Boolean(false),
                value::Value::Boolean(true),
            ]),
        );

        let result = Value::try_from(arg);
        assert!(result.is_ok());
        if let Value::OwnedPtr(owned) = result.unwrap() {
            unsafe {
                let slice = std::slice::from_raw_parts(owned.ptr as *const u8, 3);
                assert_eq!(slice, &[1, 0, 1]);
            }
        } else {
            panic!("Expected Value::OwnedPtr");
        }
    }

    #[test]
    fn value_as_ptr_integer_types() {
        let v_u8 = Value::U8(42);
        let v_i32 = Value::I32(-100);
        let v_u64 = Value::U64(999);

        assert!(!v_u8.as_ptr().is_null());
        assert!(!v_i32.as_ptr().is_null());
        assert!(!v_u64.as_ptr().is_null());
    }

    #[test]
    fn value_as_ptr_float_types() {
        let v_f32 = Value::F32(3.14);
        let v_f64 = Value::F64(2.718);

        assert!(!v_f32.as_ptr().is_null());
        assert!(!v_f64.as_ptr().is_null());
    }

    #[test]
    fn value_as_ptr_void() {
        let v = Value::Void;
        assert!(v.as_ptr().is_null());
    }

    #[test]
    fn value_as_ptr_null_ptr() {
        let v = Value::Ptr(std::ptr::null_mut());
        assert!(!v.as_ptr().is_null());
    }

    #[test]
    fn value_to_libffi_arg_integers() {
        let v = Value::I32(42);
        let _arg: libffi::Arg = (&v).into();
    }

    #[test]
    fn value_to_libffi_arg_floats() {
        let v = Value::F64(3.14);
        let _arg: libffi::Arg = (&v).into();
    }

    #[test]
    fn value_to_libffi_arg_ptr() {
        let v = Value::Ptr(std::ptr::null_mut());
        let _arg: libffi::Arg = (&v).into();
    }

    #[test]
    fn value_to_libffi_arg_owned_ptr() {
        let owned = OwnedPtr::from_vec(vec![1u8, 2, 3]);
        let v = Value::OwnedPtr(owned);
        let _arg: libffi::Arg = (&v).into();
    }
}
