import { type Descriptor, resolveType as nativeResolveType } from "@gtkx/native";
import { bind } from "./bind.js";
import {
    type BoxedDescriptor,
    biguint64T,
    booleanT,
    type FundamentalDescriptor,
    refT,
    sizedArrayT,
    stringT,
    uint32T,
} from "./descriptors.js";
import { LIB } from "./library.js";

export type TypedClass = {
    __type__: bigint;
};

const resolvedTypeCache = new Map<string, bigint>();

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
    typeof value === "object" && value !== null && "__type__" in value && typeof value.__type__ === "bigint";

export const TYPE_INVALID: bigint = 0n;
export const TYPE_NONE: bigint = typeFromName("void");
export const TYPE_INTERFACE: bigint = typeFromName("GInterface");
export const TYPE_CHAR: bigint = typeFromName("gchar");
export const TYPE_UCHAR: bigint = typeFromName("guchar");
export const TYPE_BOOLEAN: bigint = typeFromName("gboolean");
export const TYPE_INT: bigint = typeFromName("gint");
export const TYPE_UINT: bigint = typeFromName("guint");
export const TYPE_LONG: bigint = typeFromName("glong");
export const TYPE_ULONG: bigint = typeFromName("gulong");
export const TYPE_INT64: bigint = typeFromName("gint64");
export const TYPE_UINT64: bigint = typeFromName("guint64");
export const TYPE_ENUM: bigint = typeFromName("GEnum");
export const TYPE_FLAGS: bigint = typeFromName("GFlags");
export const TYPE_FLOAT: bigint = typeFromName("gfloat");
export const TYPE_DOUBLE: bigint = typeFromName("gdouble");
export const TYPE_STRING: bigint = typeFromName("gchararray");
export const TYPE_POINTER: bigint = typeFromName("gpointer");
export const TYPE_BOXED: bigint = typeFromName("GBoxed");
export const TYPE_PARAM: bigint = typeFromName("GParam");
export const TYPE_OBJECT: bigint = typeFromName("GObject");
export const TYPE_GTYPE: bigint = typeFromName("GType");
export const TYPE_VARIANT: bigint = typeFromName("GVariant");
export const TYPE_UNICHAR: bigint = typeFromName("guint");
export const getErrorType: () => bigint = lazyType("GError");
export const getStrvType: () => bigint = lazyType("GStrv");

export function typeIsA(type: bigint, isAType: bigint): boolean {
    return gTypeIsA(type, isAType) as boolean;
}

export function typeParent(type: bigint): bigint {
    return gTypeParent(type) as bigint;
}

export function typeInterfaces(type: bigint): bigint[] {
    const nInterfacesRef = { value: 0 };
    return gTypeInterfaces(type, nInterfacesRef) as bigint[];
}

export function typeFromName(name: string): bigint {
    return gTypeFromName(name) as bigint;
}

export function typeFundamental(type: bigint): bigint {
    return gTypeFundamental(type) as bigint;
}

export function typeName(type: bigint): string | null {
    return (gTypeName(type) ?? null) as string | null;
}

export function valueIsA(value: unknown, gtype: bigint): boolean {
    return isTypedClass(value) && typeIsA(value.__type__, gtype);
}

export const resolveType = (sharedLibrary: string, getTypeFnName: string): bigint => {
    const key = `${sharedLibrary}:${getTypeFnName}`;
    const cached = resolvedTypeCache.get(key);
    if (cached !== undefined) return cached;
    const gtype = nativeResolveType(sharedLibrary, getTypeFnName);
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
    throw new Error(`Cannot resolve gtype for fundamental type without a typeName`);
};

export function resolveDescriptorType(descriptor: Descriptor): bigint {
    if (descriptor.kind === "biguint64" && "type" in descriptor) return TYPE_GTYPE;
    switch (descriptor.kind) {
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
        case "object":
            return TYPE_OBJECT;
        case "enum":
        case "flags":
            return resolveType(descriptor.sharedLibrary, descriptor.getTypeFnName);
        case "boxed":
            return resolveBoxedType(descriptor);
        case "fundamental":
            return resolveFundamentalType(descriptor);
        case "array":
            if (descriptor.itemDescriptor.kind === "string" && descriptor.arrayKind === "array") return getStrvType();
            throw new Error(`Unsupported array type ${descriptor.arrayKind} of ${descriptor.itemDescriptor.kind}`);
        default:
            throw new Error(`Unsupported type descriptor '${descriptor.kind}'`);
    }
}
