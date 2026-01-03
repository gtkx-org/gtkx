/**
 * Normalizer that converts raw GIR types to normalized types.
 *
 * The key job is to qualify all type references with their namespace,
 * except for intrinsic types which remain unqualified.
 *
 * @internal
 */

import { isIntrinsicType } from "../intrinsics.js";
import {
    NormalizedCallback,
    NormalizedClass,
    NormalizedConstant,
    NormalizedConstructor,
    NormalizedEnumeration,
    NormalizedEnumerationMember,
    NormalizedField,
    NormalizedFunction,
    NormalizedInterface,
    NormalizedMethod,
    NormalizedNamespace,
    NormalizedParameter,
    NormalizedProperty,
    NormalizedRecord,
    NormalizedSignal,
    NormalizedType,
    type QualifiedName,
    qualifiedName,
} from "../types.js";
import type {
    RawCallback,
    RawClass,
    RawConstant,
    RawConstructor,
    RawEnumeration,
    RawField,
    RawFunction,
    RawInterface,
    RawMethod,
    RawNamespace,
    RawParameter,
    RawProperty,
    RawRecord,
    RawSignal,
    RawType,
} from "./raw-types.js";

/**
 * Context for normalization - provides access to all loaded namespaces
 * for resolving cross-namespace references.
 */
export type NormalizerContext = {
    /** All raw namespaces that have been loaded */
    rawNamespaces: Map<string, RawNamespace>;
};

/**
 * Normalizes a raw namespace into a normalized namespace.
 */
export const normalizeNamespace = (raw: RawNamespace, ctx: NormalizerContext): NormalizedNamespace => {
    const nsName = raw.name;

    const classes = new Map<string, NormalizedClass>();
    const interfaces = new Map<string, NormalizedInterface>();
    const records = new Map<string, NormalizedRecord>();
    const enumerations = new Map<string, NormalizedEnumeration>();
    const bitfields = new Map<string, NormalizedEnumeration>();
    const callbacks = new Map<string, NormalizedCallback>();
    const functions = new Map<string, NormalizedFunction>();
    const constants = new Map<string, NormalizedConstant>();

    for (const rawClass of raw.classes) {
        const normalized = normalizeClass(rawClass, nsName, ctx);
        classes.set(normalized.name, normalized);
    }

    for (const rawInterface of raw.interfaces) {
        const normalized = normalizeInterface(rawInterface, nsName, ctx);
        interfaces.set(normalized.name, normalized);
    }

    for (const rawRecord of raw.records) {
        const normalized = normalizeRecord(rawRecord, nsName, ctx);
        records.set(normalized.name, normalized);
    }

    for (const rawEnum of raw.enumerations) {
        const normalized = normalizeEnumeration(rawEnum, nsName);
        enumerations.set(normalized.name, normalized);
    }

    for (const rawBitfield of raw.bitfields) {
        const normalized = normalizeEnumeration(rawBitfield, nsName);
        bitfields.set(normalized.name, normalized);
    }

    for (const rawCallback of raw.callbacks) {
        const normalized = normalizeCallback(rawCallback, nsName, ctx);
        callbacks.set(normalized.name, normalized);
    }

    for (const rawFunction of raw.functions) {
        const normalized = normalizeFunction(rawFunction, nsName, ctx);
        functions.set(normalized.name, normalized);
    }

    for (const rawConstant of raw.constants) {
        const normalized = normalizeConstant(rawConstant, nsName, ctx);
        constants.set(normalized.name, normalized);
    }

    return new NormalizedNamespace({
        name: raw.name,
        version: raw.version,
        sharedLibrary: raw.sharedLibrary,
        cPrefix: raw.cPrefix,
        classes,
        interfaces,
        records,
        enumerations,
        bitfields,
        callbacks,
        functions,
        constants,
        doc: raw.doc,
    });
};

/**
 * Normalizes a type reference, qualifying it with its namespace if not intrinsic.
 */
const normalizeTypeName = (
    typeName: string,
    currentNamespace: string,
    ctx: NormalizerContext,
): QualifiedName | string => {
    if (isIntrinsicType(typeName)) {
        return typeName;
    }

    if (typeName.includes(".")) {
        return typeName as QualifiedName;
    }

    const currentNs = ctx.rawNamespaces.get(currentNamespace);
    if (currentNs && typeExistsInNamespace(typeName, currentNs)) {
        return qualifiedName(currentNamespace, typeName);
    }

    for (const [nsName, ns] of ctx.rawNamespaces) {
        if (nsName !== currentNamespace && typeExistsInNamespace(typeName, ns)) {
            return qualifiedName(nsName, typeName);
        }
    }

    return qualifiedName(currentNamespace, typeName);
};

/**
 * Checks if a type name exists in a namespace.
 */
const typeExistsInNamespace = (typeName: string, ns: RawNamespace): boolean => {
    return (
        ns.classes.some((c) => c.name === typeName) ||
        ns.interfaces.some((i) => i.name === typeName) ||
        ns.records.some((r) => r.name === typeName) ||
        ns.enumerations.some((e) => e.name === typeName) ||
        ns.bitfields.some((b) => b.name === typeName) ||
        ns.callbacks.some((c) => c.name === typeName)
    );
};

const buildContainerTypeBase = (raw: RawType) => ({
    cType: raw.cType,
    containerType: raw.containerType,
    transferOwnership: raw.transferOwnership,
    nullable: raw.nullable ?? false,
});

/**
 * Normalizes a raw type to a normalized type.
 */
const normalizeType = (raw: RawType, currentNamespace: string, ctx: NormalizerContext): NormalizedType => {
    if (raw.containerType === "ghashtable") {
        const typeParams = (raw.typeParameters ?? []).map((tp) => normalizeType(tp, currentNamespace, ctx));
        return new NormalizedType({
            ...buildContainerTypeBase(raw),
            name: qualifiedName("GLib", "HashTable"),
            isArray: false,
            elementType: typeParams[1] ?? null,
            typeParameters: typeParams,
        });
    }

    if (raw.containerType === "gptrarray" || raw.containerType === "garray") {
        const typeParams = (raw.typeParameters ?? []).map((tp) => normalizeType(tp, currentNamespace, ctx));
        const typeName = raw.containerType === "gptrarray" ? "PtrArray" : "Array";
        return new NormalizedType({
            ...buildContainerTypeBase(raw),
            name: qualifiedName("GLib", typeName),
            isArray: true,
            elementType: typeParams[0] ?? null,
            typeParameters: typeParams,
        });
    }

    if (raw.containerType === "glist" || raw.containerType === "gslist") {
        const elementType = raw.elementType ? normalizeType(raw.elementType, currentNamespace, ctx) : null;
        return new NormalizedType({
            ...buildContainerTypeBase(raw),
            name: "array",
            isArray: true,
            elementType,
            typeParameters: elementType ? [elementType] : [],
        });
    }

    const isArray = raw.isArray === true || raw.name === "array";

    if (isArray && raw.elementType) {
        return new NormalizedType({
            name: "array",
            cType: raw.cType,
            isArray: true,
            elementType: normalizeType(raw.elementType, currentNamespace, ctx),
            transferOwnership: raw.transferOwnership,
            nullable: raw.nullable ?? false,
        });
    }

    if (isArray) {
        return new NormalizedType({
            name: "array",
            cType: raw.cType,
            isArray: true,
            elementType: null,
            transferOwnership: raw.transferOwnership,
            nullable: raw.nullable ?? false,
        });
    }

    return new NormalizedType({
        name: normalizeTypeName(raw.name, currentNamespace, ctx),
        cType: raw.cType,
        isArray: false,
        elementType: null,
        transferOwnership: raw.transferOwnership,
        nullable: raw.nullable ?? false,
    });
};

/**
 * Normalizes a raw class to a normalized class.
 */
const normalizeClass = (raw: RawClass, currentNamespace: string, ctx: NormalizerContext): NormalizedClass => {
    const qn = qualifiedName(currentNamespace, raw.name);

    let parent: QualifiedName | null = null;
    if (raw.parent) {
        const normalizedParent = normalizeTypeName(raw.parent, currentNamespace, ctx);
        if (typeof normalizedParent !== "string" || normalizedParent.includes(".")) {
            parent = normalizedParent as QualifiedName;
        }
    }

    const implementsRefs = raw.implements.map((impl) => {
        const normalized = normalizeTypeName(impl, currentNamespace, ctx);
        return normalized as QualifiedName;
    });

    return new NormalizedClass({
        name: raw.name,
        qualifiedName: qn,
        cType: raw.cType,
        parent,
        abstract: raw.abstract ?? false,
        glibTypeName: raw.glibTypeName,
        glibGetType: raw.glibGetType,
        cSymbolPrefix: raw.cSymbolPrefix,
        implements: implementsRefs,
        methods: raw.methods.map((m) => normalizeMethod(m, currentNamespace, ctx)),
        constructors: raw.constructors.map((c) => normalizeConstructor(c, currentNamespace, ctx)),
        staticFunctions: raw.functions.map((f) => normalizeFunction(f, currentNamespace, ctx)),
        properties: raw.properties.map((p) => normalizeProperty(p, currentNamespace, ctx)),
        signals: raw.signals.map((s) => normalizeSignal(s, currentNamespace, ctx)),
        doc: raw.doc,
    });
};

/**
 * Normalizes a raw interface to a normalized interface.
 */
const normalizeInterface = (
    raw: RawInterface,
    currentNamespace: string,
    ctx: NormalizerContext,
): NormalizedInterface => {
    const qn = qualifiedName(currentNamespace, raw.name);

    const prerequisites = raw.prerequisites.map((prereq) => {
        const normalized = normalizeTypeName(prereq, currentNamespace, ctx);
        return normalized as QualifiedName;
    });

    return new NormalizedInterface({
        name: raw.name,
        qualifiedName: qn,
        cType: raw.cType,
        glibTypeName: raw.glibTypeName,
        prerequisites,
        methods: raw.methods.map((m) => normalizeMethod(m, currentNamespace, ctx)),
        properties: raw.properties.map((p) => normalizeProperty(p, currentNamespace, ctx)),
        signals: raw.signals.map((s) => normalizeSignal(s, currentNamespace, ctx)),
        doc: raw.doc,
    });
};

/**
 * Normalizes a raw record to a normalized record.
 */
const normalizeRecord = (raw: RawRecord, currentNamespace: string, ctx: NormalizerContext): NormalizedRecord => {
    const qn = qualifiedName(currentNamespace, raw.name);

    return new NormalizedRecord({
        name: raw.name,
        qualifiedName: qn,
        cType: raw.cType,
        opaque: raw.opaque ?? false,
        disguised: raw.disguised ?? false,
        glibTypeName: raw.glibTypeName,
        glibGetType: raw.glibGetType,
        isGtypeStructFor: raw.isGtypeStructFor,
        fields: raw.fields.map((f) => normalizeField(f, currentNamespace, ctx)),
        methods: raw.methods.map((m) => normalizeMethod(m, currentNamespace, ctx)),
        constructors: raw.constructors.map((c) => normalizeConstructor(c, currentNamespace, ctx)),
        staticFunctions: raw.functions.map((f) => normalizeFunction(f, currentNamespace, ctx)),
        doc: raw.doc,
    });
};

/**
 * Normalizes a raw enumeration to a normalized enumeration.
 */
const normalizeEnumeration = (raw: RawEnumeration, currentNamespace: string): NormalizedEnumeration => {
    const qn = qualifiedName(currentNamespace, raw.name);

    return new NormalizedEnumeration({
        name: raw.name,
        qualifiedName: qn,
        cType: raw.cType,
        members: raw.members.map(
            (m) =>
                new NormalizedEnumerationMember({
                    name: m.name,
                    value: m.value,
                    cIdentifier: m.cIdentifier,
                    doc: m.doc,
                }),
        ),
        doc: raw.doc,
    });
};

/**
 * Normalizes a raw callback to a normalized callback.
 */
const normalizeCallback = (raw: RawCallback, currentNamespace: string, ctx: NormalizerContext): NormalizedCallback => {
    const qn = qualifiedName(currentNamespace, raw.name);

    return new NormalizedCallback({
        name: raw.name,
        qualifiedName: qn,
        cType: raw.cType,
        returnType: normalizeType(raw.returnType, currentNamespace, ctx),
        parameters: raw.parameters.map((p) => normalizeParameter(p, currentNamespace, ctx)),
        doc: raw.doc,
    });
};

/**
 * Normalizes a raw constant to a normalized constant.
 */
const normalizeConstant = (raw: RawConstant, currentNamespace: string, ctx: NormalizerContext): NormalizedConstant => {
    const qn = qualifiedName(currentNamespace, raw.name);

    return new NormalizedConstant({
        name: raw.name,
        qualifiedName: qn,
        cType: raw.cType,
        value: raw.value,
        type: normalizeType(raw.type, currentNamespace, ctx),
        doc: raw.doc,
    });
};

/**
 * Normalizes a raw method to a normalized method.
 */
const normalizeMethod = (raw: RawMethod, currentNamespace: string, ctx: NormalizerContext): NormalizedMethod => {
    return new NormalizedMethod({
        name: raw.name,
        cIdentifier: raw.cIdentifier,
        returnType: normalizeType(raw.returnType, currentNamespace, ctx),
        parameters: raw.parameters.map((p) => normalizeParameter(p, currentNamespace, ctx)),
        throws: raw.throws ?? false,
        doc: raw.doc,
        returnDoc: raw.returnDoc,
        finishFunc: raw.finishFunc,
    });
};

/**
 * Normalizes a raw constructor to a normalized constructor.
 */
const normalizeConstructor = (
    raw: RawConstructor,
    currentNamespace: string,
    ctx: NormalizerContext,
): NormalizedConstructor => {
    return new NormalizedConstructor({
        name: raw.name,
        cIdentifier: raw.cIdentifier,
        returnType: normalizeType(raw.returnType, currentNamespace, ctx),
        parameters: raw.parameters.map((p) => normalizeParameter(p, currentNamespace, ctx)),
        throws: raw.throws ?? false,
        doc: raw.doc,
        returnDoc: raw.returnDoc,
    });
};

/**
 * Normalizes a raw function to a normalized function.
 */
const normalizeFunction = (raw: RawFunction, currentNamespace: string, ctx: NormalizerContext): NormalizedFunction => {
    return new NormalizedFunction({
        name: raw.name,
        cIdentifier: raw.cIdentifier,
        returnType: normalizeType(raw.returnType, currentNamespace, ctx),
        parameters: raw.parameters.map((p) => normalizeParameter(p, currentNamespace, ctx)),
        throws: raw.throws ?? false,
        doc: raw.doc,
        returnDoc: raw.returnDoc,
    });
};

/**
 * Normalizes a raw parameter to a normalized parameter.
 */
const normalizeParameter = (
    raw: RawParameter,
    currentNamespace: string,
    ctx: NormalizerContext,
): NormalizedParameter => {
    return new NormalizedParameter({
        name: raw.name,
        type: normalizeType(raw.type, currentNamespace, ctx),
        direction: raw.direction ?? "in",
        callerAllocates: raw.callerAllocates ?? false,
        nullable: raw.nullable ?? false,
        optional: raw.optional ?? false,
        scope: raw.scope,
        closure: raw.closure,
        destroy: raw.destroy,
        transferOwnership: raw.transferOwnership,
        doc: raw.doc,
    });
};

/**
 * Normalizes a raw property to a normalized property.
 */
const normalizeProperty = (raw: RawProperty, currentNamespace: string, ctx: NormalizerContext): NormalizedProperty => {
    return new NormalizedProperty({
        name: raw.name,
        type: normalizeType(raw.type, currentNamespace, ctx),
        readable: raw.readable ?? true,
        writable: raw.writable ?? false,
        constructOnly: raw.constructOnly ?? false,
        hasDefault: raw.hasDefault ?? false,
        getter: raw.getter,
        setter: raw.setter,
        doc: raw.doc,
    });
};

/**
 * Normalizes a raw signal to a normalized signal.
 */
const normalizeSignal = (raw: RawSignal, currentNamespace: string, ctx: NormalizerContext): NormalizedSignal => {
    return new NormalizedSignal({
        name: raw.name,
        when: raw.when ?? "last",
        returnType: raw.returnType ? normalizeType(raw.returnType, currentNamespace, ctx) : null,
        parameters: (raw.parameters ?? []).map((p) => normalizeParameter(p, currentNamespace, ctx)),
        doc: raw.doc,
    });
};

/**
 * Normalizes a raw field to a normalized field.
 */
const normalizeField = (raw: RawField, currentNamespace: string, ctx: NormalizerContext): NormalizedField => {
    return new NormalizedField({
        name: raw.name,
        type: normalizeType(raw.type, currentNamespace, ctx),
        writable: raw.writable ?? false,
        readable: raw.readable ?? true,
        private: raw.private ?? false,
        doc: raw.doc,
    });
};
