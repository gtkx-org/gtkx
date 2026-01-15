/**
 * FFI Type System
 *
 * Types and utilities for mapping GIR types to FFI representations.
 * This module owns all FFI-specific type logic, separate from the pure GIR data layer.
 */

/**
 * Describes how a type should be marshalled for FFI calls.
 *
 * Used by the code generator to create proper FFI type descriptors
 * for the native module.
 */
export type FfiTypeDescriptor = {
    /**
     * The FFI type: "int", "float", "string", "boolean", "boxed", "struct", "gobject", etc.
     */
    type: string;

    /**
     * Size in bits for numeric types, or bytes for struct types.
     */
    size?: number;

    unsigned?: boolean;

    /**
     * Ownership transfer semantics:
     * - "full": Caller takes ownership, responsible for freeing
     * - "borrowed": Caller borrows reference, must not free
     */
    ownership?: "full" | "borrowed";

    innerType?: FfiTypeDescriptor | string;

    lib?: string;

    getTypeFn?: string;

    refFunc?: string;

    unrefFunc?: string;

    itemType?: FfiTypeDescriptor;

    /**
     * List container type:
     * - "array": C-style null-terminated array
     * - "glist": GLib doubly-linked list
     * - "gslist": GLib singly-linked list
     * - "gptrarray": GLib pointer array
     * - "garray": GLib array with sized elements
     * - "ghashtable": GLib hash table (for HashTableType)
     * - "sized": Array with length from a parameter
     * - "fixed": Array with compile-time known fixed size
     */
    listType?: "array" | "glist" | "gslist" | "gptrarray" | "garray" | "ghashtable" | "sized" | "fixed";

    /**
     * For sized arrays, the index of the parameter that contains the length.
     * This is the parameter index in the FFI call arguments array.
     */
    lengthParamIndex?: number;

    /**
     * For fixed-size arrays, the compile-time known size.
     */
    fixedSize?: number;

    keyType?: FfiTypeDescriptor;

    valueType?: FfiTypeDescriptor;

    elementSize?: number;

    trampoline?:
        | "animationTargetFunc"
        | "asyncReady"
        | "closure"
        | "destroy"
        | "drawFunc"
        | "pathIntersectionFunc"
        | "scaleFormatValueFunc"
        | "shortcutFunc"
        | "tickCallback"
        | "treeListModelCreateFunc";

    sourceType?: FfiTypeDescriptor;

    resultType?: FfiTypeDescriptor;

    argTypes?: FfiTypeDescriptor[];

    returnType?: FfiTypeDescriptor;

    optional?: boolean;
};

/**
 * The kind of a type for import tracking purposes.
 */
export type TypeKind = "class" | "interface" | "enum" | "flags" | "record" | "callback";

/**
 * Represents a type import required by generated code.
 *
 * Used to collect all necessary imports during type mapping.
 */
export type TypeImport = {
    /** The kind of type being imported */
    kind: TypeKind;

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
    kind?: TypeKind;

    /** Whether the type is nullable */
    nullable?: boolean;

    /** For Ref<T> types, the TypeScript type string of the inner type T. */
    innerTsType?: string;
};

/** FFI type descriptor for void/undefined. */
export const FFI_VOID: FfiTypeDescriptor = { type: "undefined" };

/** FFI type descriptor for boolean. */
const FFI_BOOLEAN: FfiTypeDescriptor = { type: "boolean" };

/** FFI type descriptor for pointer (64-bit unsigned). */
export const FFI_POINTER: FfiTypeDescriptor = { type: "int", size: 64, unsigned: true };

/** FFI type descriptor for 32-bit signed integer. */
export const FFI_INT32: FfiTypeDescriptor = { type: "int", size: 32, unsigned: false };

/** FFI type descriptor for 32-bit unsigned integer. */
export const FFI_UINT32: FfiTypeDescriptor = { type: "int", size: 32, unsigned: true };

/** FFI type descriptor for 64-bit signed integer. */
const FFI_INT64: FfiTypeDescriptor = { type: "int", size: 64, unsigned: false };

/** FFI type descriptor for 64-bit unsigned integer. */
const FFI_UINT64: FfiTypeDescriptor = { type: "int", size: 64, unsigned: true };

/** FFI type descriptor for 32-bit float. */
const FFI_FLOAT32: FfiTypeDescriptor = { type: "float", size: 32 };

/** FFI type descriptor for 64-bit float. */
const FFI_FLOAT64: FfiTypeDescriptor = { type: "float", size: 64 };

/**
 * Mapping of primitive type names to their FFI and TypeScript representations.
 */
export const PRIMITIVE_TYPE_MAP = new Map<string, { ts: string; ffi: FfiTypeDescriptor }>([
    ["void", { ts: "void", ffi: FFI_VOID }],
    ["none", { ts: "void", ffi: FFI_VOID }],
    ["gboolean", { ts: "boolean", ffi: FFI_BOOLEAN }],
    ["gchar", { ts: "number", ffi: { type: "int", size: 8, unsigned: false } }],
    ["guchar", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["gint8", { ts: "number", ffi: { type: "int", size: 8, unsigned: false } }],
    ["guint8", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["gshort", { ts: "number", ffi: { type: "int", size: 16, unsigned: false } }],
    ["gushort", { ts: "number", ffi: { type: "int", size: 16, unsigned: true } }],
    ["gint16", { ts: "number", ffi: { type: "int", size: 16, unsigned: false } }],
    ["guint16", { ts: "number", ffi: { type: "int", size: 16, unsigned: true } }],
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
    ["DateDay", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["GLib.DateDay", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
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
]);

export const BOXED_TYPE_SIZES = new Map<string, number>([
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
 * @param refFunc - name of the ref function
 * @param unrefFunc - name of the unref function
 * @param transferFull - true for transfer full, false for transfer none
 */
export const fundamentalType = (
    lib: string,
    refFunc: string,
    unrefFunc: string,
    transferFull: boolean,
): FfiTypeDescriptor => ({
    type: "fundamental",
    lib,
    refFunc,
    unrefFunc,
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
    lib,
    getTypeFn,
});

/**
 * Creates a struct FFI type descriptor.
 * @param transferFull - true for transfer full, false for transfer none
 */
export const structType = (innerType: string, transferFull: boolean, size?: number): FfiTypeDescriptor => ({
    type: "struct",
    innerType,
    ownership: toOwnership(transferFull),
    size,
});

/**
 * Creates an array FFI type descriptor.
 * @param transferFull - true for transfer full, false for transfer none
 * @param lengthParamIndex - for sized arrays, the index of the parameter containing the length
 * @param fixedSize - for fixed-size arrays, the compile-time known size
 */
export const arrayType = (
    itemType: FfiTypeDescriptor,
    listType: "array" | "glist" | "gslist" | "gptrarray" | "garray" | "sized" | "fixed" = "array",
    transferFull: boolean = true,
    lengthParamIndex?: number,
    fixedSize?: number,
    elementSize?: number,
): FfiTypeDescriptor => {
    const result: FfiTypeDescriptor = {
        type: "array",
        itemType,
        listType,
        ownership: toOwnership(transferFull),
    };
    if (lengthParamIndex !== undefined) {
        result.lengthParamIndex = lengthParamIndex;
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
    listType: "gptrarray",
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
    listType: "garray",
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
    listType: "ghashtable",
    ownership: toOwnership(transferFull),
});

/**
 * Creates a ref FFI type descriptor for out parameters.
 */
export const refType = (innerType: FfiTypeDescriptor): FfiTypeDescriptor => ({
    type: "ref",
    innerType,
});

/**
 * GLib primitive type names that can be used in plain struct fields.
 * Derived from PRIMITIVE_TYPE_MAP, excluding special/pointer types.
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
    "gfloat",
    "gdouble",
    "gboolean",
    "gchar",
    "guchar",
    "gsize",
    "gssize",
    "glong",
    "gulong",
]);

/**
 * Types that can be written to memory in struct fields.
 * Subset of PRIMITIVE_FIELD_TYPES that are safe for memory writes.
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
]);

/**
 * Checks if a type name is a primitive field type.
 */
export const isPrimitiveFieldType = (typeName: string): boolean => PRIMITIVE_FIELD_TYPES.has(typeName);

/**
 * Checks if a type name is memory-writable.
 */
export const isMemoryWritableType = (typeName: string): boolean => MEMORY_WRITABLE_TYPES.has(typeName);

/**
 * Type-safe self type descriptor for instance method calls.
 *
 * Discriminated union providing compile-time safety for method call FFI.
 * "borrowed" = caller keeps ownership, "full" = function consumes the instance
 */
export type SelfTypeDescriptor =
    | { type: "gobject"; ownership: "borrowed" | "full" }
    | { type: "fundamental"; ownership: "borrowed" | "full"; lib: string; refFunc: string; unrefFunc: string }
    | { type: "boxed"; ownership: "borrowed" | "full"; innerType: string; lib: string; getTypeFn?: string };

/** Self type descriptor for GObject instance methods. */
export const SELF_TYPE_GOBJECT: SelfTypeDescriptor = { type: "gobject", ownership: "borrowed" };

/**
 * Creates a fundamental self type descriptor for types with custom ref/unref.
 */
export const fundamentalSelfType = (
    lib: string,
    refFunc: string,
    unrefFunc: string,
    ownership: "borrowed" | "full" = "borrowed",
): SelfTypeDescriptor => ({
    type: "fundamental",
    ownership,
    lib,
    refFunc,
    unrefFunc,
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

/**
 * Gets the size in bytes for a primitive type.
 * Derives size from PRIMITIVE_TYPE_MAP to maintain DRY.
 */
export const getPrimitiveTypeSize = (typeName: string): number => {
    if (typeName === "gboolean") {
        return 1;
    }

    const entry = PRIMITIVE_TYPE_MAP.get(typeName);
    if (entry?.ffi.size) {
        return entry.ffi.size / 8;
    }

    return 8;
};
