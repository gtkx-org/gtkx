//! FFI type system for describing GTK and GLib types.
//!
//! This module defines the [`Type`] enum and associated types that describe
//! all values that can flow through the FFI boundary. Types are parsed from
//! JavaScript objects and converted to libffi types for native calls.
//!
//! ## Type Hierarchy
//!
//! ```text
//! Type
//! ├── Integer(IntegerType)    - Sized integers (i8..i64, u8..u64)
//! ├── Float(FloatType)        - Floating point (f32, f64)
//! ├── String(StringType)      - UTF-8 strings (owned or borrowed)
//! ├── Boolean                 - Boolean values
//! ├── Null / Undefined        - Null pointer / void return
//! ├── GObject(GObjectType)    - GObject instances
//! ├── Boxed(BoxedType)        - GObject boxed types (e.g., GdkRGBA)
//! ├── GVariant(GVariantType)  - GVariant values
//! ├── Array(ArrayType)        - Arrays, GLists, GSLists
//! ├── Callback(CallbackType)  - JavaScript callback functions
//! └── Ref(RefType)            - Pointers to values (out parameters)
//! ```
//!
//! ## Ownership
//!
//! Many types have an `is_borrowed` flag that distinguishes:
//! - **Owned**: Caller takes ownership, responsible for freeing
//! - **Borrowed**: Caller receives a reference, must not free
//!
//! This is critical for correct memory management across the FFI boundary.

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
mod struct_type;

pub use array::*;
pub use boxed::*;
pub use callback::*;
pub use float::*;
pub use gobject::*;
pub use gvariant::*;
pub use integer::*;
pub use r#ref::*;
pub use string::*;
pub use struct_type::*;

#[derive(Debug, Clone, PartialEq)]
pub enum CallbackTrampoline {

    Closure,

    AsyncReady,

    Destroy,

    DrawFunc,

    ShortcutFunc,

    TreeListModelCreateFunc,
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

    /// Plain C struct without GType registration.
    Struct(StructType),

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
            "struct" => Ok(Type::Struct(StructType::from_js_value(cx, value)?)),
            "gvariant" => Ok(Type::GVariant(GVariantType::from_js_value(cx, value)?)),
            "array" => Ok(Type::Array(ArrayType::from_js_value(cx, obj.upcast())?)),
            "callback" => {
                let trampoline_handle: Option<Handle<JsString>> = obj.get_opt(cx, "trampoline")?;
                let trampoline_str = trampoline_handle.map(|h| h.value(cx));
                let trampoline = match trampoline_str.as_deref() {
                    Some("asyncReady") => CallbackTrampoline::AsyncReady,
                    Some("destroy") => CallbackTrampoline::Destroy,
                    Some("drawFunc") => CallbackTrampoline::DrawFunc,
                    Some("shortcutFunc") => CallbackTrampoline::ShortcutFunc,
                    Some("treeListModelCreateFunc") => CallbackTrampoline::TreeListModelCreateFunc,
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
            Type::Struct(type_) => type_.into(),
            Type::GVariant(type_) => type_.into(),
            Type::Array(type_) => type_.into(),
            Type::Callback(_) => ffi::Type::pointer(),
            Type::Ref(type_) => type_.into(),
            Type::Undefined => ffi::Type::void(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn callback_trampoline_equality() {
        assert_eq!(CallbackTrampoline::Closure, CallbackTrampoline::Closure);
        assert_eq!(CallbackTrampoline::AsyncReady, CallbackTrampoline::AsyncReady);
        assert_eq!(CallbackTrampoline::Destroy, CallbackTrampoline::Destroy);
        assert_eq!(CallbackTrampoline::DrawFunc, CallbackTrampoline::DrawFunc);
        assert_eq!(CallbackTrampoline::ShortcutFunc, CallbackTrampoline::ShortcutFunc);
        assert_eq!(
            CallbackTrampoline::TreeListModelCreateFunc,
            CallbackTrampoline::TreeListModelCreateFunc
        );
        assert_ne!(CallbackTrampoline::Closure, CallbackTrampoline::AsyncReady);
        assert_ne!(CallbackTrampoline::ShortcutFunc, CallbackTrampoline::TreeListModelCreateFunc);
        assert_ne!(CallbackTrampoline::DrawFunc, CallbackTrampoline::ShortcutFunc);
    }

    #[test]
    fn callback_trampoline_debug() {
        // Verify Debug impl works for all variants
        assert_eq!(format!("{:?}", CallbackTrampoline::Closure), "Closure");
        assert_eq!(format!("{:?}", CallbackTrampoline::AsyncReady), "AsyncReady");
        assert_eq!(format!("{:?}", CallbackTrampoline::Destroy), "Destroy");
        assert_eq!(format!("{:?}", CallbackTrampoline::DrawFunc), "DrawFunc");
        assert_eq!(format!("{:?}", CallbackTrampoline::ShortcutFunc), "ShortcutFunc");
        assert_eq!(
            format!("{:?}", CallbackTrampoline::TreeListModelCreateFunc),
            "TreeListModelCreateFunc"
        );
    }

    #[test]
    fn callback_trampoline_clone() {
        let original = CallbackTrampoline::ShortcutFunc;
        let cloned = original.clone();
        assert_eq!(original, cloned);

        let original = CallbackTrampoline::TreeListModelCreateFunc;
        let cloned = original.clone();
        assert_eq!(original, cloned);
    }

    #[test]
    fn callback_type_with_shortcut_func_trampoline() {
        let callback_type = CallbackType {
            trampoline: CallbackTrampoline::ShortcutFunc,
            arg_types: Some(vec![
                Type::GObject(GObjectType::new(false)),
                Type::GVariant(GVariantType::new(false)),
            ]),
            return_type: Some(Box::new(Type::Boolean)),
            source_type: None,
            result_type: None,
        };
        assert_eq!(callback_type.trampoline, CallbackTrampoline::ShortcutFunc);
        assert!(callback_type.arg_types.is_some());
        assert_eq!(callback_type.arg_types.as_ref().unwrap().len(), 2);
    }

    #[test]
    fn callback_type_with_tree_list_model_create_func_trampoline() {
        let callback_type = CallbackType {
            trampoline: CallbackTrampoline::TreeListModelCreateFunc,
            arg_types: Some(vec![Type::GObject(GObjectType::new(false))]),
            return_type: Some(Box::new(Type::GObject(GObjectType::new(false)))),
            source_type: None,
            result_type: None,
        };
        assert_eq!(
            callback_type.trampoline,
            CallbackTrampoline::TreeListModelCreateFunc
        );
        assert!(callback_type.arg_types.is_some());
        assert_eq!(callback_type.arg_types.as_ref().unwrap().len(), 1);
    }

    #[test]
    fn type_to_ffi_callback_shortcut_func() {
        let callback_type = CallbackType {
            trampoline: CallbackTrampoline::ShortcutFunc,
            arg_types: None,
            return_type: None,
            source_type: None,
            result_type: None,
        };
        let type_ = Type::Callback(callback_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_callback_tree_list_model_create_func() {
        let callback_type = CallbackType {
            trampoline: CallbackTrampoline::TreeListModelCreateFunc,
            arg_types: None,
            return_type: None,
            source_type: None,
            result_type: None,
        };
        let type_ = Type::Callback(callback_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_boolean() {
        let _ffi_type: ffi::Type = (&Type::Boolean).into();
    }

    #[test]
    fn type_to_ffi_null() {
        let _ffi_type: ffi::Type = (&Type::Null).into();
    }

    #[test]
    fn type_to_ffi_undefined() {
        let _ffi_type: ffi::Type = (&Type::Undefined).into();
    }

    #[test]
    fn type_to_ffi_callback() {
        let callback_type = CallbackType {
            trampoline: CallbackTrampoline::Closure,
            arg_types: None,
            return_type: None,
            source_type: None,
            result_type: None,
        };
        let type_ = Type::Callback(callback_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_integer() {
        let int_type = IntegerType::new(IntegerSize::_32, IntegerSign::Signed);
        let type_ = Type::Integer(int_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_float() {
        let float_type = FloatType::new(FloatSize::_64);
        let type_ = Type::Float(float_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_string() {
        let string_type = StringType::new(false);
        let type_ = Type::String(string_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_gobject() {
        let gobject_type = GObjectType::new(false);
        let type_ = Type::GObject(gobject_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_boxed() {
        let boxed_type = BoxedType::new(false, "Test".to_string(), None, None);
        let type_ = Type::Boxed(boxed_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_gvariant() {
        let gvariant_type = GVariantType::new(false);
        let type_ = Type::GVariant(gvariant_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_array() {
        let int_type = Type::Integer(IntegerType::new(IntegerSize::_32, IntegerSign::Signed));
        let array_type = ArrayType::new(int_type);
        let type_ = Type::Array(array_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_ref() {
        let int_type = Type::Integer(IntegerType::new(IntegerSize::_32, IntegerSign::Signed));
        let ref_type = RefType::new(int_type);
        let type_ = Type::Ref(ref_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_struct() {
        let struct_type = StructType::new(false, "PangoRectangle".to_string(), Some(16));
        let type_ = Type::Struct(struct_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_to_ffi_struct_borrowed() {
        let struct_type = StructType::new(true, "GtkTextIter".to_string(), None);
        let type_ = Type::Struct(struct_type);
        let _ffi_type: ffi::Type = (&type_).into();
    }

    #[test]
    fn type_struct_variant_debug() {
        let struct_type = StructType::new(true, "PangoRectangle".to_string(), Some(16));
        let type_ = Type::Struct(struct_type);
        let debug_str = format!("{:?}", type_);

        assert!(debug_str.contains("Struct"));
        assert!(debug_str.contains("PangoRectangle"));
    }

    #[test]
    fn type_struct_variant_clone() {
        let struct_type = StructType::new(false, "CustomStruct".to_string(), Some(32));
        let type_ = Type::Struct(struct_type);
        let cloned = type_.clone();

        if let Type::Struct(s) = cloned {
            assert!(!s.is_borrowed);
            assert_eq!(s.type_, "CustomStruct");
            assert_eq!(s.size, Some(32));
        } else {
            panic!("Expected Type::Struct");
        }
    }
}
