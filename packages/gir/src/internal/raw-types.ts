/**
 * Raw GIR type definitions.
 *
 * These types represent the structure of parsed GIR XML data before normalization.
 * They are internal to the @gtkx/gir package and not exported publicly.
 *
 * @internal
 */

import type { ContainerType } from "../types.js";

export type { ContainerType };

/**
 * Represents a parsed GIR namespace (library).
 *
 * Contains all type definitions from a single GIR file, including
 * classes, interfaces, functions, enums, records, and callbacks.
 */
export type RawNamespace = {
    name: string;
    version: string;
    sharedLibrary: string;
    cPrefix: string;
    classes: RawClass[];
    interfaces: RawInterface[];
    functions: RawFunction[];
    enumerations: RawEnumeration[];
    bitfields: RawEnumeration[];
    records: RawRecord[];
    callbacks: RawCallback[];
    constants: RawConstant[];
    doc?: string;
};

/**
 * A constant value defined in a GIR namespace.
 */
export type RawConstant = {
    name: string;
    cType: string;
    value: string;
    type: RawType;
    doc?: string;
};

/**
 * A callback type definition (function pointer type).
 */
export type RawCallback = {
    name: string;
    cType: string;
    returnType: RawType;
    parameters: RawParameter[];
    doc?: string;
};

/**
 * A GObject interface definition.
 */
export type RawInterface = {
    name: string;
    cType: string;
    glibTypeName?: string;
    prerequisites: string[];
    methods: RawMethod[];
    properties: RawProperty[];
    signals: RawSignal[];
    doc?: string;
};

/**
 * A GObject class definition.
 */
export type RawClass = {
    name: string;
    cType: string;
    parent?: string;
    abstract?: boolean;
    glibTypeName?: string;
    glibGetType?: string;
    cSymbolPrefix?: string;
    fundamental?: boolean;
    refFunc?: string;
    unrefFunc?: string;
    implements: string[];
    methods: RawMethod[];
    constructors: RawConstructor[];
    functions: RawFunction[];
    properties: RawProperty[];
    signals: RawSignal[];
    doc?: string;
};

/**
 * A GLib record (boxed type or struct).
 */
export type RawRecord = {
    name: string;
    cType: string;
    opaque?: boolean;
    disguised?: boolean;
    glibTypeName?: string;
    glibGetType?: string;
    isGtypeStructFor?: string;
    copyFunction?: string;
    freeFunction?: string;
    fields: RawField[];
    methods: RawMethod[];
    constructors: RawConstructor[];
    functions: RawFunction[];
    doc?: string;
};

/**
 * A field within a record or class.
 */
export type RawField = {
    name: string;
    type: RawType;
    writable?: boolean;
    readable?: boolean;
    private?: boolean;
    doc?: string;
};

/**
 * A method on a class, interface, or record.
 */
export type RawMethod = {
    name: string;
    cIdentifier: string;
    returnType: RawType;
    parameters: RawParameter[];
    throws?: boolean;
    doc?: string;
    returnDoc?: string;
    /** For async methods, the name of the corresponding finish function */
    finishFunc?: string;
    shadows?: string;
    shadowedBy?: string;
};

/**
 * A constructor for a class or record.
 */
export type RawConstructor = {
    name: string;
    cIdentifier: string;
    returnType: RawType;
    parameters: RawParameter[];
    throws?: boolean;
    doc?: string;
    returnDoc?: string;
    shadows?: string;
    shadowedBy?: string;
};

/**
 * A standalone function or static method.
 */
export type RawFunction = {
    name: string;
    cIdentifier: string;
    returnType: RawType;
    parameters: RawParameter[];
    throws?: boolean;
    doc?: string;
    returnDoc?: string;
    shadows?: string;
    shadowedBy?: string;
};

/**
 * A parameter to a function, method, or callback.
 */
export type RawParameter = {
    name: string;
    type: RawType;
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
 * Type names may be unqualified (e.g., "Widget") for local types
 * or qualified (e.g., "GObject.Object") for cross-namespace references.
 */
export type RawType = {
    name: string;
    cType?: string;
    isArray?: boolean;
    elementType?: RawType;
    typeParameters?: RawType[];
    containerType?: ContainerType;
    transferOwnership?: "none" | "full" | "container";
    nullable?: boolean;
    lengthParamIndex?: number;
    zeroTerminated?: boolean;
    fixedSize?: number;
};

/**
 * A GObject property definition.
 */
export type RawProperty = {
    name: string;
    type: RawType;
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
 */
export type RawSignal = {
    name: string;
    when?: "first" | "last" | "cleanup";
    returnType?: RawType;
    parameters?: RawParameter[];
    doc?: string;
};

/**
 * An enumeration or bitfield definition.
 */
export type RawEnumeration = {
    name: string;
    cType: string;
    members: RawEnumerationMember[];
    doc?: string;
};

/**
 * A member of an enumeration or bitfield.
 */
export type RawEnumerationMember = {
    name: string;
    value: string;
    cIdentifier: string;
    doc?: string;
};
