/* TODO: Keep array lowering until GLib GIR describes owned, NUL-terminated UCS4 buffers as arrays.
 * https://github.com/gtkx-org/gtkx/issues/753
 */
const RETURNS_MISSING_UCS4_ARRAY_TYPE: Set<string> = new Set([
    "g_utf8_to_ucs4",
    "g_utf8_to_ucs4_fast",
    "g_utf16_to_ucs4",
]);

export { RETURNS_MISSING_UCS4_ARRAY_TYPE };
