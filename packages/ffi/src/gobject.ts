/**
 * The GObject instance and value layer.
 *
 * Owns GObject construction (`newGobjectWithProperties`), the hand-written
 * `GValue` container and its bidirectional marshalling (JavaScript values to
 * and from a `GValue` via FFI type descriptors), GObject property get/set, and
 * `wrapValue` — the single descriptor-driven lift from a raw native value to
 * its typed JavaScript wrapper. Every GObject and `GValue` symbol is bound
 * through raw FFI so the runtime carries no dependency on the generated
 * `GObject` namespace.
 */

import { alloc, call, type Type as FfiType, getType, type Handle, read, setWrapper, write } from "@gtkx/native";
import type { AnyClass } from "@gtkx/utils";
import {
    type GType,
    GVALUE_BORROWED,
    GVALUE_SIZE,
    gtypeFromFfi,
    LIBGOBJECT,
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
import { t } from "./helpers.js";
import {
    getClassGtype,
    getHandle,
    getInterfaceWrapperClass,
    getWrapperClass,
    setHandle,
    tryGetHandle,
    wrapHandle,
} from "./registry.js";

/**
 * A property-marshalling instruction: the property's FFI type paired with the
 * raw JavaScript value to convert. The translating constructor of each class
 * emits one per property it introduces, keyed by the property's GIR name, and
 * threads it up the `super(...)` chain.
 */
type MarshalEntry = readonly [FfiType, unknown];

/**
 * Every FFI type-descriptor `kind`, the closed set the `t` helpers produce. A
 * marshalling instruction's first element is always one of these; nothing a
 * caller mixes into the prop bag — a React element, an array, a handler — has a
 * `type` field drawn from it, so the set cleanly tells the two apart.
 */
const FFI_TYPE_KINDS: ReadonlySet<string> = new Set([
    "int8",
    "uint8",
    "int16",
    "uint16",
    "int32",
    "uint32",
    "int64",
    "uint64",
    "bigint64",
    "biguint64",
    "float32",
    "float64",
    "boolean",
    "void",
    "unichar",
    "blob",
    "string",
    "gobject",
    "boxed",
    "struct",
    "fundamental",
    "ref",
    "hashtable",
    "enum",
    "flags",
    "array",
    "trampoline",
]);

/**
 * Whether a constructor prop-bag entry is a property-marshalling instruction,
 * as opposed to a raw `...rest` value still keyed by its camelCase name on its
 * way to the ancestor constructor that introduces it. Marshalling instructions
 * are the only entries {@link newGobjectWithProperties} consumes; anything else
 * (a raw prop, a React element, a signal handler, or a ref a caller mixed in)
 * is ignored. The discriminator is the first element being an FFI type
 * descriptor — a `[FfiType, value]` pair — which a raw prop value never is.
 */
const isMarshalEntry = (entry: unknown): entry is MarshalEntry => {
    if (!Array.isArray(entry) || entry.length !== 2) return false;
    const descriptor: unknown = entry[0];
    if (typeof descriptor !== "object" || descriptor === null) return false;
    const kind: unknown = (descriptor as { type?: unknown }).type;
    return typeof kind === "string" && FFI_TYPE_KINDS.has(kind);
};

/**
 * Canonical "new GObject with properties" implementation.
 *
 * The generated `GObject.Object` constructor delegates here, threading the
 * prop bag each subclass constructor assembled up the `super(...)` chain: a
 * `[ffiType, value]` marshalling instruction per property it introduces (keyed
 * by GIR name), spread alongside the untranslated `...rest`. This function
 * marshals each instruction into a `GValue` and forwards it to
 * `g_object_new_with_properties`; every other entry is ignored. An instruction
 * whose value is `undefined` (an omitted optional prop) is dropped.
 *
 * The freshly allocated handle is linked to the wrapper and registered with a
 * toggle reference (`setWrapper`), so every future handle for this object
 * round-trips to the same JS wrapper. Construct-time initialization for a
 * subclass belongs in its constructor, after `super(...)` — where the handle is
 * already live; gtkx does not route GObject construct-time vtable slots
 * (`constructed`, `set_property`, `get_property`) to JavaScript, so no synchronous
 * vfunc observes the wrapper before construction completes.
 *
 * @param instance - The wrapper being constructed; its leaf class supplies the GType
 * @param props - GIR-name-keyed marshalling instructions (plus ignored extras)
 */
export function newGobjectWithProperties(instance: object, props: Record<string, unknown>): void {
    const names: string[] = [];
    const values: Handle[] = [];
    for (const key in props) {
        const entry = props[key];
        if (!isMarshalEntry(entry)) continue;
        const [ffiType, value] = entry;
        if (value === undefined) continue;
        names.push(key);
        values.push(getHandle(valueFromFfi(ffiType, value)));
    }

    const gtype = getClassGtype(instance.constructor as AnyClass);
    const handle = call(
        LIBGOBJECT,
        "g_object_new_with_properties",
        [
            { type: t.uint64, value: gtype },
            { type: t.uint32, value: names.length },
            { type: t.sizedArray(t.string("borrowed"), 1, "borrowed"), value: names },
            { type: t.sizedArray(GVALUE_BORROWED, 1, "borrowed", GVALUE_SIZE), value: values },
        ],
        t.object("full"),
    ) as Handle;

    setHandle(instance, handle);
    setWrapper(handle, instance);
}

const gStrvGetType = t.bind(LIBGOBJECT, "g_strv_get_type", [], t.uint64);

const gValueSetBoxedStrv = t.bind(
    LIBGOBJECT,
    "g_value_set_boxed",
    [{ type: GVALUE_BORROWED }, { type: t.array(t.string("borrowed")) }],
    t.void,
);

let cachedStrvGtype: GType | undefined;

/** Resolves and caches the `GStrv` (`gchar**`) boxed `GType`. */
export function getStrvGtype(): GType {
    cachedStrvGtype ??= gtypeFromFfi(gStrvGetType());
    return cachedStrvGtype;
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
export function setGvalueBoxed(value: object, boxed: object | null): void {
    call(
        LIBGOBJECT,
        "g_value_set_boxed",
        [
            { type: GVALUE_BORROWED, value: getHandle(value) },
            {
                type: t.boxed(boxedTypeName(valueGetType(value)), "borrowed", LIBGOBJECT),
                value: boxed === null ? null : getHandle(boxed),
            },
        ],
        t.void,
    );
}

/**
 * Stores `boxed` as a `GValue`'s payload without copying it
 * (`g_value_set_static_boxed`): the value holds the wrapper's own pointer, so a
 * callee that mutates the boxed in place writes through to `boxed`. The wrapper
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
            { type: t.boxed(boxedTypeName(valueGetType(value)), "borrowed", LIBGOBJECT), value: getHandle(boxed) },
        ],
        t.void,
    );
}

/**
 * Builds a `G_TYPE_BOXED` `GValue` holding a copy of `boxed`, for emitting a
 * signal whose caller-allocated out-parameter a handler fills. The handler
 * mutates the value's owned copy in place; the generated `emit` reads that copy
 * back through {@link getGvalueBoxed} after `g_signal_emitv` returns.
 *
 * @param ffiType - The boxed FFI descriptor naming the value's `GType`.
 * @param boxed - The freshly allocated wrapper whose contents seed the copy.
 */
export function outBoxedFromFfi(ffiType: FfiType, boxed: object): GValue {
    const value = new GValue();
    value.init(resolveBoxedGtype(ffiType));
    setGvalueBoxed(value, boxed);
    return value;
}

/**
 * Builds a `G_TYPE_BOXED` `GValue` that references `boxed` in place (no copy),
 * for emitting a signal whose boxed inout-parameter a handler mutates. The
 * value shares the caller's pointer through {@link setStaticBoxed}, so the
 * handler's in-place writes land on the caller's wrapper directly; the result
 * surfaces through that wrapper rather than the `emit` return tuple. The value
 * must not outlive `boxed`.
 *
 * @param ffiType - The boxed FFI descriptor naming the value's `GType`.
 * @param boxed - The caller's wrapper the handler mutates in place.
 */
export function inoutBoxedFromFfi(ffiType: FfiType, boxed: object): GValue {
    const value = new GValue();
    value.init(resolveBoxedGtype(ffiType));
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
export function getGvalueBoxed(value: object): object | null {
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
        [{ type: GVALUE_BORROWED, value: getHandle(value) }],
        t.boxed(boxedTypeName(gtype), "full", LIBGOBJECT),
    );
    return ptr === null ? null : wrapHandle(ptr as Handle, cls);
}

/** Creates a `GValue` initialized with a boolean. */
function newFromBoolean(value: boolean): GValue {
    return initValue(TYPE_BOOLEAN, (v) => v.setBoolean(value));
}

/** Creates a `GValue` initialized with a signed 32-bit integer. */
function newFromInt(value: number): GValue {
    return initValue(TYPE_INT, (v) => v.setInt(value));
}

/** Creates a `GValue` initialized with an unsigned 32-bit integer. */
function newFromUint(value: number): GValue {
    return initValue(TYPE_UINT, (v) => v.setUint(value));
}

/** Creates a `GValue` initialized with a signed long integer. */
function newFromLong(value: number): GValue {
    return initValue(TYPE_LONG, (v) => v.setLong(value));
}

/** Creates a `GValue` initialized with an unsigned long integer. */
function newFromUlong(value: number): GValue {
    return initValue(TYPE_ULONG, (v) => v.setUlong(value));
}

/** Creates a `GValue` initialized with a signed 64-bit integer. */
function newFromInt64(value: number): GValue {
    return initValue(TYPE_INT64, (v) => v.setInt64(value));
}

/** Creates a `GValue` initialized with an unsigned 64-bit integer. */
function newFromUint64(value: number): GValue {
    return initValue(TYPE_UINT64, (v) => v.setUint64(value));
}

const gValueSetInt64Big = t.bind(
    LIBGOBJECT,
    "g_value_set_int64",
    [{ type: GVALUE_BORROWED }, { type: t.bigint64 }],
    t.void,
);

const gValueSetUint64Big = t.bind(
    LIBGOBJECT,
    "g_value_set_uint64",
    [{ type: GVALUE_BORROWED }, { type: t.biguint64 }],
    t.void,
);

/** Creates a `GValue` initialized with a signed 64-bit integer from a bigint. */
function newFromBigInt64(value: bigint | number): GValue {
    return initValue(TYPE_INT64, (v) => gValueSetInt64Big(getHandle(v), value));
}

/** Creates a `GValue` initialized with an unsigned 64-bit integer from a bigint. */
function newFromBigUint64(value: bigint | number): GValue {
    return initValue(TYPE_UINT64, (v) => gValueSetUint64Big(getHandle(v), value));
}

/** Creates a `GValue` initialized with a single-precision float. */
function newFromFloat(value: number): GValue {
    return initValue(TYPE_FLOAT, (v) => v.setFloat(value));
}

/** Creates a `GValue` initialized with a double-precision float. */
function newFromDouble(value: number): GValue {
    return initValue(TYPE_DOUBLE, (v) => v.setDouble(value));
}

/** Creates a `GValue` initialized with a string (or `null`). */
function newFromString(value: string | null): GValue {
    return initValue(TYPE_STRING, (v) => v.setString(value));
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
        const gtype: GType = getType(getHandle(value));
        v.init(gtype);
    } else {
        v.init(TYPE_OBJECT);
    }
    v.setObject(value);
    return v;
}

/** Creates a `GValue` initialized with a boxed value of the given `GType`. */
function newFromBoxed(value: object, gtype: GType): GValue {
    return initValue(gtype, (v) => setGvalueBoxed(v, value));
}

/** Creates a `GValue` initialized with a `GStrv` from a JS string array. */
function newFromStrv(value: string[]): GValue {
    return initValue(getStrvGtype(), (v) => gValueSetBoxedStrv(getHandle(v), value));
}

/** Creates a `GValue` initialized with a `GVariant`. */
function newFromVariant(value: object): GValue {
    return initValue(TYPE_VARIANT, (v) => v.setVariant(value));
}

/** Creates a `GValue` initialized with an enum payload of the given `GType`. */
function newFromEnum(gtype: GType, value: number): GValue {
    return initValue(gtype, (v) => v.setEnum(value));
}

/** Creates a `GValue` initialized with a flags payload of the given `GType`. */
function newFromFlags(gtype: GType, value: number): GValue {
    return initValue(gtype, (v) => v.setFlags(value));
}

function resolveBoxedGtype(ffiType: FfiType): GType {
    if (ffiType.type === "boxed") {
        if (ffiType.getTypeFn && ffiType.library) {
            return gtypeFromFfi(call(ffiType.library, ffiType.getTypeFn, [], t.uint64));
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

function newFromEnumOrFlagsFfi(ffiType: FfiEnumOrFlagsType, value: unknown): GValue {
    const gtype = gtypeFromFfi(call(ffiType.library, ffiType.getTypeFn, [], t.uint64));
    if (ffiType.type === "flags" || typeFundamental(gtype) === TYPE_FLAGS) {
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
        case "bigint64":
            return newFromBigInt64(value as bigint | number);
        case "biguint64":
            return newFromBigUint64(value as bigint | number);
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
 * Builds a `GValue` from a fundamental FFI descriptor. The descriptor's `GType`
 * is resolved and routed through the {@link getFundamentalMarshallers} table, so
 * a `GParamSpec` marshals via `g_value_set_param`, a `GVariant` via the variant
 * marshaller, and so on; a fundamental whose `GType` is a boxed type falls back
 * to the boxed marshaller.
 */
function newFromFundamentalFfi(ffiType: FfiFundamentalType, value: unknown): GValue {
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
function emptyValue(gtype: GType): GValue {
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
            return gtypeFromFfi(call(ffiType.library, ffiType.getTypeFn, [], t.uint64));
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
export function emptyValueFromFfi(ffiType: FfiType): GValue {
    return emptyValue(gtypeFromFfiType(ffiType));
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
 * Both directions dispatch through it: {@link newFromFundamentalFfi} reads each
 * entry's `to` when an FFI descriptor's `GType` names a fundamental, and
 * `valueToJS` reads its `from`. Supporting a new fundamental — or correcting how
 * an existing one is marshalled — is a one-line edit here rather than a change
 * spread across parallel write and read structures.
 *
 * Built lazily because every key is a `TYPE_*` fundamental constant whose GType
 * is itself resolved on first access.
 */
export function getFundamentalMarshallers(): Map<GType, FundamentalMarshaller> {
    fundamentalMarshallers ??= new Map<GType, FundamentalMarshaller>([
        [TYPE_BOOLEAN, { to: (_g, v) => newFromBoolean(v as boolean), from: (v) => v.getBoolean() }],
        [TYPE_INT, { to: (_g, v) => newFromInt(v as number), from: (v) => v.getInt() }],
        [TYPE_UINT, { to: (_g, v) => newFromUint(v as number), from: (v) => v.getUint() }],
        [TYPE_LONG, { to: (_g, v) => newFromLong(v as number), from: (v) => v.getLong() }],
        [TYPE_ULONG, { to: (_g, v) => newFromUlong(v as number), from: (v) => v.getUlong() }],
        [TYPE_INT64, { to: (_g, v) => newFromInt64(v as number), from: (v) => v.getInt64() }],
        [TYPE_UINT64, { to: (_g, v) => newFromUint64(v as number), from: (v) => v.getUint64() }],
        [TYPE_FLOAT, { to: (_g, v) => newFromFloat(v as number), from: (v) => v.getFloat() }],
        [TYPE_DOUBLE, { to: (_g, v) => newFromDouble(v as number), from: (v) => v.getDouble() }],
        [TYPE_STRING, { to: (_g, v) => newFromString(v as string | null), from: (v) => v.getString() }],
        [TYPE_CHAR, { to: (g, v) => initValue(g, (val) => val.setSchar(v as number)), from: (v) => v.getSchar() }],
        [TYPE_UCHAR, { to: (g, v) => initValue(g, (val) => val.setUchar(v as number)), from: (v) => v.getUchar() }],
        [TYPE_ENUM, { to: (g, v) => newFromEnum(g, v as number), from: (v) => v.getEnum() }],
        [TYPE_FLAGS, { to: (g, v) => newFromFlags(g, v as number), from: (v) => v.getFlags() }],
        [TYPE_OBJECT, { to: (_g, v) => valueFromObject(v as object | null), from: (v) => v.getObject() }],
        [TYPE_VARIANT, { to: (_g, v) => newFromVariant(v as object), from: (v) => v.getVariant() }],
        [
            TYPE_PARAM,
            { to: (g, v) => initValue(g, (val) => val.setParam(v as object | null)), from: (v) => v.getParam() },
        ],
    ]);
    return fundamentalMarshallers;
}

const gValueInit = t.bind(LIBGOBJECT, "g_value_init", [{ type: GVALUE_BORROWED }, { type: t.uint64 }], t.void);
const gValueSetPointer = t.bind(
    LIBGOBJECT,
    "g_value_set_pointer",
    [{ type: GVALUE_BORROWED }, { type: t.uint64 }],
    t.void,
);

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

const gValueSetBoolean = t.bind(
    LIBGOBJECT,
    "g_value_set_boolean",
    [{ type: GVALUE_BORROWED }, { type: t.boolean }],
    t.void,
);
const gValueGetBoolean = t.bind(LIBGOBJECT, "g_value_get_boolean", [{ type: GVALUE_BORROWED }], t.boolean);
const gValueSetInt = t.bind(LIBGOBJECT, "g_value_set_int", [{ type: GVALUE_BORROWED }, { type: t.int32 }], t.void);
const gValueGetInt = t.bind(LIBGOBJECT, "g_value_get_int", [{ type: GVALUE_BORROWED }], t.int32);
const gValueSetUint = t.bind(LIBGOBJECT, "g_value_set_uint", [{ type: GVALUE_BORROWED }, { type: t.uint32 }], t.void);
const gValueGetUint = t.bind(LIBGOBJECT, "g_value_get_uint", [{ type: GVALUE_BORROWED }], t.uint32);
const gValueSetLong = t.bind(LIBGOBJECT, "g_value_set_long", [{ type: GVALUE_BORROWED }, { type: t.int64 }], t.void);
const gValueGetLong = t.bind(LIBGOBJECT, "g_value_get_long", [{ type: GVALUE_BORROWED }], t.int64);
const gValueSetUlong = t.bind(LIBGOBJECT, "g_value_set_ulong", [{ type: GVALUE_BORROWED }, { type: t.uint64 }], t.void);
const gValueGetUlong = t.bind(LIBGOBJECT, "g_value_get_ulong", [{ type: GVALUE_BORROWED }], t.uint64);
const gValueSetInt64 = t.bind(LIBGOBJECT, "g_value_set_int64", [{ type: GVALUE_BORROWED }, { type: t.int64 }], t.void);
const gValueGetInt64 = t.bind(LIBGOBJECT, "g_value_get_int64", [{ type: GVALUE_BORROWED }], t.int64);
const gValueSetUint64 = t.bind(
    LIBGOBJECT,
    "g_value_set_uint64",
    [{ type: GVALUE_BORROWED }, { type: t.uint64 }],
    t.void,
);
const gValueGetUint64 = t.bind(LIBGOBJECT, "g_value_get_uint64", [{ type: GVALUE_BORROWED }], t.uint64);
const gValueSetFloat = t.bind(
    LIBGOBJECT,
    "g_value_set_float",
    [{ type: GVALUE_BORROWED }, { type: t.float32 }],
    t.void,
);
const gValueGetFloat = t.bind(LIBGOBJECT, "g_value_get_float", [{ type: GVALUE_BORROWED }], t.float32);
const gValueSetDouble = t.bind(
    LIBGOBJECT,
    "g_value_set_double",
    [{ type: GVALUE_BORROWED }, { type: t.float64 }],
    t.void,
);
const gValueGetDouble = t.bind(LIBGOBJECT, "g_value_get_double", [{ type: GVALUE_BORROWED }], t.float64);
const gValueSetString = t.bind(
    LIBGOBJECT,
    "g_value_set_string",
    [{ type: GVALUE_BORROWED }, { type: t.string("borrowed") }],
    t.void,
);
const gValueGetString = t.bind(LIBGOBJECT, "g_value_get_string", [{ type: GVALUE_BORROWED }], t.string("borrowed"));
const gValueSetSchar = t.bind(LIBGOBJECT, "g_value_set_schar", [{ type: GVALUE_BORROWED }, { type: t.int8 }], t.void);
const gValueGetSchar = t.bind(LIBGOBJECT, "g_value_get_schar", [{ type: GVALUE_BORROWED }], t.int8);
const gValueSetUchar = t.bind(LIBGOBJECT, "g_value_set_uchar", [{ type: GVALUE_BORROWED }, { type: t.uint8 }], t.void);
const gValueGetUchar = t.bind(LIBGOBJECT, "g_value_get_uchar", [{ type: GVALUE_BORROWED }], t.uint8);
const gValueSetEnum = t.bind(LIBGOBJECT, "g_value_set_enum", [{ type: GVALUE_BORROWED }, { type: t.int32 }], t.void);
const gValueGetEnum = t.bind(LIBGOBJECT, "g_value_get_enum", [{ type: GVALUE_BORROWED }], t.int32);
const gValueSetFlags = t.bind(LIBGOBJECT, "g_value_set_flags", [{ type: GVALUE_BORROWED }, { type: t.uint32 }], t.void);
const gValueGetFlags = t.bind(LIBGOBJECT, "g_value_get_flags", [{ type: GVALUE_BORROWED }], t.uint32);
const gValueSetObject = t.bind(
    LIBGOBJECT,
    "g_value_set_object",
    [{ type: GVALUE_BORROWED }, { type: t.object("borrowed") }],
    t.void,
);
const gValueGetObject = t.bind(LIBGOBJECT, "g_value_get_object", [{ type: GVALUE_BORROWED }], t.object("borrowed"));

const PARAM_FUNDAMENTAL = t.fundamental(LIBGOBJECT, "g_param_spec_ref", "g_param_spec_unref", {
    ownership: "borrowed",
    typeName: "GParam",
});
const gValueSetParam = t.bind(
    LIBGOBJECT,
    "g_value_set_param",
    [{ type: GVALUE_BORROWED }, { type: PARAM_FUNDAMENTAL }],
    t.void,
);
const gValueGetParam = t.bind(LIBGOBJECT, "g_value_get_param", [{ type: GVALUE_BORROWED }], PARAM_FUNDAMENTAL);

const VARIANT_FUNDAMENTAL = t.fundamental("libgobject-2.0.so.0,libglib-2.0.so.0", "g_variant_ref", "g_variant_unref", {
    ownership: "borrowed",
    typeName: "GVariant",
});
const gValueSetVariant = t.bind(
    LIBGOBJECT,
    "g_value_set_variant",
    [{ type: GVALUE_BORROWED }, { type: VARIANT_FUNDAMENTAL }],
    t.void,
);
const gValueGetVariant = t.bind(LIBGOBJECT, "g_value_get_variant", [{ type: GVALUE_BORROWED }], VARIANT_FUNDAMENTAL);

/**
 * Low-level wrapper over a freshly allocated `GValue` struct.
 *
 * Mirrors the subset of the generated `GObject.Value` surface the runtime
 * marshalling layer relies on, but binds every accessor through raw FFI so it
 * carries no generated dependency. Boxed access is intentionally absent: the
 * registry-aware boxed marshalling lives in `./gvalue.js` and reads the handle
 * directly.
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

/** Storage size, in bytes, of a single out-parameter cell (a pointer or any scalar). */
const OUT_PARAM_STORAGE_SIZE = 8;

/**
 * Builds the `G_TYPE_POINTER` GValue a signal out-parameter is emitted through,
 * paired with a reader for the value a handler writes back.
 *
 * `g_signal_emitv` hands the pointer payload to handlers as the out-parameter's
 * `T*`, so a handler writes into the freshly allocated storage; the returned
 * {@link read} unmarshals that storage with `innerFfi`. The `initial` value
 * seeds the storage for inout parameters, where the handler both reads the
 * incoming value and overwrites it.
 *
 * @param innerFfi - FFI descriptor of the pointed-to value (the `t.ref` inner type).
 * @param initial - Seed written before emission, for inout parameters.
 */
export function outValueFromFfi(innerFfi: FfiType, initial?: unknown): { value: GValue; read: () => unknown } {
    const storage = alloc(OUT_PARAM_STORAGE_SIZE);
    write(storage, t.uint64, 0, 0);
    if (initial !== undefined) write(storage, innerFfi, 0, initial);
    const value = new GValue();
    value.init(TYPE_POINTER);
    setGValuePointer(value, storage);
    return { value, read: () => read(storage, innerFfi, 0) };
}

const gValueGetBoxedStrv = t.bind(
    LIBGOBJECT,
    "g_value_get_boxed",
    [{ type: GVALUE_BORROWED }],
    t.array(t.string("borrowed")),
);

const gValueGetInt64Big = t.bind(LIBGOBJECT, "g_value_get_int64", [{ type: GVALUE_BORROWED }], t.bigint64);

const gValueGetUint64Big = t.bind(LIBGOBJECT, "g_value_get_uint64", [{ type: GVALUE_BORROWED }], t.biguint64);

/**
 * Reads a 64-bit `GValue` payload as a `bigint` when the property's FFI
 * descriptor declares a bigint representation, or `undefined` when it does
 * not and the fundamental-keyed {@link valueToJS} path applies.
 */
function bigintValueToJS(ffiType: FfiType, value: GValue): bigint | undefined {
    if (ffiType.type === "bigint64") return gValueGetInt64Big(getHandle(value)) as bigint;
    if (ffiType.type === "biguint64") return gValueGetUint64Big(getHandle(value)) as bigint;
    return undefined;
}

const valueGetStrv = (value: object): string[] => (gValueGetBoxedStrv(getHandle(value)) as string[] | null) ?? [];

const valueFromFundamental = (value: GValueReader, fundamental: GType): unknown => {
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
 * @param value - The `GValue` to unmarshal (the hand-written wrapper or the
 *   public generated `GObject.Value`).
 * @throws if the GValue holds an unsupported or unregistered type.
 */
export function valueToJS(value: GValueReader): unknown {
    const gtype = valueGetType(value);

    if (gtype === getStrvGtype()) return valueGetStrv(value);

    const fundamental = typeFundamental(gtype);
    const fundamentalValue = valueFromFundamental(value, fundamental);
    if (fundamentalValue !== undefined) return fundamentalValue;

    if (fundamental === TYPE_POINTER) return getPointerValue(getHandle(value));
    if (fundamental === TYPE_BOXED) return getGvalueBoxed(value);

    throw new Error(`Unsupported GType for valueToJS: ${typeName(gtype) ?? String(gtype)}`);
}

const PROPERTY_CALL_ARGS = [
    { type: t.object("borrowed") },
    { type: t.string("borrowed") },
    { type: GVALUE_BORROWED },
] as const;

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
    gObjectGetProperty(getHandle(obj), propertyName, getHandle(value));
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
    gObjectSetProperty(getHandle(obj), propertyName, getHandle(valueFromFfi(ffiType, jsValue)));
}

type ArrayFfiType = Extract<FfiType, { type: "array" }>;

/**
 * Whether a value of this FFI descriptor is transformed on the way out, as
 * opposed to passing through unchanged. Primitives, enums, flags, strings, and
 * raw buffers are passthrough; object, boxed, struct, fundamental, collection,
 * and hash-table values are lifted into wrappers. Used to skip the per-element
 * map for a primitive collection, which would otherwise reallocate the array.
 */
const isWrappedKind = (ffiType: FfiType): boolean => {
    switch (ffiType.type) {
        case "gobject":
        case "boxed":
        case "struct":
        case "fundamental":
        case "array":
        case "hashtable":
            return true;
        default:
            return false;
    }
};

const wrapCollection = (ffiType: ArrayFfiType, value: unknown, elementClass: AnyClass | undefined): unknown => {
    if (value === null) return null;
    if (ffiType.kind === "gbytearray") return value;
    if (!isWrappedKind(ffiType.itemType)) return value;
    return (value as unknown[]).map((item) => wrapValue(ffiType.itemType, item, elementClass));
};

type GObjectFfiType = Extract<FfiType, { type: "gobject" }>;

const interfaceClassByDescriptor = new WeakMap<FfiType, AnyClass>();

/**
 * Lifts a `GObject` value. A descriptor naming an interface resolves that
 * interface's wrapper class from the registry — caching it per descriptor — so
 * the wrapper carries the interface's methods even when the runtime instance is
 * a private, unregistered implementation; a concrete-class or untyped descriptor
 * self-resolves from the handle's runtime `GType`. An explicit `targetClass`
 * takes precedence.
 */
const wrapGObjectValue = (
    ffiType: GObjectFfiType,
    value: Handle | null,
    targetClass: AnyClass | undefined,
): object | null => {
    if (targetClass !== undefined) return wrapHandle(value, targetClass);
    if (ffiType.typeName === undefined) return wrapHandle(value, undefined);
    let cls = interfaceClassByDescriptor.get(ffiType);
    if (cls === undefined) {
        const resolved = getInterfaceWrapperClass(typeFromName(ffiType.typeName));
        if (resolved === null) return wrapHandle(value, undefined);
        interfaceClassByDescriptor.set(ffiType, resolved);
        cls = resolved;
    }
    return wrapHandle(value, cls);
};

const boxedGtypeByDescriptor = new WeakMap<FfiType, GType>();

/**
 * Lifts a boxed or named-fundamental value whose FFI descriptor identifies its
 * `GType`, resolving the wrapper class from the registry and caching the
 * resolved `GType` per descriptor so the lookup is paid once per binding. When
 * the binding supplies an explicit fallback class — a plain struct, or a
 * fundamental with no registered GLib type name — that class is used directly.
 */
const wrapBoxedValue = (ffiType: FfiType, value: Handle | null, targetClass: AnyClass | undefined): object | null => {
    if (value === null) return null;
    if (targetClass !== undefined) return wrapHandle(value, targetClass);
    let gtype = boxedGtypeByDescriptor.get(ffiType);
    if (gtype === undefined) {
        gtype = resolveBoxedGtype(ffiType);
        boxedGtypeByDescriptor.set(ffiType, gtype);
    }
    const cls = getWrapperClass(gtype);
    if (cls === null) {
        throw new Error(`wrapValue: no registered wrapper class for boxed GType '${typeName(gtype) ?? String(gtype)}'`);
    }
    return wrapHandle(value, cls);
};

/**
 * Lifts a raw FFI value into its typed JavaScript form.
 *
 * @param ffiType - The value's FFI type descriptor.
 * @param value - The raw value the native call produced.
 * @param targetClass - The fallback wrapper class for a plain struct or a
 *   GType-less fundamental, or the element wrapper for a collection. Omitted for
 *   GObjects and boxed or named-fundamental values, which self-resolve from their
 *   descriptor's `GType`, and for primitives, enums, flags, and strings.
 * @returns The wrapped JavaScript value.
 */
export function wrapValue(ffiType: FfiType, value: unknown, targetClass?: AnyClass): unknown {
    switch (ffiType.type) {
        case "boolean":
            return Boolean(value);
        case "gobject":
            return wrapGObjectValue(ffiType, value as Handle | null, targetClass);
        case "struct":
            return wrapHandle(value as Handle | null, targetClass);
        case "boxed":
        case "fundamental":
            return wrapBoxedValue(ffiType, value as Handle | null, targetClass);
        case "array":
            return wrapCollection(ffiType, value, targetClass);
        case "hashtable":
            return value === null ? null : new Map(value as Iterable<readonly [unknown, unknown]>);
        default:
            return value;
    }
}
