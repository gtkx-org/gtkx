/**
 * The hand-written `GValue` container and its bidirectional marshalling.
 *
 * A `GValue` here is the {@link Handle} of a freshly allocated `GValue` struct,
 * with every accessor bound through raw FFI so the runtime carries no dependency
 * on the generated `GObject.Value`. {@link newGValue} allocates one,
 * {@link valueInit} types it, and the `valueGet*`/`valueSet*` pairs read and
 * write its payload. On top of those, {@link toGvalue} builds a value from an
 * FFI type descriptor and a JS value and {@link fromGvalue} reads one back, with
 * the boxed payload helpers and `GStrv` marshalling registry-aware access relies
 * on living here too.
 */

import { alloc, call, type Type as FfiType, getType, type Handle, read, write } from "@gtkx/native";
import { GVALUE_SIZE, GVALUE_T, LIB } from "./constants.js";
import {
    arrayT,
    bigint64T,
    biguint64T,
    bind,
    booleanT,
    boxedT,
    float32T,
    float64T,
    fundamentalT,
    int32T,
    objectT,
    stringT,
    uint32T,
    uint64T,
    voidT,
} from "./descriptors.js";
import {
    type GType,
    getStrvGtype,
    TYPE_BOOLEAN,
    TYPE_BOXED,
    TYPE_DOUBLE,
    TYPE_ENUM,
    TYPE_FLAGS,
    TYPE_FLOAT,
    TYPE_INT,
    TYPE_INT64,
    TYPE_INVALID,
    TYPE_OBJECT,
    TYPE_PARAM,
    TYPE_POINTER,
    TYPE_STRING,
    TYPE_UINT,
    TYPE_UINT64,
    TYPE_VARIANT,
    typeFromName,
    typeFundamental,
    typeName,
} from "./gtype.js";
import { getHandle, getWrapperClass, tryGetHandle, wrapHandle } from "./registry.js";

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
    return read(value, biguint64T, 0) as GType;
}

const gValueInit = bind(LIB, "g_value_init", [GVALUE_T, biguint64T], voidT);

/** Initializes `value` to hold `gtype`. */
export const valueInit = (value: Handle, gtype: GType): void => {
    gValueInit(value, gtype);
};

/** Allocates a fresh `GValue` and initializes it to `gtype`, ready to receive a payload. */
export const newTypedGValue = (gtype: GType): Handle => {
    const value = newGValue();
    valueInit(value, gtype);
    return value;
};

const gValueCopy = bind(LIB, "g_value_copy", [GVALUE_T, GVALUE_T], voidT);

/**
 * Deep-copies the contents of `src` into the caller-allocated `dest` `GValue`,
 * the ownership-correct fill for a caller-allocated out `GValue` parameter:
 * `g_value_copy` refs objects, duplicates strings, and copies boxed payloads per
 * the value's `GType`, so `dest` owns its own contents. `dest` is initialized to
 * `src`'s type first when it is still untyped, as the out-parameter contract
 * passes a zeroed `GValue`.
 *
 * @param dest - The caller-allocated destination `GValue` handle.
 * @param src - The source `GValue` handle whose contents are copied.
 */
export const valueCopyInto = (dest: Handle, src: Handle): void => {
    if (valueGetType(dest) === TYPE_INVALID) {
        valueInit(dest, valueGetType(src));
    }
    gValueCopy(src, dest);
};

const gValueSetPointer = bind(LIB, "g_value_set_pointer", [GVALUE_T, uint64T], voidT);

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

const gValueSetBoolean = bind(LIB, "g_value_set_boolean", [GVALUE_T, booleanT], voidT);
const gValueGetBoolean = bind(LIB, "g_value_get_boolean", [GVALUE_T], booleanT);
const gValueSetInt = bind(LIB, "g_value_set_int", [GVALUE_T, int32T], voidT);
const gValueGetInt = bind(LIB, "g_value_get_int", [GVALUE_T], int32T);
const gValueSetUint = bind(LIB, "g_value_set_uint", [GVALUE_T, uint32T], voidT);
const gValueGetUint = bind(LIB, "g_value_get_uint", [GVALUE_T], uint32T);
const gValueSetInt64 = bind(LIB, "g_value_set_int64", [GVALUE_T, bigint64T], voidT);
const gValueGetInt64 = bind(LIB, "g_value_get_int64", [GVALUE_T], bigint64T);
const gValueSetUint64 = bind(LIB, "g_value_set_uint64", [GVALUE_T, biguint64T], voidT);
const gValueGetUint64 = bind(LIB, "g_value_get_uint64", [GVALUE_T], biguint64T);
const gValueSetFloat = bind(LIB, "g_value_set_float", [GVALUE_T, float32T], voidT);
const gValueGetFloat = bind(LIB, "g_value_get_float", [GVALUE_T], float32T);
const gValueSetDouble = bind(LIB, "g_value_set_double", [GVALUE_T, float64T], voidT);
const gValueGetDouble = bind(LIB, "g_value_get_double", [GVALUE_T], float64T);
const gValueSetString = bind(LIB, "g_value_set_string", [GVALUE_T, stringT("borrowed")], voidT);
const gValueGetString = bind(LIB, "g_value_get_string", [GVALUE_T], stringT("borrowed"));
const gValueSetEnum = bind(LIB, "g_value_set_enum", [GVALUE_T, int32T], voidT);
const gValueGetEnum = bind(LIB, "g_value_get_enum", [GVALUE_T], int32T);
const gValueSetFlags = bind(LIB, "g_value_set_flags", [GVALUE_T, uint32T], voidT);
const gValueGetFlags = bind(LIB, "g_value_get_flags", [GVALUE_T], uint32T);
const gValueSetObject = bind(LIB, "g_value_set_object", [GVALUE_T, objectT("borrowed")], voidT);
const gValueGetObject = bind(LIB, "g_value_get_object", [GVALUE_T], objectT("borrowed"));

const PARAM_FUNDAMENTAL = fundamentalT(LIB, "g_param_spec_ref", "g_param_spec_unref", {
    ownership: "borrowed",
    typeName: "GParam",
});
const gValueSetParam = bind(LIB, "g_value_set_param", [GVALUE_T, PARAM_FUNDAMENTAL], voidT);
const gValueGetParam = bind(LIB, "g_value_get_param", [GVALUE_T], PARAM_FUNDAMENTAL);

const VARIANT_FUNDAMENTAL = fundamentalT("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});
const gValueSetVariant = bind(LIB, "g_value_set_variant", [GVALUE_T, VARIANT_FUNDAMENTAL], voidT);
const gValueGetVariant = bind(LIB, "g_value_get_variant", [GVALUE_T], VARIANT_FUNDAMENTAL);

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
export const valueSetInt64 = (value: Handle, v: bigint | number): void => {
    gValueSetInt64(value, v);
};
export const valueGetInt64 = (value: Handle): bigint => gValueGetInt64(value) as bigint;
export const valueSetUint64 = (value: Handle, v: bigint | number): void => {
    gValueSetUint64(value, v);
};
export const valueGetUint64 = (value: Handle): bigint => gValueGetUint64(value) as bigint;
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

const gValueSetBoxedStrv = bind(LIB, "g_value_set_boxed", [GVALUE_T, arrayT(stringT("borrowed"))], voidT);
const gValueGetBoxedStrv = bind(LIB, "g_value_get_boxed", [GVALUE_T], arrayT(stringT("borrowed")));

const valueSetStrv = (value: Handle, v: string[]): void => {
    gValueSetBoxedStrv(value, v);
};
const valueGetStrv = (value: Handle): string[] => (gValueGetBoxedStrv(value) as string[] | null) ?? [];

const setBoxedPayload = (
    value: Handle,
    symbol: "g_value_set_boxed" | "g_value_set_static_boxed",
    boxedHandle: Handle | null,
): void => {
    call(
        LIB,
        symbol,
        [
            { type: GVALUE_T, value },
            {
                type: boxedT(typeName(valueGetType(value)) ?? "GBoxed", "borrowed", LIB),
                value: boxedHandle,
            },
        ],
        voidT,
    );
};

/** Sets the boxed payload of a `GValue` handle already typed with a boxed `GType`. */
export function valueSetBoxed(value: Handle, boxed: object | null): void {
    setBoxedPayload(value, "g_value_set_boxed", boxed === null ? null : getHandle(boxed));
}

/**
 * Stores `boxed` as a `GValue` handle's payload without copying it
 * (`g_value_set_static_boxed`): the value holds the wrapper's own pointer, so a
 * callee that mutates the boxed in place writes through to `boxed`. The wrapper
 * retains ownership, so the value must not outlive it.
 */
export function valueSetStaticBoxed(value: Handle, boxed: object): void {
    setBoxedPayload(value, "g_value_set_static_boxed", getHandle(boxed));
}

/** Storage size, in bytes, of a single out-parameter cell (a pointer or any scalar). */
const OUT_PARAM_STORAGE_SIZE = 8;

/**
 * Builds the `G_TYPE_POINTER` GValue a signal out-parameter is emitted through,
 * paired with a reader for the value a handler writes back.
 *
 * `g_signal_emitv` hands the pointer payload to handlers as the out-parameter's
 * `T*`, so a handler writes into the freshly allocated storage; the returned
 * `read` unmarshals that storage with `innerFfi`. The `initial` value seeds the
 * storage for inout parameters, where the handler both reads the incoming value
 * and overwrites it.
 *
 * @param innerFfi - FFI descriptor of the pointed-to value (the `t.ref` inner type).
 * @param initial - Seed written before emission, for inout parameters.
 */
export function outValueFromFfi(innerFfi: FfiType, initial?: unknown): { value: Handle; read: () => unknown } {
    const storage = alloc(OUT_PARAM_STORAGE_SIZE);
    write(storage, uint64T, 0, 0);
    if (initial !== undefined) write(storage, innerFfi, 0, initial);
    const value = newTypedGValue(TYPE_POINTER);
    setGValuePointer(value, storage);
    return { value, read: () => read(storage, innerFfi, 0) };
}

/**
 * Builds a `G_TYPE_BOXED` `GValue` holding a copy of `boxed`, for emitting a
 * signal whose caller-allocated out-parameter a handler fills. The handler
 * mutates the value's owned copy in place; the generated `emit` reads that copy
 * back through {@link valueGetBoxed} after `g_signal_emitv` returns.
 *
 * @param ffiType - The boxed FFI descriptor naming the value's `GType`.
 * @param boxed - The freshly allocated wrapper whose contents seed the copy.
 */
export function outBoxedFromFfi(ffiType: FfiType, boxed: object): Handle {
    const value = newTypedGValue(resolveBoxedGtype(ffiType));
    valueSetBoxed(value, boxed);
    return value;
}

/**
 * Builds a `G_TYPE_BOXED` `GValue` that references `boxed` in place (no copy),
 * for emitting a signal whose boxed inout-parameter a handler mutates. The
 * value shares the caller's pointer through {@link valueSetStaticBoxed}, so the
 * handler's in-place writes land on the caller's wrapper directly; the result
 * surfaces through that wrapper rather than the `emit` return tuple. The value
 * must not outlive `boxed`.
 *
 * @param ffiType - The boxed FFI descriptor naming the value's `GType`.
 * @param boxed - The caller's wrapper the handler mutates in place.
 */
export function inoutBoxedFromFfi(ffiType: FfiType, boxed: object): Handle {
    const value = newTypedGValue(resolveBoxedGtype(ffiType));
    valueSetStaticBoxed(value, boxed);
    return value;
}

/**
 * Reads the boxed payload of a `GValue` handle, resolving the wrapper class
 * through the registry. Returns `null` when the value holds no boxed type or the
 * boxed pointer is NULL; throws when the boxed `GType` has no registered class.
 */
export function valueGetBoxed(value: Handle): object | null {
    const gtype = valueGetType(value);
    if (typeFundamental(gtype) !== TYPE_BOXED) {
        return null;
    }
    const cls = getWrapperClass(gtype);
    if (!cls) {
        throw new Error(`No registered class for boxed GType '${typeName(gtype) ?? String(gtype)}'`);
    }
    const ptr = call(
        LIB,
        "g_value_dup_boxed",
        [{ type: GVALUE_T, value }],
        boxedT(typeName(gtype) ?? "GBoxed", "full", LIB),
    );
    return ptr === null ? null : wrapHandle(ptr as Handle, cls);
}

/**
 * Sets the boxed payload of a `GValue` already typed with a boxed `GType`.
 *
 * @param value - The `GValue` (any object backed by a `GValue` handle).
 * @param boxed - The boxed wrapper to store, or `null`.
 */
export function setGvalueBoxed(value: object, boxed: object | null): void {
    valueSetBoxed(getHandle(value), boxed);
}

/**
 * Reads the boxed payload of a `GValue`, resolving the wrapper class through
 * the registry.
 *
 * @param value - The `GValue` to read (any object backed by a `GValue` handle).
 * @returns The wrapped boxed instance, or `null` when the value holds no boxed
 *   type or the boxed pointer is NULL.
 * @throws if the boxed `GType` has no registered wrapper class.
 */
export function getGvalueBoxed(value: object): object | null {
    return valueGetBoxed(getHandle(value));
}

/**
 * Resolves the concrete boxed or named-fundamental `GType` an FFI descriptor
 * identifies, through its registered `get-type` function or its GLib type name.
 *
 * @param ffiType - The boxed or fundamental FFI type descriptor.
 */
export function resolveBoxedGtype(ffiType: FfiType): GType {
    if (ffiType.type === "boxed") {
        if (ffiType.getTypeFn && ffiType.library) {
            return call(ffiType.library, ffiType.getTypeFn, [], biguint64T) as GType;
        }
        const gtype = typeFromName(ffiType.innerType);
        if (gtype === TYPE_INVALID) {
            throw new Error(`Cannot resolve gtype for boxed type '${ffiType.innerType}'`);
        }
        return gtype;
    }
    if (ffiType.type === "fundamental") {
        if (ffiType.typeName) {
            const gtype = typeFromName(ffiType.typeName);
            if (gtype !== TYPE_INVALID) return gtype;
        }
        throw new Error(`Cannot resolve gtype for fundamental type without a typeName`);
    }
    throw new Error(`resolveBoxedGtype: unsupported FFI type '${ffiType.type}'`);
}

/**
 * Resolves the concrete `GType` an FFI type descriptor denotes. Primitive
 * descriptors map to their fundamental `GType`; enum/flags and boxed/fundamental
 * descriptors resolve their registered `GType`; a string-array descriptor
 * resolves `GStrv`.
 */
function gtypeFromFfiType(ffiType: FfiType): GType {
    switch (ffiType.type) {
        case "boolean":
            return TYPE_BOOLEAN;
        case "string":
            return TYPE_STRING;
        case "int8":
        case "int16":
        case "int32":
            return TYPE_INT;
        case "uint8":
        case "uint16":
        case "uint32":
            return TYPE_UINT;
        case "int64":
        case "bigint64":
            return TYPE_INT64;
        case "uint64":
        case "biguint64":
            return TYPE_UINT64;
        case "float32":
            return TYPE_FLOAT;
        case "float64":
            return TYPE_DOUBLE;
        case "gobject":
            return TYPE_OBJECT;
        case "enum":
        case "flags":
            return call(ffiType.library, ffiType.getTypeFn, [], biguint64T) as GType;
        case "boxed":
            return resolveBoxedGtype(ffiType);
        case "fundamental":
            return ffiType.typeName === "GVariant" ? TYPE_VARIANT : resolveBoxedGtype(ffiType);
        case "array":
            if (ffiType.itemType.type === "string" && ffiType.kind === "array") return getStrvGtype();
            throw new Error(`Unsupported array type ${ffiType.kind} of ${ffiType.itemType.type}`);
        default:
            throw new Error(`Unsupported FFI type '${ffiType.type}'`);
    }
}

/**
 * Creates an empty `GValue` typed to the `GType` an FFI descriptor denotes,
 * ready for `g_object_get_property` to populate or a signal emission to fill.
 *
 * @param ffiType - The FFI type descriptor.
 */
export function newValueFromFfi(ffiType: FfiType): Handle {
    return newTypedGValue(gtypeFromFfiType(ffiType));
}

/** Builds a `GValue` holding a `GObject` instance, typed to its runtime class. */
function objectToGvalue(value: object | null): Handle {
    const v = newTypedGValue(value ? getType(getHandle(value)) : TYPE_OBJECT);
    valueSetObject(v, value);
    return v;
}

const getPointerValue = (value: Handle): null => {
    const ptr = read(value, uint64T, 8) as number;
    if (ptr !== 0) {
        throw new Error("G_TYPE_POINTER non-null values cannot be marshalled to JS");
    }
    return null;
};

/**
 * Writes `jsValue` into the already-typed `GValue` handle, dispatching on the
 * `GType`'s fundamental. A 64-bit integer is written through the bigint
 * accessor, which accepts a `bigint` or a `number`. The FFI descriptor
 * disambiguates the one case the fundamental cannot: a string-array descriptor
 * selects the `GStrv` setter over the generic boxed setter. Fundamentals
 * {@link gtypeFromFfiType} never resolves to (`LONG`/`ULONG`/`CHAR`/`UCHAR`) are
 * absent by construction.
 */
function setGvaluePayload(value: Handle, gtype: GType, ffiType: FfiType, jsValue: unknown): void {
    switch (typeFundamental(gtype)) {
        case TYPE_BOOLEAN:
            valueSetBoolean(value, jsValue as boolean);
            break;
        case TYPE_INT:
            valueSetInt(value, jsValue as number);
            break;
        case TYPE_UINT:
            valueSetUint(value, jsValue as number);
            break;
        case TYPE_INT64:
            valueSetInt64(value, jsValue as bigint | number);
            break;
        case TYPE_UINT64:
            valueSetUint64(value, jsValue as bigint | number);
            break;
        case TYPE_FLOAT:
            valueSetFloat(value, jsValue as number);
            break;
        case TYPE_DOUBLE:
            valueSetDouble(value, jsValue as number);
            break;
        case TYPE_STRING:
            valueSetString(value, jsValue as string | null);
            break;
        case TYPE_ENUM:
            valueSetEnum(value, jsValue as number);
            break;
        case TYPE_FLAGS:
            valueSetFlags(value, jsValue as number);
            break;
        case TYPE_VARIANT:
            valueSetVariant(value, jsValue as object | null);
            break;
        case TYPE_PARAM:
            valueSetParam(value, jsValue as object | null);
            break;
        case TYPE_BOXED:
            if (ffiType.type === "array") valueSetStrv(value, jsValue as string[]);
            else valueSetBoxed(value, jsValue as object | null);
            break;
        default:
            throw new Error(`Unsupported GType for toGvalue: ${typeName(gtype) ?? String(gtype)}`);
    }
}

/**
 * Builds a `GValue` from an FFI type descriptor and a JavaScript value.
 *
 * The descriptor resolves the target `GType` — a `GObject` derives it from the
 * instance's runtime class — then the value is written by fundamental through
 * {@link setGvaluePayload}.
 *
 * @param ffiType - The FFI type descriptor.
 * @param jsValue - The JS value to convert.
 */
export function toGvalue(ffiType: FfiType, jsValue: unknown): Handle {
    if (ffiType.type === "gobject") return objectToGvalue(jsValue as object | null);
    const gtype = gtypeFromFfiType(ffiType);
    const value = newTypedGValue(gtype);
    setGvaluePayload(value, gtype, ffiType, jsValue);
    return value;
}

/**
 * Unmarshals a `GValue` into a plain JavaScript value, dispatching on the
 * value's fundamental `GType`: numeric/boolean fundamentals return their JS
 * primitive, STRING returns `string | null`, ENUM/FLAGS the integer payload,
 * OBJECT/VARIANT/PARAM the wrapped instance, the `GStrv` boxed type a
 * `string[]`, any other BOXED type its registered wrapper, and POINTER `null`
 * for a null pointer.
 *
 * @param value - The handle of the `GValue` to unmarshal.
 * @throws if the GValue holds an unsupported or unregistered type.
 */
export function fromGvalue(value: Handle): unknown {
    const gtype = valueGetType(value);
    if (gtype === getStrvGtype()) return valueGetStrv(value);
    switch (typeFundamental(gtype)) {
        case TYPE_BOOLEAN:
            return valueGetBoolean(value);
        case TYPE_INT:
            return valueGetInt(value);
        case TYPE_UINT:
            return valueGetUint(value);
        case TYPE_INT64:
            return valueGetInt64(value);
        case TYPE_UINT64:
            return valueGetUint64(value);
        case TYPE_FLOAT:
            return valueGetFloat(value);
        case TYPE_DOUBLE:
            return valueGetDouble(value);
        case TYPE_STRING:
            return valueGetString(value);
        case TYPE_ENUM:
            return valueGetEnum(value);
        case TYPE_FLAGS:
            return valueGetFlags(value);
        case TYPE_OBJECT:
            return valueGetObject(value);
        case TYPE_VARIANT:
            return valueGetVariant(value);
        case TYPE_PARAM:
            return valueGetParam(value);
        case TYPE_POINTER:
            return getPointerValue(value);
        case TYPE_BOXED:
            return valueGetBoxed(value);
        default:
            throw new Error(`Unsupported GType for fromGvalue: ${typeName(gtype) ?? String(gtype)}`);
    }
}
