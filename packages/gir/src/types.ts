/**
 * GIR type definitions and utilities.
 *
 * Provides TypeScript representations of GObject Introspection data
 * and utilities for type resolution and mapping.
 *
 * @packageDocumentation
 */

import { normalizeClassName } from "./class-names.js";
import { toCamelCase, toPascalCase } from "./naming.js";

export { toCamelCase, toPascalCase };

/**
 * Represents a parsed GIR namespace (library).
 *
 * Contains all type definitions from a single GIR file, including
 * classes, interfaces, functions, enums, records, and callbacks.
 */
export type GirNamespace = {
    name: string;

    version: string;

    sharedLibrary: string;

    cPrefix: string;

    classes: GirClass[];

    interfaces: GirInterface[];

    functions: GirFunction[];

    enumerations: GirEnumeration[];

    bitfields: GirEnumeration[];

    records: GirRecord[];

    callbacks: GirCallback[];

    constants: GirConstant[];

    doc?: string;
};

/**
 * A constant value defined in a GIR namespace.
 */
export type GirConstant = {
    name: string;

    cType: string;

    value: string;

    type: GirType;

    doc?: string;
};

/**
 * A callback type definition (function pointer type).
 */
export type GirCallback = {
    name: string;

    cType: string;

    returnType: GirType;

    parameters: GirParameter[];

    doc?: string;
};

/**
 * A GObject interface definition.
 *
 * Interfaces in GObject are similar to TypeScript interfaces - they
 * define a contract that classes can implement.
 */
export type GirInterface = {
    name: string;

    cType: string;

    glibTypeName?: string;

    prerequisites: string[];

    methods: GirMethod[];

    properties: GirProperty[];

    signals: GirSignal[];

    doc?: string;
};

/**
 * A GObject class definition.
 *
 * Classes are the primary building blocks of GObject-based libraries
 * like GTK. They support single inheritance, interface implementation,
 * properties, signals, and methods.
 */
export type GirClass = {
    name: string;

    cType: string;

    parent?: string;

    abstract?: boolean;

    glibTypeName?: string;

    glibGetType?: string;

    cSymbolPrefix?: string;

    implements: string[];

    methods: GirMethod[];

    constructors: GirConstructor[];

    functions: GirFunction[];

    properties: GirProperty[];

    signals: GirSignal[];

    doc?: string;
};

/**
 * A GLib record (boxed type or struct).
 *
 * Records are value types that can be allocated on the stack or heap.
 * They may have fields, methods, and constructors but no inheritance.
 */
export type GirRecord = {
    name: string;

    cType: string;

    opaque?: boolean;

    disguised?: boolean;

    glibTypeName?: string;

    glibGetType?: string;

    fields: GirField[];

    methods: GirMethod[];

    constructors: GirConstructor[];

    functions: GirFunction[];

    doc?: string;
};

/**
 * A field within a record or class.
 */
export type GirField = {
    name: string;

    type: GirType;

    writable?: boolean;

    readable?: boolean;

    private?: boolean;

    doc?: string;
};

/**
 * A method on a class, interface, or record.
 */
export type GirMethod = {
    name: string;

    cIdentifier: string;

    returnType: GirType;

    parameters: GirParameter[];

    throws?: boolean;

    doc?: string;

    returnDoc?: string;
};

/**
 * A constructor for a class or record.
 */
export type GirConstructor = {
    name: string;

    cIdentifier: string;

    returnType: GirType;

    parameters: GirParameter[];

    throws?: boolean;

    doc?: string;

    returnDoc?: string;
};

/**
 * A standalone function or static method.
 */
export type GirFunction = {
    name: string;

    cIdentifier: string;

    returnType: GirType;

    parameters: GirParameter[];

    throws?: boolean;

    doc?: string;

    returnDoc?: string;
};

/**
 * A parameter to a function, method, or callback.
 *
 * Includes direction (in/out/inout) and ownership transfer information
 * for proper memory management in generated bindings.
 */
export type GirParameter = {
    name: string;

    type: GirType;

    direction?: "in" | "out" | "inout";

    callerAllocates?: boolean;

    nullable?: boolean;

    optional?: boolean;

    scope?: "async" | "call" | "notified";

    closure?: number;

    destroy?: number;

    transferOwnership?: "none" | "full" | "container";

    doc?: string;
};

/**
 * A type reference in GIR.
 *
 * Can represent primitive types, objects, arrays, or boxed types.
 * Includes C type information and ownership semantics.
 */
export type GirType = {
    name: string;

    cType?: string;

    isArray?: boolean;

    elementType?: GirType;

    transferOwnership?: "none" | "full" | "container";

    nullable?: boolean;
};

/**
 * A GObject property definition.
 *
 * Properties in GObject are observable values with getter/setter
 * methods and change notification support.
 */
export type GirProperty = {
    name: string;

    type: GirType;

    readable?: boolean;

    writable?: boolean;

    constructOnly?: boolean;

    hasDefault?: boolean;

    getter?: string;

    setter?: string;

    doc?: string;
};

/**
 * A GObject signal definition.
 *
 * Signals are the GObject event system, allowing objects to emit
 * notifications that handlers can connect to.
 */
export type GirSignal = {
    name: string;

    when?: "first" | "last" | "cleanup";

    returnType?: GirType;

    parameters?: GirParameter[];

    doc?: string;
};

/**
 * An enumeration or bitfield definition.
 */
export type GirEnumeration = {
    name: string;

    cType: string;

    members: GirEnumerationMember[];

    doc?: string;
};

/**
 * A member of an enumeration or bitfield.
 */
export type GirEnumerationMember = {
    name: string;

    value: string;

    cIdentifier: string;

    doc?: string;
};

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

    borrowed?: boolean;

    innerType?: FfiTypeDescriptor | string;

    lib?: string;

    getTypeFn?: string;

    itemType?: FfiTypeDescriptor;

    listType?: "glist" | "gslist";

    trampoline?:
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
 * Builds a lookup map from class name to class definition.
 *
 * @param classes - Array of parsed GIR classes
 * @returns Map keyed by class name for O(1) lookup
 */
export const buildClassMap = (classes: GirClass[]): Map<string, GirClass> => {
    const classMap = new Map<string, GirClass>();
    for (const cls of classes) {
        classMap.set(cls.name, cls);
    }
    return classMap;
};

/**
 * Registers all enumerations and bitfields from a namespace into a type mapper.
 *
 * @param typeMapper - The type mapper to register enums with
 * @param namespace - The parsed GIR namespace containing enums
 */
export const registerEnumsFromNamespace = (typeMapper: TypeMapper, namespace: GirNamespace): void => {
    for (const enumeration of namespace.enumerations) {
        typeMapper.registerEnum(enumeration.name, toPascalCase(enumeration.name));
    }
    for (const bitfield of namespace.bitfields) {
        typeMapper.registerEnum(bitfield.name, toPascalCase(bitfield.name));
    }
};

type TypeMapping = { ts: string; ffi: FfiTypeDescriptor };

/**
 * The kind of a registered type.
 */
export type TypeKind = "class" | "interface" | "enum" | "record" | "callback";

/**
 * A type registered in the type registry.
 *
 * Contains metadata about the type including its namespace,
 * original name, and transformed TypeScript name.
 */
export type RegisteredType = {
    kind: TypeKind;
    name: string;
    namespace: string;
    transformedName: string;
    glibTypeName?: string;
    sharedLibrary?: string;
    glibGetType?: string;
    /**
     * If true, this is a plain C struct without GType registration.
     * These require different FFI handling than boxed types.
     */
    isPlainStruct?: boolean;
    /**
     * Size in bytes for plain structs (for allocation).
     */
    structSize?: number;
    /**
     * Field definitions for plain structs.
     */
    structFields?: Array<{ name: string; offset: number; type: string }>;
};

/**
 * Registry for resolving types across multiple GIR namespaces.
 *
 * Enables cross-namespace type resolution by maintaining a map of
 * all known types from all loaded namespaces.
 *
 * @example
 * ```tsx
 * const registry = TypeRegistry.fromNamespaces([gtkNamespace, gioNamespace]);
 * const buttonType = registry.resolve("Gtk.Button");
 * ```
 */
export class TypeRegistry {
    private types = new Map<string, RegisteredType>();

    /**
     * Registers a native class type.
     *
     * @param namespace - The GIR namespace (e.g., "Gtk")
     * @param name - The class name (e.g., "Button")
     */
    registerNativeClass(namespace: string, name: string): void {
        const transformedName = normalizeClassName(name, namespace);
        this.types.set(`${namespace}.${name}`, {
            kind: "class",
            name,
            namespace,
            transformedName,
        });
    }

    /**
     * Registers an interface type.
     *
     * @param namespace - The GIR namespace
     * @param name - The interface name
     */
    registerInterface(namespace: string, name: string): void {
        const transformedName = normalizeClassName(name, namespace);
        this.types.set(`${namespace}.${name}`, {
            kind: "interface",
            name,
            namespace,
            transformedName,
        });
    }

    /**
     * Registers an enumeration type.
     *
     * @param namespace - The GIR namespace
     * @param name - The enum name
     */
    registerEnum(namespace: string, name: string): void {
        const transformedName = toPascalCase(name);
        this.types.set(`${namespace}.${name}`, {
            kind: "enum",
            name,
            namespace,
            transformedName,
        });
    }

    /**
     * Registers a record (boxed) type.
     *
     * @param namespace - The GIR namespace
     * @param name - The record name
     * @param glibTypeName - Optional GLib type name for runtime type info
     * @param sharedLibrary - Optional shared library containing the type
     * @param glibGetType - Optional get_type function name
     * @param isPlainStruct - If true, this is a plain C struct without GType
     * @param structSize - Size in bytes for plain structs
     * @param structFields - Field definitions for plain structs
     */
    registerRecord(
        namespace: string,
        name: string,
        glibTypeName?: string,
        sharedLibrary?: string,
        glibGetType?: string,
        isPlainStruct?: boolean,
        structSize?: number,
        structFields?: Array<{ name: string; offset: number; type: string }>,
    ): void {
        const transformedName = normalizeClassName(name, namespace);
        this.types.set(`${namespace}.${name}`, {
            kind: "record",
            name,
            namespace,
            transformedName,
            glibTypeName,
            sharedLibrary,
            glibGetType,
            isPlainStruct,
            structSize,
            structFields,
        });
    }

    /**
     * Registers a callback type.
     *
     * @param namespace - The GIR namespace
     * @param name - The callback name
     */
    registerCallback(namespace: string, name: string): void {
        const transformedName = toPascalCase(name);
        this.types.set(`${namespace}.${name}`, {
            kind: "callback",
            name,
            namespace,
            transformedName,
        });
    }

    /**
     * Resolves a fully qualified type name.
     *
     * @param qualifiedName - Type name in "Namespace.TypeName" format
     * @returns The registered type, or undefined if not found
     */
    resolve(qualifiedName: string): RegisteredType | undefined {
        return this.types.get(qualifiedName);
    }

    /**
     * Resolves a type name within a namespace context.
     *
     * First checks the current namespace, then falls back to
     * searching all registered types.
     *
     * @param name - Type name (may be unqualified)
     * @param currentNamespace - The namespace to search first
     * @returns The registered type, or undefined if not found
     */
    resolveInNamespace(name: string, currentNamespace: string): RegisteredType | undefined {
        if (name.includes(".")) {
            return this.resolve(name);
        }

        const inCurrent = this.resolve(`${currentNamespace}.${name}`);
        if (inCurrent) {
            return inCurrent;
        }

        for (const type of this.types.values()) {
            if (type.name === name || type.transformedName === name) {
                return type;
            }
        }
    }

    /**
     * Creates a type registry from multiple parsed namespaces.
     *
     * @param namespaces - Array of parsed GIR namespaces
     * @returns A populated type registry
     *
     * @example
     * ```tsx
     * const parser = new GirParser();
     * const gtk = parser.parse(gtkGir);
     * const gio = parser.parse(gioGir);
     * const registry = TypeRegistry.fromNamespaces([gtk, gio]);
     * ```
     */
    static fromNamespaces(namespaces: GirNamespace[]): TypeRegistry {
        const registry = new TypeRegistry();
        for (const ns of namespaces) {
            for (const cls of ns.classes) {
                registry.registerNativeClass(ns.name, cls.name);
            }
            for (const iface of ns.interfaces) {
                registry.registerInterface(ns.name, iface.name);
            }
            for (const enumeration of ns.enumerations) {
                registry.registerEnum(ns.name, enumeration.name);
            }
            for (const bitfield of ns.bitfields) {
                registry.registerEnum(ns.name, bitfield.name);
            }
            for (const record of ns.records) {
                if (record.disguised) continue;

                if (record.glibTypeName) {
                    registry.registerRecord(
                        ns.name,
                        record.name,
                        record.glibTypeName,
                        ns.sharedLibrary,
                        record.glibGetType,
                    );
                } else if (
                    record.fields.length > 0 &&
                    !record.opaque &&
                    hasOnlyPrimitiveFields(record.fields)
                ) {
                    const { size, fields } = calculateStructLayout(record.fields);
                    registry.registerRecord(
                        ns.name,
                        record.name,
                        undefined,
                        ns.sharedLibrary,
                        undefined,
                        true,
                        size,
                        fields,
                    );
                }
            }
            for (const callback of ns.callbacks) {
                registry.registerCallback(ns.name, callback.name);
            }
        }
        return registry;
    }
}

const STRING_TYPES = new Set(["utf8", "filename"]);

const PRIMITIVE_TYPES = new Set([
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
 * Checks if a record has at least one public primitive field and all public fields are primitive.
 * Used to determine if a plain struct can be safely generated.
 * Records with only private fields are considered opaque and should not be plain structs.
 */
const hasOnlyPrimitiveFields = (fields: GirField[]): boolean => {
    const publicFields = fields.filter((f) => !f.private);
    if (publicFields.length === 0) return false;
    return publicFields.every((field) => PRIMITIVE_TYPES.has(field.type.name));
};

/**
 * Gets the size and alignment of a field type in bytes.
 */
const getFieldSizeAndAlignment = (type: GirType): { size: number; alignment: number } => {
    const typeName = type.name;

    if (["gboolean", "guint8", "gint8", "guchar", "gchar"].includes(typeName)) {
        return { size: 1, alignment: 1 };
    }
    if (["gint16", "guint16", "gshort", "gushort"].includes(typeName)) {
        return { size: 2, alignment: 2 };
    }
    if (
        ["gint", "guint", "gint32", "guint32", "gfloat", "float", "Quark", "GQuark"].includes(typeName)
    ) {
        return { size: 4, alignment: 4 };
    }
    if (
        [
            "gint64",
            "guint64",
            "gdouble",
            "double",
            "glong",
            "gulong",
            "gsize",
            "gssize",
            "GType",
            "gpointer",
        ].includes(typeName)
    ) {
        return { size: 8, alignment: 8 };
    }
    return { size: 8, alignment: 8 };
};

/**
 * Calculates the memory layout of a struct (size and field offsets).
 */
const calculateStructLayout = (
    fields: GirField[],
): { size: number; fields: Array<{ name: string; offset: number; type: string }> } => {
    const result: Array<{ name: string; offset: number; type: string }> = [];
    let currentOffset = 0;
    let maxAlignment = 1;

    for (const field of fields) {
        if (field.private) continue;

        const { size, alignment } = getFieldSizeAndAlignment(field.type);
        maxAlignment = Math.max(maxAlignment, alignment);

        currentOffset = Math.ceil(currentOffset / alignment) * alignment;

        result.push({
            name: field.name,
            offset: currentOffset,
            type: field.type.name,
        });

        currentOffset += size;
    }

    const finalSize = Math.ceil(currentOffset / maxAlignment) * maxAlignment;

    return { size: finalSize, fields: result };
};

const POINTER_TYPE: TypeMapping = { ts: "number", ffi: { type: "int", size: 64, unsigned: true } };

const C_TYPE_MAP = new Map<string, TypeMapping>([
    ["void", { ts: "void", ffi: { type: "undefined" } }],
    ["gboolean", { ts: "boolean", ffi: { type: "boolean" } }],
    ["gchar", { ts: "number", ffi: { type: "int", size: 8, unsigned: false } }],
    ["guchar", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["gint", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["guint", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["gshort", { ts: "number", ffi: { type: "int", size: 16, unsigned: false } }],
    ["gushort", { ts: "number", ffi: { type: "int", size: 16, unsigned: true } }],
    ["glong", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["gulong", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["gint8", { ts: "number", ffi: { type: "int", size: 8, unsigned: false } }],
    ["guint8", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["gint16", { ts: "number", ffi: { type: "int", size: 16, unsigned: false } }],
    ["guint16", { ts: "number", ffi: { type: "int", size: 16, unsigned: true } }],
    ["gint32", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["guint32", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["gint64", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["guint64", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["gfloat", { ts: "number", ffi: { type: "float", size: 32 } }],
    ["gdouble", { ts: "number", ffi: { type: "float", size: 64 } }],
    ["gsize", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["gssize", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["goffset", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["int", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["unsigned int", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["long", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["unsigned long", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["double", { ts: "number", ffi: { type: "float", size: 64 } }],
    ["float", { ts: "number", ffi: { type: "float", size: 32 } }],
    ["size_t", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["ssize_t", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["GType", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["GQuark", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
]);

const mapCType = (cType: string | undefined): TypeMapping => {
    if (!cType) {
        return POINTER_TYPE;
    }

    if (cType.endsWith("*")) {
        return POINTER_TYPE;
    }

    const mapped = C_TYPE_MAP.get(cType);
    if (mapped) {
        return mapped;
    }

    if (cType.startsWith("const ")) {
        return mapCType(cType.slice(6));
    }

    return POINTER_TYPE;
};

const BASIC_TYPE_MAP = new Map<string, TypeMapping>([
    ["gboolean", { ts: "boolean", ffi: { type: "boolean" } }],
    ["gchar", { ts: "number", ffi: { type: "int", size: 8, unsigned: false } }],
    ["guchar", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["gint", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["guint", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["gshort", { ts: "number", ffi: { type: "int", size: 16, unsigned: false } }],
    ["gushort", { ts: "number", ffi: { type: "int", size: 16, unsigned: true } }],
    ["glong", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["gulong", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["GType", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["gint8", { ts: "number", ffi: { type: "int", size: 8, unsigned: false } }],
    ["guint8", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["gint16", { ts: "number", ffi: { type: "int", size: 16, unsigned: false } }],
    ["guint16", { ts: "number", ffi: { type: "int", size: 16, unsigned: true } }],
    ["gint32", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["guint32", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["gint64", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["guint64", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["gfloat", { ts: "number", ffi: { type: "float", size: 32 } }],
    ["gdouble", { ts: "number", ffi: { type: "float", size: 64 } }],
    ["gpointer", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["gconstpointer", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["gsize", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["gssize", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["goffset", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["guintptr", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["gintptr", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["pid_t", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["uid_t", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["gid_t", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["time_t", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["Quark", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["GLib.Quark", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["TimeSpan", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["GLib.TimeSpan", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["DateDay", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["GLib.DateDay", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["DateYear", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["GLib.DateYear", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["DateMonth", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["GLib.DateMonth", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["Pid", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["GLib.Pid", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["void", { ts: "void", ffi: { type: "undefined" } }],
    ["none", { ts: "void", ffi: { type: "undefined" } }],
    ["int", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["uint", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["long", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["ulong", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["size_t", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["ssize_t", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["double", { ts: "number", ffi: { type: "float", size: 64 } }],
    ["float", { ts: "number", ffi: { type: "float", size: 32 } }],
    ["GLib.DestroyNotify", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["DestroyNotify", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["GLib.FreeFunc", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["FreeFunc", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
]);

/**
 * Describes usage of a type from another namespace.
 *
 * Used to track import dependencies during code generation.
 */
export type ExternalTypeUsage = {
    namespace: string;
    name: string;
    transformedName: string;
    kind: TypeKind;
};

/**
 * Result of mapping a GIR type to TypeScript and FFI representations.
 */
export type MappedType = {
    ts: string;
    ffi: FfiTypeDescriptor;
    externalType?: ExternalTypeUsage;
    kind?: TypeKind;
    nullable?: boolean;
};

/**
 * Maps GIR types to TypeScript and FFI type representations.
 *
 * Handles conversion of GIR type information into:
 * - TypeScript type strings for generated declarations
 * - FFI type descriptors for runtime marshalling
 *
 * Supports callbacks for tracking type usage dependencies.
 *
 * @example
 * ```tsx
 * const mapper = new TypeMapper();
 * mapper.registerEnum("Orientation", "Orientation");
 * mapper.setTypeRegistry(registry, "Gtk");
 *
 * const result = mapper.mapType({ name: "utf8" });
 * // { ts: "string", ffi: { type: "string", borrowed: false } }
 * ```
 */
export class TypeMapper {
    private enumNames: Set<string> = new Set();
    private enumTransforms: Map<string, string> = new Map();
    private recordNames: Set<string> = new Set();
    private recordTransforms: Map<string, string> = new Map();
    private recordGlibTypes: Map<string, string> = new Map();
    private skippedClasses: Set<string> = new Set();
    private onEnumUsed?: (enumName: string) => void;
    private onRecordUsed?: (recordName: string) => void;
    private onExternalTypeUsed?: (usage: ExternalTypeUsage) => void;
    private onSameNamespaceClassUsed?: (className: string, originalName: string) => void;
    private typeRegistry?: TypeRegistry;
    private currentNamespace?: string;
    private forceExternalNamespace?: string;

    /**
     * Registers an enumeration for type mapping.
     *
     * @param originalName - The GIR enum name
     * @param transformedName - Optional transformed TypeScript name
     */
    registerEnum(originalName: string, transformedName?: string): void {
        this.enumNames.add(originalName);
        if (transformedName) {
            this.enumTransforms.set(originalName, transformedName);
        }
    }

    /**
     * Registers a record for type mapping.
     *
     * @param originalName - The GIR record name
     * @param transformedName - Optional transformed TypeScript name
     * @param glibTypeName - Optional GLib type name for boxed type marshalling
     */
    registerRecord(originalName: string, transformedName?: string, glibTypeName?: string): void {
        this.recordNames.add(originalName);
        if (transformedName) {
            this.recordTransforms.set(originalName, transformedName);
        }
        if (glibTypeName) {
            this.recordGlibTypes.set(originalName, glibTypeName);
        }
    }

    setEnumUsageCallback(callback: ((enumName: string) => void) | null): void {
        this.onEnumUsed = callback ?? undefined;
    }

    getEnumUsageCallback(): ((enumName: string) => void) | null {
        return this.onEnumUsed ?? null;
    }

    setRecordUsageCallback(callback: ((recordName: string) => void) | null): void {
        this.onRecordUsed = callback ?? undefined;
    }

    getRecordUsageCallback(): ((recordName: string) => void) | null {
        return this.onRecordUsed ?? null;
    }

    setExternalTypeUsageCallback(callback: ((usage: ExternalTypeUsage) => void) | null): void {
        this.onExternalTypeUsed = callback ?? undefined;
    }

    getExternalTypeUsageCallback(): ((usage: ExternalTypeUsage) => void) | null {
        return this.onExternalTypeUsed ?? null;
    }

    setSameNamespaceClassUsageCallback(callback: ((className: string, originalName: string) => void) | null): void {
        this.onSameNamespaceClassUsed = callback ?? undefined;
    }

    getSameNamespaceClassUsageCallback(): ((className: string, originalName: string) => void) | null {
        return this.onSameNamespaceClassUsed ?? null;
    }

    /**
     * Sets the type registry for cross-namespace type resolution.
     *
     * @param registry - The type registry to use
     * @param currentNamespace - The current namespace being processed
     */
    setTypeRegistry(registry: TypeRegistry, currentNamespace: string): void {
        this.typeRegistry = registry;
        this.currentNamespace = currentNamespace;
    }

    setForceExternalNamespace(namespace: string | null): void {
        this.forceExternalNamespace = namespace ?? undefined;
    }

    registerSkippedClass(name: string): void {
        this.skippedClasses.add(name);
    }

    clearSkippedClasses(): void {
        this.skippedClasses.clear();
    }

    /**
     * Maps a GIR type to TypeScript and FFI representations.
     *
     * @param girType - The GIR type to map
     * @param isReturn - Whether this is a return type (affects ownership)
     * @returns The mapped type with TypeScript and FFI descriptors
     */
    mapType(girType: GirType, isReturn = false): MappedType {
        if (girType.isArray || girType.name === "array") {
            const listType = girType.cType?.includes("GSList")
                ? "gslist"
                : girType.cType?.includes("GList")
                  ? "glist"
                  : undefined;
            if (girType.elementType) {
                const elementType = this.mapType(girType.elementType);
                return {
                    ts: `${elementType.ts}[]`,
                    ffi: listType
                        ? { type: "array", itemType: elementType.ffi, listType, borrowed: isReturn }
                        : { type: "array", itemType: elementType.ffi },
                };
            }
            return {
                ts: `unknown[]`,
                ffi: listType
                    ? { type: "array", itemType: { type: "undefined" }, listType, borrowed: isReturn }
                    : { type: "array", itemType: { type: "undefined" } },
            };
        }

        if (STRING_TYPES.has(girType.name)) {
            const borrowed = girType.transferOwnership === "none";
            return {
                ts: "string",
                ffi: { type: "string", borrowed },
            };
        }

        const basicType = BASIC_TYPE_MAP.get(girType.name);
        if (basicType) {
            return basicType;
        }

        if (this.typeRegistry && this.currentNamespace && !girType.name.includes(".")) {
            const registered = this.typeRegistry.resolveInNamespace(girType.name, this.currentNamespace);
            if (registered) {
                const isExternal =
                    registered.namespace !== this.currentNamespace ||
                    registered.namespace === this.forceExternalNamespace;
                const qualifiedName = isExternal
                    ? `${registered.namespace}.${registered.transformedName}`
                    : registered.transformedName;
                const externalType: ExternalTypeUsage | undefined = isExternal
                    ? {
                          namespace: registered.namespace,
                          name: registered.name,
                          transformedName: registered.transformedName,
                          kind: registered.kind,
                      }
                    : undefined;
                if (isExternal) {
                    this.onExternalTypeUsed?.(externalType as ExternalTypeUsage);
                } else if (registered.kind === "class" || registered.kind === "interface") {
                    if (this.skippedClasses.has(registered.name)) {
                        return {
                            ts: "unknown",
                            ffi: { type: "gobject", borrowed: isReturn },
                        };
                    }
                    this.onSameNamespaceClassUsed?.(registered.transformedName, registered.name);
                } else if (registered.kind === "enum") {
                    this.onEnumUsed?.(registered.transformedName);
                } else if (registered.kind === "record") {
                    this.onRecordUsed?.(registered.transformedName);
                }

                if (registered.kind === "enum") {
                    return {
                        ts: qualifiedName,
                        ffi: { type: "int", size: 32, unsigned: false },
                        externalType,
                    };
                }

                if (registered.kind === "record") {
                    if (registered.name === "Variant" && registered.namespace === "GLib") {
                        return {
                            ts: qualifiedName,
                            ffi: { type: "gvariant", borrowed: isReturn },
                            externalType,
                            kind: registered.kind,
                        };
                    }
                    if (registered.isPlainStruct) {
                        return {
                            ts: qualifiedName,
                            ffi: {
                                type: "struct",
                                borrowed: isReturn,
                                innerType: registered.transformedName,
                                size: registered.structSize,
                            } as FfiTypeDescriptor,
                            externalType,
                            kind: registered.kind,
                        };
                    }
                    return {
                        ts: qualifiedName,
                        ffi: {
                            type: "boxed",
                            borrowed: isReturn,
                            innerType: registered.glibTypeName ?? registered.transformedName,
                            lib: registered.sharedLibrary,
                            getTypeFn: registered.glibGetType,
                        },
                        externalType,
                        kind: registered.kind,
                    };
                }

                if (registered.kind === "callback") {
                    return POINTER_TYPE;
                }

                return {
                    ts: qualifiedName,
                    ffi: { type: "gobject", borrowed: isReturn },
                    externalType,
                    kind: registered.kind,
                };
            }
        }

        if (this.enumNames.has(girType.name)) {
            const transformedName = this.enumTransforms.get(girType.name) ?? girType.name;
            this.onEnumUsed?.(transformedName);
            return {
                ts: transformedName,
                ffi: { type: "int", size: 32, unsigned: false },
            };
        }

        if (this.recordNames.has(girType.name)) {
            const transformedName = this.recordTransforms.get(girType.name) ?? girType.name;
            const glibTypeName = this.recordGlibTypes.get(girType.name) ?? transformedName;
            this.onRecordUsed?.(transformedName);
            return {
                ts: transformedName,
                ffi: { type: "boxed", borrowed: isReturn, innerType: glibTypeName },
            };
        }

        if (girType.name.includes(".")) {
            const [ns, typeName] = girType.name.split(".", 2);
            if (typeName && ns === this.currentNamespace) {
                if (this.enumNames.has(typeName)) {
                    const transformedName = this.enumTransforms.get(typeName) ?? typeName;
                    this.onEnumUsed?.(transformedName);
                    return {
                        ts: transformedName,
                        ffi: { type: "int", size: 32, unsigned: false },
                    };
                }
                if (this.recordNames.has(typeName)) {
                    const transformedName = this.recordTransforms.get(typeName) ?? typeName;
                    const glibTypeName = this.recordGlibTypes.get(typeName) ?? transformedName;
                    this.onRecordUsed?.(transformedName);
                    return {
                        ts: transformedName,
                        ffi: { type: "boxed", borrowed: isReturn, innerType: glibTypeName },
                    };
                }
            }
            if (this.typeRegistry && ns && typeName) {
                const registered = this.typeRegistry.resolve(girType.name);
                if (registered) {
                    const isExternal =
                        registered.namespace !== this.currentNamespace ||
                        registered.namespace === this.forceExternalNamespace;
                    const qualifiedName = isExternal
                        ? `${registered.namespace}.${registered.transformedName}`
                        : registered.transformedName;
                    const externalType: ExternalTypeUsage = {
                        namespace: registered.namespace,
                        name: registered.name,
                        transformedName: registered.transformedName,
                        kind: registered.kind,
                    };
                    if (isExternal) {
                        this.onExternalTypeUsed?.(externalType);
                    }
                    if (registered.kind === "enum") {
                        return {
                            ts: qualifiedName,
                            ffi: { type: "int", size: 32, unsigned: false },
                            externalType: isExternal ? externalType : undefined,
                        };
                    }
                    if (registered.kind === "record") {
                        if (registered.name === "Variant" && registered.namespace === "GLib") {
                            return {
                                ts: qualifiedName,
                                ffi: { type: "gvariant", borrowed: isReturn },
                                externalType: isExternal ? externalType : undefined,
                            };
                        }
                        if (registered.isPlainStruct) {
                            return {
                                ts: qualifiedName,
                                ffi: {
                                    type: "struct",
                                    borrowed: isReturn,
                                    innerType: registered.transformedName,
                                    size: registered.structSize,
                                } as FfiTypeDescriptor,
                                externalType: isExternal ? externalType : undefined,
                                kind: registered.kind,
                            };
                        }
                        return {
                            ts: qualifiedName,
                            ffi: {
                                type: "boxed",
                                borrowed: isReturn,
                                innerType: registered.glibTypeName ?? registered.transformedName,
                                lib: registered.sharedLibrary,
                                getTypeFn: registered.glibGetType,
                            },
                            externalType: isExternal ? externalType : undefined,
                        };
                    }
                    if (registered.kind === "callback") {
                        return POINTER_TYPE;
                    }
                    return {
                        ts: qualifiedName,
                        ffi: { type: "gobject", borrowed: isReturn },
                        externalType: isExternal ? externalType : undefined,
                        kind: registered.kind,
                    };
                }
            }
            return mapCType(girType.cType);
        }

        if (this.typeRegistry && this.currentNamespace) {
            const registered = this.typeRegistry.resolveInNamespace(girType.name, this.currentNamespace);
            if (registered) {
                const isExternal =
                    registered.namespace !== this.currentNamespace ||
                    registered.namespace === this.forceExternalNamespace;
                const qualifiedName = isExternal
                    ? `${registered.namespace}.${registered.transformedName}`
                    : registered.transformedName;
                const externalType: ExternalTypeUsage | undefined = isExternal
                    ? {
                          namespace: registered.namespace,
                          name: registered.name,
                          transformedName: registered.transformedName,
                          kind: registered.kind,
                      }
                    : undefined;
                if (isExternal) {
                    this.onExternalTypeUsed?.(externalType as ExternalTypeUsage);
                } else if (registered.kind === "class" || registered.kind === "interface") {
                    if (this.skippedClasses.has(registered.name)) {
                        return {
                            ts: "unknown",
                            ffi: { type: "gobject", borrowed: isReturn },
                        };
                    }
                    this.onSameNamespaceClassUsed?.(registered.transformedName, registered.name);
                }
                if (registered.kind === "enum") {
                    return {
                        ts: qualifiedName,
                        ffi: { type: "int", size: 32, unsigned: false },
                        externalType,
                    };
                }
                if (registered.kind === "record") {
                    if (registered.isPlainStruct) {
                        return {
                            ts: qualifiedName,
                            ffi: {
                                type: "struct",
                                borrowed: isReturn,
                                innerType: registered.transformedName,
                                size: registered.structSize,
                            } as FfiTypeDescriptor,
                            externalType,
                            kind: registered.kind,
                        };
                    }
                    return {
                        ts: qualifiedName,
                        ffi: {
                            type: "boxed",
                            borrowed: isReturn,
                            innerType: registered.glibTypeName ?? registered.transformedName,
                            lib: registered.sharedLibrary,
                            getTypeFn: registered.glibGetType,
                        },
                        externalType,
                        kind: registered.kind,
                    };
                }
                if (registered.kind === "callback") {
                    return POINTER_TYPE;
                }
                return {
                    ts: qualifiedName,
                    ffi: { type: "gobject", borrowed: isReturn },
                    externalType,
                    kind: registered.kind,
                };
            }
        }

        return mapCType(girType.cType);
    }

    isCallback(typeName: string): boolean {
        if (this.typeRegistry) {
            const resolved = this.currentNamespace
                ? this.typeRegistry.resolveInNamespace(typeName, this.currentNamespace)
                : this.typeRegistry.resolve(typeName);
            return resolved?.kind === "callback";
        }
        return false;
    }

    /**
     * Maps a function parameter to TypeScript and FFI representations.
     *
     * Handles special cases like out parameters, callbacks, and
     * ownership transfer.
     *
     * @param param - The GIR parameter to map
     * @returns The mapped type with TypeScript and FFI descriptors
     */
    mapParameter(param: GirParameter): MappedType {
        if (param.direction === "out" || param.direction === "inout") {
            const innerType = this.mapType(param.type);
            const isBoxedOrGObjectOrStruct =
                innerType.ffi.type === "boxed" ||
                innerType.ffi.type === "gobject" ||
                innerType.ffi.type === "struct";

            if (param.callerAllocates && isBoxedOrGObjectOrStruct) {
                return {
                    ...innerType,
                    ffi: {
                        ...innerType.ffi,
                        borrowed: true,
                    },
                };
            }

            if (!isBoxedOrGObjectOrStruct) {
                return {
                    ts: `Ref<${innerType.ts}>`,
                    ffi: {
                        type: "ref",
                        innerType: innerType.ffi,
                    },
                };
            }

            return {
                ts: `Ref<${innerType.ts}>`,
                ffi: {
                    type: "ref",
                    innerType: innerType.ffi,
                },
                externalType: innerType.externalType,
                kind: innerType.kind,
            };
        }

        if (param.type.name === "Gio.AsyncReadyCallback") {
            return {
                ts: "(source: unknown, result: unknown) => void",
                ffi: {
                    type: "callback",
                    trampoline: "asyncReady",
                    sourceType: { type: "gobject", borrowed: true },
                    resultType: { type: "gobject", borrowed: true },
                },
            };
        }

        if (param.type.name === "GLib.DestroyNotify" || param.type.name === "DestroyNotify") {
            return {
                ts: "() => void",
                ffi: {
                    type: "callback",
                    trampoline: "destroy",
                },
            };
        }

        if (param.type.name === "Gtk.DrawingAreaDrawFunc" || param.type.name === "DrawingAreaDrawFunc") {
            this.onExternalTypeUsed?.({
                namespace: "cairo",
                name: "Context",
                transformedName: "Context",
                kind: "record",
            });
            this.onSameNamespaceClassUsed?.("DrawingArea", "DrawingArea");
            return {
                ts: "(self: DrawingArea, cr: cairo.Context, width: number, height: number) => void",
                ffi: {
                    type: "callback",
                    trampoline: "drawFunc",
                    argTypes: [
                        { type: "gobject", borrowed: true },
                        {
                            type: "boxed",
                            borrowed: true,
                            innerType: "CairoContext",
                            lib: "libcairo-gobject.so.2",
                            getTypeFn: "cairo_gobject_context_get_type",
                        },
                        { type: "int", size: 32, unsigned: false },
                        { type: "int", size: 32, unsigned: false },
                    ],
                },
            };
        }

        if (param.type.name === "Gtk.ShortcutFunc" || param.type.name === "ShortcutFunc") {
            this.onSameNamespaceClassUsed?.("Widget", "Widget");
            this.onExternalTypeUsed?.({
                namespace: "GLib",
                name: "Variant",
                transformedName: "Variant",
                kind: "record",
            });
            return {
                ts: "(widget: Widget, args: GLib.Variant | null) => boolean",
                ffi: {
                    type: "callback",
                    trampoline: "shortcutFunc",
                    argTypes: [
                        { type: "gobject", borrowed: true },
                        { type: "gvariant", borrowed: true },
                    ],
                    returnType: { type: "boolean" },
                },
            };
        }

        if (
            param.type.name === "Gtk.TreeListModelCreateModelFunc" ||
            param.type.name === "TreeListModelCreateModelFunc"
        ) {
            this.onExternalTypeUsed?.({
                namespace: "GObject",
                name: "Object",
                transformedName: "GObject",
                kind: "class",
            });
            this.onExternalTypeUsed?.({
                namespace: "Gio",
                name: "ListModel",
                transformedName: "ListModel",
                kind: "interface",
            });
            return {
                ts: "(item: GObject.GObject) => Gio.ListModel | null",
                ffi: {
                    type: "callback",
                    trampoline: "treeListModelCreateFunc",
                    argTypes: [{ type: "gobject", borrowed: true }],
                    returnType: { type: "gobject", borrowed: true },
                },
            };
        }

        if (param.type.name === "GLib.Closure" || this.isCallback(param.type.name)) {
            return {
                ts: "(...args: unknown[]) => unknown",
                ffi: { type: "callback" },
            };
        }

        const mapped = this.mapType(param.type);
        const isObjectType = mapped.ffi.type === "gobject" || mapped.ffi.type === "boxed";
        const isTransferFull = param.transferOwnership === "full";
        const isTransferNone = param.transferOwnership === "none" || param.transferOwnership === undefined;

        if (isObjectType && isTransferFull) {
            return {
                ts: mapped.ts,
                ffi: { ...mapped.ffi, borrowed: false },
                externalType: mapped.externalType,
                kind: mapped.kind,
            };
        }

        if (isObjectType && isTransferNone) {
            return {
                ts: mapped.ts,
                ffi: { ...mapped.ffi, borrowed: true },
                externalType: mapped.externalType,
                kind: mapped.kind,
            };
        }

        return mapped;
    }

    isClosureTarget(paramIndex: number, allParams: GirParameter[]): boolean {
        const trampolineCallbacks = [
            "Gio.AsyncReadyCallback",
            "Gtk.DrawingAreaDrawFunc",
            "DrawingAreaDrawFunc",
            "GLib.CompareDataFunc",
            "CompareDataFunc",
            "GLib.SourceFunc",
            "SourceFunc",
            "Gtk.TickCallback",
            "TickCallback",
            "Gtk.ShortcutFunc",
            "ShortcutFunc",
            "Gtk.TreeListModelCreateModelFunc",
            "TreeListModelCreateModelFunc",
        ];
        return allParams.some(
            (p) => trampolineCallbacks.includes(p.type.name) && (p.closure === paramIndex || p.destroy === paramIndex),
        );
    }

    isNullable(param: GirParameter): boolean {
        return param.nullable === true || param.optional === true;
    }

    hasUnsupportedCallback(param: GirParameter): boolean {
        const supportedCallbacks = [
            "Gio.AsyncReadyCallback",
            "GLib.DestroyNotify",
            "DestroyNotify",
            "Gtk.DrawingAreaDrawFunc",
            "DrawingAreaDrawFunc",
            "Gtk.ShortcutFunc",
            "ShortcutFunc",
            "Gtk.TreeListModelCreateModelFunc",
            "TreeListModelCreateModelFunc",
        ];

        if (supportedCallbacks.includes(param.type.name)) {
            return false;
        }

        return param.type.name === "GLib.Closure" || this.isCallback(param.type.name);
    }
}
