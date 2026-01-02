//! Ownership parsing for transfer semantics.
//!
//! Provides a helper to parse GLib transfer annotations from JavaScript objects.

use neon::prelude::*;

/// Parse ownership from a JS object's "ownership" property.
///
/// Returns `true` for "full" (caller owns data), `false` for "none" (borrowed).
pub fn parse_is_transfer_full(
    cx: &mut FunctionContext,
    obj: Handle<JsObject>,
    type_name: &str,
) -> NeonResult<bool> {
    let ownership_prop: Handle<'_, JsValue> = obj.prop(cx, "ownership").get()?;

    let ownership = ownership_prop
        .downcast::<JsString, _>(cx)
        .or_else(|_| {
            cx.throw_type_error(format!(
                "'ownership' property is required for {} types",
                type_name
            ))
        })?
        .value(cx);

    match ownership.as_str() {
        "full" => Ok(true),
        "none" => Ok(false),
        other => cx.throw_type_error(format!(
            "'ownership' must be 'full' or 'none', got '{}'",
            other
        )),
    }
}
