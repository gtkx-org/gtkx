/**
 * The hand-written `GValue` container and its low-level accessors.
 *
 * {@link GValue} wraps a freshly allocated `GValue` struct and binds every
 * accessor through raw FFI, so the runtime carries no dependency on the
 * generated `GObject.Value`. The descriptor-driven marshalling that builds and
 * reads these values lives in `./value-marshal.js`; this module owns the
 * container, its scalar accessors, the {@link GValueReader} surface they
 * satisfy, {@link valueGetType}, and {@link setGValuePointer}.
 */

import { alloc, type Handle, read } from "@gtkx/native";
import { t } from "./descriptors.js";
import { type GType, GVALUE_BORROWED, GVALUE_SIZE, gtypeFromFfi, LIBGOBJECT, TYPE_VARIANT } from "./gtype.js";
import { getHandle, getWrapperClass, setHandle, tryGetHandle, wrapHandle } from "./registry.js";

/**
 * Gets the `GType` of the value stored in a `GValue`.
 *
 * Equivalent to the C macro `G_VALUE_TYPE(value)`.
 *
 * @param value - The `GValue` to inspect (any object backed by a `GValue`
 *   handle, including the generated `GObject.Value`).
 * @returns The `GType` identifier.
 */
export function valueGetType(value: object): GType {
    return gtypeFromFfi(read(getHandle(value), t.uint64, 0));
}

/**
 * The read-only `GValue` accessor surface the unmarshaller consumes.
 *
 * Both the hand-written {@link GValue} and the public generated `GObject.Value`
 * satisfy it structurally, so the marshalling layer accepts either without
 * coupling the runtime to the generated class.
 */
export interface GValueReader {
    getBoolean(): boolean;
    getInt(): number;
    getUint(): number;
    getLong(): number;
    getUlong(): number;
    getInt64(): number;
    getUint64(): number;
    getFloat(): number;
    getDouble(): number;
    getString(): string | null;
    getSchar(): number;
    getUchar(): number;
    getEnum(): number;
    getFlags(): number;
    getObject(): object | null;
    getParam(): object | null;
    getVariant(): object | null;
}

const gValueInit = t.bind(LIBGOBJECT, "g_value_init", [GVALUE_BORROWED, t.uint64], t.void);
const gValueSetPointer = t.bind(LIBGOBJECT, "g_value_set_pointer", [GVALUE_BORROWED, t.uint64], t.void);

/**
 * Stores `pointer`'s raw address as `value`'s `G_TYPE_POINTER` payload. `value`
 * must already be initialized to `G_TYPE_POINTER`; a handler reached through the
 * payload writes into the memory `pointer` references.
 *
 * Provided as a free function, not a {@link GValue} method, so the wrapper
 * stays a structural subset of the generated `GObject.Value`.
 *
 * @param value - The `G_TYPE_POINTER`-initialized value to populate.
 * @param pointer - Handle whose backing memory the payload points at.
 */
export const setGValuePointer = (value: GValue, pointer: Handle): void => {
    gValueSetPointer(getHandle(value), pointer);
};

const gValueSetBoolean = t.bind(LIBGOBJECT, "g_value_set_boolean", [GVALUE_BORROWED, t.boolean], t.void);
const gValueGetBoolean = t.bind(LIBGOBJECT, "g_value_get_boolean", [GVALUE_BORROWED], t.boolean);
const gValueSetInt = t.bind(LIBGOBJECT, "g_value_set_int", [GVALUE_BORROWED, t.int32], t.void);
const gValueGetInt = t.bind(LIBGOBJECT, "g_value_get_int", [GVALUE_BORROWED], t.int32);
const gValueSetUint = t.bind(LIBGOBJECT, "g_value_set_uint", [GVALUE_BORROWED, t.uint32], t.void);
const gValueGetUint = t.bind(LIBGOBJECT, "g_value_get_uint", [GVALUE_BORROWED], t.uint32);
const gValueSetLong = t.bind(LIBGOBJECT, "g_value_set_long", [GVALUE_BORROWED, t.int64], t.void);
const gValueGetLong = t.bind(LIBGOBJECT, "g_value_get_long", [GVALUE_BORROWED], t.int64);
const gValueSetUlong = t.bind(LIBGOBJECT, "g_value_set_ulong", [GVALUE_BORROWED, t.uint64], t.void);
const gValueGetUlong = t.bind(LIBGOBJECT, "g_value_get_ulong", [GVALUE_BORROWED], t.uint64);
const gValueSetInt64 = t.bind(LIBGOBJECT, "g_value_set_int64", [GVALUE_BORROWED, t.int64], t.void);
const gValueGetInt64 = t.bind(LIBGOBJECT, "g_value_get_int64", [GVALUE_BORROWED], t.int64);
const gValueSetUint64 = t.bind(LIBGOBJECT, "g_value_set_uint64", [GVALUE_BORROWED, t.uint64], t.void);
const gValueGetUint64 = t.bind(LIBGOBJECT, "g_value_get_uint64", [GVALUE_BORROWED], t.uint64);
const gValueSetFloat = t.bind(LIBGOBJECT, "g_value_set_float", [GVALUE_BORROWED, t.float32], t.void);
const gValueGetFloat = t.bind(LIBGOBJECT, "g_value_get_float", [GVALUE_BORROWED], t.float32);
const gValueSetDouble = t.bind(LIBGOBJECT, "g_value_set_double", [GVALUE_BORROWED, t.float64], t.void);
const gValueGetDouble = t.bind(LIBGOBJECT, "g_value_get_double", [GVALUE_BORROWED], t.float64);
const gValueSetString = t.bind(LIBGOBJECT, "g_value_set_string", [GVALUE_BORROWED, t.string("borrowed")], t.void);
const gValueGetString = t.bind(LIBGOBJECT, "g_value_get_string", [GVALUE_BORROWED], t.string("borrowed"));
const gValueSetSchar = t.bind(LIBGOBJECT, "g_value_set_schar", [GVALUE_BORROWED, t.int8], t.void);
const gValueGetSchar = t.bind(LIBGOBJECT, "g_value_get_schar", [GVALUE_BORROWED], t.int8);
const gValueSetUchar = t.bind(LIBGOBJECT, "g_value_set_uchar", [GVALUE_BORROWED, t.uint8], t.void);
const gValueGetUchar = t.bind(LIBGOBJECT, "g_value_get_uchar", [GVALUE_BORROWED], t.uint8);
const gValueSetEnum = t.bind(LIBGOBJECT, "g_value_set_enum", [GVALUE_BORROWED, t.int32], t.void);
const gValueGetEnum = t.bind(LIBGOBJECT, "g_value_get_enum", [GVALUE_BORROWED], t.int32);
const gValueSetFlags = t.bind(LIBGOBJECT, "g_value_set_flags", [GVALUE_BORROWED, t.uint32], t.void);
const gValueGetFlags = t.bind(LIBGOBJECT, "g_value_get_flags", [GVALUE_BORROWED], t.uint32);
const gValueSetObject = t.bind(LIBGOBJECT, "g_value_set_object", [GVALUE_BORROWED, t.object("borrowed")], t.void);
const gValueGetObject = t.bind(LIBGOBJECT, "g_value_get_object", [GVALUE_BORROWED], t.object("borrowed"));

const PARAM_FUNDAMENTAL = t.fundamental(LIBGOBJECT, "g_param_spec_ref", "g_param_spec_unref", {
    ownership: "borrowed",
    typeName: "GParam",
});
const gValueSetParam = t.bind(LIBGOBJECT, "g_value_set_param", [GVALUE_BORROWED, PARAM_FUNDAMENTAL], t.void);
const gValueGetParam = t.bind(LIBGOBJECT, "g_value_get_param", [GVALUE_BORROWED], PARAM_FUNDAMENTAL);

const VARIANT_FUNDAMENTAL = t.fundamental("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});
const gValueSetVariant = t.bind(LIBGOBJECT, "g_value_set_variant", [GVALUE_BORROWED, VARIANT_FUNDAMENTAL], t.void);
const gValueGetVariant = t.bind(LIBGOBJECT, "g_value_get_variant", [GVALUE_BORROWED], VARIANT_FUNDAMENTAL);

/**
 * Low-level wrapper over a freshly allocated `GValue` struct.
 *
 * Mirrors the subset of the generated `GObject.Value` surface the runtime
 * marshalling layer relies on, but binds every accessor through raw FFI so it
 * carries no generated dependency. Boxed access is intentionally absent: the
 * registry-aware boxed marshalling lives in `./value-marshal.js` and reads the
 * handle directly.
 */
export class GValue {
    constructor() {
        setHandle(this, alloc(GVALUE_SIZE, "GValue"));
    }

    /** Initializes the value to hold `gtype`. */
    init(gtype: GType): void {
        gValueInit(getHandle(this), gtype);
    }

    setBoolean(value: boolean): void {
        gValueSetBoolean(getHandle(this), value);
    }
    getBoolean(): boolean {
        return Boolean(gValueGetBoolean(getHandle(this)));
    }
    setInt(value: number): void {
        gValueSetInt(getHandle(this), value);
    }
    getInt(): number {
        return gValueGetInt(getHandle(this)) as number;
    }
    setUint(value: number): void {
        gValueSetUint(getHandle(this), value);
    }
    getUint(): number {
        return gValueGetUint(getHandle(this)) as number;
    }
    setLong(value: number): void {
        gValueSetLong(getHandle(this), value);
    }
    getLong(): number {
        return gValueGetLong(getHandle(this)) as number;
    }
    setUlong(value: number): void {
        gValueSetUlong(getHandle(this), value);
    }
    getUlong(): number {
        return gValueGetUlong(getHandle(this)) as number;
    }
    setInt64(value: number): void {
        gValueSetInt64(getHandle(this), value);
    }
    getInt64(): number {
        return gValueGetInt64(getHandle(this)) as number;
    }
    setUint64(value: number): void {
        gValueSetUint64(getHandle(this), value);
    }
    getUint64(): number {
        return gValueGetUint64(getHandle(this)) as number;
    }
    setFloat(value: number): void {
        gValueSetFloat(getHandle(this), value);
    }
    getFloat(): number {
        return gValueGetFloat(getHandle(this)) as number;
    }
    setDouble(value: number): void {
        gValueSetDouble(getHandle(this), value);
    }
    getDouble(): number {
        return gValueGetDouble(getHandle(this)) as number;
    }
    setString(value: string | null): void {
        gValueSetString(getHandle(this), value);
    }
    getString(): string | null {
        return (gValueGetString(getHandle(this)) as string | null) ?? null;
    }
    setSchar(value: number): void {
        gValueSetSchar(getHandle(this), value);
    }
    getSchar(): number {
        return gValueGetSchar(getHandle(this)) as number;
    }
    setUchar(value: number): void {
        gValueSetUchar(getHandle(this), value);
    }
    getUchar(): number {
        return gValueGetUchar(getHandle(this)) as number;
    }
    setEnum(value: number): void {
        gValueSetEnum(getHandle(this), value);
    }
    getEnum(): number {
        return gValueGetEnum(getHandle(this)) as number;
    }
    setFlags(value: number): void {
        gValueSetFlags(getHandle(this), value);
    }
    getFlags(): number {
        return gValueGetFlags(getHandle(this)) as number;
    }
    setObject(value: object | null): void {
        gValueSetObject(getHandle(this), tryGetHandle(value));
    }
    getObject(): object | null {
        return wrapHandle(gValueGetObject(getHandle(this)) as Handle | null);
    }
    setParam(value: object | null): void {
        gValueSetParam(getHandle(this), tryGetHandle(value));
    }
    getParam(): object | null {
        return wrapHandle(gValueGetParam(getHandle(this)) as Handle | null);
    }
    setVariant(value: object | null): void {
        gValueSetVariant(getHandle(this), tryGetHandle(value));
    }
    getVariant(): object | null {
        const result = gValueGetVariant(getHandle(this)) as Handle | null;
        if (result === null) return null;
        const cls = getWrapperClass(TYPE_VARIANT);
        if (cls === null) {
            throw new Error("GValue.getVariant: GLib.Variant wrapper class is not registered");
        }
        return wrapHandle(result, cls);
    }
}
