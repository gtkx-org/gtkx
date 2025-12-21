import { normalizeClassName } from "./class-names.js";
import { toCamelCase, toPascalCase } from "./naming.js";

export { toCamelCase, toPascalCase };

/**
 * Represents a parsed GIR namespace containing all type definitions.
 */
export type GirNamespace = {
    /** The namespace name (e.g., "Gtk", "Gio"). */
    name: string;
    /** The namespace version (e.g., "4.0"). */
    version: string;
    /** The shared library file name. */
    sharedLibrary: string;
    /** The C identifier prefix for this namespace. */
    cPrefix: string;
    /** All classes defined in this namespace. */
    classes: GirClass[];
    /** All interfaces defined in this namespace. */
    interfaces: GirInterface[];
    /** All standalone functions defined in this namespace. */
    functions: GirFunction[];
    /** All enumerations defined in this namespace. */
    enumerations: GirEnumeration[];
    /** All bitfield enumerations defined in this namespace. */
    bitfields: GirEnumeration[];
    /** All records (structs) defined in this namespace. */
    records: GirRecord[];
    /** All callback types defined in this namespace. */
    callbacks: GirCallback[];
    /** All constants defined in this namespace. */
    constants: GirConstant[];
    /** Documentation for the namespace. */
    doc?: string;
};

/**
 * Represents a GIR constant definition.
 */
export type GirConstant = {
    /** The constant name. */
    name: string;
    /** The C type name. */
    cType: string;
    /** The constant value (as a string, may be numeric or string literal). */
    value: string;
    /** The type of the constant value. */
    type: GirType;
    /** Documentation for the constant. */
    doc?: string;
};

/**
 * Represents a GIR callback type definition.
 */
export type GirCallback = {
    /** The callback name. */
    name: string;
    /** The C type name. */
    cType: string;
    /** The return type. */
    returnType: GirType;
    /** The callback parameters. */
    parameters: GirParameter[];
    /** Documentation for the callback. */
    doc?: string;
};

/**
 * Represents a GIR interface definition.
 */
export type GirInterface = {
    /** The interface name. */
    name: string;
    /** The C type name. */
    cType: string;
    /** The GLib type name. */
    glibTypeName?: string;
    /** List of prerequisite interface names this interface requires. */
    prerequisites: string[];
    /** Methods defined on this interface. */
    methods: GirMethod[];
    /** Properties defined on this interface. */
    properties: GirProperty[];
    /** Signals defined on this interface. */
    signals: GirSignal[];
    /** Documentation for the interface. */
    doc?: string;
};

/**
 * Represents a GIR class definition.
 */
export type GirClass = {
    /** The class name. */
    name: string;
    /** The C type name. */
    cType: string;
    /** The parent class name, if any. */
    parent?: string;
    /** Whether this is an abstract class. */
    abstract?: boolean;
    /** The GLib type name. */
    glibTypeName?: string;
    /** The GLib get-type function. */
    glibGetType?: string;
    /** The C symbol prefix for this class. */
    cSymbolPrefix?: string;
    /** List of interface names this class implements. */
    implements: string[];
    /** Methods defined on this class. */
    methods: GirMethod[];
    /** Constructor functions for this class. */
    constructors: GirConstructor[];
    /** Static functions defined on this class. */
    functions: GirFunction[];
    /** Properties defined on this class. */
    properties: GirProperty[];
    /** Signals defined on this class. */
    signals: GirSignal[];
    /** Documentation for the class. */
    doc?: string;
};

/**
 * Represents a GIR record (struct) definition.
 */
export type GirRecord = {
    /** The record name. */
    name: string;
    /** The C type name. */
    cType: string;
    /** Whether this record is opaque (no field access). */
    opaque?: boolean;
    /** Whether this record is disguised (typically internal). */
    disguised?: boolean;
    /** The GLib type name for boxed types. */
    glibTypeName?: string;
    /** The GLib get-type function. */
    glibGetType?: string;
    /** Fields defined in this record. */
    fields: GirField[];
    /** Methods defined on this record. */
    methods: GirMethod[];
    /** Constructor functions for this record. */
    constructors: GirConstructor[];
    /** Static functions defined on this record. */
    functions: GirFunction[];
    /** Documentation for the record. */
    doc?: string;
};

/**
 * Represents a GIR field definition in a record.
 */
export type GirField = {
    /** The field name. */
    name: string;
    /** The field type. */
    type: GirType;
    /** Whether this field is writable. */
    writable?: boolean;
    /** Whether this field is readable. */
    readable?: boolean;
    /** Whether this field is private. */
    private?: boolean;
    /** Documentation for the field. */
    doc?: string;
};

/**
 * Represents a GIR method definition.
 */
export type GirMethod = {
    /** The method name. */
    name: string;
    /** The C function identifier. */
    cIdentifier: string;
    /** The return type. */
    returnType: GirType;
    /** The method parameters. */
    parameters: GirParameter[];
    /** Whether this method can throw a GError. */
    throws?: boolean;
    /** Documentation for the method. */
    doc?: string;
    /** Documentation for the return value. */
    returnDoc?: string;
};

/**
 * Represents a GIR constructor definition.
 */
export type GirConstructor = {
    /** The constructor name. */
    name: string;
    /** The C function identifier. */
    cIdentifier: string;
    /** The return type (typically the class type). */
    returnType: GirType;
    /** The constructor parameters. */
    parameters: GirParameter[];
    /** Whether this constructor can throw a GError. */
    throws?: boolean;
    /** Documentation for the constructor. */
    doc?: string;
    /** Documentation for the return value. */
    returnDoc?: string;
};

/**
 * Represents a GIR standalone function definition.
 */
export type GirFunction = {
    /** The function name. */
    name: string;
    /** The C function identifier. */
    cIdentifier: string;
    /** The return type. */
    returnType: GirType;
    /** The function parameters. */
    parameters: GirParameter[];
    /** Whether this function can throw a GError. */
    throws?: boolean;
    /** Documentation for the function. */
    doc?: string;
    /** Documentation for the return value. */
    returnDoc?: string;
};

/**
 * Represents a GIR parameter definition.
 */
export type GirParameter = {
    /** The parameter name. */
    name: string;
    /** The parameter type. */
    type: GirType;
    /** The parameter direction (in, out, or inout). */
    direction?: "in" | "out" | "inout";
    /** Whether the caller allocates memory for out parameters. */
    callerAllocates?: boolean;
    /** Whether this parameter can be null. */
    nullable?: boolean;
    /** Whether this parameter is optional. */
    optional?: boolean;
    /** The scope of the callback (async, call, notified). */
    scope?: "async" | "call" | "notified";
    /** Index of the closure/user_data parameter for callbacks. */
    closure?: number;
    /** Index of the destroy notifier parameter for callbacks. */
    destroy?: number;
    /** Transfer ownership semantics for the parameter. */
    transferOwnership?: "none" | "full" | "container";
    /** Documentation for the parameter. */
    doc?: string;
};

/**
 * Represents a GIR type reference.
 */
export type GirType = {
    /** The type name. */
    name: string;
    /** The C type name. */
    cType?: string;
    /** Whether this is an array type. */
    isArray?: boolean;
    /** The element type for array types. */
    elementType?: GirType;
    /** Transfer ownership semantics for return types. */
    transferOwnership?: "none" | "full" | "container";
    /** Whether this type can be null (for return types). */
    nullable?: boolean;
};

/**
 * Represents a GIR property definition.
 */
export type GirProperty = {
    /** The property name. */
    name: string;
    /** The property type. */
    type: GirType;
    /** Whether this property is readable. */
    readable?: boolean;
    /** Whether this property is writable. */
    writable?: boolean;
    /** Whether this property can only be set at construction time. */
    constructOnly?: boolean;
    /** Whether this property has a default value. */
    hasDefault?: boolean;
    /** The getter method name for this property. */
    getter?: string;
    /** The setter method name for this property. */
    setter?: string;
    /** Documentation for the property. */
    doc?: string;
};

/**
 * Represents a GIR signal definition.
 */
export type GirSignal = {
    /** The signal name. */
    name: string;
    /** When the signal handler runs relative to the default handler. */
    when?: "first" | "last" | "cleanup";
    /** The signal return type. */
    returnType?: GirType;
    /** The signal parameters passed to handlers. */
    parameters?: GirParameter[];
    /** Documentation for the signal. */
    doc?: string;
};

/**
 * Represents a GIR enumeration or bitfield definition.
 */
export type GirEnumeration = {
    /** The enumeration name. */
    name: string;
    /** The C type name. */
    cType: string;
    /** The enumeration members. */
    members: GirEnumerationMember[];
    /** Documentation for the enumeration. */
    doc?: string;
};

/**
 * Represents a single enumeration member.
 */
export type GirEnumerationMember = {
    /** The member name. */
    name: string;
    /** The numeric value. */
    value: string;
    /** The C identifier. */
    cIdentifier: string;
    /** Documentation for the member. */
    doc?: string;
};

/**
 * Describes an FFI type for code generation.
 */
export type FfiTypeDescriptor = {
    /** The FFI type category. */
    type: string;
    /** Size in bits for integer/float types. */
    size?: number;
    /** Whether the integer type is unsigned. */
    unsigned?: boolean;
    /** Whether the pointer is borrowed (not owned). */
    borrowed?: boolean;
    /** Inner type for ref types (as descriptor) or boxed types (as GLib type name string). */
    innerType?: FfiTypeDescriptor | string;
    /** Library name for boxed types that need dynamic type lookup. */
    lib?: string;
    /** Explicit get_type function name for boxed types (when naive transformation doesn't work). */
    getTypeFn?: string;
    /** Item type for array types. */
    itemType?: FfiTypeDescriptor;
    /** List type for arrays (glist, gslist) - indicates native GList/GSList iteration. */
    listType?: "glist" | "gslist";
    /** Trampoline type for callbacks. Default is "closure". */
    trampoline?: "asyncReady" | "destroy" | "drawFunc" | "scaleFormatValueFunc";
    /** Source type for asyncReady callback (the GObject source). */
    sourceType?: FfiTypeDescriptor;
    /** Result type for asyncReady callback (the GAsyncResult). */
    resultType?: FfiTypeDescriptor;
    /** Argument types for callbacks that need explicit type info (e.g., drawFunc). */
    argTypes?: FfiTypeDescriptor[];
    /** Whether this argument is optional (can be null/undefined for pointer types). */
    optional?: boolean;
};

/**
 * Builds a map of class names to class definitions for quick lookup.
 * @param classes - Array of GIR class definitions
 * @returns Map from class name to class definition
 */
export const buildClassMap = (classes: GirClass[]): Map<string, GirClass> => {
    const classMap = new Map<string, GirClass>();
    for (const cls of classes) {
        classMap.set(cls.name, cls);
    }
    return classMap;
};

/**
 * Registers all enumerations and bitfields from a namespace with a type mapper.
 * @param typeMapper - The TypeMapper instance to register with
 * @param namespace - The GIR namespace containing enums to register
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

export type TypeKind = "class" | "interface" | "enum" | "record" | "callback";

export type RegisteredType = {
    kind: TypeKind;
    name: string;
    namespace: string;
    transformedName: string;
    glibTypeName?: string;
    sharedLibrary?: string;
    glibGetType?: string;
};

/**
 * Registry for tracking all types across GIR namespaces.
 * Used for cross-namespace type resolution during code generation.
 */
export class TypeRegistry {
    private types = new Map<string, RegisteredType>();

    /**
     * Registers a class type.
     * @param namespace - The namespace containing the class
     * @param name - The class name
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
     * @param namespace - The namespace containing the interface
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
     * @param namespace - The namespace containing the enum
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
     * Registers a record (struct) type.
     * @param namespace - The namespace containing the record
     * @param name - The record name
     * @param glibTypeName - Optional GLib type name for boxed type handling
     * @param sharedLibrary - The shared library containing this record's type
     * @param glibGetType - The GLib get_type function name
     */
    registerRecord(
        namespace: string,
        name: string,
        glibTypeName?: string,
        sharedLibrary?: string,
        glibGetType?: string,
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
        });
    }

    /**
     * Registers a callback type.
     * @param namespace - The namespace containing the callback
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
     * Resolves a type by its fully qualified name (Namespace.TypeName).
     * @param qualifiedName - The fully qualified type name
     * @returns The registered type or undefined if not found
     */
    resolve(qualifiedName: string): RegisteredType | undefined {
        return this.types.get(qualifiedName);
    }

    /**
     * Resolves a type name within a namespace context.
     * First tries the current namespace, then searches all namespaces.
     * @param name - The type name (may or may not be qualified)
     * @param currentNamespace - The namespace to try first if name is not qualified
     * @returns The registered type or undefined if not found
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
     * Creates a TypeRegistry populated with all types from the given namespaces.
     * @param namespaces - Array of GIR namespaces to register
     * @returns A new TypeRegistry containing all types
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
                if (record.glibTypeName && !record.disguised) {
                    registry.registerRecord(
                        ns.name,
                        record.name,
                        record.glibTypeName,
                        ns.sharedLibrary,
                        record.glibGetType,
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

export type ExternalTypeUsage = {
    namespace: string;
    name: string;
    transformedName: string;
    kind: TypeKind;
};

export type MappedType = {
    ts: string;
    ffi: FfiTypeDescriptor;
    externalType?: ExternalTypeUsage;
    kind?: TypeKind;
    nullable?: boolean;
};

/**
 * Maps GIR types to TypeScript types and FFI type descriptors.
 * Handles basic types, enumerations, records, arrays, and object references.
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

    /**
     * Registers an enumeration type for mapping.
     * @param originalName - The original GIR enum name
     * @param transformedName - The transformed TypeScript enum name
     */
    registerEnum(originalName: string, transformedName?: string): void {
        this.enumNames.add(originalName);
        if (transformedName) {
            this.enumTransforms.set(originalName, transformedName);
        }
    }

    /**
     * Registers a record type for mapping.
     * @param originalName - The original GIR record name
     * @param transformedName - The transformed TypeScript class name
     * @param glibTypeName - The GLib type name for boxed type handling
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

    /**
     * Sets a callback to track enum usage during type mapping.
     * @param callback - Called when an enum is used, or null to clear
     */
    setEnumUsageCallback(callback: ((enumName: string) => void) | null): void {
        this.onEnumUsed = callback ?? undefined;
    }

    /**
     * Gets the current enum usage callback.
     * @returns The callback or null if not set
     */
    getEnumUsageCallback(): ((enumName: string) => void) | null {
        return this.onEnumUsed ?? null;
    }

    /**
     * Sets a callback to track record usage during type mapping.
     * @param callback - Called when a record is used, or null to clear
     */
    setRecordUsageCallback(callback: ((recordName: string) => void) | null): void {
        this.onRecordUsed = callback ?? undefined;
    }

    /**
     * Gets the current record usage callback.
     * @returns The callback or null if not set
     */
    getRecordUsageCallback(): ((recordName: string) => void) | null {
        return this.onRecordUsed ?? null;
    }

    /**
     * Sets a callback to track external type usage during type mapping.
     * @param callback - Called when an external type is used, or null to clear
     */
    setExternalTypeUsageCallback(callback: ((usage: ExternalTypeUsage) => void) | null): void {
        this.onExternalTypeUsed = callback ?? undefined;
    }

    /**
     * Gets the current external type usage callback.
     * @returns The callback or null if not set
     */
    getExternalTypeUsageCallback(): ((usage: ExternalTypeUsage) => void) | null {
        return this.onExternalTypeUsed ?? null;
    }

    /**
     * Sets a callback to track same-namespace class/interface usage during type mapping.
     * @param callback - Called when a same-namespace class is used, or null to clear
     */
    setSameNamespaceClassUsageCallback(callback: ((className: string, originalName: string) => void) | null): void {
        this.onSameNamespaceClassUsed = callback ?? undefined;
    }

    /**
     * Gets the current same-namespace class usage callback.
     * @returns The callback or null if not set
     */
    getSameNamespaceClassUsageCallback(): ((className: string, originalName: string) => void) | null {
        return this.onSameNamespaceClassUsed ?? null;
    }

    /**
     * Sets the type registry for cross-namespace type resolution.
     * @param registry - The TypeRegistry instance
     * @param currentNamespace - The current namespace being processed
     */
    setTypeRegistry(registry: TypeRegistry, currentNamespace: string): void {
        this.typeRegistry = registry;
        this.currentNamespace = currentNamespace;
    }

    registerSkippedClass(name: string): void {
        this.skippedClasses.add(name);
    }

    clearSkippedClasses(): void {
        this.skippedClasses.clear();
    }

    /**
     * Maps a GIR type to TypeScript and FFI type descriptors.
     * @param girType - The GIR type to map
     * @param isReturn - Whether this is a return type (affects pointer ownership)
     * @returns The TypeScript type string and FFI descriptor
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
                const isExternal = registered.namespace !== this.currentNamespace;
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
                    const isExternal = registered.namespace !== this.currentNamespace;
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
                const isExternal = registered.namespace !== this.currentNamespace;
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

    /**
     * Checks if a type name refers to a callback type.
     * @param typeName - The type name to check
     * @returns True if the type is a callback
     */
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
     * Maps a GIR parameter to TypeScript and FFI type descriptors.
     * Handles out/inout parameters by wrapping in Ref type.
     * @param param - The GIR parameter to map
     * @returns The TypeScript type string and FFI descriptor
     */
    mapParameter(param: GirParameter): MappedType {
        if (param.direction === "out" || param.direction === "inout") {
            const innerType = this.mapType(param.type);
            const isBoxedOrGObject = innerType.ffi.type === "boxed" || innerType.ffi.type === "gobject";

            if (param.callerAllocates && isBoxedOrGObject) {
                return {
                    ...innerType,
                    ffi: {
                        ...innerType.ffi,
                        borrowed: true,
                    },
                };
            }

            if (!isBoxedOrGObject) {
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

    /**
     * Checks if a parameter is a closure/user_data target or destroy notifier for a callback that uses trampolines.
     * These parameters are handled automatically by the trampoline mechanism.
     * @param paramIndex - The index of the parameter to check
     * @param allParams - All parameters in the method
     * @returns True if this parameter is user_data or destroy for a trampoline callback
     */
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
        ];
        return allParams.some(
            (p) => trampolineCallbacks.includes(p.type.name) && (p.closure === paramIndex || p.destroy === paramIndex),
        );
    }

    /**
     * Checks if a parameter can accept null values.
     * @param param - The parameter to check
     * @returns True if the parameter is nullable or optional
     */
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
        ];

        if (supportedCallbacks.includes(param.type.name)) {
            return false;
        }

        return param.type.name === "GLib.Closure" || this.isCallback(param.type.name);
    }
}
