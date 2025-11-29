/**
 * Represents a parsed GIR namespace containing all type definitions.
 */
export interface GirNamespace {
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
    /** Documentation for the namespace. */
    doc?: string;
}

/**
 * Represents a GIR interface definition.
 */
export interface GirInterface {
    /** The interface name. */
    name: string;
    /** The C type name. */
    cType: string;
    /** Methods defined on this interface. */
    methods: GirMethod[];
    /** Properties defined on this interface. */
    properties: GirProperty[];
    /** Signals defined on this interface. */
    signals: GirSignal[];
    /** Documentation for the interface. */
    doc?: string;
}

/**
 * Represents a GIR class definition.
 */
export interface GirClass {
    /** The class name. */
    name: string;
    /** The C type name. */
    cType: string;
    /** The parent class name, if any. */
    parent?: string;
    /** Whether this is an abstract class. */
    abstract?: boolean;
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
}

/**
 * Represents a GIR record (struct) definition.
 */
export interface GirRecord {
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
}

/**
 * Represents a GIR field definition in a record.
 */
export interface GirField {
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
}

/**
 * Represents a GIR method definition.
 */
export interface GirMethod {
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
}

/**
 * Represents a GIR constructor definition.
 */
export interface GirConstructor {
    /** The constructor name. */
    name: string;
    /** The C function identifier. */
    cIdentifier: string;
    /** The return type (typically the class type). */
    returnType: GirType;
    /** The constructor parameters. */
    parameters: GirParameter[];
    /** Documentation for the constructor. */
    doc?: string;
}

/**
 * Represents a GIR standalone function definition.
 */
export interface GirFunction {
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
}

/**
 * Represents a GIR parameter definition.
 */
export interface GirParameter {
    /** The parameter name. */
    name: string;
    /** The parameter type. */
    type: GirType;
    /** The parameter direction (in, out, or inout). */
    direction?: "in" | "out" | "inout";
    /** Whether this parameter can be null. */
    nullable?: boolean;
    /** Whether this parameter is optional. */
    optional?: boolean;
    /** The scope of the callback (async, call, notified). */
    scope?: "async" | "call" | "notified";
    /** Index of the closure/user_data parameter for callbacks. */
    closure?: number;
    /** Documentation for the parameter. */
    doc?: string;
}

/**
 * Represents a GIR type reference.
 */
export interface GirType {
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
}

/**
 * Represents a GIR property definition.
 */
export interface GirProperty {
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
}

/**
 * Represents a GIR signal definition.
 */
export interface GirSignal {
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
}

/**
 * Represents a GIR enumeration or bitfield definition.
 */
export interface GirEnumeration {
    /** The enumeration name. */
    name: string;
    /** The C type name. */
    cType: string;
    /** The enumeration members. */
    members: GirEnumerationMember[];
    /** Documentation for the enumeration. */
    doc?: string;
}

/**
 * Represents a single enumeration member.
 */
export interface GirEnumerationMember {
    /** The member name. */
    name: string;
    /** The numeric value. */
    value: string;
    /** The C identifier. */
    cIdentifier: string;
    /** Documentation for the member. */
    doc?: string;
}

/**
 * Describes an FFI type for code generation.
 */
export interface FfiTypeDescriptor {
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
    /** Item type for array types. */
    itemType?: FfiTypeDescriptor;
    /** List type for arrays (glist, gslist) - indicates native GList/GSList iteration. */
    listType?: "glist" | "gslist";
    /** Source type for asyncCallback (the GObject source). */
    sourceType?: FfiTypeDescriptor;
    /** Result type for asyncCallback (the GAsyncResult). */
    resultType?: FfiTypeDescriptor;
}

/**
 * Converts a snake_case or kebab-case string to camelCase.
 * @param str - The input string
 * @returns The camelCase version
 */
export const toCamelCase = (str: string): string => str.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());

/**
 * Converts a snake_case or kebab-case string to PascalCase.
 * @param str - The input string
 * @returns The PascalCase version
 */
export const toPascalCase = (str: string): string => {
    const camel = toCamelCase(str);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
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

export type TypeKind = "class" | "interface" | "enum" | "record";

export interface RegisteredType {
    kind: TypeKind;
    name: string;
    namespace: string;
    transformedName: string;
    glibTypeName?: string;
}

const CLASS_RENAMES = new Map<string, string>([
    ["Error", "GError"],
    ["Object", "GObject"],
]);

const normalizeTypeName = (name: string): string => {
    const pascalName = toPascalCase(name);
    return CLASS_RENAMES.get(pascalName) ?? pascalName;
};

export class TypeRegistry {
    private types = new Map<string, RegisteredType>();

    registerClass(namespace: string, name: string): void {
        const transformedName = normalizeTypeName(name);
        this.types.set(`${namespace}.${name}`, {
            kind: "class",
            name,
            namespace,
            transformedName,
        });
    }

    registerInterface(namespace: string, name: string): void {
        const transformedName = normalizeTypeName(name);
        this.types.set(`${namespace}.${name}`, {
            kind: "class",
            name,
            namespace,
            transformedName,
        });
    }

    registerEnum(namespace: string, name: string): void {
        const transformedName = toPascalCase(name);
        this.types.set(`${namespace}.${name}`, {
            kind: "enum",
            name,
            namespace,
            transformedName,
        });
    }

    registerRecord(namespace: string, name: string, glibTypeName?: string): void {
        const transformedName = normalizeTypeName(name);
        this.types.set(`${namespace}.${name}`, {
            kind: "record",
            name,
            namespace,
            transformedName,
            glibTypeName,
        });
    }

    resolve(qualifiedName: string): RegisteredType | undefined {
        return this.types.get(qualifiedName);
    }

    resolveInNamespace(name: string, currentNamespace: string): RegisteredType | undefined {
        if (name.includes(".")) {
            return this.resolve(name);
        }
        return this.resolve(`${currentNamespace}.${name}`);
    }

    static fromNamespaces(namespaces: GirNamespace[]): TypeRegistry {
        const registry = new TypeRegistry();
        for (const ns of namespaces) {
            for (const cls of ns.classes) {
                registry.registerClass(ns.name, cls.name);
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
                if (
                    record.glibTypeName &&
                    !record.disguised &&
                    !record.name.endsWith("Class") &&
                    !record.name.endsWith("Private") &&
                    !record.name.endsWith("Iface")
                ) {
                    registry.registerRecord(ns.name, record.name, record.glibTypeName);
                }
            }
        }
        return registry;
    }
}

const STRING_TYPES = new Set(["utf8", "filename"]);

const BASIC_TYPE_MAP = new Map<string, TypeMapping>([
    ["gboolean", { ts: "boolean", ffi: { type: "boolean" } }],
    ["gchar", { ts: "number", ffi: { type: "int", size: 8, unsigned: false } }],
    ["guchar", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["gint", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["guint", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["gshort", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["gushort", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
    ["glong", { ts: "number", ffi: { type: "int", size: 64, unsigned: false } }],
    ["gulong", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["GType", { ts: "number", ffi: { type: "int", size: 64, unsigned: true } }],
    ["gint8", { ts: "number", ffi: { type: "int", size: 8, unsigned: false } }],
    ["guint8", { ts: "number", ffi: { type: "int", size: 8, unsigned: true } }],
    ["gint16", { ts: "number", ffi: { type: "int", size: 32, unsigned: false } }],
    ["guint16", { ts: "number", ffi: { type: "int", size: 32, unsigned: true } }],
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

const LIBRARY_MAP: Record<string, string> = {
    Gtk: "libgtk-4.so.1",
    GObject: "libgobject-2.0.so.0",
    GLib: "libglib-2.0.so.0",
    Gio: "libgio-2.0.so.0",
    GdkPixbuf: "libgdk_pixbuf-2.0.so.0",
    Pango: "libpango-1.0.so.0",
    Cairo: "libcairo.so.2",
};

export interface ExternalTypeUsage {
    namespace: string;
    name: string;
    transformedName: string;
    kind: TypeKind;
}

export interface MappedType {
    ts: string;
    ffi: FfiTypeDescriptor;
    externalType?: ExternalTypeUsage;
    kind?: TypeKind;
    nullable?: boolean;
}

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
     * Sets a callback to track same-namespace class/interface usage during type mapping.
     * @param callback - Called when a same-namespace class is used, or null to clear
     */
    setSameNamespaceClassUsageCallback(callback: ((className: string, originalName: string) => void) | null): void {
        this.onSameNamespaceClassUsed = callback ?? undefined;
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
                            },
                            externalType: isExternal ? externalType : undefined,
                        };
                    }
                    return {
                        ts: qualifiedName,
                        ffi: { type: "gobject", borrowed: isReturn },
                        externalType: isExternal ? externalType : undefined,
                        kind: registered.kind,
                    };
                }
            }
            return {
                ts: "unknown",
                ffi: { type: "gobject", borrowed: isReturn },
            };
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
                        },
                        externalType,
                        kind: registered.kind,
                    };
                }
                return {
                    ts: qualifiedName,
                    ffi: { type: "gobject", borrowed: isReturn },
                    externalType,
                    kind: registered.kind,
                };
            }
        }

        return {
            ts: "unknown",
            ffi: { type: "gobject", borrowed: isReturn },
        };
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
            return {
                ts: `Ref<${innerType.ts}>`,
                ffi: {
                    type: "ref",
                    innerType: innerType.ffi,
                },
            };
        }

        if (param.type.name === "Gio.AsyncReadyCallback") {
            return {
                ts: "(source: unknown, result: unknown) => void",
                ffi: {
                    type: "asyncCallback",
                    sourceType: { type: "gobject", borrowed: true },
                    resultType: { type: "gobject", borrowed: true },
                },
            };
        }

        if (param.type.name === "GLib.Closure" || param.type.name.endsWith("Func")) {
            return {
                ts: "(...args: unknown[]) => unknown",
                ffi: { type: "callback" },
            };
        }

        return this.mapType(param.type);
    }

    /**
     * Checks if a parameter is a closure/user_data target for a GAsyncReadyCallback.
     * @param paramIndex - The index of the parameter to check
     * @param allParams - All parameters in the method
     * @returns True if this parameter is user_data for a GAsyncReadyCallback
     */
    isClosureTarget(paramIndex: number, allParams: GirParameter[]): boolean {
        return allParams.some((p) => p.type.name === "Gio.AsyncReadyCallback" && p.closure === paramIndex);
    }

    /**
     * Checks if a parameter can accept null values.
     * @param param - The parameter to check
     * @returns True if the parameter is nullable or optional
     */
    isNullable(param: GirParameter): boolean {
        return param.nullable === true || param.optional === true;
    }

    /**
     * Gets the shared library name for a namespace.
     * @param namespace - The namespace name
     * @returns The shared library file name
     */
    getLibraryName(namespace: string): string {
        return LIBRARY_MAP[namespace] ?? `lib${namespace.toLowerCase()}.so`;
    }
}
