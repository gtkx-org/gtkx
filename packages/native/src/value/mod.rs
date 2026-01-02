mod from_cif;
mod from_glib;
mod helpers;
mod into_glib;
mod js;
mod r#ref;

pub use r#ref::Ref;

use crate::{object::ObjectId, types::Callback};

#[derive(Debug, Clone)]
pub enum Value {
    Number(f64),
    String(String),
    Boolean(bool),
    Object(ObjectId),
    Null,
    Undefined,
    Array(Vec<Value>),
    Callback(Callback),
    Ref(Ref),
}

impl std::fmt::Display for Value {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Value::Number(n) => write!(f, "Number({})", n),
            Value::String(s) => write!(f, "String({:?})", s),
            Value::Boolean(b) => write!(f, "Boolean({})", b),
            Value::Object(id) => write!(f, "Object({})", id.0),
            Value::Null => write!(f, "Null"),
            Value::Undefined => write!(f, "Undefined"),
            Value::Array(arr) => write!(f, "Array(len={})", arr.len()),
            Value::Callback(_) => write!(f, "Callback"),
            Value::Ref(r) => write!(f, "Ref({})", r.value),
        }
    }
}
