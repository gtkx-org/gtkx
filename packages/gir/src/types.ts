/**
 * Normalized GIR types with helper methods.
 *
 * All type references use fully qualified names (Namespace.TypeName)
 * except for intrinsic types which remain unqualified.
 */

import { isIntrinsicType, isNumericType, isStringType, isVoidType } from "./intrinsics.js";

/**
 * A fully qualified type name.
 * Always in the format "Namespace.TypeName" (e.g., "Gtk.Widget", "GLib.Variant").
 * Intrinsic types like "gint" are NOT QualifiedNames.
 */
export type QualifiedName = string & { readonly __brand: "QualifiedName" };

/**
 * Creates a QualifiedName from namespace and type name.
 */
export const qualifiedName = (namespace: string, name: string): QualifiedName => {
    return `${namespace}.${name}` as QualifiedName;
};

/**
 * Parses a QualifiedName into its parts.
 */
export const parseQualifiedName = (qn: QualifiedName): { namespace: string; name: string } => {
    const dot = qn.indexOf(".");
    return {
        namespace: qn.slice(0, dot),
        name: qn.slice(dot + 1),
    };
};

/**
 * The kind of a user-defined type (not intrinsic).
 */
export type TypeKind = "class" | "interface" | "record" | "enum" | "flags" | "callback";

/**
 * Container type discriminator for generic GLib containers.
 */
export type ContainerType = "ghashtable" | "gptrarray" | "garray" | "glist" | "gslist";

type RepositoryLike = {
    resolveClass(name: QualifiedName): GirClass | null;
    resolveInterface(name: QualifiedName): GirInterface | null;
    resolveRecord(name: QualifiedName): GirRecord | null;
    resolveEnum(name: QualifiedName): GirEnumeration | null;
    resolveFlags(name: QualifiedName): GirEnumeration | null;
    resolveCallback(name: QualifiedName): GirCallback | null;
    getTypeKind(name: QualifiedName): TypeKind | null;
    findClasses(predicate: (cls: GirClass) => boolean): GirClass[];
};

/**
 * Normalized namespace containing all resolved types.
 */
export class GirNamespace {
    readonly name: string;
    readonly version: string;
    readonly sharedLibrary: string;
    readonly cPrefix: string;
    readonly classes: Map<string, GirClass>;
    readonly interfaces: Map<string, GirInterface>;
    readonly records: Map<string, GirRecord>;
    readonly enumerations: Map<string, GirEnumeration>;
    readonly bitfields: Map<string, GirEnumeration>;
    readonly callbacks: Map<string, GirCallback>;
    readonly functions: Map<string, GirFunction>;
    readonly constants: Map<string, GirConstant>;
    readonly doc?: string;

    constructor(data: {
        name: string;
        version: string;
        sharedLibrary: string;
        cPrefix: string;
        classes: Map<string, GirClass>;
        interfaces: Map<string, GirInterface>;
        records: Map<string, GirRecord>;
        enumerations: Map<string, GirEnumeration>;
        bitfields: Map<string, GirEnumeration>;
        callbacks: Map<string, GirCallback>;
        functions: Map<string, GirFunction>;
        constants: Map<string, GirConstant>;
        doc?: string;
    }) {
        this.name = data.name;
        this.version = data.version;
        this.sharedLibrary = data.sharedLibrary;
        this.cPrefix = data.cPrefix;
        this.classes = data.classes;
        this.interfaces = data.interfaces;
        this.records = data.records;
        this.enumerations = data.enumerations;
        this.bitfields = data.bitfields;
        this.callbacks = data.callbacks;
        this.functions = data.functions;
        this.constants = data.constants;
        this.doc = data.doc;
    }
}

/**
 * Normalized class with helper methods.
 */
export class GirClass {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly parent: QualifiedName | null;
    readonly abstract: boolean;
    readonly glibTypeName?: string;
    readonly glibGetType?: string;
    readonly cSymbolPrefix?: string;
    readonly fundamental: boolean;
    readonly refFunc?: string;
    readonly unrefFunc?: string;
    readonly implements: QualifiedName[];
    readonly methods: GirMethod[];
    readonly constructors: GirConstructor[];
    readonly staticFunctions: GirFunction[];
    readonly properties: GirProperty[];
    readonly signals: GirSignal[];
    readonly doc?: string;

    /** @internal */
    private _repo?: RepositoryLike;

    constructor(data: {
        name: string;
        qualifiedName: QualifiedName;
        cType: string;
        parent: QualifiedName | null;
        abstract: boolean;
        glibTypeName?: string;
        glibGetType?: string;
        cSymbolPrefix?: string;
        fundamental?: boolean;
        refFunc?: string;
        unrefFunc?: string;
        implements: QualifiedName[];
        methods: GirMethod[];
        constructors: GirConstructor[];
        staticFunctions: GirFunction[];
        properties: GirProperty[];
        signals: GirSignal[];
        doc?: string;
    }) {
        this.name = data.name;
        this.qualifiedName = data.qualifiedName;
        this.cType = data.cType;
        this.parent = data.parent;
        this.abstract = data.abstract;
        this.glibTypeName = data.glibTypeName;
        this.glibGetType = data.glibGetType;
        this.cSymbolPrefix = data.cSymbolPrefix;
        this.fundamental = data.fundamental ?? false;
        this.refFunc = data.refFunc;
        this.unrefFunc = data.unrefFunc;
        this.implements = data.implements;
        this.methods = data.methods;
        this.constructors = data.constructors;
        this.staticFunctions = data.staticFunctions;
        this.properties = data.properties;
        this.signals = data.signals;
        this.doc = data.doc;
    }

    /** @internal */
    _setRepository(repo: RepositoryLike): void {
        this._repo = repo;
    }

    /** Checks if this class is a subclass of another (direct or transitive). */
    isSubclassOf(qualifiedName: QualifiedName): boolean {
        if (this.qualifiedName === qualifiedName) return true;
        if (!this.parent || !this._repo) return false;
        if (this.parent === qualifiedName) return true;
        const parentClass = this._repo.resolveClass(this.parent);
        return parentClass?.isSubclassOf(qualifiedName) ?? false;
    }

    /** Gets the full inheritance chain from this class to the root. */
    getInheritanceChain(): QualifiedName[] {
        const chain: QualifiedName[] = [this.qualifiedName];
        let current: GirClass | null = this;
        while (current?.parent && this._repo) {
            chain.push(current.parent);
            current = this._repo.resolveClass(current.parent);
        }
        return chain;
    }

    /** Gets the parent class object, or null if this is a root class. */
    getParent(): GirClass | null {
        return this.parent && this._repo ? this._repo.resolveClass(this.parent) : null;
    }

    /** Checks if this class directly or transitively implements an interface. */
    implementsInterface(qualifiedName: QualifiedName): boolean {
        if (this.implements.includes(qualifiedName)) return true;
        const parent = this.getParent();
        return parent?.implementsInterface(qualifiedName) ?? false;
    }

    /** Gets all implemented interfaces including inherited ones. */
    getAllImplementedInterfaces(): QualifiedName[] {
        const interfaces = new Set<QualifiedName>(this.implements);
        let current = this.getParent();
        while (current) {
            for (const iface of current.implements) {
                interfaces.add(iface);
            }
            current = current.getParent();
        }
        return [...interfaces];
    }

    /** Finds a method defined on this class by name. */
    getMethod(name: string): GirMethod | null {
        return this.methods.find((m) => m.name === name) ?? null;
    }

    /** Finds a property defined on this class by name. */
    getProperty(name: string): GirProperty | null {
        return this.properties.find((p) => p.name === name) ?? null;
    }

    /** Finds a signal defined on this class by name. */
    getSignal(name: string): GirSignal | null {
        return this.signals.find((s) => s.name === name) ?? null;
    }

    /** Finds a constructor by name. */
    getConstructor(name: string): GirConstructor | null {
        return this.constructors.find((c) => c.name === name) ?? null;
    }

    /** Gets all methods including inherited ones. */
    getAllMethods(): GirMethod[] {
        const methods = [...this.methods];
        let current = this.getParent();
        while (current) {
            methods.push(...current.methods);
            current = current.getParent();
        }
        return methods;
    }

    /** Gets all properties including inherited ones. */
    getAllProperties(): GirProperty[] {
        const properties = [...this.properties];
        let current = this.getParent();
        while (current) {
            properties.push(...current.properties);
            current = current.getParent();
        }
        return properties;
    }

    /** Gets all signals including inherited ones. */
    getAllSignals(): GirSignal[] {
        const signals = [...this.signals];
        let current = this.getParent();
        while (current) {
            signals.push(...current.signals);
            current = current.getParent();
        }
        return signals;
    }

    /** Finds a method by name, searching up the inheritance chain. */
    findMethod(name: string): GirMethod | null {
        const own = this.getMethod(name);
        if (own) return own;
        return this.getParent()?.findMethod(name) ?? null;
    }

    /** Finds a property by name, searching up the inheritance chain. */
    findProperty(name: string): GirProperty | null {
        const own = this.getProperty(name);
        if (own) return own;
        return this.getParent()?.findProperty(name) ?? null;
    }

    /** Finds a signal by name, searching up the inheritance chain. */
    findSignal(name: string): GirSignal | null {
        const own = this.getSignal(name);
        if (own) return own;
        return this.getParent()?.findSignal(name) ?? null;
    }

    /** True if this is an abstract class. */
    isAbstract(): boolean {
        return this.abstract;
    }

    /** True if this has a GType (most GObject classes do). */
    hasGType(): boolean {
        return this.glibTypeName !== undefined;
    }

    /** True if this is a fundamental type with custom ref/unref functions. */
    isFundamental(): boolean {
        return this.fundamental && this.refFunc !== undefined && this.unrefFunc !== undefined;
    }

    /** Gets direct subclasses of this class. */
    getDirectSubclasses(): GirClass[] {
        if (!this._repo) return [];
        return this._repo.findClasses((cls) => cls.parent === this.qualifiedName);
    }
}

/**
 * Normalized interface with helper methods.
 */
export class GirInterface {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly glibTypeName?: string;
    readonly prerequisites: QualifiedName[];
    readonly methods: GirMethod[];
    readonly properties: GirProperty[];
    readonly signals: GirSignal[];
    readonly doc?: string;

    /** @internal */
    private _repo?: RepositoryLike;

    constructor(data: {
        name: string;
        qualifiedName: QualifiedName;
        cType: string;
        glibTypeName?: string;
        prerequisites: QualifiedName[];
        methods: GirMethod[];
        properties: GirProperty[];
        signals: GirSignal[];
        doc?: string;
    }) {
        this.name = data.name;
        this.qualifiedName = data.qualifiedName;
        this.cType = data.cType;
        this.glibTypeName = data.glibTypeName;
        this.prerequisites = data.prerequisites;
        this.methods = data.methods;
        this.properties = data.properties;
        this.signals = data.signals;
        this.doc = data.doc;
    }

    /** @internal */
    _setRepository(repo: RepositoryLike): void {
        this._repo = repo;
    }

    /** Checks if this interface has a prerequisite (direct or transitive). */
    hasPrerequisite(qualifiedName: QualifiedName): boolean {
        if (this.prerequisites.includes(qualifiedName)) return true;
        if (!this._repo) return false;
        for (const prereq of this.prerequisites) {
            const prereqIface = this._repo.resolveInterface(prereq);
            if (prereqIface?.hasPrerequisite(qualifiedName)) return true;
        }
        return false;
    }

    /** Gets all prerequisites including transitive ones. */
    getAllPrerequisites(): QualifiedName[] {
        const all = new Set<QualifiedName>(this.prerequisites);
        if (this._repo) {
            for (const prereq of this.prerequisites) {
                const prereqIface = this._repo.resolveInterface(prereq);
                if (prereqIface) {
                    for (const p of prereqIface.getAllPrerequisites()) {
                        all.add(p);
                    }
                }
            }
        }
        return [...all];
    }

    /** Finds a method by name. */
    getMethod(name: string): GirMethod | null {
        return this.methods.find((m) => m.name === name) ?? null;
    }

    /** Finds a property by name. */
    getProperty(name: string): GirProperty | null {
        return this.properties.find((p) => p.name === name) ?? null;
    }

    /** Finds a signal by name. */
    getSignal(name: string): GirSignal | null {
        return this.signals.find((s) => s.name === name) ?? null;
    }
}

/**
 * Normalized record (boxed type or plain struct) with helper methods.
 */
export class GirRecord {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly opaque: boolean;
    readonly disguised: boolean;
    readonly glibTypeName?: string;
    readonly glibGetType?: string;
    readonly isGtypeStructFor?: string;
    readonly copyFunction?: string;
    readonly freeFunction?: string;
    readonly fields: GirField[];
    readonly methods: GirMethod[];
    readonly constructors: GirConstructor[];
    readonly staticFunctions: GirFunction[];
    readonly doc?: string;

    constructor(data: {
        name: string;
        qualifiedName: QualifiedName;
        cType: string;
        opaque: boolean;
        disguised: boolean;
        glibTypeName?: string;
        glibGetType?: string;
        isGtypeStructFor?: string;
        copyFunction?: string;
        freeFunction?: string;
        fields: GirField[];
        methods: GirMethod[];
        constructors: GirConstructor[];
        staticFunctions: GirFunction[];
        doc?: string;
    }) {
        this.name = data.name;
        this.qualifiedName = data.qualifiedName;
        this.cType = data.cType;
        this.opaque = data.opaque;
        this.disguised = data.disguised;
        this.glibTypeName = data.glibTypeName;
        this.glibGetType = data.glibGetType;
        this.isGtypeStructFor = data.isGtypeStructFor;
        this.copyFunction = data.copyFunction;
        this.freeFunction = data.freeFunction;
        this.fields = data.fields;
        this.methods = data.methods;
        this.constructors = data.constructors;
        this.staticFunctions = data.staticFunctions;
        this.doc = data.doc;
    }

    /** True if this is a fundamental type with custom copy/free functions. */
    isFundamental(): boolean {
        return this.copyFunction !== undefined && this.freeFunction !== undefined;
    }

    /** True if this is a GLib boxed type (has glibTypeName). */
    isBoxed(): boolean {
        return this.glibTypeName !== undefined;
    }

    /** True if this is a GType struct (vtable for a class/interface). */
    isGtypeStruct(): boolean {
        return this.isGtypeStructFor !== undefined;
    }

    /** True if this is a plain C struct (no GType, has public fields). */
    isPlainStruct(): boolean {
        return !this.glibTypeName && !this.opaque && this.getPublicFields().length > 0;
    }

    /** Gets public (non-private) fields only. */
    getPublicFields(): GirField[] {
        return this.fields.filter((f) => !f.private);
    }

    /** Finds a method by name. */
    getMethod(name: string): GirMethod | null {
        return this.methods.find((m) => m.name === name) ?? null;
    }

    /** Finds a field by name. */
    getField(name: string): GirField | null {
        return this.fields.find((f) => f.name === name) ?? null;
    }

    /** Finds a constructor by name. */
    getConstructor(name: string): GirConstructor | null {
        return this.constructors.find((c) => c.name === name) ?? null;
    }
}

/**
 * Normalized enumeration with helper methods.
 */
export class GirEnumeration {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly members: GirEnumerationMember[];
    readonly doc?: string;

    constructor(data: {
        name: string;
        qualifiedName: QualifiedName;
        cType: string;
        members: GirEnumerationMember[];
        doc?: string;
    }) {
        this.name = data.name;
        this.qualifiedName = data.qualifiedName;
        this.cType = data.cType;
        this.members = data.members;
        this.doc = data.doc;
    }

    /** Finds a member by name. */
    getMember(name: string): GirEnumerationMember | null {
        return this.members.find((m) => m.name === name) ?? null;
    }

    /** Finds a member by value. */
    getMemberByValue(value: string): GirEnumerationMember | null {
        return this.members.find((m) => m.value === value) ?? null;
    }

    /** Gets all member names. */
    getMemberNames(): string[] {
        return this.members.map((m) => m.name);
    }
}

/**
 * Normalized enumeration member.
 */
export class GirEnumerationMember {
    readonly name: string;
    readonly value: string;
    readonly cIdentifier: string;
    readonly doc?: string;

    constructor(data: { name: string; value: string; cIdentifier: string; doc?: string }) {
        this.name = data.name;
        this.value = data.value;
        this.cIdentifier = data.cIdentifier;
        this.doc = data.doc;
    }
}

/**
 * Normalized callback type.
 */
export class GirCallback {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly returnType: GirType;
    readonly parameters: GirParameter[];
    readonly doc?: string;

    constructor(data: {
        name: string;
        qualifiedName: QualifiedName;
        cType: string;
        returnType: GirType;
        parameters: GirParameter[];
        doc?: string;
    }) {
        this.name = data.name;
        this.qualifiedName = data.qualifiedName;
        this.cType = data.cType;
        this.returnType = data.returnType;
        this.parameters = data.parameters;
        this.doc = data.doc;
    }
}

/**
 * Normalized constant.
 */
export class GirConstant {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly value: string;
    readonly type: GirType;
    readonly doc?: string;

    constructor(data: {
        name: string;
        qualifiedName: QualifiedName;
        cType: string;
        value: string;
        type: GirType;
        doc?: string;
    }) {
        this.name = data.name;
        this.qualifiedName = data.qualifiedName;
        this.cType = data.cType;
        this.value = data.value;
        this.type = data.type;
        this.doc = data.doc;
    }
}

/**
 * Normalized method with helper methods.
 */
export class GirMethod {
    readonly name: string;
    readonly cIdentifier: string;
    readonly returnType: GirType;
    readonly parameters: GirParameter[];
    readonly throws: boolean;
    readonly doc?: string;
    readonly returnDoc?: string;
    /** For async methods, the name of the corresponding finish function */
    readonly finishFunc?: string;
    readonly shadows?: string;
    readonly shadowedBy?: string;

    constructor(data: {
        name: string;
        cIdentifier: string;
        returnType: GirType;
        parameters: GirParameter[];
        throws: boolean;
        doc?: string;
        returnDoc?: string;
        finishFunc?: string;
        shadows?: string;
        shadowedBy?: string;
    }) {
        this.name = data.name;
        this.cIdentifier = data.cIdentifier;
        this.returnType = data.returnType;
        this.parameters = data.parameters;
        this.throws = data.throws;
        this.doc = data.doc;
        this.returnDoc = data.returnDoc;
        this.finishFunc = data.finishFunc;
        this.shadows = data.shadows;
        this.shadowedBy = data.shadowedBy;
    }

    /** True if this follows the async/finish pattern. */
    isAsync(): boolean {
        return this.name.endsWith("_async") || this.parameters.some((p) => p.scope === "async");
    }

    /** True if this is a _finish method for an async operation. */
    isAsyncFinish(): boolean {
        return this.name.endsWith("_finish");
    }

    /** Gets the corresponding _finish method name if this is async. */
    getFinishMethodName(): string | null {
        if (this.name.endsWith("_async")) {
            return this.name.replace(/_async$/, "_finish");
        }
        return null;
    }

    /** Gets required (non-optional, non-nullable) parameters. */
    getRequiredParameters(): GirParameter[] {
        return this.parameters.filter((p) => !p.optional && !p.nullable && p.direction === "in");
    }

    /** Gets optional parameters. */
    getOptionalParameters(): GirParameter[] {
        return this.parameters.filter((p) => p.optional || p.nullable);
    }

    /** True if any parameter is an out parameter. */
    hasOutParameters(): boolean {
        return this.parameters.some((p) => p.direction === "out" || p.direction === "inout");
    }

    /** Gets out parameters only. */
    getOutParameters(): GirParameter[] {
        return this.parameters.filter((p) => p.direction === "out" || p.direction === "inout");
    }
}

/**
 * Normalized constructor.
 */
export class GirConstructor {
    readonly name: string;
    readonly cIdentifier: string;
    readonly returnType: GirType;
    readonly parameters: GirParameter[];
    readonly throws: boolean;
    readonly doc?: string;
    readonly returnDoc?: string;
    readonly shadows?: string;
    readonly shadowedBy?: string;

    constructor(data: {
        name: string;
        cIdentifier: string;
        returnType: GirType;
        parameters: GirParameter[];
        throws: boolean;
        doc?: string;
        returnDoc?: string;
        shadows?: string;
        shadowedBy?: string;
    }) {
        this.name = data.name;
        this.cIdentifier = data.cIdentifier;
        this.returnType = data.returnType;
        this.parameters = data.parameters;
        this.throws = data.throws;
        this.doc = data.doc;
        this.returnDoc = data.returnDoc;
        this.shadows = data.shadows;
        this.shadowedBy = data.shadowedBy;
    }

    /** Gets required (non-optional, non-nullable) parameters. */
    getRequiredParameters(): GirParameter[] {
        return this.parameters.filter((p) => !p.optional && !p.nullable && p.direction === "in");
    }
}

/**
 * Normalized standalone function.
 */
export class GirFunction {
    readonly name: string;
    readonly cIdentifier: string;
    readonly returnType: GirType;
    readonly parameters: GirParameter[];
    readonly throws: boolean;
    readonly doc?: string;
    readonly returnDoc?: string;
    readonly shadows?: string;
    readonly shadowedBy?: string;

    constructor(data: {
        name: string;
        cIdentifier: string;
        returnType: GirType;
        parameters: GirParameter[];
        throws: boolean;
        doc?: string;
        returnDoc?: string;
        shadows?: string;
        shadowedBy?: string;
    }) {
        this.name = data.name;
        this.cIdentifier = data.cIdentifier;
        this.returnType = data.returnType;
        this.parameters = data.parameters;
        this.throws = data.throws;
        this.doc = data.doc;
        this.returnDoc = data.returnDoc;
        this.shadows = data.shadows;
        this.shadowedBy = data.shadowedBy;
    }

    /** True if this follows the async/finish pattern. */
    isAsync(): boolean {
        return this.name.endsWith("_async") || this.parameters.some((p) => p.scope === "async");
    }

    /** Gets required parameters. */
    getRequiredParameters(): GirParameter[] {
        return this.parameters.filter((p) => !p.optional && !p.nullable && p.direction === "in");
    }
}

/**
 * Normalized parameter with helper methods.
 */
export class GirParameter {
    readonly name: string;
    readonly type: GirType;
    readonly direction: "in" | "out" | "inout";
    readonly callerAllocates: boolean;
    readonly nullable: boolean;
    readonly optional: boolean;
    readonly scope?: "async" | "call" | "notified";
    readonly closure?: number;
    readonly destroy?: number;
    readonly transferOwnership?: "none" | "full" | "container";
    readonly doc?: string;

    constructor(data: {
        name: string;
        type: GirType;
        direction: "in" | "out" | "inout";
        callerAllocates: boolean;
        nullable: boolean;
        optional: boolean;
        scope?: "async" | "call" | "notified";
        closure?: number;
        destroy?: number;
        transferOwnership?: "none" | "full" | "container";
        doc?: string;
    }) {
        this.name = data.name;
        this.type = data.type;
        this.direction = data.direction;
        this.callerAllocates = data.callerAllocates;
        this.nullable = data.nullable;
        this.optional = data.optional;
        this.scope = data.scope;
        this.closure = data.closure;
        this.destroy = data.destroy;
        this.transferOwnership = data.transferOwnership;
        this.doc = data.doc;
    }

    /** True if this is an input parameter. */
    isIn(): boolean {
        return this.direction === "in";
    }

    /** True if this is an output parameter. */
    isOut(): boolean {
        return this.direction === "out" || this.direction === "inout";
    }

    /** True if this is a callback parameter (has scope). */
    isCallback(): boolean {
        return this.scope !== undefined;
    }

    /** True if this is the user_data for a callback. */
    isClosureData(): boolean {
        return this.closure !== undefined;
    }

    /** True if this is a destroy notify for a callback. */
    isDestroyNotify(): boolean {
        return this.destroy !== undefined;
    }

    /** True if caller must allocate memory for this out param. */
    requiresCallerAllocation(): boolean {
        return this.callerAllocates && this.isOut();
    }
}

/**
 * Normalized property with helper methods.
 */
export class GirProperty {
    readonly name: string;
    readonly type: GirType;
    readonly readable: boolean;
    readonly writable: boolean;
    readonly constructOnly: boolean;
    readonly hasDefault: boolean;
    readonly getter?: string;
    readonly setter?: string;
    readonly doc?: string;

    constructor(data: {
        name: string;
        type: GirType;
        readable: boolean;
        writable: boolean;
        constructOnly: boolean;
        hasDefault: boolean;
        getter?: string;
        setter?: string;
        doc?: string;
    }) {
        this.name = data.name;
        this.type = data.type;
        this.readable = data.readable;
        this.writable = data.writable;
        this.constructOnly = data.constructOnly;
        this.hasDefault = data.hasDefault;
        this.getter = data.getter;
        this.setter = data.setter;
        this.doc = data.doc;
    }

    /** True if readable but not writable. */
    isReadOnly(): boolean {
        return this.readable && !this.writable;
    }

    /** True if writable but not readable. */
    isWriteOnly(): boolean {
        return this.writable && !this.readable;
    }

    /** True if can only be set during construction. */
    isConstructOnly(): boolean {
        return this.constructOnly;
    }

    /** True if has both getter and setter methods. */
    hasAccessors(): boolean {
        return this.getter !== undefined && this.setter !== undefined;
    }
}

/**
 * Normalized signal with helper methods.
 */
export class GirSignal {
    readonly name: string;
    readonly when: "first" | "last" | "cleanup";
    readonly returnType: GirType | null;
    readonly parameters: GirParameter[];
    readonly doc?: string;

    constructor(data: {
        name: string;
        when: "first" | "last" | "cleanup";
        returnType: GirType | null;
        parameters: GirParameter[];
        doc?: string;
    }) {
        this.name = data.name;
        this.when = data.when;
        this.returnType = data.returnType;
        this.parameters = data.parameters;
        this.doc = data.doc;
    }

    /** True if the signal returns a value. */
    hasReturnValue(): boolean {
        return this.returnType !== null && !this.returnType.isVoid();
    }
}

/**
 * Normalized field.
 */
export class GirField {
    readonly name: string;
    readonly type: GirType;
    readonly writable: boolean;
    readonly readable: boolean;
    readonly private: boolean;
    readonly doc?: string;

    constructor(data: {
        name: string;
        type: GirType;
        writable: boolean;
        readable: boolean;
        private: boolean;
        doc?: string;
    }) {
        this.name = data.name;
        this.type = data.type;
        this.writable = data.writable;
        this.readable = data.readable;
        this.private = data.private;
        this.doc = data.doc;
    }
}

/**
 * Normalized type reference with helper methods.
 */
export class GirType {
    /** Type name - either a QualifiedName or an intrinsic type string */
    readonly name: QualifiedName | string;
    readonly cType?: string;
    readonly isArray: boolean;
    readonly elementType: GirType | null;
    readonly typeParameters: readonly GirType[];
    readonly containerType?: ContainerType;
    readonly transferOwnership?: "none" | "full" | "container";
    readonly nullable: boolean;
    readonly lengthParamIndex?: number;
    readonly zeroTerminated?: boolean;
    readonly fixedSize?: number;

    constructor(data: {
        name: QualifiedName | string;
        cType?: string;
        isArray: boolean;
        elementType: GirType | null;
        typeParameters?: readonly GirType[];
        containerType?: ContainerType;
        transferOwnership?: "none" | "full" | "container";
        nullable: boolean;
        lengthParamIndex?: number;
        zeroTerminated?: boolean;
        fixedSize?: number;
    }) {
        this.name = data.name;
        this.cType = data.cType;
        this.isArray = data.isArray;
        this.elementType = data.elementType;
        this.typeParameters = data.typeParameters ?? [];
        this.containerType = data.containerType;
        this.transferOwnership = data.transferOwnership;
        this.nullable = data.nullable;
        this.lengthParamIndex = data.lengthParamIndex;
        this.zeroTerminated = data.zeroTerminated;
        this.fixedSize = data.fixedSize;
    }

    /** True if this is an intrinsic/primitive type. */
    isIntrinsic(): boolean {
        return typeof this.name === "string" && isIntrinsicType(this.name);
    }

    /** True if this is a string type (utf8 or filename). */
    isString(): boolean {
        return typeof this.name === "string" && isStringType(this.name);
    }

    /** True if this is a numeric type. */
    isNumeric(): boolean {
        return typeof this.name === "string" && isNumericType(this.name);
    }

    /** True if this is a boolean type. */
    isBoolean(): boolean {
        return this.name === "gboolean";
    }

    /** True if this is void. */
    isVoid(): boolean {
        return typeof this.name === "string" && isVoidType(this.name);
    }

    /** True if this is GVariant. */
    isVariant(): boolean {
        return this.name === "GVariant";
    }

    /** True if this is GParamSpec. */
    isParamSpec(): boolean {
        return this.name === "GParamSpec";
    }

    /** True if this is a GHashTable container. */
    isHashTable(): boolean {
        return this.containerType === "ghashtable";
    }

    /** True if this is a GPtrArray container. */
    isPtrArray(): boolean {
        return this.containerType === "gptrarray";
    }

    /** True if this is a GArray container. */
    isGArray(): boolean {
        return this.containerType === "garray";
    }

    /** True if this is a GList or GSList container. */
    isList(): boolean {
        return this.containerType === "glist" || this.containerType === "gslist";
    }

    /** True if this is any generic container type. */
    isGenericContainer(): boolean {
        return this.containerType !== undefined;
    }

    /** Gets the key type for GHashTable, or null for other types. */
    getKeyType(): GirType | null {
        if (!this.isHashTable() || this.typeParameters.length < 1) return null;
        return this.typeParameters[0] ?? null;
    }

    /** Gets the value type for GHashTable, or null for other types. */
    getValueType(): GirType | null {
        if (!this.isHashTable() || this.typeParameters.length < 2) return null;
        return this.typeParameters[1] ?? null;
    }

    /** Gets the namespace part of a qualified name, or null for intrinsics. */
    getNamespace(): string | null {
        if (this.isIntrinsic()) return null;
        const qn = this.name as QualifiedName;
        const dot = qn.indexOf(".");
        return dot >= 0 ? qn.slice(0, dot) : null;
    }

    /** Gets the simple name part (without namespace). */
    getSimpleName(): string {
        if (this.isIntrinsic()) return this.name as string;
        const qn = this.name as QualifiedName;
        const dot = qn.indexOf(".");
        return dot >= 0 ? qn.slice(dot + 1) : qn;
    }
}
