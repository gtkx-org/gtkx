import { isIntrinsicType } from "../intrinsics.js";
import { GirAlias } from "../model/alias.js";
import { GirConstructor, GirFunction, GirMethod } from "../model/callables.js";
import { GirCallback } from "../model/callback.js";
import { GirConstant } from "../model/constant.js";
import { GirEnumeration, GirEnumerationMember } from "../model/enumeration.js";
import { GirField } from "../model/field.js";
import { GirParameter } from "../model/parameter.js";
import { GirProperty, parseDefaultValue } from "../model/property.js";
import { GirRecord } from "../model/record.js";
import { GirSignal } from "../model/signal.js";
import { GirType } from "../model/type.js";
import type {
    RawAlias,
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

type TypeIndex = Map<string, Set<string>>;

/**
 * Data produced for a class before the repository exists.
 * Used to defer GirClass construction until the repo is available.
 */
export type GirClassData = {
    name: string;
    qualifiedName: string;
    cType: string;
    parent: string | null;
    abstract: boolean;
    glibTypeName?: string;
    glibGetType?: string;
    cSymbolPrefix?: string;
    fundamental?: boolean;
    refFunc?: string;
    unrefFunc?: string;
    implements: string[];
    methods: GirMethod[];
    constructors: GirConstructor[];
    staticFunctions: GirFunction[];
    properties: GirProperty[];
    signals: GirSignal[];
    doc?: string;
};

/**
 * Data produced for an interface before the repository exists.
 */
export type GirInterfaceData = {
    name: string;
    qualifiedName: string;
    cType: string;
    glibTypeName?: string;
    prerequisites: string[];
    methods: GirMethod[];
    properties: GirProperty[];
    signals: GirSignal[];
    doc?: string;
};

/**
 * Intermediate namespace data produced by the normalizer.
 *
 * Classes and interfaces are stored as plain data because they need
 * the repository reference at construction time (which doesn't exist yet).
 * All other types are fully constructed model instances.
 */
export type GirNamespaceIntermediate = {
    name: string;
    version: string;
    sharedLibrary: string;
    cPrefix: string;
    classes: Map<string, GirClassData>;
    interfaces: Map<string, GirInterfaceData>;
    records: Map<string, GirRecord>;
    enumerations: Map<string, GirEnumeration>;
    bitfields: Map<string, GirEnumeration>;
    callbacks: Map<string, GirCallback>;
    functions: Map<string, GirFunction>;
    constants: Map<string, GirConstant>;
    aliases: Map<string, GirAlias>;
    doc?: string;
};

/**
 * Converts raw parsed GIR data into model instances with fully qualified
 * type names.
 *
 * Uses indexed lookups for O(1) type name resolution and strict error
 * handling (throws on unresolvable type references).
 */
export class GirNormalizer {
    private typeIndex: TypeIndex = new Map();

    /**
     * Normalizes all raw namespaces into intermediate namespace data.
     *
     * @param rawNamespaces - Raw namespaces keyed by name, in dependency order
     * @returns Intermediate namespace data keyed by name, in the same order
     */
    normalize(rawNamespaces: Map<string, RawNamespace>): Map<string, GirNamespaceIntermediate> {
        this.typeIndex = this.buildTypeIndex(rawNamespaces);

        const result = new Map<string, GirNamespaceIntermediate>();
        for (const [name, raw] of rawNamespaces) {
            result.set(name, this.normalizeNamespace(raw));
        }
        return result;
    }

    private buildTypeIndex(rawNamespaces: Map<string, RawNamespace>): TypeIndex {
        const index: TypeIndex = new Map();
        for (const [nsName, raw] of rawNamespaces) {
            const names = new Set<string>();
            for (const c of raw.classes) names.add(c.name);
            for (const i of raw.interfaces) names.add(i.name);
            for (const r of raw.records) names.add(r.name);
            for (const e of raw.enumerations) names.add(e.name);
            for (const b of raw.bitfields) names.add(b.name);
            for (const cb of raw.callbacks) names.add(cb.name);
            for (const a of raw.aliases) names.add(a.name);
            index.set(nsName, names);
        }
        return index;
    }

    private normalizeNamespace(raw: RawNamespace): GirNamespaceIntermediate {
        const nsName = raw.name;

        const indexBy = <Raw, Resolved extends { name: string }>(
            items: readonly Raw[],
            normalize: (raw: Raw, ns: string) => Resolved,
        ): Map<string, Resolved> => {
            const result = new Map<string, Resolved>();
            for (const item of items) {
                const resolved = normalize(item, nsName);
                result.set(resolved.name, resolved);
            }
            return result;
        };

        return {
            name: raw.name,
            version: raw.version,
            sharedLibrary: raw.sharedLibrary,
            cPrefix: raw.cPrefix,
            classes: indexBy(raw.classes, (r, ns) => this.normalizeClass(r, ns)),
            interfaces: indexBy(raw.interfaces, (r, ns) => this.normalizeInterface(r, ns)),
            records: indexBy(raw.records, (r, ns) => this.normalizeRecord(r, ns)),
            enumerations: indexBy(raw.enumerations, (r, ns) => this.normalizeEnumeration(r, ns)),
            bitfields: indexBy(raw.bitfields, (r, ns) => this.normalizeEnumeration(r, ns)),
            callbacks: indexBy(raw.callbacks, (r, ns) => this.normalizeCallback(r, ns)),
            functions: indexBy(raw.functions, (r, ns) => this.normalizeFunction(r, ns)),
            constants: indexBy(raw.constants, (r, ns) => this.normalizeConstant(r, ns)),
            aliases: indexBy(raw.aliases, (r, ns) => this.normalizeAlias(r, ns)),
            doc: raw.doc,
        };
    }

    private qualifyTypeName(typeName: string, currentNamespace: string): string {
        if (isIntrinsicType(typeName)) return typeName;
        if (typeName.includes(".")) return typeName;

        if (this.typeIndex.get(currentNamespace)?.has(typeName)) {
            return `${currentNamespace}.${typeName}`;
        }

        for (const [nsName, names] of this.typeIndex) {
            if (nsName !== currentNamespace && names.has(typeName)) {
                return `${nsName}.${typeName}`;
            }
        }

        return `${currentNamespace}.${typeName}`;
    }

    private normalizeType(raw: RawType, currentNamespace: string): GirType {
        if (raw.containerType === "ghashtable") {
            const typeParams = (raw.typeParameters ?? []).map((tp) => this.normalizeType(tp, currentNamespace));
            return new GirType({
                name: `GLib.HashTable`,
                cType: raw.cType,
                containerType: raw.containerType,
                transferOwnership: raw.transferOwnership,
                nullable: raw.nullable ?? false,
                isArray: false,
                elementType: typeParams[1] ?? null,
                typeParameters: typeParams,
            });
        }

        if (raw.containerType === "gptrarray" || raw.containerType === "garray") {
            const typeParams = (raw.typeParameters ?? []).map((tp) => this.normalizeType(tp, currentNamespace));
            const typeName = raw.containerType === "gptrarray" ? "PtrArray" : "Array";
            return new GirType({
                name: `GLib.${typeName}`,
                cType: raw.cType,
                containerType: raw.containerType,
                transferOwnership: raw.transferOwnership,
                nullable: raw.nullable ?? false,
                isArray: true,
                elementType: typeParams[0] ?? null,
                typeParameters: typeParams,
            });
        }

        if (raw.containerType === "gbytearray") {
            const elementType = raw.elementType ? this.normalizeType(raw.elementType, currentNamespace) : null;
            return new GirType({
                name: `GLib.ByteArray`,
                cType: raw.cType,
                containerType: raw.containerType,
                transferOwnership: raw.transferOwnership,
                nullable: raw.nullable ?? false,
                isArray: true,
                elementType,
            });
        }

        if (raw.containerType === "glist" || raw.containerType === "gslist") {
            const elementType = raw.elementType ? this.normalizeType(raw.elementType, currentNamespace) : null;
            return new GirType({
                name: "array",
                cType: raw.cType,
                containerType: raw.containerType,
                transferOwnership: raw.transferOwnership,
                nullable: raw.nullable ?? false,
                isArray: true,
                elementType,
                typeParameters: elementType ? [elementType] : [],
            });
        }

        const isArray = raw.isArray === true || raw.name === "array";

        if (isArray) {
            return new GirType({
                name: "array",
                cType: raw.cType,
                isArray: true,
                elementType: raw.elementType ? this.normalizeType(raw.elementType, currentNamespace) : null,
                transferOwnership: raw.transferOwnership,
                nullable: raw.nullable ?? false,
                sizeParamIndex: raw.sizeParamIndex,
                zeroTerminated: raw.zeroTerminated,
                fixedSize: raw.fixedSize,
            });
        }

        return new GirType({
            name: this.qualifyTypeName(raw.name, currentNamespace),
            cType: raw.cType,
            isArray: false,
            elementType: null,
            transferOwnership: raw.transferOwnership,
            nullable: raw.nullable ?? false,
        });
    }

    private normalizeClass(raw: RawClass, currentNamespace: string): GirClassData {
        let parent: string | null = null;
        if (raw.parent) {
            const qualified = this.qualifyTypeName(raw.parent, currentNamespace);
            if (qualified.includes(".")) {
                parent = qualified;
            }
        }

        return {
            name: raw.name,
            qualifiedName: `${currentNamespace}.${raw.name}`,
            cType: raw.cType,
            parent,
            abstract: raw.abstract ?? false,
            glibTypeName: raw.glibTypeName,
            glibGetType: raw.glibGetType,
            cSymbolPrefix: raw.cSymbolPrefix,
            fundamental: raw.fundamental ?? false,
            refFunc: raw.refFunc,
            unrefFunc: raw.unrefFunc,
            implements: raw.implements.map((impl) => this.qualifyTypeName(impl, currentNamespace)),
            methods: raw.methods.map((m) => this.normalizeMethod(m, currentNamespace)),
            constructors: raw.constructors.map((c) => this.normalizeConstructor(c, currentNamespace)),
            staticFunctions: raw.functions.map((f) => this.normalizeFunction(f, currentNamespace)),
            properties: raw.properties.map((p) => this.normalizeProperty(p, currentNamespace)),
            signals: raw.signals.map((s) => this.normalizeSignal(s, currentNamespace)),
            doc: raw.doc,
        };
    }

    private normalizeInterface(raw: RawInterface, currentNamespace: string): GirInterfaceData {
        return {
            name: raw.name,
            qualifiedName: `${currentNamespace}.${raw.name}`,
            cType: raw.cType,
            glibTypeName: raw.glibTypeName,
            prerequisites: raw.prerequisites.map((prereq) => this.qualifyTypeName(prereq, currentNamespace)),
            methods: raw.methods.map((m) => this.normalizeMethod(m, currentNamespace)),
            properties: raw.properties.map((p) => this.normalizeProperty(p, currentNamespace)),
            signals: raw.signals.map((s) => this.normalizeSignal(s, currentNamespace)),
            doc: raw.doc,
        };
    }

    private normalizeRecord(raw: RawRecord, currentNamespace: string): GirRecord {
        return new GirRecord({
            name: raw.name,
            qualifiedName: `${currentNamespace}.${raw.name}`,
            cType: raw.cType,
            opaque: raw.opaque ?? false,
            disguised: raw.disguised ?? false,
            glibTypeName: raw.glibTypeName,
            glibGetType: raw.glibGetType,
            isGtypeStructFor: raw.isGtypeStructFor,
            copyFunction: raw.copyFunction,
            freeFunction: raw.freeFunction,
            fields: raw.fields.map((f) => this.normalizeField(f, currentNamespace)),
            methods: raw.methods.map((m) => this.normalizeMethod(m, currentNamespace)),
            constructors: raw.constructors.map((c) => this.normalizeConstructor(c, currentNamespace)),
            staticFunctions: raw.functions.map((f) => this.normalizeFunction(f, currentNamespace)),
            doc: raw.doc,
        });
    }

    private normalizeEnumeration(raw: RawEnumeration, currentNamespace: string): GirEnumeration {
        return new GirEnumeration({
            name: raw.name,
            qualifiedName: `${currentNamespace}.${raw.name}`,
            cType: raw.cType,
            members: raw.members.map(
                (m) =>
                    new GirEnumerationMember({
                        name: m.name,
                        value: m.value,
                        cIdentifier: m.cIdentifier,
                        doc: m.doc,
                    }),
            ),
            glibGetType: raw.glibGetType,
            doc: raw.doc,
        });
    }

    private normalizeCallback(raw: RawCallback, currentNamespace: string): GirCallback {
        return new GirCallback({
            name: raw.name,
            qualifiedName: `${currentNamespace}.${raw.name}`,
            cType: raw.cType,
            returnType: this.normalizeType(raw.returnType, currentNamespace),
            parameters: raw.parameters.map((p) => this.normalizeParameter(p, currentNamespace)),
            doc: raw.doc,
        });
    }

    private normalizeConstant(raw: RawConstant, currentNamespace: string): GirConstant {
        return new GirConstant({
            name: raw.name,
            qualifiedName: `${currentNamespace}.${raw.name}`,
            cType: raw.cType,
            value: raw.value,
            type: this.normalizeType(raw.type, currentNamespace),
            doc: raw.doc,
        });
    }

    private normalizeAlias(raw: RawAlias, currentNamespace: string): GirAlias {
        return new GirAlias({
            name: raw.name,
            qualifiedName: `${currentNamespace}.${raw.name}`,
            cType: raw.cType,
            targetType: this.normalizeType(raw.targetType, currentNamespace),
            doc: raw.doc,
        });
    }

    private normalizeMethod(raw: RawMethod, currentNamespace: string): GirMethod {
        return new GirMethod({
            name: raw.name,
            cIdentifier: raw.cIdentifier,
            returnType: this.normalizeType(raw.returnType, currentNamespace),
            parameters: raw.parameters.map((p) => this.normalizeParameter(p, currentNamespace)),
            instanceParameter: raw.instanceParameter
                ? this.normalizeParameter(raw.instanceParameter, currentNamespace)
                : undefined,
            throws: raw.throws ?? false,
            doc: raw.doc,
            returnDoc: raw.returnDoc,
            finishFunc: raw.finishFunc,
            shadows: raw.shadows,
            shadowedBy: raw.shadowedBy,
        });
    }

    private normalizeConstructor(raw: RawConstructor, currentNamespace: string): GirConstructor {
        return new GirConstructor({
            name: raw.name,
            cIdentifier: raw.cIdentifier,
            returnType: this.normalizeType(raw.returnType, currentNamespace),
            parameters: raw.parameters.map((p) => this.normalizeParameter(p, currentNamespace)),
            throws: raw.throws ?? false,
            doc: raw.doc,
            returnDoc: raw.returnDoc,
            shadows: raw.shadows,
            shadowedBy: raw.shadowedBy,
        });
    }

    private normalizeFunction(raw: RawFunction, currentNamespace: string): GirFunction {
        return new GirFunction({
            name: raw.name,
            cIdentifier: raw.cIdentifier,
            returnType: this.normalizeType(raw.returnType, currentNamespace),
            parameters: raw.parameters.map((p) => this.normalizeParameter(p, currentNamespace)),
            throws: raw.throws ?? false,
            doc: raw.doc,
            returnDoc: raw.returnDoc,
            shadows: raw.shadows,
            shadowedBy: raw.shadowedBy,
        });
    }

    private normalizeParameter(raw: RawParameter, currentNamespace: string): GirParameter {
        return new GirParameter({
            name: raw.name,
            type: this.normalizeType(raw.type, currentNamespace),
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
    }

    private normalizeProperty(raw: RawProperty, currentNamespace: string): GirProperty {
        return new GirProperty({
            name: raw.name,
            type: this.normalizeType(raw.type, currentNamespace),
            readable: raw.readable ?? true,
            writable: raw.writable ?? false,
            constructOnly: raw.constructOnly ?? false,
            defaultValue: parseDefaultValue(raw.defaultValueRaw),
            getter: raw.getter,
            setter: raw.setter,
            doc: raw.doc,
        });
    }

    private normalizeSignal(raw: RawSignal, currentNamespace: string): GirSignal {
        return new GirSignal({
            name: raw.name,
            when: raw.when ?? "last",
            returnType: raw.returnType ? this.normalizeType(raw.returnType, currentNamespace) : null,
            parameters: (raw.parameters ?? []).map((p) => this.normalizeParameter(p, currentNamespace)),
            doc: raw.doc,
        });
    }

    private normalizeField(raw: RawField, currentNamespace: string): GirField {
        return new GirField({
            name: raw.name,
            type: this.normalizeType(raw.type, currentNamespace),
            writable: raw.writable ?? false,
            readable: raw.readable ?? true,
            private: raw.private ?? false,
            doc: raw.doc,
        });
    }
}
