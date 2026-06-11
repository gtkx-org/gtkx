import * as fundamental from "./fundamental-types.js";

/**
 * Fundamental GLib type constants, addressed by short member name.
 *
 * Each member aliases the matching `TYPE_*` constant from
 * {@link ./fundamental-types}, the single source of truth for fundamental
 * `GType` resolution. Both spellings — `Type.STRING` and `TYPE_STRING` — name
 * the identical value and expose the identical member set.
 *
 * Names a `GValue`'s fundamental type when initializing or inspecting one.
 *
 * @example
 * ```ts
 * import { Type } from "@gtkx/ffi";
 *
 * console.log(Type.STRING); // GType for gchararray
 * ```
 */
export const Type = Object.freeze({
    INVALID: fundamental.TYPE_INVALID,
    NONE: fundamental.TYPE_NONE,
    INTERFACE: fundamental.TYPE_INTERFACE,
    CHAR: fundamental.TYPE_CHAR,
    UCHAR: fundamental.TYPE_UCHAR,
    BOOLEAN: fundamental.TYPE_BOOLEAN,
    INT: fundamental.TYPE_INT,
    UINT: fundamental.TYPE_UINT,
    LONG: fundamental.TYPE_LONG,
    ULONG: fundamental.TYPE_ULONG,
    INT64: fundamental.TYPE_INT64,
    UINT64: fundamental.TYPE_UINT64,
    ENUM: fundamental.TYPE_ENUM,
    FLAGS: fundamental.TYPE_FLAGS,
    FLOAT: fundamental.TYPE_FLOAT,
    DOUBLE: fundamental.TYPE_DOUBLE,
    STRING: fundamental.TYPE_STRING,
    POINTER: fundamental.TYPE_POINTER,
    BOXED: fundamental.TYPE_BOXED,
    PARAM: fundamental.TYPE_PARAM,
    OBJECT: fundamental.TYPE_OBJECT,
    GTYPE: fundamental.TYPE_GTYPE,
    VARIANT: fundamental.TYPE_VARIANT,
    UNICHAR: fundamental.TYPE_UNICHAR,
});
