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

type RepositoryLike = {
    resolveClass(name: QualifiedName): NormalizedClass | null;
    resolveInterface(name: QualifiedName): NormalizedInterface | null;
    resolveRecord(name: QualifiedName): NormalizedRecord | null;
    resolveEnum(name: QualifiedName): NormalizedEnumeration | null;
    resolveFlags(name: QualifiedName): NormalizedEnumeration | null;
    resolveCallback(name: QualifiedName): NormalizedCallback | null;
    getTypeKind(name: QualifiedName): TypeKind | null;
    findClasses(predicate: (cls: NormalizedClass) => boolean): NormalizedClass[];
};

/**
 * Normalized namespace containing all resolved types.
 */
export class NormalizedNamespace {
    readonly name: string;
    readonly version: string;
    readonly sharedLibrary: string;
    readonly cPrefix: string;
    readonly classes: Map<string, NormalizedClass>;
    readonly interfaces: Map<string, NormalizedInterface>;
    readonly records: Map<string, NormalizedRecord>;
    readonly enumerations: Map<string, NormalizedEnumeration>;
    readonly bitfields: Map<string, NormalizedEnumeration>;
    readonly callbacks: Map<string, NormalizedCallback>;
    readonly functions: Map<string, NormalizedFunction>;
    readonly constants: Map<string, NormalizedConstant>;
    readonly doc?: string;

    constructor(data: {
        name: string;
        version: string;
        sharedLibrary: string;
        cPrefix: string;
        classes: Map<string, NormalizedClass>;
        interfaces: Map<string, NormalizedInterface>;
        records: Map<string, NormalizedRecord>;
        enumerations: Map<string, NormalizedEnumeration>;
        bitfields: Map<string, NormalizedEnumeration>;
        callbacks: Map<string, NormalizedCallback>;
        functions: Map<string, NormalizedFunction>;
        constants: Map<string, NormalizedConstant>;
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
export class NormalizedClass {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly parent: QualifiedName | null;
    readonly abstract: boolean;
    readonly glibTypeName?: string;
    readonly glibGetType?: string;
    readonly cSymbolPrefix?: string;
    readonly implements: QualifiedName[];
    readonly methods: NormalizedMethod[];
    readonly constructors: NormalizedConstructor[];
    readonly staticFunctions: NormalizedFunction[];
    readonly properties: NormalizedProperty[];
    readonly signals: NormalizedSignal[];
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
        implements: QualifiedName[];
        methods: NormalizedMethod[];
        constructors: NormalizedConstructor[];
        staticFunctions: NormalizedFunction[];
        properties: NormalizedProperty[];
        signals: NormalizedSignal[];
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
        let current: NormalizedClass | null = this;
        while (current?.parent && this._repo) {
            chain.push(current.parent);
            current = this._repo.resolveClass(current.parent);
        }
        return chain;
    }

    /** Gets the parent class object, or null if this is a root class. */
    getParent(): NormalizedClass | null {
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
    getMethod(name: string): NormalizedMethod | null {
        return this.methods.find((m) => m.name === name) ?? null;
    }

    /** Finds a property defined on this class by name. */
    getProperty(name: string): NormalizedProperty | null {
        return this.properties.find((p) => p.name === name) ?? null;
    }

    /** Finds a signal defined on this class by name. */
    getSignal(name: string): NormalizedSignal | null {
        return this.signals.find((s) => s.name === name) ?? null;
    }

    /** Finds a constructor by name. */
    getConstructor(name: string): NormalizedConstructor | null {
        return this.constructors.find((c) => c.name === name) ?? null;
    }

    /** Gets all methods including inherited ones. */
    getAllMethods(): NormalizedMethod[] {
        const methods = [...this.methods];
        let current = this.getParent();
        while (current) {
            methods.push(...current.methods);
            current = current.getParent();
        }
        return methods;
    }

    /** Gets all properties including inherited ones. */
    getAllProperties(): NormalizedProperty[] {
        const properties = [...this.properties];
        let current = this.getParent();
        while (current) {
            properties.push(...current.properties);
            current = current.getParent();
        }
        return properties;
    }

    /** Gets all signals including inherited ones. */
    getAllSignals(): NormalizedSignal[] {
        const signals = [...this.signals];
        let current = this.getParent();
        while (current) {
            signals.push(...current.signals);
            current = current.getParent();
        }
        return signals;
    }

    /** Finds a method by name, searching up the inheritance chain. */
    findMethod(name: string): NormalizedMethod | null {
        const own = this.getMethod(name);
        if (own) return own;
        return this.getParent()?.findMethod(name) ?? null;
    }

    /** Finds a property by name, searching up the inheritance chain. */
    findProperty(name: string): NormalizedProperty | null {
        const own = this.getProperty(name);
        if (own) return own;
        return this.getParent()?.findProperty(name) ?? null;
    }

    /** Finds a signal by name, searching up the inheritance chain. */
    findSignal(name: string): NormalizedSignal | null {
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

    /** Gets direct subclasses of this class. */
    getDirectSubclasses(): NormalizedClass[] {
        if (!this._repo) return [];
        return this._repo.findClasses((cls) => cls.parent === this.qualifiedName);
    }
}

/**
 * Normalized interface with helper methods.
 */
export class NormalizedInterface {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly glibTypeName?: string;
    readonly prerequisites: QualifiedName[];
    readonly methods: NormalizedMethod[];
    readonly properties: NormalizedProperty[];
    readonly signals: NormalizedSignal[];
    readonly doc?: string;

    /** @internal */
    private _repo?: RepositoryLike;

    constructor(data: {
        name: string;
        qualifiedName: QualifiedName;
        cType: string;
        glibTypeName?: string;
        prerequisites: QualifiedName[];
        methods: NormalizedMethod[];
        properties: NormalizedProperty[];
        signals: NormalizedSignal[];
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
    getMethod(name: string): NormalizedMethod | null {
        return this.methods.find((m) => m.name === name) ?? null;
    }

    /** Finds a property by name. */
    getProperty(name: string): NormalizedProperty | null {
        return this.properties.find((p) => p.name === name) ?? null;
    }

    /** Finds a signal by name. */
    getSignal(name: string): NormalizedSignal | null {
        return this.signals.find((s) => s.name === name) ?? null;
    }
}

/**
 * Normalized record (boxed type or plain struct) with helper methods.
 */
export class NormalizedRecord {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly opaque: boolean;
    readonly disguised: boolean;
    readonly glibTypeName?: string;
    readonly glibGetType?: string;
    readonly isGtypeStructFor?: string;
    readonly fields: NormalizedField[];
    readonly methods: NormalizedMethod[];
    readonly constructors: NormalizedConstructor[];
    readonly staticFunctions: NormalizedFunction[];
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
        fields: NormalizedField[];
        methods: NormalizedMethod[];
        constructors: NormalizedConstructor[];
        staticFunctions: NormalizedFunction[];
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
        this.fields = data.fields;
        this.methods = data.methods;
        this.constructors = data.constructors;
        this.staticFunctions = data.staticFunctions;
        this.doc = data.doc;
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
    getPublicFields(): NormalizedField[] {
        return this.fields.filter((f) => !f.private);
    }

    /** Finds a method by name. */
    getMethod(name: string): NormalizedMethod | null {
        return this.methods.find((m) => m.name === name) ?? null;
    }

    /** Finds a field by name. */
    getField(name: string): NormalizedField | null {
        return this.fields.find((f) => f.name === name) ?? null;
    }

    /** Finds a constructor by name. */
    getConstructor(name: string): NormalizedConstructor | null {
        return this.constructors.find((c) => c.name === name) ?? null;
    }
}

/**
 * Normalized enumeration with helper methods.
 */
export class NormalizedEnumeration {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly members: NormalizedEnumerationMember[];
    readonly doc?: string;

    constructor(data: {
        name: string;
        qualifiedName: QualifiedName;
        cType: string;
        members: NormalizedEnumerationMember[];
        doc?: string;
    }) {
        this.name = data.name;
        this.qualifiedName = data.qualifiedName;
        this.cType = data.cType;
        this.members = data.members;
        this.doc = data.doc;
    }

    /** Finds a member by name. */
    getMember(name: string): NormalizedEnumerationMember | null {
        return this.members.find((m) => m.name === name) ?? null;
    }

    /** Finds a member by value. */
    getMemberByValue(value: string): NormalizedEnumerationMember | null {
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
export class NormalizedEnumerationMember {
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
export class NormalizedCallback {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly returnType: NormalizedType;
    readonly parameters: NormalizedParameter[];
    readonly doc?: string;

    constructor(data: {
        name: string;
        qualifiedName: QualifiedName;
        cType: string;
        returnType: NormalizedType;
        parameters: NormalizedParameter[];
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
export class NormalizedConstant {
    readonly name: string;
    readonly qualifiedName: QualifiedName;
    readonly cType: string;
    readonly value: string;
    readonly type: NormalizedType;
    readonly doc?: string;

    constructor(data: {
        name: string;
        qualifiedName: QualifiedName;
        cType: string;
        value: string;
        type: NormalizedType;
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
export class NormalizedMethod {
    readonly name: string;
    readonly cIdentifier: string;
    readonly returnType: NormalizedType;
    readonly parameters: NormalizedParameter[];
    readonly throws: boolean;
    readonly doc?: string;
    readonly returnDoc?: string;
    /** For async methods, the name of the corresponding finish function */
    readonly finishFunc?: string;

    constructor(data: {
        name: string;
        cIdentifier: string;
        returnType: NormalizedType;
        parameters: NormalizedParameter[];
        throws: boolean;
        doc?: string;
        returnDoc?: string;
        finishFunc?: string;
    }) {
        this.name = data.name;
        this.cIdentifier = data.cIdentifier;
        this.returnType = data.returnType;
        this.parameters = data.parameters;
        this.throws = data.throws;
        this.doc = data.doc;
        this.returnDoc = data.returnDoc;
        this.finishFunc = data.finishFunc;
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
    getRequiredParameters(): NormalizedParameter[] {
        return this.parameters.filter((p) => !p.optional && !p.nullable && p.direction === "in");
    }

    /** Gets optional parameters. */
    getOptionalParameters(): NormalizedParameter[] {
        return this.parameters.filter((p) => p.optional || p.nullable);
    }

    /** True if any parameter is an out parameter. */
    hasOutParameters(): boolean {
        return this.parameters.some((p) => p.direction === "out" || p.direction === "inout");
    }

    /** Gets out parameters only. */
    getOutParameters(): NormalizedParameter[] {
        return this.parameters.filter((p) => p.direction === "out" || p.direction === "inout");
    }
}

/**
 * Normalized constructor.
 */
export class NormalizedConstructor {
    readonly name: string;
    readonly cIdentifier: string;
    readonly returnType: NormalizedType;
    readonly parameters: NormalizedParameter[];
    readonly throws: boolean;
    readonly doc?: string;
    readonly returnDoc?: string;

    constructor(data: {
        name: string;
        cIdentifier: string;
        returnType: NormalizedType;
        parameters: NormalizedParameter[];
        throws: boolean;
        doc?: string;
        returnDoc?: string;
    }) {
        this.name = data.name;
        this.cIdentifier = data.cIdentifier;
        this.returnType = data.returnType;
        this.parameters = data.parameters;
        this.throws = data.throws;
        this.doc = data.doc;
        this.returnDoc = data.returnDoc;
    }

    /** Gets required (non-optional, non-nullable) parameters. */
    getRequiredParameters(): NormalizedParameter[] {
        return this.parameters.filter((p) => !p.optional && !p.nullable && p.direction === "in");
    }
}

/**
 * Normalized standalone function.
 */
export class NormalizedFunction {
    readonly name: string;
    readonly cIdentifier: string;
    readonly returnType: NormalizedType;
    readonly parameters: NormalizedParameter[];
    readonly throws: boolean;
    readonly doc?: string;
    readonly returnDoc?: string;

    constructor(data: {
        name: string;
        cIdentifier: string;
        returnType: NormalizedType;
        parameters: NormalizedParameter[];
        throws: boolean;
        doc?: string;
        returnDoc?: string;
    }) {
        this.name = data.name;
        this.cIdentifier = data.cIdentifier;
        this.returnType = data.returnType;
        this.parameters = data.parameters;
        this.throws = data.throws;
        this.doc = data.doc;
        this.returnDoc = data.returnDoc;
    }

    /** True if this follows the async/finish pattern. */
    isAsync(): boolean {
        return this.name.endsWith("_async") || this.parameters.some((p) => p.scope === "async");
    }

    /** Gets required parameters. */
    getRequiredParameters(): NormalizedParameter[] {
        return this.parameters.filter((p) => !p.optional && !p.nullable && p.direction === "in");
    }
}

/**
 * Normalized parameter with helper methods.
 */
export class NormalizedParameter {
    readonly name: string;
    readonly type: NormalizedType;
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
        type: NormalizedType;
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
export class NormalizedProperty {
    readonly name: string;
    readonly type: NormalizedType;
    readonly readable: boolean;
    readonly writable: boolean;
    readonly constructOnly: boolean;
    readonly hasDefault: boolean;
    readonly getter?: string;
    readonly setter?: string;
    readonly doc?: string;

    constructor(data: {
        name: string;
        type: NormalizedType;
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
export class NormalizedSignal {
    readonly name: string;
    readonly when: "first" | "last" | "cleanup";
    readonly returnType: NormalizedType | null;
    readonly parameters: NormalizedParameter[];
    readonly doc?: string;

    constructor(data: {
        name: string;
        when: "first" | "last" | "cleanup";
        returnType: NormalizedType | null;
        parameters: NormalizedParameter[];
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
export class NormalizedField {
    readonly name: string;
    readonly type: NormalizedType;
    readonly writable: boolean;
    readonly readable: boolean;
    readonly private: boolean;
    readonly doc?: string;

    constructor(data: {
        name: string;
        type: NormalizedType;
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
export class NormalizedType {
    /** Type name - either a QualifiedName or an intrinsic type string */
    readonly name: QualifiedName | string;
    readonly cType?: string;
    readonly isArray: boolean;
    readonly elementType: NormalizedType | null;
    readonly transferOwnership?: "none" | "full" | "container";
    readonly nullable: boolean;

    constructor(data: {
        name: QualifiedName | string;
        cType?: string;
        isArray: boolean;
        elementType: NormalizedType | null;
        transferOwnership?: "none" | "full" | "container";
        nullable: boolean;
    }) {
        this.name = data.name;
        this.cType = data.cType;
        this.isArray = data.isArray;
        this.elementType = data.elementType;
        this.transferOwnership = data.transferOwnership;
        this.nullable = data.nullable;
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
