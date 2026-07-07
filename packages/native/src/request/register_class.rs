use std::ffi::{c_char, c_void};

use glib::{
    self, gobject_ffi,
    translate::{FromGlib as _, IntoGlib as _},
};
use napi::Env;
use napi::bindgen_prelude::*;
use napi_derive::napi;

use super::Request;
use crate::ffi::closure::ClosureState;
use crate::ffi::codec::Codec;
use crate::ffi::descriptor::Descriptor;
use crate::ffi::value::JsHandle;
use crate::messaging::error_reporter::ErrorReporter;

fn type_from_bigint(value: BigInt, label: &str) -> napi::Result<glib::Type> {
    let (_, type_value, lossless) = value.get_u64();
    if !lossless {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("register_class: {label} type exceeds the 64-bit type range"),
        ));
    }
    let type_ = unsafe { glib::Type::from_glib(type_value as glib::ffi::GType) };
    if !type_.is_valid() {
        return Err(napi::Error::new(
            napi::Status::InvalidArg,
            format!("register_class: {label} type must be non-zero"),
        ));
    }
    Ok(type_)
}

pub struct VfuncCallback(JsHandle);

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
        Ok(Self(JsHandle::from_js_value(&env_wrapper, &value)?))
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
    pub r#type: BigInt,
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
            js_fn: self.r#fn.0,
            arg_codecs: self
                .arg_descriptors
                .into_iter()
                .map(Descriptor::into_codec)
                .collect::<napi::Result<_>>()?,
            return_codec: self.return_descriptor.into_codec()?,
        })
    }
}

impl RegisterClassInterface {
    fn into_raw(self) -> napi::Result<RawInterface> {
        let type_ = type_from_bigint(self.r#type, "interface")?;
        Ok(RawInterface {
            type_,
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
    js_fn: JsHandle,
    arg_codecs: Vec<Codec>,
    return_codec: Codec,
}

struct RawInterface {
    type_: glib::Type,
    vfuncs: Vec<RawVfunc>,
}

impl RawVfunc {
    fn install_into(self, vtable_base: *mut c_void) {
        let Self {
            byte_offset,
            js_fn,
            arg_codecs,
            return_codec,
        } = self;
        let state = ClosureState::boxed(js_fn, arg_codecs, return_codec, None, false);
        unsafe {
            let slot = vtable_base
                .cast::<u8>()
                .add(byte_offset)
                .cast::<*mut c_void>();
            slot.write(state.code_ptr);
        }
        std::mem::forget(state);
    }
}

impl RawInterface {
    fn install(self, class_ptr: *mut c_void) {
        let iface_vtable =
            unsafe { gobject_ffi::g_type_interface_peek(class_ptr, self.type_.into_glib()) };
        if iface_vtable.is_null() {
            ErrorReporter::global().report_str(&format!(
                "register_class: registered type does not conform to interface {:#x}",
                self.type_.into_glib()
            ));
            return;
        }
        for vfunc in self.vfuncs {
            vfunc.install_into(iface_vtable);
        }
    }
}

struct RegisterClassRequest {
    name: glib::GString,
    parent_type: glib::Type,
    vfuncs: Vec<RawVfunc>,
    interfaces: Vec<RawInterface>,
}

impl RegisterClassRequest {
    fn query_parent_type(&self) -> anyhow::Result<gobject_ffi::GTypeQuery> {
        if glib::Type::from_name(&self.name).is_some() {
            anyhow::bail!("Type name '{}' is already registered", self.name);
        }

        let mut query = gobject_ffi::GTypeQuery {
            type_: 0,
            type_name: std::ptr::null(),
            class_size: 0,
            instance_size: 0,
        };
        unsafe { gobject_ffi::g_type_query(self.parent_type.into_glib(), &mut query) };
        if query.type_ == 0 {
            anyhow::bail!("parent type could not be queried");
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
        parent_type: glib::Type,
        name_ptr: *const c_char,
        vfuncs: Vec<RawVfunc>,
        interfaces: Vec<RawInterface>,
        class_size: u16,
        instance_size: u16,
    ) -> anyhow::Result<usize> {
        let info = gobject_ffi::GTypeInfo {
            class_size,
            base_init: None,
            base_finalize: None,
            class_init: None,
            class_finalize: None,
            class_data: std::ptr::null_mut(),
            instance_size,
            n_preallocs: 0,
            instance_init: None,
            value_table: std::ptr::null(),
        };

        let new_type = unsafe {
            gobject_ffi::g_type_register_static(parent_type.into_glib(), name_ptr, &info, 0)
        };

        if new_type == 0 {
            anyhow::bail!("g_type_register_static returned G_TYPE_INVALID");
        }

        let class_ptr = unsafe { gobject_ffi::g_type_class_ref(new_type) };

        for vfunc in vfuncs {
            vfunc.install_into(class_ptr);
        }

        for iface in interfaces {
            iface.install(class_ptr);
        }

        Ok(new_type)
    }
}

impl Request for RegisterClassRequest {
    type Output = u64;

    fn execute(self) -> anyhow::Result<u64> {
        let query = self.query_parent_type()?;
        self.validate_layout(&query)?;

        let class_size = query.class_size as u16;
        let instance_size = query.instance_size as u16;

        let new_type = Self::register_type(
            self.parent_type,
            self.name.as_ptr(),
            self.vfuncs,
            self.interfaces,
            class_size,
            instance_size,
        )?;

        Ok(new_type as u64)
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
        parent_type: BigInt,
        options: Option<RegisterClassOptions>,
    ) -> napi::Result<BigInt> {
        let name = glib::GString::from_string_checked(name).map_err(|err| {
            napi::Error::new(
                napi::Status::InvalidArg,
                format!("register_class: invalid type name: {err}"),
            )
        })?;
        let parent_type = type_from_bigint(parent_type, "parent")?;
        let (vfuncs, interfaces) = match options {
            Some(options) => options.into_raw()?,
            None => (Vec::new(), Vec::new()),
        };
        let type_ = RegisterClassRequest {
            name,
            parent_type,
            vfuncs,
            interfaces,
        }
        .dispatch_output(env)?;
        Ok(BigInt::from(type_))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use glib::prelude::StaticType as _;
    use napi::bindgen_prelude::BigInt;

    fn gstring(name: &str) -> glib::GString {
        glib::GString::from_string_checked(name.to_owned()).expect("valid type name")
    }

    #[test]
    fn execute_registers_a_new_subtype_of_gobject() {
        test_support::run(|| {
            let request = RegisterClassRequest {
                name: gstring("GtkxRegisterClassSmokeType"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: Vec::new(),
            };
            let type_ = request.execute().expect("registration should succeed");
            assert_ne!(type_, 0);
            assert_eq!(
                glib::Type::from_name("GtkxRegisterClassSmokeType").map(|t| t.into_glib() as u64),
                Some(type_)
            );
        });
    }

    #[test]
    fn execute_rejects_an_already_registered_name() {
        test_support::run(|| {
            let request = RegisterClassRequest {
                name: gstring("GObject"),
                parent_type: glib::Object::static_type(),
                vfuncs: Vec::new(),
                interfaces: Vec::new(),
            };
            assert!(request.execute().is_err());
        });
    }

    #[test]
    fn validate_vfunc_offset_accepts_aligned_offset_within_bounds() {
        RegisterClassRequest::validate_vfunc_offset(8, 8, 8, Some(64), "vfunc")
            .expect("aligned in-bounds offset should validate");
    }

    #[test]
    fn validate_vfunc_offset_rejects_unaligned_offset() {
        assert!(RegisterClassRequest::validate_vfunc_offset(4, 8, 8, Some(64), "vfunc").is_err());
    }

    #[test]
    fn validate_vfunc_offset_rejects_offset_beyond_class_size() {
        assert!(RegisterClassRequest::validate_vfunc_offset(64, 8, 8, Some(64), "vfunc").is_err());
    }

    #[test]
    fn validate_vfunc_offset_rejects_end_overflow() {
        assert!(
            RegisterClassRequest::validate_vfunc_offset(usize::MAX, 8, 8, None, "vfunc").is_err()
        );
    }

    #[test]
    fn type_from_bigint_accepts_a_valid_type() {
        let value = BigInt::from(glib::Object::static_type().into_glib() as u64);
        assert!(type_from_bigint(value, "parent").is_ok());
    }

    #[test]
    fn type_from_bigint_rejects_zero() {
        assert!(type_from_bigint(BigInt::from(0u64), "parent").is_err());
    }
}
