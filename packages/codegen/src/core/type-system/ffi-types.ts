/**
 * FFI Type System
 *
 * Types and utilities for mapping GIR types to FFI representations.
 * This module owns all FFI-specific type logic, separate from the pure GIR data layer.
 */

import type { TypeKind } from "@gtkx/gir";
import type { CallbackType, Type } from "@gtkx/native";

export type ImportType = TypeKind;

/**
 * Describes how a type should be marshalled for FFI calls.
 *
 * Used by the code generator to create proper FFI type descriptors
 * for the native module.
 */
export type FfiTypeDescriptor = {
    type: Type["type"];

    ownership?: "full" | "borrowed";

    innerType?: FfiTypeDescriptor | string;

    library?: string;

    getTypeFn?: string;

    refFn?: string;

    unrefFn?: string;

    itemType?: FfiTypeDescriptor;

    kind?: "array" | "glist" | "gslist" | "gptrarray" | "garray" | "sized" | "fixed" | CallbackType["kind"];

    sizeParamIndex?: number;

    fixedSize?: number;

    keyType?: FfiTypeDescriptor;

    valueType?: FfiTypeDescriptor;

    elementSize?: number;

    sourceType?: FfiTypeDescriptor;

    resultType?: FfiTypeDescriptor;

    argTypes?: FfiTypeDescriptor[];

    returnType?: FfiTypeDescriptor;

    optional?: boolean;

    hasDestroy?: boolean;

    userDataIndex?: number;

    scope?: "call" | "notified" | "async" | "forever";
};

/**
 * Represents a type import required by generated code.
 *
 * Used to collect all necessary imports during type mapping.
 */
export type TypeImport = {
    /** The kind of type being imported */
    kind: ImportType;

    /** Original GIR name */
    name: string;

    /** Namespace the type belongs to */
    namespace: string;

    /** Transformed TypeScript name */
    transformedName: string;

    /** Whether this is from a different namespace than the current one */
    isExternal: boolean;
};

/**
 * Collects unique external namespace names from type imports.
 * Used by analyzers to track cross-namespace type references.
 */
export const collectExternalNamespaces = (imports: readonly TypeImport[]): string[] => {
    const namespaces: string[] = [];
    for (const imp of imports) {
        if (imp.isExternal && !namespaces.includes(imp.namespace)) {
            namespaces.push(imp.namespace);
        }
    }
    return namespaces;
};

/**
 * Result of mapping a GIR type to TypeScript and FFI representations.
 */
export type MappedType = {
    /** TypeScript type string */
    ts: string;

    /** FFI type descriptor for runtime marshalling */
    ffi: FfiTypeDescriptor;

    /** Types that need to be imported */
    imports: TypeImport[];

    /** Original type kind if applicable */
    kind?: ImportType;

    /** For array types, the kind of the item type */
    itemKind?: ImportType;

    /** Whether the type is nullable */
    nullable?: boolean;

    /** For Ref<T> types, the TypeScript type string of the inner type T. */
    innerTsType?: string;
};

export const FFI_VOID: FfiTypeDescriptor = { type: "void" };
const FFI_BOOLEAN: FfiTypeDescriptor = { type: "boolean" };
export const FFI_POINTER: FfiTypeDescriptor = { type: "uint64" };
const FFI_INT8: FfiTypeDescriptor = { type: "int8" };
const FFI_UINT8: FfiTypeDescriptor = { type: "uint8" };
const FFI_INT16: FfiTypeDescriptor = { type: "int16" };
const FFI_UINT16: FfiTypeDescriptor = { type: "uint16" };
export const FFI_INT32: FfiTypeDescriptor = { type: "int32" };
export const FFI_UINT32: FfiTypeDescriptor = { type: "uint32" };
const FFI_INT64: FfiTypeDescriptor = { type: "int64" };
const FFI_UINT64: FfiTypeDescriptor = { type: "uint64" };
const FFI_FLOAT32: FfiTypeDescriptor = { type: "float32" };
const FFI_FLOAT64: FfiTypeDescriptor = { type: "float64" };

/**
 * Mapping of primitive type names to their FFI and TypeScript representations.
 */
export const PRIMITIVE_TYPE_MAP = new Map<string, { ts: string; ffi: FfiTypeDescriptor }>([
    ["void", { ts: "void", ffi: FFI_VOID }],
    ["none", { ts: "void", ffi: FFI_VOID }],
    ["gboolean", { ts: "boolean", ffi: FFI_BOOLEAN }],
    ["gchar", { ts: "number", ffi: FFI_INT8 }],
    ["guchar", { ts: "number", ffi: FFI_UINT8 }],
    ["gint8", { ts: "number", ffi: FFI_INT8 }],
    ["guint8", { ts: "number", ffi: FFI_UINT8 }],
    ["gshort", { ts: "number", ffi: FFI_INT16 }],
    ["gushort", { ts: "number", ffi: FFI_UINT16 }],
    ["gint16", { ts: "number", ffi: FFI_INT16 }],
    ["guint16", { ts: "number", ffi: FFI_UINT16 }],
    ["gint", { ts: "number", ffi: FFI_INT32 }],
    ["guint", { ts: "number", ffi: FFI_UINT32 }],
    ["gint32", { ts: "number", ffi: FFI_INT32 }],
    ["guint32", { ts: "number", ffi: FFI_UINT32 }],
    ["int", { ts: "number", ffi: FFI_INT32 }],
    ["uint", { ts: "number", ffi: FFI_UINT32 }],
    ["glong", { ts: "number", ffi: FFI_INT64 }],
    ["gulong", { ts: "number", ffi: FFI_UINT64 }],
    ["gint64", { ts: "number", ffi: FFI_INT64 }],
    ["guint64", { ts: "number", ffi: FFI_UINT64 }],
    ["long", { ts: "number", ffi: FFI_INT64 }],
    ["ulong", { ts: "number", ffi: FFI_UINT64 }],
    ["gsize", { ts: "number", ffi: FFI_UINT64 }],
    ["gssize", { ts: "number", ffi: FFI_INT64 }],
    ["goffset", { ts: "number", ffi: FFI_INT64 }],
    ["size_t", { ts: "number", ffi: FFI_UINT64 }],
    ["ssize_t", { ts: "number", ffi: FFI_INT64 }],
    ["gpointer", { ts: "number", ffi: FFI_POINTER }],
    ["gconstpointer", { ts: "number", ffi: FFI_POINTER }],
    ["guintptr", { ts: "number", ffi: FFI_UINT64 }],
    ["gunichar", { ts: "string", ffi: { type: "unichar" } }],
    ["gintptr", { ts: "number", ffi: FFI_INT64 }],
    ["gfloat", { ts: "number", ffi: FFI_FLOAT32 }],
    ["gdouble", { ts: "number", ffi: FFI_FLOAT64 }],
    ["float", { ts: "number", ffi: FFI_FLOAT32 }],
    ["double", { ts: "number", ffi: FFI_FLOAT64 }],
    ["GType", { ts: "number", ffi: FFI_UINT64 }],
    ["GQuark", { ts: "number", ffi: FFI_UINT32 }],
    ["Quark", { ts: "number", ffi: FFI_UINT32 }],
    ["GLib.Quark", { ts: "number", ffi: FFI_UINT32 }],
    ["TimeSpan", { ts: "number", ffi: FFI_INT64 }],
    ["GLib.TimeSpan", { ts: "number", ffi: FFI_INT64 }],
    ["DateDay", { ts: "number", ffi: FFI_UINT8 }],
    ["GLib.DateDay", { ts: "number", ffi: FFI_UINT8 }],
    ["DateYear", { ts: "number", ffi: FFI_UINT32 }],
    ["GLib.DateYear", { ts: "number", ffi: FFI_UINT32 }],
    ["DateMonth", { ts: "number", ffi: FFI_INT32 }],
    ["GLib.DateMonth", { ts: "number", ffi: FFI_INT32 }],
    ["Pid", { ts: "number", ffi: FFI_INT32 }],
    ["GLib.Pid", { ts: "number", ffi: FFI_INT32 }],
    ["pid_t", { ts: "number", ffi: FFI_INT32 }],
    ["uid_t", { ts: "number", ffi: FFI_UINT32 }],
    ["gid_t", { ts: "number", ffi: FFI_UINT32 }],
    ["time_t", { ts: "number", ffi: FFI_INT64 }],
    ["GLib.DestroyNotify", { ts: "number", ffi: FFI_POINTER }],
    ["DestroyNotify", { ts: "number", ffi: FFI_POINTER }],
    ["GLib.FreeFunc", { ts: "number", ffi: FFI_POINTER }],
    ["FreeFunc", { ts: "number", ffi: FFI_POINTER }],
    ["GlyphUnit", { ts: "number", ffi: FFI_INT32 }],
    ["Pango.GlyphUnit", { ts: "number", ffi: FFI_INT32 }],
    ["Glyph", { ts: "number", ffi: FFI_UINT32 }],
    ["Pango.Glyph", { ts: "number", ffi: FFI_UINT32 }],
    ["cairo.Glyph", { ts: "number", ffi: FFI_UINT32 }],
    ["tag_t", { ts: "number", ffi: FFI_UINT32 }],
    ["HarfBuzz.tag_t", { ts: "number", ffi: FFI_UINT32 }],
    ["ot_name_id_t", { ts: "number", ffi: FFI_UINT32 }],
    ["HarfBuzz.ot_name_id_t", { ts: "number", ffi: FFI_UINT32 }],
    ["ot_var_axis_flags_t", { ts: "number", ffi: FFI_UINT32 }],
    ["HarfBuzz.ot_var_axis_flags_t", { ts: "number", ffi: FFI_UINT32 }],
    ["bool_t", { ts: "number", ffi: FFI_INT32 }],
    ["HarfBuzz.bool_t", { ts: "number", ffi: FFI_INT32 }],
    ["mask_t", { ts: "number", ffi: FFI_UINT32 }],
    ["HarfBuzz.mask_t", { ts: "number", ffi: FFI_UINT32 }],
    ["codepoint_t", { ts: "number", ffi: FFI_UINT32 }],
    ["HarfBuzz.codepoint_t", { ts: "number", ffi: FFI_UINT32 }],
    ["color_t", { ts: "number", ffi: FFI_UINT32 }],
    ["HarfBuzz.color_t", { ts: "number", ffi: FFI_UINT32 }],
    ["position_t", { ts: "number", ffi: FFI_INT32 }],
    ["HarfBuzz.position_t", { ts: "number", ffi: FFI_INT32 }],
]);

export const STRUCT_ELEMENT_SIZES = new Map<string, number>([
    ["GValue", 24],
    ["GObject.Value", 24],
]);

/**
 * Converts a transfer full flag to ownership string.
 * @param transferFull - true means "full" (caller takes ownership), false means "borrowed" (caller must not free)
 */
const toOwnership = (transferFull: boolean): "full" | "borrowed" => (transferFull ? "full" : "borrowed");

/**
 * Creates a string FFI type descriptor.
 * @param transferFull - true for transfer full, false for transfer none
 */
export const stringType = (transferFull: boolean): FfiTypeDescriptor => ({
    type: "string",
    ownership: toOwnership(transferFull),
});

/**
 * Creates a GObject FFI type descriptor.
 * @param transferFull - true for transfer full, false for transfer none
 */
export const gobjectType = (transferFull: boolean): FfiTypeDescriptor => ({
    type: "gobject",
    ownership: toOwnership(transferFull),
});

/**
 * Creates a fundamental type FFI descriptor for types with custom ref/unref functions.
 * @param lib - library containing the ref/unref functions
 * @param refFn - name of the ref function
 * @param unrefFn - name of the unref function
 * @param transferFull - true for transfer full, false for transfer none
 */
export const fundamentalType = (
    lib: string,
    refFn: string,
    unrefFn: string,
    transferFull: boolean,
): FfiTypeDescriptor => ({
    type: "fundamental",
    library: lib,
    refFn,
    unrefFn,
    ownership: toOwnership(transferFull),
});

/**
 * Creates a boxed FFI type descriptor.
 * @param transferFull - true for transfer full, false for transfer none
 */
export const boxedType = (
    innerType: string,
    transferFull: boolean,
    lib?: string,
    getTypeFn?: string,
): FfiTypeDescriptor => ({
    type: "boxed",
    innerType,
    ownership: toOwnership(transferFull),
    library: lib,
    getTypeFn,
});

/**
 * Creates a struct FFI type descriptor.
 * @param transferFull - true for transfer full, false for transfer none
 */
export const structType = (innerType: string, transferFull: boolean): FfiTypeDescriptor => ({
    type: "struct",
    innerType,
    ownership: toOwnership(transferFull),
});

/**
 * Creates an array FFI type descriptor.
 * @param transferFull - true for transfer full, false for transfer none
 * @param sizeParamIndex - for sized arrays, the index of the parameter containing the length
 * @param fixedSize - for fixed-size arrays, the compile-time known size
 */
export const arrayType = (
    itemType: FfiTypeDescriptor,
    containerKind: "array" | "glist" | "gslist" | "gptrarray" | "garray" | "sized" | "fixed" = "array",
    transferFull: boolean = true,
    sizeParamIndex?: number,
    fixedSize?: number,
    elementSize?: number,
): FfiTypeDescriptor => {
    const result: FfiTypeDescriptor = {
        type: "array",
        itemType,
        kind: containerKind,
        ownership: toOwnership(transferFull),
    };
    if (sizeParamIndex !== undefined) {
        result.sizeParamIndex = sizeParamIndex;
    }
    if (fixedSize !== undefined) {
        result.fixedSize = fixedSize;
    }
    if (elementSize !== undefined) {
        result.elementSize = elementSize;
    }
    return result;
};

/**
 * Creates a GPtrArray FFI type descriptor.
 * @param transferFull - true for transfer full, false for transfer none
 */
export const ptrArrayType = (itemType: FfiTypeDescriptor, transferFull: boolean): FfiTypeDescriptor => ({
    type: "array",
    itemType,
    kind: "gptrarray",
    ownership: toOwnership(transferFull),
});

/**
 * Creates a GArray FFI type descriptor with element size.
 * @param transferFull - true for transfer full, false for transfer none
 */
export const gArrayType = (
    itemType: FfiTypeDescriptor,
    elementSize: number,
    transferFull: boolean,
): FfiTypeDescriptor => ({
    type: "array",
    itemType,
    kind: "garray",
    elementSize,
    ownership: toOwnership(transferFull),
});

/**
 * Creates a GHashTable FFI type descriptor.
 * @param transferFull - true for transfer full, false for transfer none
 */
export const hashTableType = (
    keyType: FfiTypeDescriptor,
    valueType: FfiTypeDescriptor,
    transferFull: boolean,
): FfiTypeDescriptor => ({
    type: "hashtable",
    keyType,
    valueType,
    ownership: toOwnership(transferFull),
});

/**
 * Creates a ref FFI type descriptor for out parameters.
 */
export const refType = (innerType: FfiTypeDescriptor): FfiTypeDescriptor => ({
    type: "ref",
    innerType,
});

export const enumType = (library: string, getTypeFn: string): FfiTypeDescriptor => ({
    type: "enum",
    library,
    getTypeFn,
});

export const flagsType = (library: string, getTypeFn: string): FfiTypeDescriptor => ({
    type: "flags",
    library,
    getTypeFn,
});

export const trampolineType = (
    argTypes: FfiTypeDescriptor[],
    returnType: FfiTypeDescriptor,
    hasDestroy?: boolean,
    userDataIndex?: number,
): FfiTypeDescriptor => {
    const result: FfiTypeDescriptor = {
        type: "trampoline",
        argTypes,
        returnType,
    };
    if (hasDestroy) {
        result.hasDestroy = hasDestroy;
    }
    if (userDataIndex !== undefined) {
        result.userDataIndex = userDataIndex;
    }
    return result;
};

/**
 * GLib primitive type names that can be used in plain struct fields.
 * Derived from PRIMITIVE_TYPE_MAP, excluding special/pointer types.
 * Also includes well-known type aliases from GTK libraries.
 */
const PRIMITIVE_FIELD_TYPES = new Set([
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
    "gshort",
    "gushort",
    "gfloat",
    "gdouble",
    "float",
    "double",
    "gboolean",
    "gchar",
    "guchar",
    "gsize",
    "gssize",
    "glong",
    "gulong",
    "GlyphUnit",
    "Pango.GlyphUnit",
    "Glyph",
    "Pango.Glyph",
    "cairo.Glyph",
    "Quark",
    "GQuark",
    "GLib.Quark",
    "utf8",
    "tag_t",
    "HarfBuzz.tag_t",
    "ot_name_id_t",
    "HarfBuzz.ot_name_id_t",
    "ot_var_axis_flags_t",
    "HarfBuzz.ot_var_axis_flags_t",
    "bool_t",
    "HarfBuzz.bool_t",
    "mask_t",
    "HarfBuzz.mask_t",
    "codepoint_t",
    "HarfBuzz.codepoint_t",
    "color_t",
    "HarfBuzz.color_t",
    "position_t",
    "HarfBuzz.position_t",
]);

/**
 * Types that can be written to memory in struct fields.
 * Subset of PRIMITIVE_FIELD_TYPES that are safe for memory writes.
 * Also includes well-known type aliases from GTK libraries.
 */
const MEMORY_WRITABLE_TYPES = new Set([
    "gboolean",
    "guint8",
    "gint8",
    "guchar",
    "gchar",
    "gint16",
    "guint16",
    "gshort",
    "gushort",
    "gint",
    "guint",
    "gint32",
    "guint32",
    "gfloat",
    "float",
    "gint64",
    "guint64",
    "glong",
    "gulong",
    "gsize",
    "gssize",
    "gdouble",
    "double",
    "GlyphUnit",
    "Pango.GlyphUnit",
    "Glyph",
    "Pango.Glyph",
    "cairo.Glyph",
    "tag_t",
    "HarfBuzz.tag_t",
    "ot_name_id_t",
    "HarfBuzz.ot_name_id_t",
    "ot_var_axis_flags_t",
    "HarfBuzz.ot_var_axis_flags_t",
    "bool_t",
    "HarfBuzz.bool_t",
    "mask_t",
    "HarfBuzz.mask_t",
    "codepoint_t",
    "HarfBuzz.codepoint_t",
    "color_t",
    "HarfBuzz.color_t",
    "position_t",
    "HarfBuzz.position_t",
]);

/**
 * Checks if a type name is a primitive field type.
 */
export const isPrimitiveFieldType = (typeName: string): boolean => PRIMITIVE_FIELD_TYPES.has(typeName);

/**
 * Checks if a type name is memory-writable.
 */
export const isMemoryWritableType = (typeName: string): boolean => MEMORY_WRITABLE_TYPES.has(typeName);

type SyntheticSetterPrimitiveInfo = {
    staticConstructor: string;
};

const SYNTHETIC_SETTER_PRIMITIVE_TYPES: Record<string, SyntheticSetterPrimitiveInfo> = {
    utf8: { staticConstructor: "newFromString" },
    gchararray: { staticConstructor: "newFromString" },
    gboolean: { staticConstructor: "newFromBoolean" },
    gint: { staticConstructor: "newFromInt" },
    gint32: { staticConstructor: "newFromInt" },
    guint: { staticConstructor: "newFromUint" },
    guint32: { staticConstructor: "newFromUint" },
    gint64: { staticConstructor: "newFromInt64" },
    guint64: { staticConstructor: "newFromUint64" },
    gfloat: { staticConstructor: "newFromFloat" },
    gdouble: { staticConstructor: "newFromDouble" },
    glong: { staticConstructor: "newFromLong" },
    gulong: { staticConstructor: "newFromUlong" },
};

export const isSyntheticSetterSupportedPrimitive = (typeName: string): boolean =>
    typeName in SYNTHETIC_SETTER_PRIMITIVE_TYPES;

export const getSyntheticSetterPrimitiveInfo = (typeName: string): SyntheticSetterPrimitiveInfo | undefined =>
    SYNTHETIC_SETTER_PRIMITIVE_TYPES[typeName];

type SyntheticGetterPrimitiveInfo = {
    gtypeName: string;
    getMethod: string;
    isString?: boolean;
};

const SYNTHETIC_GETTER_PRIMITIVE_TYPES: Record<string, SyntheticGetterPrimitiveInfo> = {
    utf8: { gtypeName: "gchararray", getMethod: "getString", isString: true },
    gchararray: { gtypeName: "gchararray", getMethod: "getString", isString: true },
    gboolean: { gtypeName: "gboolean", getMethod: "getBoolean" },
    gint: { gtypeName: "gint", getMethod: "getInt" },
    gint32: { gtypeName: "gint", getMethod: "getInt" },
    guint: { gtypeName: "guint", getMethod: "getUint" },
    guint32: { gtypeName: "guint", getMethod: "getUint" },
    gint64: { gtypeName: "gint64", getMethod: "getInt64" },
    guint64: { gtypeName: "guint64", getMethod: "getUint64" },
    gfloat: { gtypeName: "gfloat", getMethod: "getFloat" },
    gdouble: { gtypeName: "gdouble", getMethod: "getDouble" },
    glong: { gtypeName: "glong", getMethod: "getInt64" },
    gulong: { gtypeName: "gulong", getMethod: "getUint64" },
};

export const getSyntheticGetterPrimitiveInfo = (typeName: string): SyntheticGetterPrimitiveInfo | undefined =>
    SYNTHETIC_GETTER_PRIMITIVE_TYPES[typeName];

/**
 * Type-safe self type descriptor for instance method calls.
 *
 * Discriminated union providing compile-time safety for method call FFI.
 * "borrowed" = caller keeps ownership, "full" = function consumes the instance
 */
export type SelfTypeDescriptor =
    | { type: "gobject"; ownership: "borrowed" | "full" }
    | { type: "fundamental"; ownership: "borrowed" | "full"; lib: string; refFn: string; unrefFn: string }
    | { type: "boxed"; ownership: "borrowed" | "full"; innerType: string; lib: string; getTypeFn?: string };

/** Self type descriptor for GObject instance methods. */
export const SELF_TYPE_GOBJECT: SelfTypeDescriptor = { type: "gobject", ownership: "borrowed" };

/**
 * Creates a fundamental self type descriptor for types with custom ref/unref.
 */
export const fundamentalSelfType = (
    lib: string,
    refFn: string,
    unrefFn: string,
    ownership: "borrowed" | "full" = "borrowed",
): SelfTypeDescriptor => ({
    type: "fundamental",
    ownership,
    lib,
    refFn,
    unrefFn,
});

/**
 * Creates a boxed self type descriptor.
 */
export const boxedSelfType = (
    innerType: string,
    lib: string,
    getTypeFn?: string,
    ownership: "borrowed" | "full" = "borrowed",
): SelfTypeDescriptor => {
    const result: SelfTypeDescriptor = {
        type: "boxed",
        ownership,
        innerType,
        lib,
    };
    if (getTypeFn) {
        result.getTypeFn = getTypeFn;
    }
    return result;
};

const FFI_TYPE_BYTE_SIZES: Record<string, number> = {
    int8: 1,
    uint8: 1,
    boolean: 1,
    int16: 2,
    uint16: 2,
    int32: 4,
    uint32: 4,
    float32: 4,
    enum: 4,
    flags: 4,
    int64: 8,
    uint64: 8,
    float64: 8,
    unichar: 4,
};

export const getFfiTypeByteSize = (ffiType: string): number => FFI_TYPE_BYTE_SIZES[ffiType] ?? 8;

export const getPrimitiveTypeSize = (typeName: string): number => {
    if (typeName === "gboolean") {
        return 1;
    }

    const entry = PRIMITIVE_TYPE_MAP.get(typeName);
    if (entry) {
        return getFfiTypeByteSize(entry.ffi.type);
    }

    return 8;
};
