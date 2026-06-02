import {
    TYPE_BOOLEAN,
    TYPE_BOXED,
    TYPE_CHAR,
    TYPE_DOUBLE,
    TYPE_ENUM,
    TYPE_FLAGS,
    TYPE_FLOAT,
    TYPE_GTYPE,
    TYPE_INT,
    TYPE_INT64,
    TYPE_INTERFACE,
    TYPE_INVALID,
    TYPE_LONG,
    TYPE_NONE,
    TYPE_OBJECT,
    TYPE_PARAM,
    TYPE_POINTER,
    TYPE_STRING,
    TYPE_UCHAR,
    TYPE_UINT,
    TYPE_UINT64,
    TYPE_ULONG,
    TYPE_UNICHAR,
    TYPE_VARIANT,
} from "./fundamental-types.js";

/**
 * Fundamental GLib type constants, addressed by short member name.
 *
 * Each member aliases the matching `TYPE_*` constant from
 * {@link ./fundamental-types}, the single source of truth for fundamental
 * `GType` resolution. Both spellings — `Type.STRING` and `TYPE_STRING` — name
 * the identical value and expose the identical member set.
 *
 * Use with the `@gtkx/ffi` marshalling helpers that require explicit type
 * specification.
 *
 * @example
 * ```ts
 * import { Type, valueFromJS } from "@gtkx/ffi";
 *
 * const value = valueFromJS(Type.INT, 0);
 * console.log(Type.STRING); // GType for gchararray
 * ```
 */
export const Type = Object.freeze({
    INVALID: TYPE_INVALID,
    NONE: TYPE_NONE,
    INTERFACE: TYPE_INTERFACE,
    CHAR: TYPE_CHAR,
    UCHAR: TYPE_UCHAR,
    BOOLEAN: TYPE_BOOLEAN,
    INT: TYPE_INT,
    UINT: TYPE_UINT,
    LONG: TYPE_LONG,
    ULONG: TYPE_ULONG,
    INT64: TYPE_INT64,
    UINT64: TYPE_UINT64,
    ENUM: TYPE_ENUM,
    FLAGS: TYPE_FLAGS,
    FLOAT: TYPE_FLOAT,
    DOUBLE: TYPE_DOUBLE,
    STRING: TYPE_STRING,
    POINTER: TYPE_POINTER,
    BOXED: TYPE_BOXED,
    PARAM: TYPE_PARAM,
    OBJECT: TYPE_OBJECT,
    GTYPE: TYPE_GTYPE,
    VARIANT: TYPE_VARIANT,
    UNICHAR: TYPE_UNICHAR,
});
