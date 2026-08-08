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

/** Object tagged with its GLib type through a `__type__` GType field. */
type TypedClass = {
    /** GType the object's class is registered under. */
    __type__: bigint;
};

type ResolvableKind = "enum" | "flags" | "boxed" | "fundamental" | "array";
type ResolvableDescriptor = Extract<Descriptor, { kind: ResolvableKind }>;

const resolvedTypeCache: Map<string, bigint> = new Map();
const gTypeFromName = bind(LIB, "g_type_from_name", [stringT("borrowed")], biguint64T);
const gTypeIsA = bind(LIB, "g_type_is_a", [biguint64T, biguint64T], booleanT);
const gTypeParent = bind(LIB, "g_type_parent", [biguint64T], biguint64T);
const gTypeFundamental = bind(LIB, "g_type_fundamental", [biguint64T], biguint64T);
const gTypeName = bind(LIB, "g_type_name", [biguint64T], stringT("borrowed"));
const gTypeInterfaces = bind(LIB, "g_type_interfaces", [biguint64T, refT(uint32T)], sizedArrayT(biguint64T, 1, "full"));
/** GType tag for an invalid or uninitialized type. */
const TYPE_INVALID = 0n;
/** GType tag for the absence of a value (`void`). */
const TYPE_NONE: bigint = typeFromName("void");
/** GType tag for the base GInterface type. */
const TYPE_INTERFACE: bigint = typeFromName("GInterface");
/** GType tag for `gchar` (signed 8-bit integer). */
const TYPE_CHAR: bigint = typeFromName("gchar");
/** GType tag for `guchar` (unsigned 8-bit integer). */
const TYPE_UCHAR: bigint = typeFromName("guchar");
/** GType tag for `gboolean`. */
const TYPE_BOOLEAN: bigint = typeFromName("gboolean");
/** GType tag for `gint`. */
const TYPE_INT: bigint = typeFromName("gint");
/** GType tag for `guint`. */
const TYPE_UINT: bigint = typeFromName("guint");
/** GType tag for `glong`. */
const TYPE_LONG: bigint = typeFromName("glong");
/** GType tag for `gulong`. */
const TYPE_ULONG: bigint = typeFromName("gulong");
/** GType tag for `gint64`. */
const TYPE_INT64: bigint = typeFromName("gint64");
/** GType tag for `guint64`. */
const TYPE_UINT64: bigint = typeFromName("guint64");
/** GType tag for the base GEnum type. */
const TYPE_ENUM: bigint = typeFromName("GEnum");
/** GType tag for the base GFlags type. */
const TYPE_FLAGS: bigint = typeFromName("GFlags");
/** GType tag for `gfloat`. */
const TYPE_FLOAT: bigint = typeFromName("gfloat");
/** GType tag for `gdouble`. */
const TYPE_DOUBLE: bigint = typeFromName("gdouble");
/** GType tag for `gchararray` (a nul-terminated C string). */
const TYPE_STRING: bigint = typeFromName("gchararray");
/** GType tag for `gpointer` (an opaque pointer). */
const TYPE_POINTER: bigint = typeFromName("gpointer");
/** GType tag for the base GBoxed type. */
const TYPE_BOXED: bigint = typeFromName("GBoxed");
/** GType tag for the base GParam type. */
const TYPE_PARAM: bigint = typeFromName("GParam");
/** GType tag for the base GObject type. */
const TYPE_OBJECT: bigint = typeFromName("GObject");
/** GType tag for a GType value itself. */
const TYPE_GTYPE: bigint = typeFromName("GType");
/** GType tag for GVariant. */
const TYPE_VARIANT: bigint = typeFromName("GVariant");
/** GType tag for a Unicode character stored as `guint`. */
const TYPE_UNICHAR: bigint = typeFromName("guint");
const getErrorType: () => bigint = lazyType("GError");
const getStrvType: () => bigint = lazyType("GStrv");

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

const RESOLVABLE_DESCRIPTOR_KINDS: Set<Descriptor["kind"]> = new Set<ResolvableKind>([
    "enum",
    "flags",
    "boxed",
    "fundamental",
    "array",
]);

function lazyType(name: string): () => bigint {
    let cached: bigint | undefined;

    return () => {
        cached ??= typeFromName(name);

        return cached;
    };
}

const isTypedClass = (value: unknown): value is TypedClass =>
    typeof value === "object" && value !== null && "__type__" in value && typeof value.__type__ === "bigint";

/** Returns whether `type` is `ancestorType` or descends from it. */
/* eslint-disable-next-line unicorn/consistent-boolean-name -- mirrors g_type_is_a from the C API */
function typeIsA(type: bigint, ancestorType: bigint): boolean {
    return gTypeIsA(type, ancestorType) as boolean;
}

/** Returns the immediate parent GType of the given type. */
function typeParent(type: bigint): bigint {
    return gTypeParent(type) as bigint;
}

/** Returns the GTypes of the interfaces implemented by the given type. */
function typeInterfaces(type: bigint): bigint[] {
    const nInterfacesRef = { value: 0 };

    return gTypeInterfaces(type, nInterfacesRef) as bigint[];
}

/** Returns the GType registered under the given name, or `TYPE_INVALID` if none exists. */
function typeFromName(name: string): bigint {
    return gTypeFromName(name) as bigint;
}

function typeFundamental(type: bigint): bigint {
    return gTypeFundamental(type) as bigint;
}

/** Returns the registered name of a GType, or null if it has none. */
function typeName(type: bigint): string | null {
    return (gTypeName(type) ?? null) as string | null;
}

/** Returns whether `value` is a typed wrapper whose GType is or descends from `gtype`. */
/* eslint-disable-next-line unicorn/consistent-boolean-name -- mirrors g_type_is_a from the C API */
function valueIsA(value: unknown, gtype: bigint): boolean {
    return isTypedClass(value) && typeIsA(value.__type__, gtype);
}

/**
 * Resolves the GType produced by a `get_type` function in a shared library, caching
 * the result per library and function name.
 * @param sharedLibrary Path or name of the shared library exporting the function.
 * @param typeFnName Name of the `*_get_type` function to call.
 */
const resolveType = (sharedLibrary: string, typeFnName: string): bigint => {
    const key = `${sharedLibrary}:${typeFnName}`;
    const cached = resolvedTypeCache.get(key);

    if (cached !== undefined) {
        return cached;
    }

    const gtype = nativeResolveType(sharedLibrary, typeFnName);
    resolvedTypeCache.set(key, gtype);

    return gtype;
};

const resolveBoxedType = (descriptor: BoxedDescriptor): bigint => {
    if (descriptor.getTypeFnName && descriptor.sharedLibrary) {
        return resolveType(descriptor.sharedLibrary, descriptor.getTypeFnName);
    }

    const gtype = typeFromName(descriptor.typeName);

    if (gtype === TYPE_INVALID) {
        throw new Error(`Cannot resolve gtype for boxed type '${descriptor.typeName}'`);
    }

    return gtype;
};

const resolveFundamentalType = (descriptor: FundamentalDescriptor): bigint => {
    if (descriptor.typeName) {
        const gtype = typeFromName(descriptor.typeName);

        if (gtype !== TYPE_INVALID) {
            return gtype;
        }
    }

    throw new Error("Cannot resolve gtype for fundamental type without a typeName");
};

function resolveArrayType(descriptor: ArrayDescriptor): bigint {
    if (descriptor.itemDescriptor.kind === "string" && descriptor.arrayKind === "array") {
        return getStrvType();
    }

    throw new Error(`Unsupported array type ${descriptor.arrayKind} of ${descriptor.itemDescriptor.kind}`);
}

function isResolvableDescriptor(descriptor: Descriptor): descriptor is ResolvableDescriptor {
    return RESOLVABLE_DESCRIPTOR_KINDS.has(descriptor.kind);
}

function resolveDescriptorType(descriptor: Descriptor): bigint {
    if (descriptor.kind === "biguint64" && "type" in descriptor) {
        return TYPE_GTYPE;
    }

    const plain = PLAIN_DESCRIPTOR_TYPES[descriptor.kind];

    if (plain !== undefined) {
        return plain;
    }

    if (!isResolvableDescriptor(descriptor)) {
        throw new Error(`Unsupported type descriptor '${descriptor.kind}'`);
    }

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
    }
}

export {
    TYPE_INVALID,
    TYPE_NONE,
    TYPE_INTERFACE,
    TYPE_CHAR,
    TYPE_UCHAR,
    TYPE_BOOLEAN,
    TYPE_INT,
    TYPE_UINT,
    TYPE_LONG,
    TYPE_ULONG,
    TYPE_INT64,
    TYPE_UINT64,
    TYPE_ENUM,
    TYPE_FLAGS,
    TYPE_FLOAT,
    TYPE_DOUBLE,
    TYPE_STRING,
    TYPE_POINTER,
    TYPE_BOXED,
    TYPE_PARAM,
    TYPE_OBJECT,
    TYPE_GTYPE,
    TYPE_VARIANT,
    TYPE_UNICHAR,
    getErrorType,
    getStrvType,
    isResolvableDescriptor,
    isTypedClass,
    typeIsA,
    typeParent,
    typeInterfaces,
    typeFromName,
    typeFundamental,
    typeName,
    valueIsA,
    resolveType,
    resolveBoxedType,
    resolveFundamentalType,
    resolveDescriptorType,
    type TypedClass,
};
