import { LIB } from "./constants.js";
import { biguint64T, bind, booleanT, refT, sizedArrayT, stringT, uint32T } from "./descriptors.js";

export type GType = bigint;

export type GTyped = {
    __gtype__: GType;
};

export const isGtyped = (value: unknown): value is GTyped =>
    typeof value === "object" && value !== null && "__gtype__" in value && typeof value.__gtype__ === "bigint";

export const lazyGtype = (name: string): (() => GType) => {
    let cached: GType | undefined;
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

export function typeIsA(type: GType, isAType: GType): boolean {
    return gTypeIsA(type, isAType) as boolean;
}

export function typeParent(type: GType): GType {
    return gTypeParent(type) as GType;
}

export function typeInterfaces(type: GType): GType[] {
    const nInterfacesRef = { value: 0 };
    return gTypeInterfaces(type, nInterfacesRef) as GType[];
}

export function typeFromName(name: string): GType {
    return gTypeFromName(name) as GType;
}

export function typeFundamental(type: GType): GType {
    return gTypeFundamental(type) as GType;
}

export function typeName(type: GType): string | null {
    return (gTypeName(type) ?? null) as string | null;
}

export const TYPE_INVALID: GType = 0n;

export const TYPE_NONE: GType = typeFromName("void");

export const TYPE_INTERFACE: GType = typeFromName("GInterface");

export const TYPE_CHAR: GType = typeFromName("gchar");

export const TYPE_UCHAR: GType = typeFromName("guchar");

export const TYPE_BOOLEAN: GType = typeFromName("gboolean");

export const TYPE_INT: GType = typeFromName("gint");

export const TYPE_UINT: GType = typeFromName("guint");

export const TYPE_LONG: GType = typeFromName("glong");

export const TYPE_ULONG: GType = typeFromName("gulong");

export const TYPE_INT64: GType = typeFromName("gint64");

export const TYPE_UINT64: GType = typeFromName("guint64");

export const TYPE_ENUM: GType = typeFromName("GEnum");

export const TYPE_FLAGS: GType = typeFromName("GFlags");

export const TYPE_FLOAT: GType = typeFromName("gfloat");

export const TYPE_DOUBLE: GType = typeFromName("gdouble");

export const TYPE_STRING: GType = typeFromName("gchararray");

export const TYPE_POINTER: GType = typeFromName("gpointer");

export const TYPE_BOXED: GType = typeFromName("GBoxed");

export const TYPE_PARAM: GType = typeFromName("GParam");

export const TYPE_OBJECT: GType = typeFromName("GObject");

export const TYPE_GTYPE: GType = typeFromName("GType");

export const TYPE_VARIANT: GType = typeFromName("GVariant");

export const TYPE_UNICHAR: GType = typeFromName("guint");

export function valueIsA(value: unknown, gtype: GType): boolean {
    return isGtyped(value) && typeIsA(value.__gtype__, gtype);
}

export const getErrorGtype: () => GType = lazyGtype("GError");

export const getStrvGtype: () => GType = lazyGtype("GStrv");
