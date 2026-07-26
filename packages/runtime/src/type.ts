import { type Descriptor, resolveType as nativeResolveType } from "@gtkx/native";
import { bind } from "./bind.js";
import {
    type ArrayDescriptor,
    biguint64T,
    booleanT,
    type BoxedDescriptor,
    type FundamentalDescriptor,
    refT,
    sizedArrayT,
    stringT,
    uint32T,
} from "./descriptors.js";
import { LIB } from "./library.js";

/** Object tagged with its GLib type through a `_type_` GType field. */
export type TypedClass = {
    _type_: bigint;
};

const resolvedTypeCache: Map<string, bigint> = new Map();

const gTypeFromName = bind(LIB, "g_type_from_name", [stringT("borrowed")], biguint64T);
const gTypeIsA = bind(LIB, "g_type_is_a", [biguint64T, biguint64T], booleanT);
const gTypeParent = bind(LIB, "g_type_parent", [biguint64T], biguint64T);
const gTypeFundamental = bind(LIB, "g_type_fundamental", [biguint64T], biguint64T);
const gTypeName = bind(LIB, "g_type_name", [biguint64T], stringT("borrowed"));
const gTypeInterfaces = bind(LIB, "g_type_interfaces", [biguint64T, refT(uint32T)], sizedArrayT(biguint64T, 1, "full"));

const lazyType = (name: string): (() => bigint) => {
    let cached: bigint | undefined;
    return () => {
        cached ??= typeFromName(name);
        return cached;
    };
};

export const isTypedClass = (value: unknown): value is TypedClass =>
    typeof value === "object" && value !== null && "_type_" in value && typeof value._type_ === "bigint";

/** GType tag for an invalid or uninitialized type. */
export const TYPE_INVALID = 0n;
/** GType tag for the absence of a value (`void`). */
export const TYPE_NONE: bigint = typeFromName("void");
/** GType tag for the base GInterface type. */
export const TYPE_INTERFACE: bigint = typeFromName("GInterface");
/** GType tag for `gchar` (signed 8-bit integer). */
export const TYPE_CHAR: bigint = typeFromName("gchar");
/** GType tag for `guchar` (unsigned 8-bit integer). */
export const TYPE_UCHAR: bigint = typeFromName("guchar");
/** GType tag for `gboolean`. */
export const TYPE_BOOLEAN: bigint = typeFromName("gboolean");
/** GType tag for `gint`. */
export const TYPE_INT: bigint = typeFromName("gint");
/** GType tag for `guint`. */
export const TYPE_UINT: bigint = typeFromName("guint");
/** GType tag for `glong`. */
export const TYPE_LONG: bigint = typeFromName("glong");
/** GType tag for `gulong`. */
export const TYPE_ULONG: bigint = typeFromName("gulong");
/** GType tag for `gint64`. */
export const TYPE_INT64: bigint = typeFromName("gint64");
/** GType tag for `guint64`. */
export const TYPE_UINT64: bigint = typeFromName("guint64");
/** GType tag for the base GEnum type. */
export const TYPE_ENUM: bigint = typeFromName("GEnum");
/** GType tag for the base GFlags type. */
export const TYPE_FLAGS: bigint = typeFromName("GFlags");
/** GType tag for `gfloat`. */
export const TYPE_FLOAT: bigint = typeFromName("gfloat");
/** GType tag for `gdouble`. */
export const TYPE_DOUBLE: bigint = typeFromName("gdouble");
/** GType tag for `gchararray` (a nul-terminated C string). */
export const TYPE_STRING: bigint = typeFromName("gchararray");
/** GType tag for `gpointer` (an opaque pointer). */
export const TYPE_POINTER: bigint = typeFromName("gpointer");
/** GType tag for the base GBoxed type. */
export const TYPE_BOXED: bigint = typeFromName("GBoxed");
/** GType tag for the base GParam type. */
export const TYPE_PARAM: bigint = typeFromName("GParam");
/** GType tag for the base GObject type. */
export const TYPE_OBJECT: bigint = typeFromName("GObject");
/** GType tag for a GType value itself. */
export const TYPE_GTYPE: bigint = typeFromName("GType");
/** GType tag for GVariant. */
export const TYPE_VARIANT: bigint = typeFromName("GVariant");
/** GType tag for a Unicode character stored as `guint`. */
export const TYPE_UNICHAR: bigint = typeFromName("guint");
export const getErrorType: () => bigint = lazyType("GError");
export const getStrvType: () => bigint = lazyType("GStrv");

/** Returns whether `type` is `isAType` or descends from it. */
export function typeIsA(type: bigint, isAType: bigint): boolean {
    return gTypeIsA(type, isAType) as boolean;
}

/** Returns the immediate parent GType of the given type. */
export function typeParent(type: bigint): bigint {
    return gTypeParent(type) as bigint;
}

/** Returns the GTypes of the interfaces implemented by the given type. */
export function typeInterfaces(type: bigint): bigint[] {
    const nInterfacesRef = { value: 0 };
    return gTypeInterfaces(type, nInterfacesRef) as bigint[];
}

/** Returns the GType registered under the given name, or `TYPE_INVALID` if none exists. */
export function typeFromName(name: string): bigint {
    return gTypeFromName(name) as bigint;
}

export function typeFundamental(type: bigint): bigint {
    return gTypeFundamental(type) as bigint;
}

/** Returns the registered name of a GType, or null if it has none. */
export function typeName(type: bigint): string | null {
    return (gTypeName(type) ?? null) as string | null;
}

/** Returns whether `value` is a typed wrapper whose GType is or descends from `gtype`. */
export function valueIsA(value: unknown, gtype: bigint): boolean {
    return isTypedClass(value) && typeIsA(value._type_, gtype);
}

/**
 * Resolves the GType produced by a `get_type` function in a shared library, caching
 * the result per library and function name.
 * @param sharedLibrary Path or name of the shared library exporting the function.
 * @param typeFnName Name of the `*_get_type` function to call.
 */
export const resolveType = (sharedLibrary: string, typeFnName: string): bigint => {
    const key = `${sharedLibrary}:${typeFnName}`;
    const cached = resolvedTypeCache.get(key);
    if (cached !== undefined) return cached;
    const gtype = nativeResolveType(sharedLibrary, typeFnName);
    resolvedTypeCache.set(key, gtype);
    return gtype;
};

export const resolveBoxedType = (descriptor: BoxedDescriptor): bigint => {
    if (descriptor.getTypeFnName && descriptor.sharedLibrary) {
        return resolveType(descriptor.sharedLibrary, descriptor.getTypeFnName);
    }
    const gtype = typeFromName(descriptor.typeName);
    if (gtype === TYPE_INVALID) {
        throw new Error(`Cannot resolve gtype for boxed type '${descriptor.typeName}'`);
    }
    return gtype;
};

export const resolveFundamentalType = (descriptor: FundamentalDescriptor): bigint => {
    if (descriptor.typeName) {
        const gtype = typeFromName(descriptor.typeName);
        if (gtype !== TYPE_INVALID) return gtype;
    }
    throw new Error("Cannot resolve gtype for fundamental type without a typeName");
};

function resolveArrayType(descriptor: ArrayDescriptor): bigint {
    if (descriptor.itemDescriptor.kind === "string" && descriptor.arrayKind === "array") return getStrvType();
    throw new Error(`Unsupported array type ${descriptor.arrayKind} of ${descriptor.itemDescriptor.kind}`);
}

const PLAIN_DESCRIPTOR_TYPES: Partial<Record<Descriptor["kind"], bigint>> = {
    boolean: TYPE_BOOLEAN,
    string: TYPE_STRING,
    int8: TYPE_INT,
    int16: TYPE_INT,
    int32: TYPE_INT,
    uint8: TYPE_UINT,
    uint16: TYPE_UINT,
    uint32: TYPE_UINT,
    int64: TYPE_INT64,
    bigint64: TYPE_INT64,
    uint64: TYPE_UINT64,
    biguint64: TYPE_UINT64,
    float32: TYPE_FLOAT,
    float64: TYPE_DOUBLE,
    object: TYPE_OBJECT,
};

export function resolveDescriptorType(descriptor: Descriptor): bigint {
    if (descriptor.kind === "biguint64" && "type" in descriptor) return TYPE_GTYPE;
    const plain = PLAIN_DESCRIPTOR_TYPES[descriptor.kind];
    if (plain !== undefined) return plain;
    switch (descriptor.kind) {
        case "enum":
        case "flags": {
            return resolveType(descriptor.sharedLibrary, descriptor.getTypeFnName);
        }
        case "boxed": {
            return resolveBoxedType(descriptor);
        }
        case "fundamental": {
            return resolveFundamentalType(descriptor);
        }
        case "array": {
            return resolveArrayType(descriptor);
        }
        default: {
            throw new Error(`Unsupported type descriptor '${descriptor.kind}'`);
        }
    }
}
