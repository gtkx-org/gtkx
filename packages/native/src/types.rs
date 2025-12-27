

use libffi::middle as ffi;
use neon::prelude::*;

mod array;
mod boxed;
mod callback;
mod float;
mod gobject;
mod gvariant;
mod integer;
mod r#ref;
mod string;

pub use array::*;
pub use boxed::*;
pub use callback::*;
pub use float::*;
pub use gobject::*;
pub use gvariant::*;
pub use integer::*;
pub use r#ref::*;
pub use string::*;

#[derive(Debug, Clone, PartialEq)]
pub enum CallbackTrampoline {

    Closure,

    AsyncReady,

    Destroy,

    DrawFunc,
}

#[derive(Debug, Clone)]
pub struct CallbackType {

    pub trampoline: CallbackTrampoline,

    pub arg_types: Option<Vec<Type>>,

    pub return_type: Option<Box<Type>>,

    pub source_type: Option<Box<Type>>,

    pub result_type: Option<Box<Type>>,
}

#[derive(Debug, Clone)]
pub enum Type {

    Integer(IntegerType),

    Float(FloatType),

    String(StringType),

    Null,

    Undefined,

    Boolean,

    GObject(GObjectType),

    Boxed(BoxedType),

    GVariant(GVariantType),

    Array(ArrayType),

    Callback(CallbackType),

    Ref(RefType),
}

impl Type {

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let type_value: Handle<'_, JsValue> = obj.prop(cx, "type").get()?;

        let type_ = type_value
            .downcast::<JsString, _>(cx)
            .or_throw(cx)?
            .value(cx);

        match type_.as_str() {
            "int" => Ok(Type::Integer(IntegerType::from_js_value(cx, value)?)),
            "float" => Ok(Type::Float(FloatType::from_js_value(cx, value)?)),
            "string" => Ok(Type::String(StringType::from_js_value(cx, value)?)),
            "boolean" => Ok(Type::Boolean),
            "null" => Ok(Type::Null),
            "undefined" => Ok(Type::Undefined),
            "gobject" => Ok(Type::GObject(GObjectType::from_js_value(cx, value)?)),
            "boxed" => Ok(Type::Boxed(BoxedType::from_js_value(cx, value)?)),
            "gvariant" => Ok(Type::GVariant(GVariantType::from_js_value(cx, value)?)),
            "array" => Ok(Type::Array(ArrayType::from_js_value(cx, obj.upcast())?)),
            "callback" => {
                let trampoline_handle: Option<Handle<JsString>> = obj.get_opt(cx, "trampoline")?;
                let trampoline_str = trampoline_handle.map(|h| h.value(cx));
                let trampoline = match trampoline_str.as_deref() {
                    Some("asyncReady") => CallbackTrampoline::AsyncReady,
                    Some("destroy") => CallbackTrampoline::Destroy,
                    Some("drawFunc") => CallbackTrampoline::DrawFunc,
                    _ => CallbackTrampoline::Closure,
                };

                let arg_types: Option<Handle<JsArray>> = obj.get_opt(cx, "argTypes")?;
                let arg_types = match arg_types {
                    Some(arr) => {
                        let vec = arr.to_vec(cx)?;
                        let mut types = Vec::with_capacity(vec.len());
                        for item in vec {
                            types.push(Type::from_js_value(cx, item)?);
                        }
                        Some(types)
                    }
                    None => None,
                };

                let return_type: Option<Handle<JsValue>> = obj.get_opt(cx, "returnType")?;
                let return_type = match return_type {
                    Some(v) => Some(Box::new(Type::from_js_value(cx, v)?)),
                    None => None,
                };

                let source_type: Option<Handle<JsValue>> = obj.get_opt(cx, "sourceType")?;
                let source_type = match source_type {
                    Some(v) => Some(Box::new(Type::from_js_value(cx, v)?)),
                    None => None,
                };

                let result_type: Option<Handle<JsValue>> = obj.get_opt(cx, "resultType")?;
                let result_type = match result_type {
                    Some(v) => Some(Box::new(Type::from_js_value(cx, v)?)),
                    None => None,
                };

                Ok(Type::Callback(CallbackType {
                    trampoline,
                    arg_types,
                    return_type,
                    source_type,
                    result_type,
                }))
            }
            "ref" => Ok(Type::Ref(RefType::from_js_value(cx, obj.upcast())?)),
            _ => cx.throw_type_error(format!("Unknown type: {}", type_)),
        }
    }
}

impl From<&Type> for ffi::Type {
    fn from(value: &Type) -> Self {
        match value {
            Type::Integer(type_) => type_.into(),
            Type::Float(type_) => type_.into(),
            Type::String(type_) => type_.into(),
            Type::Boolean => ffi::Type::u8(),
            Type::Null => ffi::Type::pointer(),
            Type::GObject(type_) => type_.into(),
            Type::Boxed(type_) => type_.into(),
            Type::GVariant(type_) => type_.into(),
            Type::Array(type_) => type_.into(),
            Type::Callback(_) => ffi::Type::pointer(),
            Type::Ref(type_) => type_.into(),
            Type::Undefined => ffi::Type::void(),
        }
    }
}
