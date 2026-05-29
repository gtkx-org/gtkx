use std::sync::Arc;
use std::sync::atomic::{AtomicPtr, Ordering};

use gtk4::glib::{
    self, gobject_ffi,
    translate::{FromGlibPtrFull as _, ToGlibPtr as _},
};
use napi::{Env, JsFunction, JsObject};

use super::prelude::*;
use crate::callback::ClosureGuard;
use crate::dispatch::Mailbox;
use crate::error_reporter::NativeErrorReporter;
use crate::ffi::FfiStorage;
use crate::managed::{Boxed, NativeValue};
use crate::types::Type;
use crate::value::{Callback, JsRef};

struct ClosureContext {
    js_func: Arc<JsRef<JsFunction>>,
    arg_types: Vec<Type>,
}

#[cfg_attr(coverage_nightly, coverage(off))]
impl ClosureContext {
    fn from_callback(callback: &Callback, callback_type: &CallbackType) -> Self {
        Self {
            js_func: callback.js_func.clone(),
            arg_types: callback_type.arg_types.clone(),
        }
    }

    fn build_closure_with_guard(self, return_type: Box<Type>) -> glib::Closure {
        let closure_holder: Arc<AtomicPtr<gobject_ffi::GClosure>> =
            Arc::new(AtomicPtr::new(std::ptr::null_mut()));
        let closure_holder_for_callback = closure_holder.clone();

        let closure = glib::Closure::new(move |args: &[glib::Value]| {
            let _guard =
                ClosureGuard::from_ptr(closure_holder_for_callback.load(Ordering::Acquire));

            let args_values = match Self::convert_closure_args(args, &self.arg_types) {
                Ok(v) => v,
                Err(e) => {
                    NativeErrorReporter::global()
                        .report(&e.context("closure: failed to convert callback arguments"));
                    return None;
                }
            };

            let return_type_ref: Option<&Type> = Some(&return_type);

            let result = Mailbox::global().invoke_node_and_wait(&self.js_func, args_values, true);

            match result {
                Ok(value) => value::Value::into_glib_value_with_default(value, return_type_ref),
                Err(ref e) => {
                    NativeErrorReporter::global().report(&anyhow::anyhow!(
                        "closure callback: JS callback error: {e:#}"
                    ));
                    value::Value::into_glib_value_with_default(
                        value::Value::Undefined,
                        return_type_ref,
                    )
                }
            }
        });

        let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
        closure_holder.store(closure_ptr, Ordering::Release);

        unsafe { glib::Closure::from_glib_full(closure_ptr) }
    }

    fn convert_closure_args(
        args: &[glib::Value],
        arg_types: &[Type],
    ) -> anyhow::Result<Vec<value::Value>> {
        args.iter()
            .zip(arg_types.iter())
            .map(|(gval, ty)| {
                if let Type::Boxed(boxed_type) = ty {
                    let boxed_ptr = unsafe {
                        glib::gobject_ffi::g_value_get_boxed(gval.to_glib_none().0 as *const _)
                    };
                    if boxed_ptr.is_null() {
                        return Ok(value::Value::Null);
                    }
                    let boxed = if boxed_type.ownership.is_full() {
                        let gtype = boxed_type.gtype();
                        let owned_ptr = unsafe {
                            glib::gobject_ffi::g_value_dup_boxed(gval.to_glib_none().0 as *const _)
                        };
                        Boxed::from_glib_full(gtype, owned_ptr)
                    } else {
                        Boxed::from_ptr_unowned(boxed_ptr)
                    };
                    Ok(value::Value::Object(NativeValue::Boxed(boxed).into()))
                } else {
                    value::Value::from_glib_value(gval, ty)
                }
            })
            .collect()
    }
}

#[derive(Debug, Clone)]
pub struct CallbackType {
    pub arg_types: Vec<Type>,
    pub return_type: Box<Type>,
}

impl CallbackType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn from_js_value(env: &Env, obj: &JsObject) -> napi::Result<Self> {
        let (arg_types, return_type) =
            super::parse_callback_arg_and_return_types(env, obj, "callback")?;
        Ok(Self {
            arg_types,
            return_type,
        })
    }

    #[must_use]
    #[cfg_attr(coverage_nightly, coverage(off))]
    pub fn build_ffi_value(&self, callback: &Callback) -> ffi::FfiValue {
        let ctx = ClosureContext::from_callback(callback, self);
        let closure = ctx.build_closure_with_guard(self.return_type.clone());
        let closure_ptr: *mut gobject_ffi::GClosure = closure.to_glib_full();
        ffi::FfiValue::Storage(FfiStorage::closure(closure_ptr))
    }

    fn build_null_ffi_value() -> ffi::FfiValue {
        ffi::FfiValue::Storage(FfiStorage::new(
            std::ptr::null_mut(),
            ffi::FfiStorageKind::Unit,
        ))
    }
}

impl FfiEncoder for CallbackType {
    #[cfg_attr(coverage_nightly, coverage(off))]
    fn encode(&self, val: &value::Value, optional: bool) -> anyhow::Result<ffi::FfiValue> {
        use anyhow::bail;

        let callback = match val {
            value::Value::Callback(callback) => callback,
            value::Value::Null | value::Value::Undefined if optional => {
                return Ok(Self::build_null_ffi_value());
            }
            _ => bail!("Expected a Callback for callback type, got {val:?}"),
        };

        Ok(self.build_ffi_value(callback))
    }

    arg_only_call_cif!("Callbacks");
}

impl FfiDecoder for CallbackType {}

impl RawPtrCodec for CallbackType {}

impl GlibValueCodec for CallbackType {}
