use std::ffi::{c_char, c_void};
use std::sync::Arc;

use glib::{
    self, gobject_ffi,
    translate::{FromGlib as _, IntoGlib as _},
};
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::ffi::callback::{CallbackState, build_trampoline};
use crate::ffi::descriptor::{Codec, Descriptor};
use crate::ffi::value::JsRef;
use crate::messaging::error_reporter::ErrorReporter;

pub struct VfuncCallback(Arc<JsRef>);

impl FromNapiValue for VfuncCallback {
    unsafe fn from_napi_value(env: sys::napi_env, napi_val: sys::napi_value) -> napi::Result<Self> {
        let env_wrapper = Env::from(env);
        let value = unsafe { Unknown::from_napi_value(env, napi_val)? };
        if !matches!(value.get_type()?, napi::ValueType::Function) {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "register_class: vfunc 'fn' must be a function",
            ));
        }
        Ok(Self(Arc::new(JsRef::from_js_value(&env_wrapper, &value)?)))
    }
}

#[napi(object, object_to_js = false)]
pub struct RegisterClassVfunc {
    pub byte_offset: u32,
    pub arg_descriptors: Vec<Descriptor>,
    pub return_descriptor: Descriptor,
    #[napi(ts_type = "(...args: never[]) => unknown")]
    pub r#fn: VfuncCallback,
}

#[napi(object, object_to_js = false)]
pub struct RegisterClassInterface {
    pub gtype: BigInt,
    pub vfuncs: Vec<RegisterClassVfunc>,
}

#[napi(object, object_to_js = false)]
pub struct RegisterClassOptions {
    pub vfuncs: Option<Vec<RegisterClassVfunc>>,
    pub interfaces: Option<Vec<RegisterClassInterface>>,
}

impl RegisterClassVfunc {
    fn into_raw(self) -> napi::Result<RawVfunc> {
        Ok(RawVfunc {
            byte_offset: self.byte_offset as usize,
            js_func: self.r#fn.0,
            arg_descriptors: self
                .arg_descriptors
                .into_iter()
                .map(Descriptor::into_codec)
                .collect::<napi::Result<_>>()?,
            return_descriptor: self.return_descriptor.into_codec()?,
        })
    }
}

impl RegisterClassInterface {
    fn into_raw(self) -> napi::Result<RawInterface> {
        let (_, gtype_value, gtype_lossless) = self.gtype.get_u64();
        if !gtype_lossless {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "register_class: interface gtype exceeds the 64-bit GType range",
            ));
        }
        let gtype = unsafe { glib::Type::from_glib(gtype_value as glib::ffi::GType) };
        if !gtype.is_valid() {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "register_class: interface gtype must be non-zero",
            ));
        }
        Ok(RawInterface {
            gtype,
            vfuncs: self
                .vfuncs
                .into_iter()
                .map(RegisterClassVfunc::into_raw)
                .collect::<napi::Result<_>>()?,
        })
    }
}

impl RegisterClassOptions {
    fn into_raw(self) -> napi::Result<(Vec<RawVfunc>, Vec<RawInterface>)> {
        let vfuncs = self
            .vfuncs
            .unwrap_or_default()
            .into_iter()
            .map(RegisterClassVfunc::into_raw)
            .collect::<napi::Result<_>>()?;
        let interfaces = self
            .interfaces
            .unwrap_or_default()
            .into_iter()
            .map(RegisterClassInterface::into_raw)
            .collect::<napi::Result<_>>()?;
        Ok((vfuncs, interfaces))
    }
}

struct RawVfunc {
    byte_offset: usize,
    js_func: Arc<JsRef>,
    arg_descriptors: Vec<Codec>,
    return_descriptor: Codec,
}

struct RawInterface {
    gtype: glib::Type,
    vfuncs: Vec<RawVfunc>,
}

impl RawVfunc {
    fn into_prepared(self) -> PreparedVfunc {
        let Self {
            byte_offset,
            js_func,
            arg_descriptors,
            return_descriptor,
        } = self;
        let (code_ptr, state) =
            build_trampoline(js_func, arg_descriptors, return_descriptor, None, false);
        PreparedVfunc {
            byte_offset,
            code_ptr,
            state,
        }
    }
}

impl RawInterface {
    fn into_prepared(self) -> PreparedInterface {
        PreparedInterface {
            gtype: self.gtype,
            vfuncs: self
                .vfuncs
                .into_iter()
                .map(RawVfunc::into_prepared)
                .collect(),
        }
    }
}

struct PreparedVfunc {
    byte_offset: usize,
    code_ptr: *mut c_void,
    state: Box<CallbackState>,
}

struct PreparedInterface {
    gtype: glib::Type,
    vfuncs: Vec<PreparedVfunc>,
}

impl PreparedVfunc {
    fn install_all(vtable_base: *mut c_void, vfuncs: Vec<Self>) {
        for vfunc in vfuncs {
            unsafe {
                let slot = vtable_base
                    .cast::<u8>()
                    .add(vfunc.byte_offset)
                    .cast::<*mut c_void>();
                slot.write(vfunc.code_ptr);
            }
            std::mem::forget(vfunc.state);
        }
    }
}

impl PreparedInterface {
    fn install(self, class_ptr: *mut c_void) {
        let iface_vtable =
            unsafe { gobject_ffi::g_type_interface_peek(class_ptr, self.gtype.into_glib()) };
        if iface_vtable.is_null() {
            ErrorReporter::global().report_str(&format!(
                "register_class: registered type does not conform to interface {:#x}",
                self.gtype.into_glib()
            ));
            return;
        }
        PreparedVfunc::install_all(iface_vtable, self.vfuncs);
    }
}

unsafe extern "C" fn class_init(g_class: *mut c_void, class_data: *mut c_void) {
    if class_data.is_null() {
        return;
    }
    let vfuncs = unsafe { Box::from_raw(class_data.cast::<Vec<PreparedVfunc>>()) };
    PreparedVfunc::install_all(g_class, *vfuncs);
}

struct RegisterClassRequest {
    name: glib::GString,
    parent_gtype: glib::Type,
    vfuncs: Vec<RawVfunc>,
    interfaces: Vec<RawInterface>,
}

impl RegisterClassRequest {
    fn query_parent_gtype(&self) -> anyhow::Result<gobject_ffi::GTypeQuery> {
        if !self.parent_gtype.is_valid() {
            anyhow::bail!("parent gtype is invalid (G_TYPE_INVALID)");
        }

        if glib::Type::from_name(&self.name).is_some() {
            anyhow::bail!("GType name '{}' is already registered", self.name);
        }

        let mut query: gobject_ffi::GTypeQuery = unsafe { std::mem::zeroed() };
        unsafe { gobject_ffi::g_type_query(self.parent_gtype.into_glib(), &mut query) };
        if query.type_ == 0 {
            anyhow::bail!("parent gtype could not be queried");
        }
        Ok(query)
    }

    fn validate_vfunc_offset(
        byte_offset: usize,
        pointer_align: usize,
        pointer_size: usize,
        class_size: Option<u32>,
        label: &str,
    ) -> anyhow::Result<()> {
        if !byte_offset.is_multiple_of(pointer_align) {
            anyhow::bail!(
                "{label} byte_offset {byte_offset} is not aligned to a pointer ({pointer_align})"
            );
        }
        let end = byte_offset
            .checked_add(pointer_size)
            .ok_or_else(|| anyhow::anyhow!("{label} byte_offset overflow"))?;
        if let Some(class_size) = class_size
            && end > class_size as usize
        {
            anyhow::bail!("{label} byte_offset {byte_offset} exceeds class size {class_size}");
        }
        Ok(())
    }

    fn validate_layout(&self, query: &gobject_ffi::GTypeQuery) -> anyhow::Result<()> {
        let pointer_align = std::mem::align_of::<*mut c_void>();
        let pointer_size = std::mem::size_of::<*mut c_void>();

        for vfunc in &self.vfuncs {
            Self::validate_vfunc_offset(
                vfunc.byte_offset,
                pointer_align,
                pointer_size,
                Some(query.class_size),
                "vfunc",
            )?;
        }

        for iface in &self.interfaces {
            if !iface.gtype.is_valid() {
                anyhow::bail!("interface gtype is invalid (G_TYPE_INVALID)");
            }
            for vfunc in &iface.vfuncs {
                Self::validate_vfunc_offset(
                    vfunc.byte_offset,
                    pointer_align,
                    pointer_size,
                    None,
                    "interface vfunc",
                )?;
            }
        }
        Ok(())
    }

    fn register_type(
        parent_gtype: glib::Type,
        name_ptr: *const c_char,
        class_vfuncs_ptr: *mut c_void,
        interfaces: Vec<PreparedInterface>,
        class_size: u16,
        instance_size: u16,
    ) -> anyhow::Result<usize> {
        let info = gobject_ffi::GTypeInfo {
            class_size,
            base_init: None,
            base_finalize: None,
            class_init: Some(class_init),
            class_finalize: None,
            class_data: class_vfuncs_ptr,
            instance_size,
            n_preallocs: 0,
            instance_init: None,
            value_table: std::ptr::null(),
        };

        let new_gtype = unsafe {
            gobject_ffi::g_type_register_static(parent_gtype.into_glib(), name_ptr, &info, 0)
        };

        if new_gtype == 0 {
            drop(unsafe { Box::from_raw(class_vfuncs_ptr.cast::<Vec<PreparedVfunc>>()) });
            anyhow::bail!("g_type_register_static returned G_TYPE_INVALID");
        }

        let class_ptr = unsafe { gobject_ffi::g_type_class_ref(new_gtype) };

        for iface in interfaces {
            iface.install(class_ptr);
        }

        Ok(new_gtype)
    }
}

impl Request for RegisterClassRequest {
    type Output = u64;

    fn execute(self) -> anyhow::Result<u64> {
        let query = self.query_parent_gtype()?;
        self.validate_layout(&query)?;

        let class_size = query.class_size as u16;
        let instance_size = query.instance_size as u16;
        let class_vfuncs: Vec<PreparedVfunc> = self
            .vfuncs
            .into_iter()
            .map(RawVfunc::into_prepared)
            .collect();
        let interfaces: Vec<PreparedInterface> = self
            .interfaces
            .into_iter()
            .map(RawInterface::into_prepared)
            .collect();
        let class_vfuncs_ptr = Box::into_raw(Box::new(class_vfuncs)).cast::<c_void>();

        let new_gtype = Self::register_type(
            self.parent_gtype,
            self.name.as_ptr(),
            class_vfuncs_ptr,
            interfaces,
            class_size,
            instance_size,
        )?;

        Ok(new_gtype as u64)
    }

    fn error_context() -> &'static str {
        "register_class"
    }
}

pub mod napi_export {
    use super::*;

    #[napi(catch_unwind)]
    pub fn register_class(
        env: Env,
        name: String,
        parent_gtype: BigInt,
        options: Option<RegisterClassOptions>,
    ) -> napi::Result<BigInt> {
        let name = glib::GString::from_string_checked(name).map_err(|err| {
            napi::Error::new(
                napi::Status::InvalidArg,
                format!("register_class: invalid type name: {err}"),
            )
        })?;
        let (_, parent_value, parent_lossless) = parent_gtype.get_u64();
        if !parent_lossless {
            return Err(napi::Error::new(
                napi::Status::InvalidArg,
                "register_class: parent gtype exceeds the 64-bit GType range",
            ));
        }
        let (vfuncs, interfaces) = match options {
            Some(options) => options.into_raw()?,
            None => (Vec::new(), Vec::new()),
        };
        let gtype = RegisterClassRequest {
            name,
            parent_gtype: unsafe { glib::Type::from_glib(parent_value as glib::ffi::GType) },
            vfuncs,
            interfaces,
        }
        .dispatch_output(env)?;
        Ok(BigInt::from(gtype))
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use gtk4::prelude::StaticType as _;

    use super::*;

    const POINTER_ALIGN: usize = 8;
    const POINTER_SIZE: usize = 8;

    static TYPE_COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn unique_name(prefix: &str) -> glib::GString {
        let id = TYPE_COUNTER.fetch_add(1, Ordering::Relaxed);
        glib::GString::from_string_checked(format!("{prefix}{id}")).unwrap()
    }

    fn object_parent_gtype() -> glib::Type {
        glib::Object::static_type()
    }

    #[test]
    fn execute_registers_a_new_gtype() {
        let request = RegisterClassRequest {
            name: unique_name("GtkxTestExecuteType"),
            parent_gtype: object_parent_gtype(),
            vfuncs: vec![],
            interfaces: vec![],
        };
        let gtype = request.execute().expect("registration should succeed");
        assert_ne!(gtype, 0);
    }

    #[test]
    fn error_context_is_register_class() {
        assert_eq!(RegisterClassRequest::error_context(), "register_class");
    }

    #[test]
    fn validate_vfunc_offset_accepts_aligned_offset_within_class() {
        let result = RegisterClassRequest::validate_vfunc_offset(
            16,
            POINTER_ALIGN,
            POINTER_SIZE,
            Some(64),
            "vfunc",
        );
        assert!(result.is_ok());
    }

    #[test]
    fn validate_vfunc_offset_accepts_offset_when_class_size_unknown() {
        let result = RegisterClassRequest::validate_vfunc_offset(
            64,
            POINTER_ALIGN,
            POINTER_SIZE,
            None,
            "interface vfunc",
        );
        assert!(result.is_ok());
    }
}
