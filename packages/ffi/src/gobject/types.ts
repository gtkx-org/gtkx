import { type GType, typeFromName } from "../gtype.js";

const FUNDAMENTAL_TYPE_NAMES = {
    INVALID: "void",
    NONE: "void",
    INTERFACE: "GInterface",
    CHAR: "gchar",
    UCHAR: "guchar",
    BOOLEAN: "gboolean",
    INT: "gint",
    UINT: "guint",
    LONG: "glong",
    ULONG: "gulong",
    INT64: "gint64",
    UINT64: "guint64",
    ENUM: "GEnum",
    FLAGS: "GFlags",
    FLOAT: "gfloat",
    DOUBLE: "gdouble",
    STRING: "gchararray",
    POINTER: "gpointer",
    BOXED: "GBoxed",
    PARAM: "GParam",
    OBJECT: "GObject",
    VARIANT: "GVariant",
} as const;

type FundamentalTypeName = keyof typeof FUNDAMENTAL_TYPE_NAMES;

const resolvedTypes = new Map<string, GType>();

const resolveType = (glibName: string): GType => {
    let gtype = resolvedTypes.get(glibName);
    if (gtype === undefined) {
        gtype = typeFromName(glibName);
        resolvedTypes.set(glibName, gtype);
    }
    return gtype;
};

const typeDescriptors: PropertyDescriptorMap = {};
for (const [name, glibName] of Object.entries(FUNDAMENTAL_TYPE_NAMES)) {
    typeDescriptors[name] = { enumerable: true, get: (): GType => resolveType(glibName) };
}

/**
 * Fundamental GLib type constants.
 *
 * Provides lazy-loaded GType identifiers for primitive and object types.
 * Each member resolves its `g_type_from_name` lookup on first access and
 * memoizes it by GLib type name, so `INVALID` and `NONE` (both `void`)
 * share a single resolution.
 *
 * Use with the `@gtkx/ffi` marshalling helpers that require explicit type
 * specification.
 *
 * @example
 * ```ts
 * import { Type, valueFromJS } from "@gtkx/ffi";
 *
 * const value = valueFromJS(Type.INT, 0);
 * console.log(Type.STRING); // GType for gchararray
 * ```
 */
export const Type: Readonly<Record<FundamentalTypeName, GType>> = Object.freeze(
    Object.defineProperties({} as Record<FundamentalTypeName, GType>, typeDescriptors),
);
