use libffi::middle as ffi;
use neon::prelude::*;

mod array;
mod boxed;
mod callback;
mod float;
mod gobject;
mod integer;
mod r#ref;

pub use array::*;
pub use boxed::*;
pub use callback::*;
pub use float::*;
pub use gobject::*;
pub use integer::*;
pub use r#ref::*;

#[derive(Debug, Clone)]
pub struct CallbackType {
    pub arg_types: Option<Vec<Type>>,
}

#[derive(Debug, Clone)]
pub struct AsyncCallbackType {
    pub source_type: Box<Type>,
    pub result_type: Box<Type>,
}

#[derive(Debug, Clone)]
pub enum Type {
    Integer(IntegerType),
    Float(FloatType),
    String,
    Null,
    Undefined,
    Boolean,
    GObject(GObjectType),
    Boxed(BoxedType),
    Array(ArrayType),
    Callback(CallbackType),
    AsyncCallback(AsyncCallbackType),
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
            "string" => Ok(Type::String),
            "boolean" => Ok(Type::Boolean),
            "null" => Ok(Type::Null),
            "undefined" => Ok(Type::Undefined),
            "gobject" => Ok(Type::GObject(GObjectType::from_js_value(cx, value)?)),
            "boxed" => Ok(Type::Boxed(BoxedType::from_js_value(cx, value)?)),
            "array" => Ok(Type::Array(ArrayType::from_js_value(cx, obj.upcast())?)),
            "callback" => {
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
                Ok(Type::Callback(CallbackType { arg_types }))
            }
            "asyncCallback" => {
                let source_type_value: Handle<JsValue> = obj.get(cx, "sourceType")?;
                let result_type_value: Handle<JsValue> = obj.get(cx, "resultType")?;
                let source_type = Box::new(Type::from_js_value(cx, source_type_value)?);
                let result_type = Box::new(Type::from_js_value(cx, result_type_value)?);
                Ok(Type::AsyncCallback(AsyncCallbackType {
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
            Type::String => ffi::Type::pointer(),
            Type::Boolean => ffi::Type::u8(),
            Type::Null => ffi::Type::pointer(),
            Type::GObject(type_) => type_.into(),
            Type::Boxed(type_) => type_.into(),
            Type::Array(type_) => type_.into(),
            Type::Callback(_) => ffi::Type::pointer(),
            Type::AsyncCallback(_) => ffi::Type::pointer(),
            Type::Ref(type_) => type_.into(),
            Type::Undefined => ffi::Type::void(),
        }
    }
}
