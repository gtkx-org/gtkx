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
    | "bigint64"
    | "biguint64"
    | "gtype"
    | "float32"
    | "float64"
    | "string"
    | "unichar"
    | "pointer";

export const PRIMITIVE_SIZE: Record<PrimitiveCategory, number> = Object.freeze({
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
    bigint64: 8,
    biguint64: 8,
    gtype: 8,
    float32: 4,
    float64: 8,
    string: 8,
    unichar: 4,
    pointer: 8,
});

const PRIMITIVE_BY_NAME: Map<string, PrimitiveCategory> = new Map([
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
    ["int64", "bigint64"],
    ["uint64", "biguint64"],
    ["guint", "uint32"],
    ["guint32", "uint32"],
    ["glong", "bigint64"],
    ["gint64", "bigint64"],
    ["long", "bigint64"],
    ["gssize", "int64"],
    ["gintptr", "int64"],
    ["gulong", "biguint64"],
    ["guint64", "biguint64"],
    ["gsize", "uint64"],
    ["guintptr", "uint64"],
    ["GType", "gtype"],
    ["time_t", "bigint64"],
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

export const primitiveCategory = (name: string): PrimitiveCategory | undefined => PRIMITIVE_BY_NAME.get(name);

export const PRIMITIVE_TS_TYPE: Record<PrimitiveCategory, string> = Object.freeze({
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
    bigint64: "bigint",
    biguint64: "bigint",
    gtype: "GType",
    float32: "number",
    float64: "number",
    string: "string",
    unichar: "string",
    pointer: "number",
});
