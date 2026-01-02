use gtk4::glib;

use super::Value;
use crate::types::Type;

impl Value {
    pub fn into_glib_value_with_default(self, return_type: Option<&Type>) -> Option<glib::Value> {
        match &self {
            Value::Undefined => match return_type {
                Some(Type::Boolean) => Some(false.into()),
                Some(Type::Integer(_)) => Some(0i32.into()),
                _ => None,
            },
            _ => self.into(),
        }
    }
}

impl From<Value> for Option<glib::Value> {
    fn from(value: Value) -> Self {
        match value {
            Value::Number(n) => Some(n.into()),
            Value::String(s) => Some(s.into()),
            Value::Boolean(b) => Some(b.into()),
            Value::Null | Value::Undefined => None,
            _ => None,
        }
    }
}
