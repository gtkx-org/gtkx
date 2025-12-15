//! FFI Call Interface (CIF) value types and conversions.
//!
//! This module provides types for representing values in libffi calls,
//! including owned pointers that manage memory lifetime and conversion
//! from argument types to CIF-compatible representations.

use std::{
    any::Any,
    ffi::{CString, c_void},
    sync::Arc,
};

use anyhow::bail;
use gtk4::glib::{self, translate::IntoGlib as _};
use libffi::middle as libffi;
use neon::prelude::*;

use crate::{
    arg::{self, Arg},
    callback, gtk_dispatch, js_dispatch,
    types::*,
    value,
};

/// A pointer that owns its referenced data.
///
/// This struct ensures that heap-allocated data passed to FFI calls
/// remains valid for the duration of the call. The `value` field holds
/// the actual Rust value, while `ptr` points to its memory location.
#[derive(Debug)]
#[repr(C)]
pub struct OwnedPtr {
    /// Raw pointer to the data.
    pub ptr: *mut c_void,
    /// Boxed value that owns the data, ensuring it lives long enough.
    pub value: Box<dyn Any>,
}

/// A value representation for libffi function calls.
///
/// Each variant corresponds to a C type that can be passed to or returned
/// from FFI calls. This includes primitive types, pointers, and special
/// callback trampolines for GTK signal handlers.
#[derive(Debug)]
pub enum Value {
    /// Unsigned 8-bit integer.
    U8(u8),
    /// Signed 8-bit integer.
    I8(i8),
    /// Unsigned 16-bit integer.
    U16(u16),
    /// Signed 16-bit integer.
    I16(i16),
    /// Unsigned 32-bit integer.
    U32(u32),
    /// Signed 32-bit integer.
    I32(i32),
    /// Unsigned 64-bit integer.
    U64(u64),
    /// Signed 64-bit integer.
    I64(i64),
    /// 32-bit floating point.
    F32(f32),
    /// 64-bit floating point.
    F64(f64),
    /// Raw pointer (borrowed, not owned).
    Ptr(*mut c_void),
    /// Pointer with owned data that must outlive the FFI call.
    OwnedPtr(OwnedPtr),
    /// Callback with trampoline function for GTK signals.
    TrampolineCallback(TrampolineCallbackValue),
    /// Void (no value).
    Void,
}

/// A callback value with a trampoline for GTK signal handling.
///
/// GTK callbacks require C-compatible function pointers, but we need to
/// invoke JavaScript callbacks. This struct holds the trampoline function
/// pointer (the C-compatible wrapper) and the closure containing the
/// actual JavaScript callback.
#[derive(Debug)]
pub struct TrampolineCallbackValue {
    /// Pointer to the C trampoline function.
    pub trampoline_ptr: *mut c_void,
    /// The GLib closure containing the JavaScript callback.
    pub closure: OwnedPtr,
    /// Optional destroy notify function pointer.
    pub destroy_ptr: Option<*mut c_void>,
}

impl OwnedPtr {
    /// Creates a new owned pointer from a value and its raw pointer.
    ///
    /// The value is boxed to ensure it outlives the FFI call.
    pub fn new<T: 'static>(value: T, ptr: *mut c_void) -> Self {
        Self {
            value: Box::new(value),
            ptr,
        }
    }
}

fn wait_for_js_result<T, F>(
    rx: std::sync::mpsc::Receiver<Result<value::Value, ()>>,
    error_message: &str,
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
                panic!("{}", error_message);
            }
        }
    }
}

fn invoke_and_wait_for_js_result<T, F>(
    channel: &Channel,
    callback: &Arc<Root<JsFunction>>,
    args_values: Vec<value::Value>,
    capture_result: bool,
    error_message: &str,
    on_result: F,
) -> T
where
    F: FnOnce(Result<value::Value, ()>) -> T,
{
    let rx = if gtk_dispatch::is_js_waiting() {
        js_dispatch::queue(callback.clone(), args_values, capture_result)
    } else {
        js_dispatch::send_via_channel(channel, callback.clone(), args_values, capture_result)
    };

    wait_for_js_result(rx, error_message, on_result)
}

/// Transfers ownership of a closure to C, returning a raw pointer.
///
/// This adds a reference to the closure (and sinks any floating reference),
/// returning a pointer that the caller is responsible for eventually unreffing.
/// Use this when Rust retains ownership and will drop the closure later.
fn closure_to_glib_full(closure: &glib::Closure) -> *mut c_void {
    use glib::translate::ToGlibPtr as _;
    let ptr: *mut glib::gobject_ffi::GClosure = closure.to_glib_full();
    ptr as *mut c_void
}

/// Returns a raw pointer to a closure without adding a reference.
///
/// Use this when transferring sole ownership to GTK via mem::forget.
/// The closure's existing reference becomes GTK's responsibility to unref.
fn closure_to_glib_none(closure: &glib::Closure) -> *mut c_void {
    use glib::translate::ToGlibPtr;
    let stash: glib::translate::Stash<*mut glib::gobject_ffi::GClosure, _> = closure.to_glib_none();
    stash.0 as *mut c_void
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

                let ptr = match object_id {
                    Some(id) => id
                        .as_ptr()
                        .ok_or_else(|| anyhow::anyhow!("GObject has been garbage collected"))?,
                    None => std::ptr::null_mut(),
                };

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
            Type::Array(type_) => Value::try_from_array(&arg, type_),
            Type::Callback(type_) => Value::try_from_callback(&arg, type_),
            Type::Ref(type_) => Value::try_from_ref(&arg, type_),
        }
    }
}

impl Value {
    /// Returns a raw pointer to this value's data.
    ///
    /// # Panics
    ///
    /// Panics if called on a `TrampolineCallback` variant, which requires
    /// special multi-pointer handling in the call module.
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

                let ptrs: Vec<*mut c_void> = ids
                    .iter()
                    .map(|id| id.as_ptr().unwrap_or(std::ptr::null_mut()))
                    .collect();
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
                    let args_values = convert_glib_args(args, &arg_types);
                    let return_type = *return_type.clone().unwrap_or(Box::new(Type::Undefined));

                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        args_values,
                        true,
                        "JS thread disconnected while waiting for callback result",
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
                        .map(|gval| value::Value::from_glib_value(gval, &source_type))
                        .unwrap_or(value::Value::Null);

                    let result_value = args
                        .get(1)
                        .map(|gval| value::Value::from_glib_value(gval, &result_type))
                        .unwrap_or(value::Value::Null);

                    let args_values = vec![source_value, result_value];

                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        args_values,
                        false,
                        "JS thread disconnected while waiting for async callback",
                        |_| None::<glib::Value>,
                    )
                });

                let closure_ptr = closure_to_glib_full(&closure);
                let trampoline_ptr = callback::get_async_ready_trampoline_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new(closure, closure_ptr),
                    destroy_ptr: None,
                }))
            }

            CallbackTrampoline::Destroy => {
                let closure = glib::Closure::new(move |_args: &[glib::Value]| {
                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        vec![],
                        false,
                        "JS thread disconnected while waiting for destroy callback",
                        |_| None::<glib::Value>,
                    )
                });

                let closure_ptr = closure_to_glib_full(&closure);
                let trampoline_ptr = callback::get_destroy_trampoline_ptr();

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new(closure, closure_ptr),
                    destroy_ptr: None,
                }))
            }

            CallbackTrampoline::SourceFunc => {
                let closure = glib::Closure::new(move |_args: &[glib::Value]| {
                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        vec![],
                        true,
                        "JS thread disconnected while waiting for source func callback",
                        |result| match result {
                            Ok(value) => value.into(),
                            Err(_) => Some(false.into()),
                        },
                    )
                });

                let closure_ptr = closure_to_glib_none(&closure);
                let trampoline_ptr = callback::get_source_func_trampoline_ptr();
                let destroy_ptr = callback::get_unref_closure_trampoline_ptr();

                std::mem::forget(closure);

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new((), closure_ptr),
                    destroy_ptr: Some(destroy_ptr),
                }))
            }

            CallbackTrampoline::DrawFunc => {
                let arg_types = type_.arg_types.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = convert_glib_args(args, &arg_types);

                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        args_values,
                        false,
                        "JS thread disconnected while waiting for draw func callback",
                        |_| None::<glib::Value>,
                    )
                });

                let closure_ptr = closure_to_glib_none(&closure);
                let trampoline_ptr = callback::get_draw_func_trampoline_ptr();
                let destroy_ptr = callback::get_unref_closure_trampoline_ptr();

                std::mem::forget(closure);

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new((), closure_ptr),
                    destroy_ptr: Some(destroy_ptr),
                }))
            }

            CallbackTrampoline::CompareDataFunc => {
                let arg_types = type_.arg_types.clone();

                let closure = glib::Closure::new(move |args: &[glib::Value]| {
                    let args_values = convert_glib_args(args, &arg_types);

                    invoke_and_wait_for_js_result(
                        &channel,
                        &callback,
                        args_values,
                        true,
                        "JS thread disconnected while waiting for compare func callback",
                        |result| match result {
                            Ok(value) => {
                                let ordering = match value {
                                    value::Value::Number(n) => n as i32,
                                    _ => 0,
                                };
                                Some(ordering.into())
                            }
                            Err(_) => Some(0i32.into()),
                        },
                    )
                });

                let closure_ptr = closure_to_glib_none(&closure);
                let trampoline_ptr = callback::get_compare_data_func_trampoline_ptr();
                let destroy_ptr = callback::get_unref_closure_trampoline_ptr();

                std::mem::forget(closure);

                Ok(Value::TrampolineCallback(TrampolineCallbackValue {
                    trampoline_ptr,
                    closure: OwnedPtr::new((), closure_ptr),
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
                        let ptr = id.as_ptr().ok_or_else(|| {
                            anyhow::anyhow!("Ref object has been garbage collected")
                        })?;
                        Ok(Value::Ptr(ptr))
                    }
                    value::Value::Null | value::Value::Undefined => {
                        // GTK-allocates: need pointer-to-pointer semantics
                        // Create heap storage for the pointer, initialized to null.
                        // FFI passes the value at &owned_ptr.ptr to C, which is the address
                        // of this storage. C writes the allocated pointer into this storage.
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
