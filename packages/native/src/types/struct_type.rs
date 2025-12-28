//! Plain struct type representation for FFI.
//!
//! Defines [`StructType`] for plain C structs that don't have GType registration
//! (like `PangoRectangle`). Unlike boxed types, these are simply allocated with
//! `g_malloc0` and freed with `g_free`.

use libffi::middle as ffi;
use neon::prelude::*;

/// Represents a plain C struct type without GType registration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StructType {
    /// Whether this is a borrowed reference (caller should not free).
    pub is_borrowed: bool,

    /// The struct type name (for debugging/error messages).
    pub type_: String,

    /// Size of the struct in bytes (for allocation).
    pub size: Option<usize>,
}

impl StructType {
    pub fn new(is_borrowed: bool, type_: String, size: Option<usize>) -> Self {
        StructType {
            is_borrowed,
            type_,
            size,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;

        let is_borrowed_prop: Handle<'_, JsValue> = obj.prop(cx, "borrowed").get()?;
        let is_borrowed = is_borrowed_prop
            .downcast::<JsBoolean, _>(cx)
            .map(|b| b.value(cx))
            .unwrap_or(false);

        let type_prop: Handle<'_, JsValue> = obj.prop(cx, "innerType").get()?;
        let type_ = type_prop
            .downcast::<JsString, _>(cx)
            .or_throw(cx)?
            .value(cx);

        let size_prop: Handle<'_, JsValue> = obj.prop(cx, "size").get()?;
        let size = size_prop
            .downcast::<JsNumber, _>(cx)
            .map(|n| n.value(cx) as usize)
            .ok();

        Ok(Self::new(is_borrowed, type_, size))
    }
}

impl From<&StructType> for ffi::Type {
    fn from(_value: &StructType) -> Self {
        ffi::Type::pointer()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn struct_type_new_creates_correct_type() {
        let struct_type = StructType::new(true, "PangoRectangle".to_string(), Some(16));

        assert!(struct_type.is_borrowed);
        assert_eq!(struct_type.type_, "PangoRectangle");
        assert_eq!(struct_type.size, Some(16));
    }

    #[test]
    fn struct_type_new_without_size() {
        let struct_type = StructType::new(false, "GtkTextIter".to_string(), None);

        assert!(!struct_type.is_borrowed);
        assert_eq!(struct_type.type_, "GtkTextIter");
        assert_eq!(struct_type.size, None);
    }

    #[test]
    fn struct_type_equality() {
        let type1 = StructType::new(true, "PangoRectangle".to_string(), Some(16));
        let type2 = StructType::new(true, "PangoRectangle".to_string(), Some(16));
        let type3 = StructType::new(false, "PangoRectangle".to_string(), Some(16));

        assert_eq!(type1, type2);
        assert_ne!(type1, type3);
    }

    #[test]
    fn struct_type_equality_different_names() {
        let type1 = StructType::new(true, "PangoRectangle".to_string(), Some(16));
        let type2 = StructType::new(true, "GtkTextIter".to_string(), Some(16));

        assert_ne!(type1, type2);
    }

    #[test]
    fn struct_type_equality_different_sizes() {
        let type1 = StructType::new(true, "PangoRectangle".to_string(), Some(16));
        let type2 = StructType::new(true, "PangoRectangle".to_string(), Some(32));

        assert_ne!(type1, type2);
    }

    #[test]
    fn struct_type_equality_with_none_size() {
        let type1 = StructType::new(true, "PangoRectangle".to_string(), None);
        let type2 = StructType::new(true, "PangoRectangle".to_string(), None);
        let type3 = StructType::new(true, "PangoRectangle".to_string(), Some(16));

        assert_eq!(type1, type2);
        assert_ne!(type1, type3);
    }

    #[test]
    fn struct_type_to_ffi_type_is_pointer() {
        let struct_type = StructType::new(true, "PangoRectangle".to_string(), Some(16));
        let _ffi_type: ffi::Type = (&struct_type).into();
    }

    #[test]
    fn struct_type_to_ffi_type_without_size() {
        let struct_type = StructType::new(false, "GtkTextIter".to_string(), None);
        let _ffi_type: ffi::Type = (&struct_type).into();
    }

    #[test]
    fn struct_type_clone() {
        let original = StructType::new(true, "PangoRectangle".to_string(), Some(16));
        let cloned = original.clone();

        assert_eq!(original, cloned);
    }

    #[test]
    fn struct_type_clone_preserves_all_fields() {
        let original = StructType::new(false, "CustomStruct".to_string(), Some(64));
        let cloned = original.clone();

        assert_eq!(cloned.is_borrowed, original.is_borrowed);
        assert_eq!(cloned.type_, original.type_);
        assert_eq!(cloned.size, original.size);
    }

    #[test]
    fn struct_type_debug_format() {
        let struct_type = StructType::new(true, "PangoRectangle".to_string(), Some(16));
        let debug_str = format!("{:?}", struct_type);

        assert!(debug_str.contains("StructType"));
        assert!(debug_str.contains("PangoRectangle"));
        assert!(debug_str.contains("16"));
    }
}
