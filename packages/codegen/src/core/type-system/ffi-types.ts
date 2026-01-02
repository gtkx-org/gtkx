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
     * - "none": Caller borrows reference, must not free
     */
    ownership?: "full" | "none";

    innerType?: FfiTypeDescriptor | string;

    lib?: string;

    getTypeFn?: string;

    itemType?: FfiTypeDescriptor;

    /**
     * List container type:
     * - "array": C-style null-terminated array
     * - "glist": GLib doubly-linked list
     * - "gslist": GLib singly-linked list
     */
    listType?: "array" | "glist" | "gslist";

    trampoline?:
        | "closure"
        | "asyncReady"
        | "destroy"
        | "drawFunc"
        | "scaleFormatValueFunc"
        | "shortcutFunc"
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
 * Used to collect all necessary imports during type mapping,
 * replacing the old callback-based import tracking.
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
 *
 * The `imports` array replaces the old callback-based import tracking,
 * making it easier to collect all required imports.
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

/**
 * Converts a transfer full flag to ownership string.
 * @param transferFull - true means "full" (caller takes ownership), false means "none" (caller must not free)
 */
const toOwnership = (transferFull: boolean): "full" | "none" => (transferFull ? "full" : "none");

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
 */
export const arrayType = (
    itemType: FfiTypeDescriptor,
    listType: "array" | "glist" | "gslist" = "array",
    transferFull: boolean = true,
): FfiTypeDescriptor => ({
    type: "array",
    itemType,
    listType,
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
 * Discriminated union that replaces the previous string-based approach,
 * eliminating the need for regex parsing and providing compile-time safety.
 */
export type SelfTypeDescriptor =
    | { type: "gobject"; ownership: "none" }
    | { type: "gparam"; ownership: "none" }
    | { type: "boxed"; ownership: "none"; innerType: string; lib: string };

/** Self type descriptor for GObject instance methods. */
export const SELF_TYPE_GOBJECT: SelfTypeDescriptor = { type: "gobject", ownership: "none" };

/** Self type descriptor for GParamSpec instance methods. */
export const SELF_TYPE_GPARAM: SelfTypeDescriptor = { type: "gparam", ownership: "none" };

/**
 * Creates a boxed self type descriptor.
 */
export const boxedSelfType = (innerType: string, lib: string): SelfTypeDescriptor => ({
    type: "boxed",
    ownership: "none",
    innerType,
    lib,
});

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
