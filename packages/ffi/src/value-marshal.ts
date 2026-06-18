/**
 * Bidirectional `GValue` marshalling.
 *
 * Converts JavaScript values to and from a {@link GValue} through FFI type
 * descriptors: {@link valueFromFfi} builds a value from a descriptor and a JS
 * value, {@link valueToJS} reads one back, and {@link getGobjectProperty} /
 * {@link setGobjectProperty} drive GObject property access on top of them. The
 * boxed payload helpers and the out-parameter cells signal emission relies on
 * live here too. Every GObject and `GValue` symbol is bound through raw FFI so
 * the runtime carries no dependency on the generated `GObject` namespace.
 */

import { alloc, call, type Type as FfiType, getType, type Handle, read, write } from "@gtkx/native";
import { GVALUE_T, LIBGOBJECT } from "./constants.js";
import { t } from "./descriptors.js";
import {
    type GType,
    TYPE_BOOLEAN,
    TYPE_BOXED,
    TYPE_CHAR,
    TYPE_DOUBLE,
    TYPE_ENUM,
    TYPE_FLAGS,
    TYPE_FLOAT,
    TYPE_INT,
    TYPE_INT64,
    TYPE_INVALID,
    TYPE_LONG,
    TYPE_OBJECT,
    TYPE_PARAM,
    TYPE_POINTER,
    TYPE_STRING,
    TYPE_UCHAR,
    TYPE_UINT,
    TYPE_UINT64,
    TYPE_ULONG,
    TYPE_VARIANT,
    typeFromName,
    typeFundamental,
    typeName,
} from "./gtype.js";
import {
    newGValue,
    setGValuePointer,
    valueGetBoolean,
    valueGetDouble,
    valueGetEnum,
    valueGetFlags,
    valueGetFloat,
    valueGetInt,
    valueGetInt64,
    valueGetLong,
    valueGetObject,
    valueGetParam,
    valueGetSchar,
    valueGetString,
    valueGetType,
    valueGetUchar,
    valueGetUint,
    valueGetUint64,
    valueGetUlong,
    valueGetVariant,
    valueInit,
    valueSetBoolean,
    valueSetDouble,
    valueSetEnum,
    valueSetFlags,
    valueSetFloat,
    valueSetInt,
    valueSetInt64,
    valueSetLong,
    valueSetObject,
    valueSetParam,
    valueSetSchar,
    valueSetString,
    valueSetUchar,
    valueSetUint,
    valueSetUint64,
    valueSetUlong,
    valueSetVariant,
} from "./gvalue.js";
import { getHandle, getWrapperClass, wrapHandle } from "./registry.js";

const gStrvGetType = t.bind(LIBGOBJECT, "g_strv_get_type", [], t.uint64);

const gValueSetBoxedStrv = t.bind(LIBGOBJECT, "g_value_set_boxed", [GVALUE_T, t.array(t.string("borrowed"))], t.void);

let cachedStrvGtype: GType | undefined;

/** Resolves and caches the `GStrv` (`gchar**`) boxed `GType`. */
export function getStrvGtype(): GType {
    cachedStrvGtype ??= gStrvGetType() as GType;
    return cachedStrvGtype;
}

function initValue(gtype: GType, populate: (v: Handle) => void): Handle {
    const v = newGValue();
    valueInit(v, gtype);
    populate(v);
    return v;
}

/** Resolves the GLib type name of a boxed `GType`, throwing when unknown. */
function boxedTypeName(gtype: GType): string {
    const name = typeName(gtype);
    if (!name) {
        throw new Error(`Cannot resolve type name for boxed GType ${String(gtype)}`);
    }
    return name;
}

/** Sets the boxed payload of a `GValue` handle already typed with a boxed `GType`. */
function valueSetBoxed(value: Handle, boxed: object | null): void {
    call(
        LIBGOBJECT,
        "g_value_set_boxed",
        [
            { type: GVALUE_T, value },
            {
                type: t.boxed(boxedTypeName(valueGetType(value)), "borrowed", LIBGOBJECT),
                value: boxed === null ? null : getHandle(boxed),
            },
        ],
        t.void,
    );
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
 * Stores `boxed` as a `GValue` handle's payload without copying it
 * (`g_value_set_static_boxed`): the value holds the wrapper's own pointer, so a
 * callee that mutates the boxed in place writes through to `boxed`. The wrapper
 * retains ownership, so the value must not outlive it.
 */
function valueSetStaticBoxed(value: Handle, boxed: object): void {
    call(
        LIBGOBJECT,
        "g_value_set_static_boxed",
        [
            { type: GVALUE_T, value },
            { type: t.boxed(boxedTypeName(valueGetType(value)), "borrowed", LIBGOBJECT), value: getHandle(boxed) },
        ],
        t.void,
    );
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
    const value = newGValue();
    valueInit(value, resolveBoxedGtype(ffiType));
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
    const value = newGValue();
    valueInit(value, resolveBoxedGtype(ffiType));
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
        LIBGOBJECT,
        "g_value_dup_boxed",
        [{ type: GVALUE_T, value }],
        t.boxed(boxedTypeName(gtype), "full", LIBGOBJECT),
    );
    return ptr === null ? null : wrapHandle(ptr as Handle, cls);
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

/** Creates a `GValue` initialized with a boolean. */
function newFromBoolean(value: boolean): Handle {
    return initValue(TYPE_BOOLEAN, (v) => valueSetBoolean(v, value));
}

/** Creates a `GValue` initialized with a signed 32-bit integer. */
function newFromInt(value: number): Handle {
    return initValue(TYPE_INT, (v) => valueSetInt(v, value));
}

/** Creates a `GValue` initialized with an unsigned 32-bit integer. */
function newFromUint(value: number): Handle {
    return initValue(TYPE_UINT, (v) => valueSetUint(v, value));
}

/** Creates a `GValue` initialized with a signed long integer. */
function newFromLong(value: number): Handle {
    return initValue(TYPE_LONG, (v) => valueSetLong(v, value));
}

/** Creates a `GValue` initialized with an unsigned long integer. */
function newFromUlong(value: number): Handle {
    return initValue(TYPE_ULONG, (v) => valueSetUlong(v, value));
}

/** Creates a `GValue` initialized with a signed 64-bit integer. */
function newFromInt64(value: number): Handle {
    return initValue(TYPE_INT64, (v) => valueSetInt64(v, value));
}

/** Creates a `GValue` initialized with an unsigned 64-bit integer. */
function newFromUint64(value: number): Handle {
    return initValue(TYPE_UINT64, (v) => valueSetUint64(v, value));
}

const gValueSetInt64Big = t.bind(LIBGOBJECT, "g_value_set_int64", [GVALUE_T, t.bigint64], t.void);

const gValueSetUint64Big = t.bind(LIBGOBJECT, "g_value_set_uint64", [GVALUE_T, t.biguint64], t.void);

/** Creates a `GValue` initialized with a signed 64-bit integer from a bigint. */
function newFromBigInt64(value: bigint | number): Handle {
    return initValue(TYPE_INT64, (v) => gValueSetInt64Big(v, value));
}

/** Creates a `GValue` initialized with an unsigned 64-bit integer from a bigint. */
function newFromBigUint64(value: bigint | number): Handle {
    return initValue(TYPE_UINT64, (v) => gValueSetUint64Big(v, value));
}

/** Creates a `GValue` initialized with a single-precision float. */
function newFromFloat(value: number): Handle {
    return initValue(TYPE_FLOAT, (v) => valueSetFloat(v, value));
}

/** Creates a `GValue` initialized with a double-precision float. */
function newFromDouble(value: number): Handle {
    return initValue(TYPE_DOUBLE, (v) => valueSetDouble(v, value));
}

/** Creates a `GValue` initialized with a string (or `null`). */
function newFromString(value: string | null): Handle {
    return initValue(TYPE_STRING, (v) => valueSetString(v, value));
}

/**
 * Creates a `GValue` initialized with a `GObject` instance.
 *
 * The `GType` is derived from the object's runtime class.
 *
 * @param value - The `GObject` instance, or `null`.
 */
export function valueFromObject(value: object | null): Handle {
    const v = newGValue();
    valueInit(v, value ? getType(getHandle(value)) : TYPE_OBJECT);
    valueSetObject(v, value);
    return v;
}

/** Creates a `GValue` initialized with a boxed value of the given `GType`. */
function newFromBoxed(value: object, gtype: GType): Handle {
    return initValue(gtype, (v) => valueSetBoxed(v, value));
}

/** Creates a `GValue` initialized with a `GStrv` from a JS string array. */
function newFromStrv(value: string[]): Handle {
    return initValue(getStrvGtype(), (v) => gValueSetBoxedStrv(v, value));
}

/** Creates a `GValue` initialized with a `GVariant`. */
function newFromVariant(value: object): Handle {
    return initValue(TYPE_VARIANT, (v) => valueSetVariant(v, value));
}

/** Creates a `GValue` initialized with an enum payload of the given `GType`. */
function newFromEnum(gtype: GType, value: number): Handle {
    return initValue(gtype, (v) => valueSetEnum(v, value));
}

/** Creates a `GValue` initialized with a flags payload of the given `GType`. */
function newFromFlags(gtype: GType, value: number): Handle {
    return initValue(gtype, (v) => valueSetFlags(v, value));
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
            return call(ffiType.library, ffiType.getTypeFn, [], t.uint64) as GType;
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

type FfiEnumOrFlagsType = Extract<FfiType, { type: "enum" | "flags" }>;
type FfiArrayType = Extract<FfiType, { type: "array" }>;
type FfiFundamentalType = Extract<FfiType, { type: "fundamental" }>;

function newFromEnumOrFlagsFfi(ffiType: FfiEnumOrFlagsType, value: unknown): Handle {
    const gtype = call(ffiType.library, ffiType.getTypeFn, [], t.uint64) as GType;
    if (ffiType.type === "flags" || typeFundamental(gtype) === TYPE_FLAGS) {
        return newFromFlags(gtype, value as number);
    }
    return newFromEnum(gtype, value as number);
}

function newFromIntegerFfi(ffiTypeName: string, value: unknown): Handle {
    switch (ffiTypeName) {
        case "int8":
        case "int16":
        case "int32":
            return newFromInt(value as number);
        case "uint8":
        case "uint16":
        case "uint32":
            return newFromUint(value as number);
        case "int64":
            return newFromInt64(value as number);
        case "uint64":
            return newFromUint64(value as number);
        case "bigint64":
            return newFromBigInt64(value as bigint | number);
        case "biguint64":
            return newFromBigUint64(value as bigint | number);
        default:
            throw new Error(`newFromIntegerFfi: not an integer type '${ffiTypeName}'`);
    }
}

function newFromArrayFfi(ffiType: FfiArrayType, value: unknown): Handle {
    if (ffiType.itemType.type === "string" && ffiType.kind === "array") {
        return newFromStrv(value as string[]);
    }
    throw new Error(`Unsupported array type for GValue conversion: ${ffiType.kind} of ${ffiType.itemType.type}`);
}

/**
 * Builds a `GValue` from a fundamental FFI descriptor. The descriptor's `GType`
 * is resolved and routed through the {@link getFundamentalMarshallers} table, so
 * a `GParamSpec` marshals via `g_value_set_param`, a `GVariant` via the variant
 * marshaller, and so on; a fundamental whose `GType` is a boxed type falls back
 * to the boxed marshaller.
 */
function newFromFundamentalFfi(ffiType: FfiFundamentalType, value: unknown): Handle {
    if (ffiType.typeName === "GVariant") {
        return newFromVariant(value as object);
    }
    const gtype = resolveBoxedGtype(ffiType);
    const marshaller = getFundamentalMarshallers().get(typeFundamental(gtype));
    if (marshaller) return marshaller.to(gtype, value);
    return newFromBoxed(value as object, gtype);
}

/**
 * Creates a `GValue` from an FFI type descriptor and a JavaScript value.
 *
 * Dispatches to the appropriate constructor based on the descriptor's type.
 *
 * @param ffiType - The FFI type descriptor.
 * @param value - The JS value to convert.
 */
export function valueFromFfi(ffiType: FfiType, value: unknown): Handle {
    switch (ffiType.type) {
        case "boolean":
            return newFromBoolean(value as boolean);
        case "string":
            return newFromString(value as string | null);
        case "enum":
        case "flags":
            return newFromEnumOrFlagsFfi(ffiType, value);
        case "int8":
        case "int16":
        case "int32":
        case "uint8":
        case "uint16":
        case "uint32":
        case "int64":
        case "uint64":
        case "bigint64":
        case "biguint64":
            return newFromIntegerFfi(ffiType.type, value);
        case "float32":
            return newFromFloat(value as number);
        case "float64":
            return newFromDouble(value as number);
        case "gobject":
            return valueFromObject(value as object | null);
        case "boxed":
            return newFromBoxed(value as object, resolveBoxedGtype(ffiType));
        case "array":
            return newFromArrayFfi(ffiType, value);
        case "fundamental":
            return newFromFundamentalFfi(ffiType, value);
        default:
            throw new Error(`Unsupported FFI type for GValue conversion: ${(ffiType as { type: string }).type}`);
    }
}

/** Creates a `GValue` typed as `gtype` but holding no payload. */
function emptyValue(gtype: GType): Handle {
    return initValue(gtype, () => {});
}

/**
 * Resolves the concrete `GType` an FFI type descriptor denotes, the inverse of
 * the type half of {@link valueFromFfi}. Primitive descriptors map to their
 * fundamental `GType` (a `TYPE_*` constant); enum/flags and boxed/fundamental
 * descriptors resolve their registered `GType`; a string-array descriptor
 * resolves `GStrv`.
 *
 * @param ffiType - The FFI type descriptor (rendered statically by codegen).
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
            return call(ffiType.library, ffiType.getTypeFn, [], t.uint64) as GType;
        case "boxed":
            return resolveBoxedGtype(ffiType);
        case "fundamental":
            return ffiType.typeName === "GVariant" ? TYPE_VARIANT : resolveBoxedGtype(ffiType);
        case "array":
            if (ffiType.itemType.type === "string" && ffiType.kind === "array") return getStrvGtype();
            throw new Error(`emptyValueFromFfi: unsupported array type ${ffiType.kind} of ${ffiType.itemType.type}`);
        default:
            throw new Error(`emptyValueFromFfi: unsupported FFI type '${(ffiType as { type: string }).type}'`);
    }
}

/**
 * Creates an empty `GValue` typed to the `GType` an FFI descriptor denotes,
 * ready for `g_object_get_property` to populate. The runtime counterpart of the
 * codegen-time property GType: where the generated accessor knows the property's
 * type statically, this materialises the matching empty cell.
 *
 * @param ffiType - The property's FFI type descriptor.
 */
export function emptyValueFromFfi(ffiType: FfiType): Handle {
    return emptyValue(gtypeFromFfiType(ffiType));
}

/** Marshals a JS value to and from a `GValue` for one GObject fundamental. */
type FundamentalMarshaller = {
    /** Builds a `GValue` of the concrete `gtype` from a JS `value`. */
    to: (gtype: GType, value: unknown) => Handle;
    /** Reads the JS value held by a `GValue` handle. */
    from: (value: Handle) => unknown;
};

let fundamentalMarshallers: Map<GType, FundamentalMarshaller> | undefined;

/**
 * The single fundamental-keyed marshalling table.
 *
 * Both directions dispatch through it: {@link newFromFundamentalFfi} reads each
 * entry's `to` when an FFI descriptor's `GType` names a fundamental, and
 * {@link valueToJS} reads its `from`. Supporting a new fundamental — or
 * correcting how an existing one is marshalled — is a one-line edit here rather
 * than a change spread across parallel write and read structures.
 *
 * Built lazily because every key is a `TYPE_*` fundamental constant whose GType
 * is itself resolved on first access.
 */
function getFundamentalMarshallers(): Map<GType, FundamentalMarshaller> {
    fundamentalMarshallers ??= new Map<GType, FundamentalMarshaller>([
        [TYPE_BOOLEAN, { to: (_g, v) => newFromBoolean(v as boolean), from: (v) => valueGetBoolean(v) }],
        [TYPE_INT, { to: (_g, v) => newFromInt(v as number), from: (v) => valueGetInt(v) }],
        [TYPE_UINT, { to: (_g, v) => newFromUint(v as number), from: (v) => valueGetUint(v) }],
        [TYPE_LONG, { to: (_g, v) => newFromLong(v as number), from: (v) => valueGetLong(v) }],
        [TYPE_ULONG, { to: (_g, v) => newFromUlong(v as number), from: (v) => valueGetUlong(v) }],
        [TYPE_INT64, { to: (_g, v) => newFromInt64(v as number), from: (v) => valueGetInt64(v) }],
        [TYPE_UINT64, { to: (_g, v) => newFromUint64(v as number), from: (v) => valueGetUint64(v) }],
        [TYPE_FLOAT, { to: (_g, v) => newFromFloat(v as number), from: (v) => valueGetFloat(v) }],
        [TYPE_DOUBLE, { to: (_g, v) => newFromDouble(v as number), from: (v) => valueGetDouble(v) }],
        [TYPE_STRING, { to: (_g, v) => newFromString(v as string | null), from: (v) => valueGetString(v) }],
        [
            TYPE_CHAR,
            { to: (g, v) => initValue(g, (val) => valueSetSchar(val, v as number)), from: (v) => valueGetSchar(v) },
        ],
        [
            TYPE_UCHAR,
            { to: (g, v) => initValue(g, (val) => valueSetUchar(val, v as number)), from: (v) => valueGetUchar(v) },
        ],
        [TYPE_ENUM, { to: (g, v) => newFromEnum(g, v as number), from: (v) => valueGetEnum(v) }],
        [TYPE_FLAGS, { to: (g, v) => newFromFlags(g, v as number), from: (v) => valueGetFlags(v) }],
        [TYPE_OBJECT, { to: (_g, v) => valueFromObject(v as object | null), from: (v) => valueGetObject(v) }],
        [TYPE_VARIANT, { to: (_g, v) => newFromVariant(v as object), from: (v) => valueGetVariant(v) }],
        [
            TYPE_PARAM,
            {
                to: (g, v) => initValue(g, (val) => valueSetParam(val, v as object | null)),
                from: (v) => valueGetParam(v),
            },
        ],
    ]);
    return fundamentalMarshallers;
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
    write(storage, t.uint64, 0, 0);
    if (initial !== undefined) write(storage, innerFfi, 0, initial);
    const value = newGValue();
    valueInit(value, TYPE_POINTER);
    setGValuePointer(value, storage);
    return { value, read: () => read(storage, innerFfi, 0) };
}

const gValueGetBoxedStrv = t.bind(LIBGOBJECT, "g_value_get_boxed", [GVALUE_T], t.array(t.string("borrowed")));

const gValueGetInt64Big = t.bind(LIBGOBJECT, "g_value_get_int64", [GVALUE_T], t.bigint64);

const gValueGetUint64Big = t.bind(LIBGOBJECT, "g_value_get_uint64", [GVALUE_T], t.biguint64);

/**
 * Reads a 64-bit `GValue` payload as a `bigint` when the property's FFI
 * descriptor declares a bigint representation, or `undefined` when it does
 * not and the fundamental-keyed {@link valueToJS} path applies.
 */
function bigintValueToJS(ffiType: FfiType, value: Handle): bigint | undefined {
    if (ffiType.type === "bigint64") return gValueGetInt64Big(value) as bigint;
    if (ffiType.type === "biguint64") return gValueGetUint64Big(value) as bigint;
    return undefined;
}

const valueGetStrv = (value: Handle): string[] => (gValueGetBoxedStrv(value) as string[] | null) ?? [];

const valueFromFundamental = (value: Handle, fundamental: GType): unknown => {
    const marshaller = getFundamentalMarshallers().get(fundamental);
    return marshaller ? marshaller.from(value) : undefined;
};

const getPointerValue = (handle: Handle): null => {
    const ptr = read(handle, t.uint64, 8) as number;
    if (ptr !== 0) {
        throw new Error("G_TYPE_POINTER non-null values cannot be marshalled to JS");
    }
    return null;
};

/**
 * Unmarshals a `GValue` into a plain JavaScript value.
 *
 * Dispatches on `typeFundamental(valueGetType(value))`:
 * - Numeric/boolean fundamentals return their primitive JS form.
 * - STRING returns `string | null` (NULL strings are preserved as `null`).
 * - ENUM/FLAGS return the integer payload.
 * - OBJECT returns the wrapped GObject instance, or `null`.
 * - VARIANT returns the wrapped Variant instance, or `null`.
 * - PARAM returns the wrapped ParamSpec instance.
 * - BOXED with the GStrv concrete type returns `string[]`.
 * - BOXED with any other type resolves the wrapper class via the registry
 *   and returns the wrapped instance; throws if no class is registered.
 * - POINTER returns `null` for a null pointer; throws otherwise.
 *
 * @param value - The handle of the `GValue` to unmarshal.
 * @throws if the GValue holds an unsupported or unregistered type.
 */
export function valueToJS(value: Handle): unknown {
    const gtype = valueGetType(value);

    if (gtype === getStrvGtype()) return valueGetStrv(value);

    const fundamental = typeFundamental(gtype);
    const fundamentalValue = valueFromFundamental(value, fundamental);
    if (fundamentalValue !== undefined) return fundamentalValue;

    if (fundamental === TYPE_POINTER) return getPointerValue(value);
    if (fundamental === TYPE_BOXED) return valueGetBoxed(value);

    throw new Error(`Unsupported GType for valueToJS: ${typeName(gtype) ?? String(gtype)}`);
}

const PROPERTY_CALL_ARGS = [t.object("borrowed"), t.string("borrowed"), GVALUE_T] as const;

const gObjectGetProperty = t.bind(LIBGOBJECT, "g_object_get_property", [...PROPERTY_CALL_ARGS], t.void);
const gObjectSetProperty = t.bind(LIBGOBJECT, "g_object_set_property", [...PROPERTY_CALL_ARGS], t.void);

/**
 * Reads a GObject property into a plain JavaScript value through a
 * statically-known FFI type descriptor.
 *
 * The generated property getter passes the property's FFI type — resolved from
 * the GIR at codegen time — so an empty `GValue` of the matching type is
 * populated by `g_object_get_property` and unmarshalled via {@link valueToJS},
 * with no runtime param-spec introspection.
 *
 * @param obj - The GObject instance whose property is read.
 * @param propertyName - The property name (kebab-case GIR name).
 * @param ffiType - The property's FFI type descriptor.
 */
export function getGobjectProperty(obj: object, propertyName: string, ffiType: FfiType): unknown {
    const value = emptyValueFromFfi(ffiType);
    gObjectGetProperty(getHandle(obj), propertyName, value);
    return bigintValueToJS(ffiType, value) ?? valueToJS(value);
}

/**
 * Writes a plain JavaScript value to a GObject property through a
 * statically-known FFI type descriptor.
 *
 * The generated property setter passes the property's FFI type — resolved from
 * the GIR at codegen time — so `value` is marshalled by {@link valueFromFfi} and
 * dispatched to `g_object_set_property`, with no runtime param-spec
 * introspection.
 *
 * @param obj - The GObject instance whose property is written.
 * @param propertyName - The property name (kebab-case GIR name).
 * @param ffiType - The property's FFI type descriptor.
 * @param jsValue - The JS value to set.
 */
export function setGobjectProperty(obj: object, propertyName: string, ffiType: FfiType, jsValue: unknown): void {
    gObjectSetProperty(getHandle(obj), propertyName, valueFromFfi(ffiType, jsValue));
}
