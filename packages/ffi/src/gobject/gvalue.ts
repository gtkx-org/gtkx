import type * as GLib from "../generated/glib/glib.js";
import type { Object as GObject, GType, ParamSpec } from "../generated/gobject/gobject.js";
import { typeFromName, typeFundamental, typeName, Value } from "../generated/gobject/gobject.js";
import { G_TYPE_INVALID, GVALUE_BORROWED, gtypeFromFfi, LIBGOBJECT } from "../gtype.js";
import { getHandle, type NativeObject } from "../handles.js";
import { call, type Type as FfiType, getInstanceGType, type NativeHandle, read, t } from "../native.js";
import { findNativeClass, getNativeObject } from "../registry.js";
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

function initValue(gtype: GType, populate: (v: Value) => void): Value {
    const v = new Value();
    v.init(gtype);
    populate(v);
    return v;
}

/** The `GType` a `GValue` currently holds — the `G_VALUE_TYPE` C macro. */
function valueHeldType(value: Value): GType {
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

/** Sets the boxed payload of a `GValue` already typed with a boxed `GType`. */
export function writeBoxed(value: Value, vBoxed: object | null): void {
    call(
        LIBGOBJECT,
        "g_value_set_boxed",
        [
            { type: GVALUE_BORROWED, value: getHandle(value) },
            {
                type: t.boxed(boxedTypeName(valueHeldType(value)), "borrowed", LIBGOBJECT),
                value: vBoxed === null ? null : getHandle(vBoxed),
                optional: true,
            },
        ],
        t.void,
    );
}

/**
 * Reads the boxed payload of a `GValue`, resolving the wrapper class through
 * the registry.
 *
 * @param value - The `GValue` to read.
 * @returns The wrapped boxed instance, or `null` when the value holds no boxed
 *   type or the boxed pointer is NULL.
 * @throws if the boxed `GType` has no registered wrapper class.
 */
export function readBoxed(value: Value): object | null {
    const gtype = valueHeldType(value);
    if (typeFundamental(gtype) !== Type.BOXED) {
        return null;
    }
    const cls = findNativeClass(gtype, false);
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
function newFromBoolean(value: boolean): Value {
    return initValue(Type.BOOLEAN, (v) => v.setBoolean(value));
}

/** Creates a `GValue` initialized with a signed 32-bit integer. */
function newFromInt(value: number): Value {
    return initValue(Type.INT, (v) => v.setInt(value));
}

/** Creates a `GValue` initialized with an unsigned 32-bit integer. */
function newFromUint(value: number): Value {
    return initValue(Type.UINT, (v) => v.setUint(value));
}

/** Creates a `GValue` initialized with a signed long integer. */
function newFromLong(value: number): Value {
    return initValue(Type.LONG, (v) => v.setLong(value));
}

/** Creates a `GValue` initialized with an unsigned long integer. */
function newFromUlong(value: number): Value {
    return initValue(Type.ULONG, (v) => v.setUlong(value));
}

/** Creates a `GValue` initialized with a signed 64-bit integer. */
function newFromInt64(value: number): Value {
    return initValue(Type.INT64, (v) => v.setInt64(value));
}

/** Creates a `GValue` initialized with an unsigned 64-bit integer. */
function newFromUint64(value: number): Value {
    return initValue(Type.UINT64, (v) => v.setUint64(value));
}

/** Creates a `GValue` initialized with a single-precision float. */
function newFromFloat(value: number): Value {
    return initValue(Type.FLOAT, (v) => v.setFloat(value));
}

/** Creates a `GValue` initialized with a double-precision float. */
function newFromDouble(value: number): Value {
    return initValue(Type.DOUBLE, (v) => v.setDouble(value));
}

/** Creates a `GValue` initialized with a string (or `null`). */
function newFromString(value: string | null): Value {
    return initValue(Type.STRING, (v) => v.setString(value));
}

/** Creates a `GValue` initialized with a `GObject` (or `null`). */
export function newFromObject(value: GObject | null): Value {
    const v = new Value();
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
function newFromBoxed(value: object, gtype: GType): Value {
    return initValue(gtype, (v) => writeBoxed(v, value));
}

/** Creates a `GValue` initialized with a `GStrv` from a JS string array. */
function newFromStrv(value: string[]): Value {
    return initValue(getStrvGType(), (v) => g_value_set_boxed_strv(getHandle(v), value));
}

/** Creates a `GValue` initialized with a `GVariant`. */
function newFromVariant(value: GLib.Variant): Value {
    return initValue(Type.VARIANT, (v) => v.setVariant(value));
}

/** Creates a `GValue` initialized with an enum payload of the given `GType`. */
function newFromEnum(gtype: GType, value: number): Value {
    return initValue(gtype, (v) => v.setEnum(value));
}

/** Creates a `GValue` initialized with a flags payload of the given `GType`. */
function newFromFlags(gtype: GType, value: number): Value {
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

function newFromEnumOrFlagsFfi(ffiType: FfiEnumOrFlagsType, value: unknown): Value {
    const gtype = gtypeFromFfi(call(ffiType.library, ffiType.getTypeFn, [], t.uint64));
    if (ffiType.type === "flags" || typeFundamental(gtype) === Type.FLAGS) {
        return newFromFlags(gtype, value as number);
    }
    return newFromEnum(gtype, value as number);
}

function newFromIntegerFfi(ffiTypeName: string, value: unknown): Value {
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

function newFromArrayFfi(ffiType: FfiArrayType, value: unknown): Value {
    if (ffiType.itemType.type === "string" && ffiType.kind === "array") {
        return newFromStrv(value as string[]);
    }
    throw new Error(`Unsupported array type for GValue conversion: ${ffiType.kind} of ${ffiType.itemType.type}`);
}

function newFromFundamentalFfi(ffiType: FfiFundamentalType, value: unknown): Value {
    if (ffiType.refFn === "g_variant_ref_sink") {
        return newFromVariant(value as GLib.Variant);
    }
    return newFromBoxed(value as NativeObject, resolveBoxedGType(ffiType));
}

/**
 * Builds a `GValue` from an FFI type descriptor and a JavaScript value,
 * dispatching on `ffiType.type`.
 */
export function newFrom(ffiType: FfiType, value: unknown): Value {
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
            return newFromObject(value as GObject | null);
        case "boxed":
            return newFromBoxed(value as NativeObject, resolveBoxedGType(ffiType));
        case "array":
            return newFromArrayFfi(ffiType, value);
        case "fundamental":
            return newFromFundamentalFfi(ffiType, value);
        default:
            throw new Error(`Unsupported FFI type for GValue conversion: ${(ffiType as { type: string }).type}`);
    }
}

/** Creates a `GValue` typed as `gtype` but holding no payload. */
function emptyValue(gtype: GType): Value {
    return initValue(gtype, () => {});
}

function newPointerValue(gtype: GType, value: unknown): Value {
    if (value !== null && value !== undefined) {
        throw new Error("G_TYPE_POINTER properties cannot be set from a non-null JS value");
    }
    return emptyValue(gtype);
}

function newBoxedValue(gtype: GType, value: unknown): Value {
    if (value === null || value === undefined) return emptyValue(gtype);
    return newFromBoxed(value as NativeObject, gtype);
}

function newStrvValue(gtype: GType, value: unknown): Value {
    if (value === null || value === undefined) return emptyValue(gtype);
    return newFromStrv(value as string[]);
}

/** Marshals a JS value to and from a `GValue` for one GObject fundamental. */
type FundamentalMarshaller = {
    /** Builds a `GValue` of the concrete `gtype` from a JS `value`. */
    to: (gtype: GType, value: unknown) => Value;
    /** Reads the JS value held by a `GValue`. */
    from: (value: Value) => unknown;
};

let fundamentalMarshallers: Map<GType, FundamentalMarshaller> | undefined;

/**
 * The single fundamental-keyed marshalling table.
 *
 * Both directions dispatch through it: {@link fromJS} reads each entry's
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
        [Type.OBJECT, { to: (_g, v) => newFromObject(v as GObject | null), from: (v) => v.getObject() }],
        [Type.VARIANT, { to: (_g, v) => newFromVariant(v as GLib.Variant), from: (v) => v.getVariant() }],
        [
            Type.PARAM,
            { to: (g, v) => initValue(g, (val) => val.setParam(v as ParamSpec | null)), from: (v) => v.getParam() },
        ],
    ]);
    return fundamentalMarshallers;
}

/**
 * Builds a `GValue` of the given `GType` from a JavaScript value, dispatching
 * on the type's fundamental.
 */
export function fromJS(gtype: GType, value: unknown): Value {
    if (gtype === getStrvGType()) return newStrvValue(gtype, value);

    const fundamental = typeFundamental(gtype);
    const marshaller = getFundamentalMarshallers().get(fundamental);
    if (marshaller) return marshaller.to(gtype, value);

    if (fundamental === Type.POINTER) return newPointerValue(gtype, value);
    if (fundamental === Type.BOXED) return newBoxedValue(gtype, value);

    throw new Error(`Unsupported GType for Value.fromJS: ${typeName(gtype) ?? String(gtype)}`);
}
