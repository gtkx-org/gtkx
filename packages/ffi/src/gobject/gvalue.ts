import {
    G_TYPE_INVALID,
    type GType,
    GVALUE_BORROWED,
    gtypeFromFfi,
    LIBGOBJECT,
    typeFromName,
    typeFundamental,
    typeName,
} from "../gtype.js";
import { getHandle } from "../handles.js";
import { call, type Type as FfiType, getInstanceGType, type NativeHandle, read, t } from "../native.js";
import { getNativeClass, getNativeObject } from "../registry.js";
import { GValue } from "./gvalue-native.js";
import { Type } from "./types.js";

const g_strv_get_type = t.fn(LIBGOBJECT, "g_strv_get_type", [], t.uint64);

const g_value_set_boxed_strv = t.fn(
    LIBGOBJECT,
    "g_value_set_boxed",
    [{ type: GVALUE_BORROWED }, { type: t.array(t.string("borrowed")) }],
    t.void,
);

let cachedStrvGType: GType | undefined;

/** Resolves and caches the `GStrv` (`gchar**`) boxed `GType`. */
export function getStrvGType(): GType {
    cachedStrvGType ??= gtypeFromFfi(g_strv_get_type());
    return cachedStrvGType;
}

function initValue(gtype: GType, populate: (v: GValue) => void): GValue {
    const v = new GValue();
    v.init(gtype);
    populate(v);
    return v;
}

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

/** Resolves the GLib type name of a boxed `GType`, throwing when unknown. */
function boxedTypeName(gtype: GType): string {
    const name = typeName(gtype);
    if (!name) {
        throw new Error(`Cannot resolve type name for boxed GType ${String(gtype)}`);
    }
    return name;
}

/**
 * Sets the boxed payload of a `GValue` already typed with a boxed `GType`.
 *
 * @param value - The `GValue` (any object backed by a `GValue` handle).
 * @param boxed - The boxed wrapper to store, or `null`.
 */
export function setBoxed(value: object, boxed: object | null): void {
    call(
        LIBGOBJECT,
        "g_value_set_boxed",
        [
            { type: GVALUE_BORROWED, value: getHandle(value) },
            {
                type: t.boxed(boxedTypeName(valueGetType(value)), "borrowed", LIBGOBJECT),
                value: boxed === null ? null : getHandle(boxed),
                optional: true,
            },
        ],
        t.void,
    );
}

/**
 * Stores `boxed` as a `GValue`'s payload without copying it: the value holds the
 * wrapper's own pointer (`g_value_set_static_boxed`), so a callee that mutates
 * the boxed in place — a signal handler filling a caller-allocated
 * out-parameter — writes through to `boxed`. The `"none"` arg ownership skips
 * the defensive `g_boxed_copy` a `"borrowed"` boxed would make. The wrapper
 * retains ownership, so the value must not outlive it.
 *
 * @param value - The `GValue` (already typed with a boxed `GType`).
 * @param boxed - The boxed wrapper to reference in place.
 */
export function setStaticBoxed(value: object, boxed: object): void {
    call(
        LIBGOBJECT,
        "g_value_set_static_boxed",
        [
            { type: GVALUE_BORROWED, value: getHandle(value) },
            { type: t.boxed(boxedTypeName(valueGetType(value)), "none", LIBGOBJECT), value: getHandle(boxed) },
        ],
        t.void,
    );
}

/**
 * Builds a `G_TYPE_BOXED` `GValue` that references `boxed` in place (no copy),
 * for emitting a signal whose caller-allocated out-parameter a handler fills.
 * Pairs with the generated `emit`, which allocates the wrapper, passes this
 * value through `g_signal_emitv`, and returns the now-populated wrapper.
 *
 * @param ffiType - The boxed FFI descriptor naming the value's `GType`.
 * @param boxed - The freshly allocated wrapper the handler writes into.
 */
export function outBoxedFromFfi(ffiType: FfiType, boxed: object): GValue {
    const value = new GValue();
    value.init(resolveBoxedGType(ffiType));
    setStaticBoxed(value, boxed);
    return value;
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
export function getBoxed(value: object): object | null {
    const gtype = valueGetType(value);
    if (typeFundamental(gtype) !== Type.BOXED) {
        return null;
    }
    const cls = getNativeClass(gtype);
    if (!cls) {
        throw new Error(`No registered class for boxed GType '${typeName(gtype) ?? String(gtype)}'`);
    }
    const ptr = call(
        LIBGOBJECT,
        "g_value_dup_boxed",
        [{ type: GVALUE_BORROWED, value: getHandle(value) }],
        t.boxed(boxedTypeName(gtype), "full", LIBGOBJECT),
    );
    return ptr === null ? null : getNativeObject(ptr as NativeHandle, cls);
}

/** Creates a `GValue` initialized with a boolean. */
function newFromBoolean(value: boolean): GValue {
    return initValue(Type.BOOLEAN, (v) => v.setBoolean(value));
}

/** Creates a `GValue` initialized with a signed 32-bit integer. */
function newFromInt(value: number): GValue {
    return initValue(Type.INT, (v) => v.setInt(value));
}

/** Creates a `GValue` initialized with an unsigned 32-bit integer. */
function newFromUint(value: number): GValue {
    return initValue(Type.UINT, (v) => v.setUint(value));
}

/** Creates a `GValue` initialized with a signed long integer. */
function newFromLong(value: number): GValue {
    return initValue(Type.LONG, (v) => v.setLong(value));
}

/** Creates a `GValue` initialized with an unsigned long integer. */
function newFromUlong(value: number): GValue {
    return initValue(Type.ULONG, (v) => v.setUlong(value));
}

/** Creates a `GValue` initialized with a signed 64-bit integer. */
function newFromInt64(value: number): GValue {
    return initValue(Type.INT64, (v) => v.setInt64(value));
}

/** Creates a `GValue` initialized with an unsigned 64-bit integer. */
function newFromUint64(value: number): GValue {
    return initValue(Type.UINT64, (v) => v.setUint64(value));
}

/** Creates a `GValue` initialized with a single-precision float. */
function newFromFloat(value: number): GValue {
    return initValue(Type.FLOAT, (v) => v.setFloat(value));
}

/** Creates a `GValue` initialized with a double-precision float. */
function newFromDouble(value: number): GValue {
    return initValue(Type.DOUBLE, (v) => v.setDouble(value));
}

/** Creates a `GValue` initialized with a string (or `null`). */
function newFromString(value: string | null): GValue {
    return initValue(Type.STRING, (v) => v.setString(value));
}

/**
 * Creates a `GValue` initialized with a `GObject` instance.
 *
 * The `GType` is derived from the object's runtime class.
 *
 * @param value - The `GObject` instance, or `null`.
 */
export function valueFromObject(value: object | null): GValue {
    const v = new GValue();
    if (value) {
        const gtype: GType = getInstanceGType(getHandle(value));
        v.init(gtype);
    } else {
        v.init(Type.OBJECT);
    }
    v.setObject(value);
    return v;
}

/** Creates a `GValue` initialized with a boxed value of the given `GType`. */
function newFromBoxed(value: object, gtype: GType): GValue {
    return initValue(gtype, (v) => setBoxed(v, value));
}

/** Creates a `GValue` initialized with a `GStrv` from a JS string array. */
function newFromStrv(value: string[]): GValue {
    return initValue(getStrvGType(), (v) => g_value_set_boxed_strv(getHandle(v), value));
}

/** Creates a `GValue` initialized with a `GVariant`. */
function newFromVariant(value: object): GValue {
    return initValue(Type.VARIANT, (v) => v.setVariant(value));
}

/** Creates a `GValue` initialized with an enum payload of the given `GType`. */
function newFromEnum(gtype: GType, value: number): GValue {
    return initValue(gtype, (v) => v.setEnum(value));
}

/** Creates a `GValue` initialized with a flags payload of the given `GType`. */
function newFromFlags(gtype: GType, value: number): GValue {
    return initValue(gtype, (v) => v.setFlags(value));
}

function resolveBoxedGType(ffiType: FfiType): GType {
    if (ffiType.type === "boxed") {
        if (ffiType.getTypeFn && ffiType.library) {
            return gtypeFromFfi(call(ffiType.library, ffiType.getTypeFn, [], t.uint64));
        }
        const gtype = typeFromName(ffiType.innerType);
        if (gtype === G_TYPE_INVALID) {
            throw new Error(`Cannot resolve gtype for boxed type '${ffiType.innerType}'`);
        }
        return gtype;
    }
    if (ffiType.type === "fundamental") {
        if (ffiType.typeName) {
            const gtype = typeFromName(ffiType.typeName);
            if (gtype !== G_TYPE_INVALID) return gtype;
        }
        throw new Error(`Cannot resolve gtype for fundamental type without a typeName`);
    }
    throw new Error(`resolveBoxedGType: unsupported FFI type '${ffiType.type}'`);
}

type FfiEnumOrFlagsType = Extract<FfiType, { type: "enum" | "flags" }>;
type FfiArrayType = Extract<FfiType, { type: "array" }>;
type FfiFundamentalType = Extract<FfiType, { type: "fundamental" }>;

function newFromEnumOrFlagsFfi(ffiType: FfiEnumOrFlagsType, value: unknown): GValue {
    const gtype = gtypeFromFfi(call(ffiType.library, ffiType.getTypeFn, [], t.uint64));
    if (ffiType.type === "flags" || typeFundamental(gtype) === Type.FLAGS) {
        return newFromFlags(gtype, value as number);
    }
    return newFromEnum(gtype, value as number);
}

function newFromIntegerFfi(ffiTypeName: string, value: unknown): GValue {
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
        default:
            throw new Error(`newFromIntegerFfi: not an integer type '${ffiTypeName}'`);
    }
}

function newFromArrayFfi(ffiType: FfiArrayType, value: unknown): GValue {
    if (ffiType.itemType.type === "string" && ffiType.kind === "array") {
        return newFromStrv(value as string[]);
    }
    throw new Error(`Unsupported array type for GValue conversion: ${ffiType.kind} of ${ffiType.itemType.type}`);
}

/**
 * Builds a `GValue` from a fundamental FFI descriptor, routing `GVariant`
 * (identified by its stable `typeName`) to the variant marshaller and every
 * other ref-counted fundamental to the boxed marshaller.
 */
function newFromFundamentalFfi(ffiType: FfiFundamentalType, value: unknown): GValue {
    if (ffiType.typeName === "GVariant") {
        return newFromVariant(value as object);
    }
    return newFromBoxed(value as object, resolveBoxedGType(ffiType));
}

/**
 * Creates a `GValue` from an FFI type descriptor and a JavaScript value.
 *
 * Dispatches to the appropriate constructor based on the descriptor's type.
 *
 * @param ffiType - The FFI type descriptor.
 * @param value - The JS value to convert.
 */
export function valueFromFfi(ffiType: FfiType, value: unknown): GValue {
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
            return newFromIntegerFfi(ffiType.type, value);
        case "float32":
            return newFromFloat(value as number);
        case "float64":
            return newFromDouble(value as number);
        case "gobject":
            return valueFromObject(value as object | null);
        case "boxed":
            return newFromBoxed(value as object, resolveBoxedGType(ffiType));
        case "array":
            return newFromArrayFfi(ffiType, value);
        case "fundamental":
            return newFromFundamentalFfi(ffiType, value);
        default:
            throw new Error(`Unsupported FFI type for GValue conversion: ${(ffiType as { type: string }).type}`);
    }
}

/** Creates a `GValue` typed as `gtype` but holding no payload. */
function emptyValue(gtype: GType): GValue {
    return initValue(gtype, () => {});
}

function newPointerValue(gtype: GType, value: unknown): GValue {
    if (value !== null && value !== undefined) {
        throw new Error("G_TYPE_POINTER properties cannot be set from a non-null JS value");
    }
    return emptyValue(gtype);
}

function newBoxedValue(gtype: GType, value: unknown): GValue {
    if (value === null || value === undefined) return emptyValue(gtype);
    return newFromBoxed(value as object, gtype);
}

function newStrvValue(gtype: GType, value: unknown): GValue {
    if (value === null || value === undefined) return emptyValue(gtype);
    return newFromStrv(value as string[]);
}

/**
 * The read-only `GValue` accessor surface the unmarshaller consumes.
 *
 * Both the hand-written {@link GValue} and the public generated `GObject.Value`
 * satisfy it structurally, so {@link valueToJS} accepts either without coupling
 * the runtime to the generated class.
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

/** Marshals a JS value to and from a `GValue` for one GObject fundamental. */
type FundamentalMarshaller = {
    /** Builds a `GValue` of the concrete `gtype` from a JS `value`. */
    to: (gtype: GType, value: unknown) => GValue;
    /** Reads the JS value held by a `GValue`. */
    from: (value: GValueReader) => unknown;
};

let fundamentalMarshallers: Map<GType, FundamentalMarshaller> | undefined;

/**
 * The single fundamental-keyed marshalling table.
 *
 * Both directions dispatch through it: {@link valueFromJS} reads each entry's
 * `to`, and `valueToJS` reads its `from`. Supporting a new fundamental — or
 * correcting how an existing one is marshalled — is a one-line edit here
 * rather than a change spread across parallel write and read structures.
 *
 * Built lazily because every key is a {@link Type} member whose GType is
 * itself resolved on first access.
 */
export function getFundamentalMarshallers(): Map<GType, FundamentalMarshaller> {
    fundamentalMarshallers ??= new Map<GType, FundamentalMarshaller>([
        [Type.BOOLEAN, { to: (_g, v) => newFromBoolean(v as boolean), from: (v) => v.getBoolean() }],
        [Type.INT, { to: (_g, v) => newFromInt(v as number), from: (v) => v.getInt() }],
        [Type.UINT, { to: (_g, v) => newFromUint(v as number), from: (v) => v.getUint() }],
        [Type.LONG, { to: (_g, v) => newFromLong(v as number), from: (v) => v.getLong() }],
        [Type.ULONG, { to: (_g, v) => newFromUlong(v as number), from: (v) => v.getUlong() }],
        [Type.INT64, { to: (_g, v) => newFromInt64(v as number), from: (v) => v.getInt64() }],
        [Type.UINT64, { to: (_g, v) => newFromUint64(v as number), from: (v) => v.getUint64() }],
        [Type.FLOAT, { to: (_g, v) => newFromFloat(v as number), from: (v) => v.getFloat() }],
        [Type.DOUBLE, { to: (_g, v) => newFromDouble(v as number), from: (v) => v.getDouble() }],
        [Type.STRING, { to: (_g, v) => newFromString(v as string | null), from: (v) => v.getString() }],
        [Type.CHAR, { to: (g, v) => initValue(g, (val) => val.setSchar(v as number)), from: (v) => v.getSchar() }],
        [Type.UCHAR, { to: (g, v) => initValue(g, (val) => val.setUchar(v as number)), from: (v) => v.getUchar() }],
        [Type.ENUM, { to: (g, v) => newFromEnum(g, v as number), from: (v) => v.getEnum() }],
        [Type.FLAGS, { to: (g, v) => newFromFlags(g, v as number), from: (v) => v.getFlags() }],
        [Type.OBJECT, { to: (_g, v) => valueFromObject(v as object | null), from: (v) => v.getObject() }],
        [Type.VARIANT, { to: (_g, v) => newFromVariant(v as object), from: (v) => v.getVariant() }],
        [
            Type.PARAM,
            { to: (g, v) => initValue(g, (val) => val.setParam(v as object | null)), from: (v) => v.getParam() },
        ],
    ]);
    return fundamentalMarshallers;
}

/**
 * Creates a `GValue` typed as `gtype` and marshals `value` into it.
 *
 * The runtime counterpart to {@link valueFromFfi}: where `valueFromFfi`
 * consumes a codegen-time FFI type descriptor, this consumes a runtime `GType`
 * integer (typically derived from a `GParamSpec`).
 *
 * @param gtype - The concrete `GType` (not necessarily the fundamental).
 * @param value - The JS value to marshal.
 * @throws on `G_TYPE_POINTER` with a non-null value, or unsupported `GType`s.
 */
export function valueFromJS(gtype: GType, value: unknown): GValue {
    if (gtype === getStrvGType()) return newStrvValue(gtype, value);

    const fundamental = typeFundamental(gtype);
    const marshaller = getFundamentalMarshallers().get(fundamental);
    if (marshaller) return marshaller.to(gtype, value);

    if (fundamental === Type.POINTER) return newPointerValue(gtype, value);
    if (fundamental === Type.BOXED) return newBoxedValue(gtype, value);

    throw new Error(`Unsupported GType for valueFromJS: ${typeName(gtype) ?? String(gtype)}`);
}
