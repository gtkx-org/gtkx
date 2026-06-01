/**
 * Mapping from GIR primitive type names to the FFI marshaling categories
 * the writers emit.
 *
 * The categories mirror the `t.*` helpers exposed by `@gtkx/ffi`'s runtime
 * (see `packages/ffi/src/helpers.ts`). Categories that are not directly
 * marshaled (e.g. `void`, `string`, `unichar`) are still listed so callers
 * can branch on them without falling through to a default.
 */
export type PrimitiveCategory =
    | "void"
    | "boolean"
    | "int8"
    | "uint8"
    | "int16"
    | "uint16"
    | "int32"
    | "uint32"
    | "int64"
    | "uint64"
    | "float32"
    | "float64"
    | "string"
    | "unichar"
    | "pointer";

/**
 * Width in bytes of each primitive category on the x86-64 ABI (Linux LP64).
 *
 * The widths are also used as the natural alignment requirement of each
 * category — every native integer/float aligns to its own size.
 */
export const PRIMITIVE_SIZE: Readonly<Record<PrimitiveCategory, number>> = Object.freeze({
    void: 0,
    boolean: 4,
    int8: 1,
    uint8: 1,
    int16: 2,
    uint16: 2,
    int32: 4,
    uint32: 4,
    int64: 8,
    uint64: 8,
    float32: 4,
    float64: 8,
    string: 8,
    unichar: 4,
    pointer: 8,
});

const PRIMITIVE_BY_NAME: ReadonlyMap<string, PrimitiveCategory> = new Map([
    ["none", "void"],
    ["void", "void"],
    ["gboolean", "boolean"],
    ["gchar", "int8"],
    ["gint8", "int8"],
    ["guchar", "uint8"],
    ["guint8", "uint8"],
    ["gshort", "int16"],
    ["gint16", "int16"],
    ["gushort", "uint16"],
    ["guint16", "uint16"],
    ["gint", "int32"],
    ["gint32", "int32"],
    ["int", "int32"],
    ["int8", "int8"],
    ["uint8", "uint8"],
    ["int16", "int16"],
    ["uint16", "uint16"],
    ["int32", "int32"],
    ["uint32", "uint32"],
    ["int64", "int64"],
    ["uint64", "uint64"],
    ["guint", "uint32"],
    ["guint32", "uint32"],
    ["glong", "int64"],
    ["gint64", "int64"],
    ["long", "int64"],
    ["gssize", "int64"],
    ["gintptr", "int64"],
    ["gulong", "uint64"],
    ["guint64", "uint64"],
    ["gsize", "uint64"],
    ["guintptr", "uint64"],
    ["GType", "uint64"],
    ["time_t", "int64"],
    ["pid_t", "int32"],
    ["uid_t", "uint32"],
    ["gid_t", "uint32"],
    ["gfloat", "float32"],
    ["float", "float32"],
    ["gdouble", "float64"],
    ["double", "float64"],
    ["long double", "float64"],
    ["utf8", "string"],
    ["filename", "string"],
    ["gchararray", "string"],
    ["gunichar", "unichar"],
    ["gpointer", "pointer"],
    ["gconstpointer", "pointer"],
] as const);

/**
 * Returns the FFI category for a GIR primitive name (`"gint"`, `"utf8"`,
 * `"gsize"`, …) or `undefined` when the name is not a primitive.
 *
 * Aliases that GIR uses inconsistently (`gint` / `int` / `gint32`, …) all
 * map to the same canonical category.
 *
 * @param name - The GIR type name as it appears in `<type name="…">`
 */
export const primitiveCategory = (name: string): PrimitiveCategory | undefined => PRIMITIVE_BY_NAME.get(name);

/**
 * TypeScript surface type for each primitive category.
 *
 * Codegen surfaces both raw C primitives and string-marshalled categories
 * (`string`, `unichar`) through this map so writers in the FFI and React
 * pipelines agree on the same annotation per category.
 */
export const PRIMITIVE_TS_TYPE: Readonly<Record<PrimitiveCategory, string>> = Object.freeze({
    void: "void",
    boolean: "boolean",
    int8: "number",
    uint8: "number",
    int16: "number",
    uint16: "number",
    int32: "number",
    uint32: "number",
    int64: "number",
    uint64: "number",
    float32: "number",
    float64: "number",
    string: "string",
    unichar: "string",
    pointer: "number",
});
