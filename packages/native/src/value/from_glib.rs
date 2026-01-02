use std::ffi::c_void;

use anyhow::bail;
use gtk4::glib::{self, translate::FromGlibPtrFull as _, translate::FromGlibPtrNone as _, translate::ToGlibPtr as _};

use super::helpers::gobject_from_gvalue;
use super::Value;
use crate::{
    boxed::Boxed,
    object::Object,
    types::*,
    variant::GVariant as GVariantWrapper,
};

impl Value {
    pub fn from_glib_value(gvalue: &glib::Value, type_: &Type) -> anyhow::Result<Self> {
        match type_ {
            Type::Integer(int_type) => {
                let gtype = gvalue.type_();
                let is_enum = gtype.is_a(glib::types::Type::ENUM);
                let is_flags = gtype.is_a(glib::types::Type::FLAGS);

                let number = match (int_type.size, int_type.sign) {
                    (IntegerSize::_8, IntegerSign::Signed) => gvalue
                        .get::<i8>()
                        .map_err(|e| anyhow::anyhow!("Failed to get i8 from GValue: {}", e))?
                        as f64,
                    (IntegerSize::_8, IntegerSign::Unsigned) => gvalue
                        .get::<u8>()
                        .map_err(|e| anyhow::anyhow!("Failed to get u8 from GValue: {}", e))?
                        as f64,
                    (IntegerSize::_16, IntegerSign::Signed) => gvalue.get::<i32>().map_err(|e| {
                        anyhow::anyhow!("Failed to get i32 (as i16) from GValue: {}", e)
                    })? as i16
                        as f64,
                    (IntegerSize::_16, IntegerSign::Unsigned) => {
                        gvalue.get::<u32>().map_err(|e| {
                            anyhow::anyhow!("Failed to get u32 (as u16) from GValue: {}", e)
                        })? as u16 as f64
                    }
                    (IntegerSize::_32, IntegerSign::Signed) => {
                        if is_enum {
                            let enum_value = unsafe {
                                glib::gobject_ffi::g_value_get_enum(
                                    gvalue.to_glib_none().0 as *const _,
                                )
                            };
                            enum_value as f64
                        } else {
                            gvalue.get::<i32>().map_err(|e| {
                                anyhow::anyhow!("Failed to get i32 from GValue: {}", e)
                            })? as f64
                        }
                    }
                    (IntegerSize::_32, IntegerSign::Unsigned) => {
                        if is_flags {
                            let flags_value = unsafe {
                                glib::gobject_ffi::g_value_get_flags(
                                    gvalue.to_glib_none().0 as *const _,
                                )
                            };
                            flags_value as f64
                        } else {
                            gvalue.get::<u32>().map_err(|e| {
                                anyhow::anyhow!("Failed to get u32 from GValue: {}", e)
                            })? as f64
                        }
                    }
                    (IntegerSize::_64, IntegerSign::Signed) => gvalue
                        .get::<i64>()
                        .map_err(|e| anyhow::anyhow!("Failed to get i64 from GValue: {}", e))?
                        as f64,
                    (IntegerSize::_64, IntegerSign::Unsigned) => gvalue
                        .get::<u64>()
                        .map_err(|e| anyhow::anyhow!("Failed to get u64 from GValue: {}", e))?
                        as f64,
                };
                Ok(Value::Number(number))
            }
            Type::Float(float_type) => {
                let number = match float_type.size {
                    FloatSize::_32 => gvalue
                        .get::<f32>()
                        .map_err(|e| anyhow::anyhow!("Failed to get f32 from GValue: {}", e))?
                        as f64,
                    FloatSize::_64 => gvalue
                        .get::<f64>()
                        .map_err(|e| anyhow::anyhow!("Failed to get f64 from GValue: {}", e))?,
                };
                Ok(Value::Number(number))
            }
            Type::String(_) => {
                let string: String = gvalue
                    .get()
                    .map_err(|e| anyhow::anyhow!("Failed to get String from GValue: {}", e))?;
                Ok(Value::String(string))
            }
            Type::Boolean => {
                let boolean: bool = gvalue
                    .get()
                    .map_err(|e| anyhow::anyhow!("Failed to get bool from GValue: {}", e))?;
                Ok(Value::Boolean(boolean))
            }
            Type::GObject(_) => gobject_from_gvalue(gvalue),
            Type::GParam(gparam_type) => {
                let param_ptr = unsafe {
                    glib::gobject_ffi::g_value_get_param(gvalue.to_glib_none().0 as *const _)
                };

                if param_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let param_spec = if !gparam_type.is_transfer_full {
                    unsafe { glib::ParamSpec::from_glib_none(param_ptr) }
                } else {
                    let owned_ptr = unsafe {
                        glib::gobject_ffi::g_value_dup_param(gvalue.to_glib_none().0 as *const _)
                    };
                    unsafe { glib::ParamSpec::from_glib_full(owned_ptr) }
                };

                Ok(Value::Object(Object::ParamSpec(param_spec).into()))
            }
            Type::Boxed(boxed_type) => {
                let gvalue_type = gvalue.type_();

                let boxed_ptr = unsafe {
                    glib::gobject_ffi::g_value_get_boxed(gvalue.to_glib_none().0 as *const _)
                };

                if boxed_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let gtype = boxed_type.get_gtype().or(Some(gvalue_type));

                let boxed = if !boxed_type.is_transfer_full {
                    Boxed::from_glib_none(gtype, boxed_ptr)
                } else {
                    let owned_ptr = unsafe {
                        glib::gobject_ffi::g_value_dup_boxed(gvalue.to_glib_none().0 as *const _)
                    };
                    Boxed::from_glib_full(gtype, owned_ptr)
                };

                let object_id = Object::Boxed(boxed).into();
                Ok(Value::Object(object_id))
            }
            Type::GVariant(variant_type) => {
                let variant_ptr = unsafe {
                    glib::gobject_ffi::g_value_get_variant(gvalue.to_glib_none().0 as *const _)
                        .cast::<c_void>()
                };

                if variant_ptr.is_null() {
                    return Ok(Value::Null);
                }

                let variant = if !variant_type.is_transfer_full {
                    GVariantWrapper::from_glib_none(variant_ptr)
                } else {
                    let owned_ptr = unsafe {
                        glib::gobject_ffi::g_value_dup_variant(gvalue.to_glib_none().0 as *const _)
                            .cast::<c_void>()
                    };
                    GVariantWrapper::from_glib_full(owned_ptr)
                };

                Ok(Value::Object(Object::GVariant(variant).into()))
            }
            Type::Null | Type::Undefined => Ok(Value::Null),
            Type::Struct(_) => {
                bail!(
                    "Plain struct type should not appear in glib value conversion - structs without GType cannot be stored in GValue"
                )
            }
            Type::Array(_) | Type::Ref(_) | Type::Callback(_) => {
                bail!(
                    "Type {:?} should not appear in glib value conversion - this indicates a bug in the type mapping",
                    type_
                )
            }
        }
    }
}

impl TryFrom<&glib::Value> for Value {
    type Error = anyhow::Error;

    fn try_from(value: &glib::Value) -> anyhow::Result<Self> {
        use glib::translate::ToGlibPtr as _;

        if value.is_type(glib::types::Type::I8) {
            Ok(Value::Number(value.get::<i8>()? as f64))
        } else if value.is_type(glib::types::Type::U8) {
            Ok(Value::Number(value.get::<u8>()? as f64))
        } else if value.is_type(glib::types::Type::I32) {
            Ok(Value::Number(value.get::<i32>()? as f64))
        } else if value.is_type(glib::types::Type::U32) {
            Ok(Value::Number(value.get::<u32>()? as f64))
        } else if value.is_type(glib::types::Type::I64) {
            Ok(Value::Number(value.get::<i64>()? as f64))
        } else if value.is_type(glib::types::Type::U64) {
            Ok(Value::Number(value.get::<u64>()? as f64))
        } else if value.is_type(glib::types::Type::F32) {
            Ok(Value::Number(value.get::<f32>()? as f64))
        } else if value.is_type(glib::types::Type::F64) {
            Ok(Value::Number(value.get::<f64>()?))
        } else if value.is_type(glib::types::Type::STRING) {
            Ok(Value::String(value.get::<String>()?))
        } else if value.is_type(glib::types::Type::BOOL) {
            Ok(Value::Boolean(value.get::<bool>()?))
        } else if value.is_type(glib::types::Type::BOXED) {
            let boxed_ptr =
                unsafe { glib::gobject_ffi::g_value_get_boxed(value.to_glib_none().0 as *const _) };
            if boxed_ptr.is_null() {
                Ok(Value::Null)
            } else {
                let boxed = Boxed::from_glib_none(Some(value.type_()), boxed_ptr);
                let object_id = Object::Boxed(boxed).into();
                Ok(Value::Object(object_id))
            }
        } else if value.type_().is_a(glib::types::Type::PARAM_SPEC) {
            let ps = value.get::<glib::ParamSpec>()?;
            Ok(Value::String(ps.name().to_string()))
        } else if value.type_().is_a(glib::types::Type::ENUM) {
            let enum_value = unsafe {
                glib::gobject_ffi::g_value_get_enum(value.to_glib_none().0 as *const _)
            };
            Ok(Value::Number(enum_value as f64))
        } else if value.type_().is_a(glib::types::Type::FLAGS) {
            let flags_value = unsafe {
                glib::gobject_ffi::g_value_get_flags(value.to_glib_none().0 as *const _)
            };
            Ok(Value::Number(flags_value as f64))
        } else if value.type_().is_a(glib::types::Type::OBJECT) {
            gobject_from_gvalue(value)
        } else if value.type_().is_a(glib::types::Type::VARIANT) {
            let variant_ptr = unsafe {
                glib::gobject_ffi::g_value_get_variant(value.to_glib_none().0 as *const _)
                    .cast::<c_void>()
            };
            if variant_ptr.is_null() {
                Ok(Value::Null)
            } else {
                let variant = GVariantWrapper::from_glib_none(variant_ptr);
                Ok(Value::Object(Object::GVariant(variant).into()))
            }
        } else {
            bail!("Unsupported glib::Value type: {:?}", value.type_())
        }
    }
}
