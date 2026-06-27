import { LIB } from "./constants.js";
import { biguint64T, bind, booleanT, refT, sizedArrayT, stringT, uint32T } from "./descriptors.js";

export type GTyped = {
    __gtype__: bigint;
};

export const isGtyped = (value: unknown): value is GTyped =>
    typeof value === "object" && value !== null && "__gtype__" in value && typeof value.__gtype__ === "bigint";

const lazyGtype = (name: string): (() => bigint) => {
    let cached: bigint | undefined;
    return () => {
        cached ??= typeFromName(name);
        return cached;
    };
};

const gTypeFromName = bind(LIB, "g_type_from_name", [stringT("borrowed")], biguint64T);
const gTypeIsA = bind(LIB, "g_type_is_a", [biguint64T, biguint64T], booleanT);
const gTypeParent = bind(LIB, "g_type_parent", [biguint64T], biguint64T);
const gTypeFundamental = bind(LIB, "g_type_fundamental", [biguint64T], biguint64T);
const gTypeName = bind(LIB, "g_type_name", [biguint64T], stringT("borrowed"));

const gTypeInterfaces = bind(LIB, "g_type_interfaces", [biguint64T, refT(uint32T)], sizedArrayT(biguint64T, 1, "full"));

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

export function valueIsA(value: unknown, gtype: bigint): boolean {
    return isGtyped(value) && typeIsA(value.__gtype__, gtype);
}

export const getErrorGtype: () => bigint = lazyGtype("GError");

export const getStrvGtype: () => bigint = lazyGtype("GStrv");
