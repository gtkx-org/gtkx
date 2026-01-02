use std::fmt;

#[derive(Debug)]
pub enum ConversionError {
    TypeMismatch {
        expected: &'static str,
        got: String,
    },
    ObjectGarbageCollected {
        id: usize,
    },
    InvalidArrayItem {
        index: usize,
        source: Box<ConversionError>,
    },
    NullNotAllowed {
        type_name: &'static str,
    },
    CStringConversion(std::ffi::NulError),
    Other(anyhow::Error),
}

impl fmt::Display for ConversionError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConversionError::TypeMismatch { expected, got } => {
                write!(f, "Type mismatch: expected {}, got {}", expected, got)
            }
            ConversionError::ObjectGarbageCollected { id } => {
                write!(f, "Object with ID {} has been garbage collected", id)
            }
            ConversionError::InvalidArrayItem { index, source } => {
                write!(f, "Invalid array item at index {}: {}", index, source)
            }
            ConversionError::NullNotAllowed { type_name } => {
                write!(f, "Null value not allowed for {}", type_name)
            }
            ConversionError::CStringConversion(e) => {
                write!(f, "CString conversion error: {}", e)
            }
            ConversionError::Other(e) => {
                write!(f, "{}", e)
            }
        }
    }
}

impl std::error::Error for ConversionError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ConversionError::InvalidArrayItem { source, .. } => Some(source.as_ref()),
            ConversionError::CStringConversion(e) => Some(e),
            _ => None,
        }
    }
}

impl From<std::ffi::NulError> for ConversionError {
    fn from(e: std::ffi::NulError) -> Self {
        ConversionError::CStringConversion(e)
    }
}

impl From<anyhow::Error> for ConversionError {
    fn from(e: anyhow::Error) -> Self {
        ConversionError::Other(e)
    }
}

#[derive(Debug, Clone, Copy)]
pub struct ObjectNotFoundError(pub usize);

impl fmt::Display for ObjectNotFoundError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "Object with ID {} not found (may have been garbage collected)",
            self.0
        )
    }
}

impl std::error::Error for ObjectNotFoundError {}
