/**
 * Intrinsic (primitive) types that are not namespace-qualified.
 *
 * These are fundamental GLib/GObject types that exist outside of any namespace.
 * When normalizing type references, intrinsic types remain as-is rather than
 * being qualified with a namespace prefix.
 */
export const INTRINSIC_TYPES = new Set([
    "void",
    "none",
    "gboolean",
    "gint",
    "gint8",
    "gint16",
    "gint32",
    "gint64",
    "gchar",
    "gshort",
    "glong",
    "gssize",
    "goffset",
    "gintptr",
    "guint",
    "guint8",
    "guint16",
    "guint32",
    "guint64",
    "guchar",
    "gushort",
    "gulong",
    "gsize",
    "guintptr",
    "gfloat",
    "gdouble",
    "gpointer",
    "gconstpointer",
    "utf8",
    "filename",
    "GType",
    "GParamSpec",
    "GVariant",
    "int",
    "uint",
    "long",
    "ulong",
    "float",
    "double",
    "size_t",
    "ssize_t",
]);

/**
 * Checks if a type name is an intrinsic (primitive) type.
 *
 * @param typeName - The type name to check
 * @returns True if the type is intrinsic and should not be namespace-qualified
 */
export const isIntrinsicType = (typeName: string): boolean => {
    return INTRINSIC_TYPES.has(typeName);
};

/**
 * String type names (utf8 and filename).
 */
export const STRING_TYPES = new Set(["utf8", "filename"]);

/**
 * Checks if a type name is a string type.
 */
export const isStringType = (typeName: string): boolean => {
    return STRING_TYPES.has(typeName);
};

/**
 * Numeric type names (integers and floats).
 */
export const NUMERIC_TYPES = new Set([
    "gint",
    "guint",
    "gint8",
    "guint8",
    "gint16",
    "guint16",
    "gint32",
    "guint32",
    "gint64",
    "guint64",
    "gchar",
    "guchar",
    "gshort",
    "gushort",
    "glong",
    "gulong",
    "gsize",
    "gssize",
    "goffset",
    "gintptr",
    "guintptr",
    "gfloat",
    "gdouble",
    "int",
    "uint",
    "long",
    "ulong",
    "float",
    "double",
    "size_t",
    "ssize_t",
    "GType",
]);

/**
 * Checks if a type name is a numeric type.
 */
export const isNumericType = (typeName: string): boolean => {
    return NUMERIC_TYPES.has(typeName);
};

/**
 * Void type names.
 */
export const VOID_TYPES = new Set(["void", "none"]);

/**
 * Checks if a type name is void.
 */
export const isVoidType = (typeName: string): boolean => {
    return VOID_TYPES.has(typeName);
};
