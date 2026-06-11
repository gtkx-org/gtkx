//! Signal connection through a `GClosure`.
//!
//! [`connect_signal_closure`] is the dedicated connect primitive for the
//! signal consumer (`@gtkx/ffi`'s `connectSignal`). Where the generic libffi
//! trampoline reads raw ABI argument slots, a signal connection made here
//! receives each parameter as a typed [`glib::Value`] from `GLib`'s own
//! closure marshaller, converts it to the JS IR using the codegen-supplied
//! type descriptors, and returns the handler's result as a typed
//! [`glib::Value`] whose contents the signal accumulator owns.
//!
//! Lifetime is automatic: the captured `Arc<JsRef<JsFunction>>` moves into
//! the `GClosure`, so a disconnect or the emitter's finalization drops it,
//! and `JsRef`'s drop schedules the napi-reference release onto the JS
//! thread. No destroy trampoline and no oneshot handshake exist on this
//! path; the libffi trampoline remains only for callback arguments
//! (call/async/forever scopes) and `register_class` vfuncs.
//!
//! The closure body never panics across the `extern "C"` marshal boundary:
//! conversion or callback errors are reported through
//! [`NativeErrorReporter`] and a zero-initialized return value of the
//! signal's declared return type is produced instead, which `GLib`'s marshal
//! contract requires. Everything here either parses JS descriptors through a
//! live [`napi::Env`] or runs inside a `GClosure` on the `GLib` thread, so
//! the module is excluded from coverage instrumentation.

#![cfg_attr(coverage_nightly, coverage(off))]

use std::ffi::c_void;
use std::sync::Arc;

use anyhow::bail;
use gtk4::glib::{
    self, gobject_ffi,
    subclass::SignalId,
    translate::{IntoGlib as _, ToGlibPtr, ToGlibPtrMut, from_glib, from_glib_borrow},
};
use napi::bindgen_prelude::*;
use napi::{Env, JsFunction, NapiValue as _};
use napi_derive::napi;

use super::handler::ModuleRequest;
use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;
use crate::managed::NativeHandle;
use crate::trampoline::{flush_out_cells, seed_ref_cell};
use crate::types::{RawPtrCodec as _, Type, str_to_glib_full};
use crate::value::{JsRef, Value, map_js_array};

/// Everything one signal closure needs to marshal an emission into JS.
struct SignalClosureData {
    js_func: Arc<JsRef<JsFunction>>,
    arg_types: Vec<Type>,
    return_type: Type,
    return_gtype: glib::Type,
}

struct ConnectSignalRequest {
    instance_addr: usize,
    signal: String,
    arg_types: Vec<Type>,
    return_type: Type,
    after: bool,
    js_func: Arc<JsRef<JsFunction>>,
}

impl ModuleRequest for ConnectSignalRequest {
    type Output = u64;

    fn execute(self) -> anyhow::Result<u64> {
        // SAFETY: The JS caller passes a handle to a live GObject, and the
        // Borrowed wrapper neither refs nor unrefs it.
        let object: glib::translate::Borrowed<glib::Object> =
            unsafe { from_glib_borrow(self.instance_addr as *mut gobject_ffi::GObject) };
        let object_type = glib::prelude::ObjectExt::type_(&*object);

        let Some((signal_id, detail)) = SignalId::parse_name(&self.signal, object_type, true)
        else {
            bail!(
                "Unknown signal '{}' on type '{}'",
                self.signal,
                object_type.name()
            );
        };

        let return_gtype = signal_id.query().return_type().type_();

        let data = SignalClosureData {
            js_func: self.js_func,
            arg_types: self.arg_types,
            return_type: self.return_type,
            return_gtype,
        };
        let closure = glib::RustClosure::new(move |values| marshal_signal_emission(&data, values));

        let handler_id = glib::prelude::ObjectExt::connect_closure_id(
            &*object, signal_id, detail, self.after, closure,
        );
        // SAFETY: The raw handler id is read once for transport to JS, which
        // forwards it verbatim to g_signal_handler_disconnect.
        Ok(unsafe { handler_id.as_raw() } as u64)
    }

    fn error_context() -> &'static str {
        "connect_signal_closure"
    }
}

/// The closure body `GLib` invokes per emission, on whichever thread emits
/// the signal — the connection uses a multi-thread `RustClosure`, and a
/// foreign-thread emission routes its JS roundtrip through the mailbox's
/// foreign-thread wait. Never panics across the marshal boundary: any
/// failure is reported and replaced by the signal's zero return value.
fn marshal_signal_emission(
    data: &SignalClosureData,
    values: &[glib::Value],
) -> Option<glib::Value> {
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        run_signal_handler(data, values)
    }));
    match outcome {
        Ok(Ok(return_value)) => return_value,
        Ok(Err(e)) => {
            NativeErrorReporter::global().report(&e.context("signal closure: handler failed"));
            default_signal_return(data.return_gtype)
        }
        Err(payload) => {
            let message = crate::panic_handler::format_panic_payload(&*payload);
            NativeErrorReporter::global()
                .report_str(&format!("signal closure: handler panicked: {message}"));
            default_signal_return(data.return_gtype)
        }
    }
}

/// The zero-initialized return value the marshal contract requires when the
/// handler cannot produce one; `None` for void signals.
fn default_signal_return(return_gtype: glib::Type) -> Option<glib::Value> {
    if return_gtype == glib::Type::UNIT || !return_gtype.is_valid() {
        return None;
    }
    Some(glib::Value::from_type(return_gtype))
}

fn run_signal_handler(
    data: &SignalClosureData,
    values: &[glib::Value],
) -> anyhow::Result<Option<glib::Value>> {
    if values.len() != data.arg_types.len() {
        bail!(
            "signal closure: expected {} arguments, got {}",
            data.arg_types.len(),
            values.len()
        );
    }

    let mut args = Vec::with_capacity(values.len());
    let mut out_cell_indices: Vec<usize> = Vec::new();
    let mut out_targets: Vec<(*mut c_void, &Type)> = Vec::new();

    for (value, ty) in values.iter().zip(&data.arg_types) {
        if let Type::Ref(ref_type) = ty {
            // SAFETY: GLib marshals an inout signal parameter as a
            // G_TYPE_POINTER value holding the out-parameter target.
            let target = unsafe { gobject_ffi::g_value_get_pointer(value.to_glib_none().0) };
            out_cell_indices.push(args.len());
            out_targets.push((target, &ref_type.inner_type));
            args.push(seed_ref_cell(target, &ref_type.inner_type));
            continue;
        }
        args.push(gvalue_to_ir(ty, value, values)?);
    }

    let capture_result = !matches!(data.return_type, Type::Void(_));
    let (return_value, cells) = Mailbox::global()
        .invoke_node_and_wait_with_cells(&data.js_func, args, capture_result, out_cell_indices)
        .map_err(|e| anyhow::anyhow!("JS signal handler failed: {e}"))?;

    flush_out_cells(&cells, &out_targets);

    if data.return_gtype == glib::Type::UNIT || !data.return_gtype.is_valid() {
        return Ok(None);
    }
    Ok(Some(ir_to_gvalue(
        data.return_gtype,
        &data.return_type,
        &return_value,
    )?))
}

/// Converts one marshalled signal parameter to the JS IR, keyed on the
/// codegen descriptor with the payload extracted per the value's fundamental
/// `GType`. `all_values` carries the full parameter list so a sized array
/// can read its element count from the sibling argument its descriptor
/// names.
fn gvalue_to_ir(
    descriptor: &Type,
    value: &glib::Value,
    all_values: &[glib::Value],
) -> anyhow::Result<Value> {
    let raw: *const gobject_ffi::GValue = value.to_glib_none().0;
    match descriptor {
        Type::Boolean(_) => {
            // SAFETY: GLib initialized the value with the signal's declared
            // boolean parameter type.
            Ok(Value::Boolean(unsafe {
                gobject_ffi::g_value_get_boolean(raw) != 0
            }))
        }
        Type::Integer(_) | Type::Float(_) | Type::Tagged(_) => {
            scalar_from_gvalue(value).map(Value::Number)
        }
        Type::Unichar(_) => {
            // SAFETY: A unichar signal parameter is marshalled as
            // G_TYPE_UINT.
            let codepoint = unsafe { gobject_ffi::g_value_get_uint(raw) };
            let character = char::from_u32(codepoint).unwrap_or(char::REPLACEMENT_CHARACTER);
            Ok(Value::String(character.to_string()))
        }
        Type::String(_)
        | Type::GObject(_)
        | Type::Boxed(_)
        | Type::Struct(_)
        | Type::Fundamental(_)
        | Type::HashTable(_) => {
            let ptr = pointer_from_gvalue(value)?;
            // SAFETY: The pointer was extracted from a live GValue whose
            // type matches the descriptor's pointer representation.
            unsafe { descriptor.ptr_to_value(ptr, "signal argument") }
        }
        Type::Array(array_type) => {
            let ptr = pointer_from_gvalue(value)?;
            if let crate::types::ArrayKind::Sized { size_index } = array_type.kind {
                let Some(size_value) = all_values.get(size_index) else {
                    bail!(
                        "signal closure: sized array length parameter {size_index} is out of range"
                    );
                };
                let length = scalar_from_gvalue(size_value)? as usize;
                // SAFETY: GLib marshalled `ptr` as this signal's array
                // parameter and `length` as the sibling count parameter the
                // descriptor names.
                return unsafe { array_type.ptr_to_value_sized(ptr, length) };
            }
            // SAFETY: The pointer was extracted from a live GValue holding
            // the container kind the descriptor declares.
            unsafe { array_type.ptr_to_value(ptr) }
        }
        other => bail!("signal closure: unsupported argument type {other}"),
    }
}

/// The fundamental `GType` of `gtype`, deciding which `g_value_get_*` /
/// `g_value_set_*` accessor applies.
fn fundamental_of(gtype: glib::Type) -> glib::Type {
    // SAFETY: g_type_fundamental is a pure lookup over a GType GLib
    // reported for this value.
    unsafe { from_glib(gobject_ffi::g_type_fundamental(gtype.into_glib())) }
}

/// The raw `GValue` pointer and fundamental `GType` of a marshalled signal
/// parameter — the shared prologue of every `GValue` accessor dispatch.
fn raw_and_fundamental(value: &glib::Value) -> (*const gobject_ffi::GValue, glib::Type) {
    let raw: *const gobject_ffi::GValue = value.to_glib_none().0;
    (raw, fundamental_of(value.type_()))
}

/// Extracts the pointer payload of a pointer-carrying signal parameter,
/// keyed on the value's fundamental type.
fn pointer_from_gvalue(value: &glib::Value) -> anyhow::Result<*mut c_void> {
    let (raw, fundamental) = raw_and_fundamental(value);
    // SAFETY: Each getter matches the fundamental type GLib stored in the
    // value, per the match arm.
    unsafe {
        match fundamental {
            glib::Type::STRING => Ok(gobject_ffi::g_value_get_string(raw)
                .cast::<c_void>()
                .cast_mut()),
            glib::Type::OBJECT | glib::Type::INTERFACE => {
                Ok(gobject_ffi::g_value_get_object(raw).cast::<c_void>())
            }
            glib::Type::BOXED => Ok(gobject_ffi::g_value_get_boxed(raw)),
            glib::Type::PARAM_SPEC => Ok(gobject_ffi::g_value_get_param(raw).cast::<c_void>()),
            glib::Type::VARIANT => Ok(gobject_ffi::g_value_get_variant(raw).cast::<c_void>()),
            glib::Type::POINTER => Ok(gobject_ffi::g_value_get_pointer(raw)),
            other => bail!("signal closure: unsupported pointer value type {other}"),
        }
    }
}

/// Reads a scalar signal parameter as an IR number, keyed on the value's
/// fundamental type (signal marshalling promotes small integer widths to
/// `G_TYPE_INT`/`G_TYPE_UINT`).
fn scalar_from_gvalue(value: &glib::Value) -> anyhow::Result<f64> {
    let (raw, fundamental) = raw_and_fundamental(value);
    // SAFETY: Each getter matches the fundamental type GLib stored in the
    // value, per the match arm.
    #[allow(clippy::cast_lossless)]
    unsafe {
        match fundamental {
            glib::Type::I8 => Ok(f64::from(gobject_ffi::g_value_get_schar(raw))),
            glib::Type::U8 => Ok(f64::from(gobject_ffi::g_value_get_uchar(raw))),
            glib::Type::BOOL => Ok(f64::from(gobject_ffi::g_value_get_boolean(raw))),
            glib::Type::I32 => Ok(f64::from(gobject_ffi::g_value_get_int(raw))),
            glib::Type::U32 => Ok(f64::from(gobject_ffi::g_value_get_uint(raw))),
            glib::Type::I_LONG => Ok(gobject_ffi::g_value_get_long(raw) as f64),
            glib::Type::U_LONG => Ok(gobject_ffi::g_value_get_ulong(raw) as f64),
            glib::Type::I64 => Ok(gobject_ffi::g_value_get_int64(raw) as f64),
            glib::Type::U64 => Ok(gobject_ffi::g_value_get_uint64(raw) as f64),
            glib::Type::F32 => Ok(f64::from(gobject_ffi::g_value_get_float(raw))),
            glib::Type::F64 => Ok(gobject_ffi::g_value_get_double(raw)),
            glib::Type::ENUM => Ok(f64::from(gobject_ffi::g_value_get_enum(raw))),
            glib::Type::FLAGS => Ok(f64::from(gobject_ffi::g_value_get_flags(raw))),
            other => bail!("signal closure: unsupported scalar value type {other}"),
        }
    }
}

/// Converts the JS handler's return value into a [`glib::Value`] of the
/// signal's declared return type. The produced value owns its contents
/// (taken string duplicate, referenced object, boxed copy), matching the
/// ownership the signal accumulator assumes.
fn ir_to_gvalue(
    return_gtype: glib::Type,
    descriptor: &Type,
    value: &Value,
) -> anyhow::Result<glib::Value> {
    let mut out = glib::Value::from_type(return_gtype);
    let raw: *mut gobject_ffi::GValue = out.to_glib_none_mut().0;
    let fundamental = fundamental_of(return_gtype);

    let number = |value: &Value| -> anyhow::Result<f64> {
        match value {
            Value::Number(n) => Ok(*n),
            Value::Boolean(b) => Ok(f64::from(*b)),
            Value::Null | Value::Undefined => Ok(0.0),
            other => bail!("signal closure: expected a numeric return, got {other:?}"),
        }
    };

    // SAFETY: Each setter matches the fundamental type the value was
    // initialized with, per the match arm.
    unsafe {
        match fundamental {
            glib::Type::BOOL => gobject_ffi::g_value_set_boolean(
                raw,
                i32::from(matches!(value, Value::Boolean(true))),
            ),
            glib::Type::I8 => gobject_ffi::g_value_set_schar(raw, number(value)? as i8),
            glib::Type::U8 => gobject_ffi::g_value_set_uchar(raw, number(value)? as u8),
            glib::Type::I32 => gobject_ffi::g_value_set_int(raw, number(value)? as i32),
            glib::Type::U32 => gobject_ffi::g_value_set_uint(raw, number(value)? as u32),
            glib::Type::I_LONG => {
                gobject_ffi::g_value_set_long(raw, number(value)? as std::ffi::c_long);
            }
            glib::Type::U_LONG => {
                gobject_ffi::g_value_set_ulong(raw, number(value)? as std::ffi::c_ulong);
            }
            glib::Type::I64 => gobject_ffi::g_value_set_int64(raw, number(value)? as i64),
            glib::Type::U64 => gobject_ffi::g_value_set_uint64(raw, number(value)? as u64),
            glib::Type::F32 => gobject_ffi::g_value_set_float(raw, number(value)? as f32),
            glib::Type::F64 => gobject_ffi::g_value_set_double(raw, number(value)?),
            glib::Type::ENUM => gobject_ffi::g_value_set_enum(raw, number(value)? as i32),
            glib::Type::FLAGS => gobject_ffi::g_value_set_flags(raw, number(value)? as u32),
            glib::Type::STRING => {
                if let Value::String(s) = value {
                    gobject_ffi::g_value_take_string(raw, str_to_glib_full(s)?);
                } else if !matches!(value, Value::Null | Value::Undefined) {
                    bail!("signal closure: expected a string return, got {value:?}");
                }
            }
            glib::Type::OBJECT | glib::Type::INTERFACE => match value {
                Value::Object(handle) => {
                    gobject_ffi::g_value_set_object(raw, handle.ptr().cast());
                }
                Value::Null | Value::Undefined => {}
                other => bail!("signal closure: expected an object return, got {other:?}"),
            },
            glib::Type::BOXED => match value {
                Value::Object(handle) => gobject_ffi::g_value_set_boxed(raw, handle.ptr()),
                Value::Null | Value::Undefined => {}
                other => bail!("signal closure: expected a boxed return, got {other:?}"),
            },
            glib::Type::POINTER => match value {
                Value::Object(handle) => gobject_ffi::g_value_set_pointer(raw, handle.ptr()),
                Value::Null | Value::Undefined => {}
                other => bail!("signal closure: expected a pointer return, got {other:?}"),
            },
            other => bail!(
                "signal closure: unsupported signal return type {other} (descriptor {descriptor})"
            ),
        }
    }

    Ok(out)
}

/// napi export shim. Excluded from coverage instrumentation: it parses JS
/// descriptors through a live [`napi::Env`]. The [`ConnectSignalRequest`]
/// logic it dispatches runs on the `GLib` thread.
#[cfg_attr(coverage_nightly, coverage(off))]
#[allow(clippy::wildcard_imports)]
mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    #[allow(clippy::needless_pass_by_value)]
    #[cfg_attr(test, allow(dead_code))]
    pub fn connect_signal_closure<'env>(
        env: &'env Env,
        handle: &External<NativeHandle>,
        signal: String,
        arg_types: Unknown<'env>,
        return_type: Unknown<'env>,
        callback: Unknown<'env>,
        after: bool,
    ) -> napi::Result<Unknown<'env>> {
        if !arg_types.is_array()? {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "'argTypes' must be an array of type descriptors",
            ));
        }
        // SAFETY: `arg_types` is a live JS value from the current
        // callback's `env`, verified to be an array just above.
        let arg_types_arr: Array = unsafe { Array::from_napi_value(env.raw(), arg_types.raw())? };
        let arg_types = map_js_array(env, &arg_types_arr, Type::from_js_value)?;
        let return_type = Type::from_js_value(env, return_type)?;

        if !matches!(callback.get_type()?, napi::ValueType::Function) {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "signal callback must be a function",
            ));
        }
        // SAFETY: `callback` is a live JS value from the current callback's
        // `env`, verified to be a function just above.
        let callback: JsFunction =
            unsafe { JsFunction::from_raw_unchecked(env.raw(), callback.raw()) };
        let js_func = Arc::new(JsRef::from_js_value(env, &callback)?);

        ConnectSignalRequest {
            instance_addr: handle.ptr() as usize,
            signal,
            arg_types,
            return_type,
            after,
            js_func,
        }
        .dispatch(env)
    }
}
