use native::error::{ConversionError, ObjectNotFoundError};

#[test]
fn type_mismatch_error_display() {
    let err = ConversionError::TypeMismatch {
        expected: "GObject",
        got: "String".to_string(),
    };
    let msg = format!("{}", err);
    assert!(msg.contains("Type mismatch"));
    assert!(msg.contains("GObject"));
    assert!(msg.contains("String"));
}

#[test]
fn object_garbage_collected_error_display() {
    let err = ConversionError::ObjectGarbageCollected { id: 42 };
    let msg = format!("{}", err);
    assert!(msg.contains("42"));
    assert!(msg.contains("garbage collected"));
}

#[test]
fn invalid_array_item_error_display() {
    let inner = ConversionError::TypeMismatch {
        expected: "number",
        got: "string".to_string(),
    };
    let err = ConversionError::InvalidArrayItem {
        index: 5,
        source: Box::new(inner),
    };
    let msg = format!("{}", err);
    assert!(msg.contains("index 5"));
}

#[test]
fn invalid_array_item_error_source() {
    let inner = ConversionError::TypeMismatch {
        expected: "number",
        got: "string".to_string(),
    };
    let err = ConversionError::InvalidArrayItem {
        index: 0,
        source: Box::new(inner),
    };
    assert!(std::error::Error::source(&err).is_some());
}

#[test]
fn null_not_allowed_error_display() {
    let err = ConversionError::NullNotAllowed {
        type_name: "GtkWidget",
    };
    let msg = format!("{}", err);
    assert!(msg.contains("Null"));
    assert!(msg.contains("GtkWidget"));
}

#[test]
fn cstring_conversion_error_display() {
    let nul_error = std::ffi::CString::new("test\0string").unwrap_err();
    let err = ConversionError::CStringConversion(nul_error);
    let msg = format!("{}", err);
    assert!(msg.contains("CString"));
}

#[test]
fn cstring_conversion_error_source() {
    let nul_error = std::ffi::CString::new("test\0string").unwrap_err();
    let err = ConversionError::CStringConversion(nul_error);
    assert!(std::error::Error::source(&err).is_some());
}

#[test]
fn other_error_display() {
    let anyhow_err = anyhow::anyhow!("Something went wrong");
    let err = ConversionError::Other(anyhow_err);
    let msg = format!("{}", err);
    assert!(msg.contains("Something went wrong"));
}

#[test]
fn from_nul_error() {
    let nul_error = std::ffi::CString::new("test\0string").unwrap_err();
    let err: ConversionError = nul_error.into();
    assert!(matches!(err, ConversionError::CStringConversion(_)));
}

#[test]
fn from_anyhow_error() {
    let anyhow_err = anyhow::anyhow!("Test error");
    let err: ConversionError = anyhow_err.into();
    assert!(matches!(err, ConversionError::Other(_)));
}

#[test]
fn object_not_found_error_display() {
    let err = ObjectNotFoundError(123);
    let msg = format!("{}", err);
    assert!(msg.contains("123"));
    assert!(msg.contains("not found"));
}

#[test]
fn object_not_found_error_is_error() {
    let err = ObjectNotFoundError(1);
    let _: &dyn std::error::Error = &err;
}

#[test]
fn object_not_found_error_no_source() {
    let err = ObjectNotFoundError(1);
    assert!(std::error::Error::source(&err).is_none());
}

#[test]
fn object_not_found_error_copy() {
    let err = ObjectNotFoundError(42);
    let copied = err;
    assert_eq!(copied.0, 42);
}

#[test]
fn object_not_found_error_clone() {
    let err = ObjectNotFoundError(42);
    let cloned = err.clone();
    assert_eq!(cloned.0, 42);
}
