/**
 * Hand-written `GValue` accessors over a raw native handle.
 *
 * A `GValue` here is the {@link Handle} of a freshly allocated `GValue` struct,
 * with every accessor bound through raw FFI so the runtime carries no dependency
 * on the generated `GObject.Value`. {@link newGValue} allocates one,
 * {@link valueInit} types it, and the `valueGet*`/`valueSet*` pairs read and
 * write its payload. The descriptor-driven marshalling that builds and reads
 * these values lives in `./value-marshal.js`; registry-aware boxed access lives
 * there too, since it reads the handle directly.
 */

import { alloc, type Handle, read } from "@gtkx/native";
import { GVALUE_SIZE, GVALUE_T, LIBGOBJECT } from "./constants.js";
import { t } from "./descriptors.js";
import { type GType, TYPE_VARIANT } from "./gtype.js";
import { getWrapperClass, tryGetHandle, wrapHandle } from "./registry.js";

/** Allocates a fresh, uninitialized `GValue` struct and returns its handle. */
export const newGValue = (): Handle => alloc(GVALUE_SIZE, "GValue");

/**
 * Gets the `GType` of the value stored in a `GValue`.
 *
 * Equivalent to the C macro `G_VALUE_TYPE(value)`.
 *
 * @param value - The handle of the `GValue` to inspect.
 * @returns The `GType` identifier.
 */
export function valueGetType(value: Handle): GType {
    return read(value, t.uint64, 0) as GType;
}

const gValueInit = t.bind(LIBGOBJECT, "g_value_init", [GVALUE_T, t.uint64], t.void);

/** Initializes `value` to hold `gtype`. */
export const valueInit = (value: Handle, gtype: GType): void => {
    gValueInit(value, gtype);
};

const gValueSetPointer = t.bind(LIBGOBJECT, "g_value_set_pointer", [GVALUE_T, t.uint64], t.void);

/**
 * Stores `pointer`'s raw address as `value`'s `G_TYPE_POINTER` payload. `value`
 * must already be initialized to `G_TYPE_POINTER`; a handler reached through the
 * payload writes into the memory `pointer` references.
 *
 * @param value - The handle of the `G_TYPE_POINTER`-initialized value.
 * @param pointer - Handle whose backing memory the payload points at.
 */
export const setGValuePointer = (value: Handle, pointer: Handle): void => {
    gValueSetPointer(value, pointer);
};

const gValueSetBoolean = t.bind(LIBGOBJECT, "g_value_set_boolean", [GVALUE_T, t.boolean], t.void);
const gValueGetBoolean = t.bind(LIBGOBJECT, "g_value_get_boolean", [GVALUE_T], t.boolean);
const gValueSetInt = t.bind(LIBGOBJECT, "g_value_set_int", [GVALUE_T, t.int32], t.void);
const gValueGetInt = t.bind(LIBGOBJECT, "g_value_get_int", [GVALUE_T], t.int32);
const gValueSetUint = t.bind(LIBGOBJECT, "g_value_set_uint", [GVALUE_T, t.uint32], t.void);
const gValueGetUint = t.bind(LIBGOBJECT, "g_value_get_uint", [GVALUE_T], t.uint32);
const gValueSetLong = t.bind(LIBGOBJECT, "g_value_set_long", [GVALUE_T, t.int64], t.void);
const gValueGetLong = t.bind(LIBGOBJECT, "g_value_get_long", [GVALUE_T], t.int64);
const gValueSetUlong = t.bind(LIBGOBJECT, "g_value_set_ulong", [GVALUE_T, t.uint64], t.void);
const gValueGetUlong = t.bind(LIBGOBJECT, "g_value_get_ulong", [GVALUE_T], t.uint64);
const gValueSetInt64 = t.bind(LIBGOBJECT, "g_value_set_int64", [GVALUE_T, t.int64], t.void);
const gValueGetInt64 = t.bind(LIBGOBJECT, "g_value_get_int64", [GVALUE_T], t.int64);
const gValueSetUint64 = t.bind(LIBGOBJECT, "g_value_set_uint64", [GVALUE_T, t.uint64], t.void);
const gValueGetUint64 = t.bind(LIBGOBJECT, "g_value_get_uint64", [GVALUE_T], t.uint64);
const gValueSetFloat = t.bind(LIBGOBJECT, "g_value_set_float", [GVALUE_T, t.float32], t.void);
const gValueGetFloat = t.bind(LIBGOBJECT, "g_value_get_float", [GVALUE_T], t.float32);
const gValueSetDouble = t.bind(LIBGOBJECT, "g_value_set_double", [GVALUE_T, t.float64], t.void);
const gValueGetDouble = t.bind(LIBGOBJECT, "g_value_get_double", [GVALUE_T], t.float64);
const gValueSetString = t.bind(LIBGOBJECT, "g_value_set_string", [GVALUE_T, t.string("borrowed")], t.void);
const gValueGetString = t.bind(LIBGOBJECT, "g_value_get_string", [GVALUE_T], t.string("borrowed"));
const gValueSetSchar = t.bind(LIBGOBJECT, "g_value_set_schar", [GVALUE_T, t.int8], t.void);
const gValueGetSchar = t.bind(LIBGOBJECT, "g_value_get_schar", [GVALUE_T], t.int8);
const gValueSetUchar = t.bind(LIBGOBJECT, "g_value_set_uchar", [GVALUE_T, t.uint8], t.void);
const gValueGetUchar = t.bind(LIBGOBJECT, "g_value_get_uchar", [GVALUE_T], t.uint8);
const gValueSetEnum = t.bind(LIBGOBJECT, "g_value_set_enum", [GVALUE_T, t.int32], t.void);
const gValueGetEnum = t.bind(LIBGOBJECT, "g_value_get_enum", [GVALUE_T], t.int32);
const gValueSetFlags = t.bind(LIBGOBJECT, "g_value_set_flags", [GVALUE_T, t.uint32], t.void);
const gValueGetFlags = t.bind(LIBGOBJECT, "g_value_get_flags", [GVALUE_T], t.uint32);
const gValueSetObject = t.bind(LIBGOBJECT, "g_value_set_object", [GVALUE_T, t.object("borrowed")], t.void);
const gValueGetObject = t.bind(LIBGOBJECT, "g_value_get_object", [GVALUE_T], t.object("borrowed"));

const PARAM_FUNDAMENTAL = t.fundamental(LIBGOBJECT, "g_param_spec_ref", "g_param_spec_unref", {
    ownership: "borrowed",
    typeName: "GParam",
});
const gValueSetParam = t.bind(LIBGOBJECT, "g_value_set_param", [GVALUE_T, PARAM_FUNDAMENTAL], t.void);
const gValueGetParam = t.bind(LIBGOBJECT, "g_value_get_param", [GVALUE_T], PARAM_FUNDAMENTAL);

const VARIANT_FUNDAMENTAL = t.fundamental("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});
const gValueSetVariant = t.bind(LIBGOBJECT, "g_value_set_variant", [GVALUE_T, VARIANT_FUNDAMENTAL], t.void);
const gValueGetVariant = t.bind(LIBGOBJECT, "g_value_get_variant", [GVALUE_T], VARIANT_FUNDAMENTAL);

export const valueSetBoolean = (value: Handle, v: boolean): void => {
    gValueSetBoolean(value, v);
};
export const valueGetBoolean = (value: Handle): boolean => Boolean(gValueGetBoolean(value));
export const valueSetInt = (value: Handle, v: number): void => {
    gValueSetInt(value, v);
};
export const valueGetInt = (value: Handle): number => gValueGetInt(value) as number;
export const valueSetUint = (value: Handle, v: number): void => {
    gValueSetUint(value, v);
};
export const valueGetUint = (value: Handle): number => gValueGetUint(value) as number;
export const valueSetLong = (value: Handle, v: number): void => {
    gValueSetLong(value, v);
};
export const valueGetLong = (value: Handle): number => gValueGetLong(value) as number;
export const valueSetUlong = (value: Handle, v: number): void => {
    gValueSetUlong(value, v);
};
export const valueGetUlong = (value: Handle): number => gValueGetUlong(value) as number;
export const valueSetInt64 = (value: Handle, v: number): void => {
    gValueSetInt64(value, v);
};
export const valueGetInt64 = (value: Handle): number => gValueGetInt64(value) as number;
export const valueSetUint64 = (value: Handle, v: number): void => {
    gValueSetUint64(value, v);
};
export const valueGetUint64 = (value: Handle): number => gValueGetUint64(value) as number;
export const valueSetFloat = (value: Handle, v: number): void => {
    gValueSetFloat(value, v);
};
export const valueGetFloat = (value: Handle): number => gValueGetFloat(value) as number;
export const valueSetDouble = (value: Handle, v: number): void => {
    gValueSetDouble(value, v);
};
export const valueGetDouble = (value: Handle): number => gValueGetDouble(value) as number;
export const valueSetString = (value: Handle, v: string | null): void => {
    gValueSetString(value, v);
};
export const valueGetString = (value: Handle): string | null => (gValueGetString(value) as string | null) ?? null;
export const valueSetSchar = (value: Handle, v: number): void => {
    gValueSetSchar(value, v);
};
export const valueGetSchar = (value: Handle): number => gValueGetSchar(value) as number;
export const valueSetUchar = (value: Handle, v: number): void => {
    gValueSetUchar(value, v);
};
export const valueGetUchar = (value: Handle): number => gValueGetUchar(value) as number;
export const valueSetEnum = (value: Handle, v: number): void => {
    gValueSetEnum(value, v);
};
export const valueGetEnum = (value: Handle): number => gValueGetEnum(value) as number;
export const valueSetFlags = (value: Handle, v: number): void => {
    gValueSetFlags(value, v);
};
export const valueGetFlags = (value: Handle): number => gValueGetFlags(value) as number;
export const valueSetObject = (value: Handle, v: object | null): void => {
    gValueSetObject(value, tryGetHandle(v));
};
export const valueGetObject = (value: Handle): object | null => wrapHandle(gValueGetObject(value) as Handle | null);
export const valueSetParam = (value: Handle, v: object | null): void => {
    gValueSetParam(value, tryGetHandle(v));
};
export const valueGetParam = (value: Handle): object | null => wrapHandle(gValueGetParam(value) as Handle | null);
export const valueSetVariant = (value: Handle, v: object | null): void => {
    gValueSetVariant(value, tryGetHandle(v));
};
export const valueGetVariant = (value: Handle): object | null => {
    const result = gValueGetVariant(value) as Handle | null;
    if (result === null) return null;
    const cls = getWrapperClass(TYPE_VARIANT);
    if (cls === null) {
        throw new Error("valueGetVariant: GLib.Variant wrapper class is not registered");
    }
    return wrapHandle(result, cls);
};
