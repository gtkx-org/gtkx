use libffi::middle as ffi;
use neon::prelude::*;

use crate::ownership::parse_is_transfer_full;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FundamentalType {
    pub is_transfer_full: bool,
    pub library: String,
    pub ref_func: String,
    pub unref_func: String,
}

impl FundamentalType {
    pub fn new(
        is_transfer_full: bool,
        library: String,
        ref_func: String,
        unref_func: String,
    ) -> Self {
        FundamentalType {
            is_transfer_full,
            library,
            ref_func,
            unref_func,
        }
    }

    pub fn from_js_value(cx: &mut FunctionContext, value: Handle<JsValue>) -> NeonResult<Self> {
        let obj = value.downcast::<JsObject, _>(cx).or_throw(cx)?;
        let is_transfer_full = parse_is_transfer_full(cx, obj, "fundamental")?;

        let library: Handle<JsString> = obj.get(cx, "library")?;
        let ref_func: Handle<JsString> = obj.get(cx, "refFunc")?;
        let unref_func: Handle<JsString> = obj.get(cx, "unrefFunc")?;

        Ok(Self::new(
            is_transfer_full,
            library.value(cx),
            ref_func.value(cx),
            unref_func.value(cx),
        ))
    }
}

impl From<&FundamentalType> for ffi::Type {
    fn from(_: &FundamentalType) -> Self {
        ffi::Type::pointer()
    }
}
