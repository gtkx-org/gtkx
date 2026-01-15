/**
 * GObject Introspection XML (GIR) parser.
 *
 * Parses GIR files to extract type information for GTK/GLib libraries.
 * Outputs raw GIR types that are then normalized by the normalizer.
 *
 * @internal
 */

import { XMLParser } from "fast-xml-parser";
import type {
    ContainerType,
    RawCallback,
    RawClass,
    RawConstant,
    RawConstructor,
    RawEnumeration,
    RawEnumerationMember,
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

const ARRAY_ELEMENT_PATHS = new Set<string>([
    "namespace.class",
    "namespace.interface",
    "namespace.function",
    "namespace.enumeration",
    "namespace.bitfield",
    "namespace.record",
    "namespace.callback",
    "namespace.constant",
    "namespace.class.method",
    "namespace.class.constructor",
    "namespace.class.function",
    "namespace.class.property",
    "namespace.class.signal",
    "namespace.class.glib:signal",
    "namespace.interface.method",
    "namespace.interface.property",
    "namespace.interface.signal",
    "namespace.interface.glib:signal",
    "namespace.record.method",
    "namespace.record.constructor",
    "namespace.record.function",
    "namespace.record.field",
    "namespace.class.method.parameters.parameter",
    "namespace.class.constructor.parameters.parameter",
    "namespace.class.function.parameters.parameter",
    "namespace.function.parameters.parameter",
    "namespace.enumeration.member",
    "namespace.bitfield.member",
    "namespace.interface.method.parameters.parameter",
    "namespace.class.glib:signal.parameters.parameter",
    "namespace.interface.glib:signal.parameters.parameter",
    "namespace.record.method.parameters.parameter",
    "namespace.record.constructor.parameters.parameter",
    "namespace.record.function.parameters.parameter",
    "namespace.callback.parameters.parameter",
]);

const extractDoc = (node: Record<string, unknown>): string | undefined => {
    const doc = node.doc as Record<string, unknown> | undefined;
    if (!doc) return undefined;
    const text = doc["#text"];
    if (typeof text !== "string") return undefined;
    return text.trim();
};

const ensureArray = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

/**
 * Parser for GObject Introspection XML (GIR) files.
 *
 * Converts GIR XML into raw TypeScript objects.
 */
export class RawGirParser {
    private parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            textNodeName: "#text",
            isArray: (_name, jpath, _isLeafNode, _isAttribute) => {
                const path = jpath.split(".").slice(1).join(".");
                return ARRAY_ELEMENT_PATHS.has(path);
            },
        });
    }

    /**
     * Parses a GIR XML string into a raw namespace object.
     */
    parse(girXml: string): RawNamespace {
        const parsed = this.parser.parse(girXml);
        const repository = parsed.repository;

        if (!repository?.namespace) {
            throw new Error("Failed to parse GIR file: missing repository or namespace element");
        }

        const namespace = repository.namespace;

        return {
            name: namespace["@_name"],
            version: namespace["@_version"],
            sharedLibrary: namespace["@_shared-library"] ?? "",
            cPrefix: namespace["@_c:identifier-prefixes"] ?? namespace["@_c:prefix"] ?? "",
            classes: this.parseClasses(namespace.class ?? []),
            interfaces: this.parseInterfaces(namespace.interface ?? []),
            functions: this.parseFunctions(namespace.function ?? []),
            enumerations: this.parseEnumerations(namespace.enumeration ?? []),
            bitfields: this.parseEnumerations(namespace.bitfield ?? []),
            records: this.parseRecords(namespace.record ?? []),
            callbacks: this.parseCallbacks(namespace.callback ?? []),
            constants: this.parseConstants(namespace.constant ?? []),
        };
    }

    private parseCallbacks(callbacks: Record<string, unknown>[]): RawCallback[] {
        if (!callbacks || !Array.isArray(callbacks)) {
            return [];
        }
        return callbacks
            .filter((cb) => cb["@_introspectable"] !== "0")
            .map((cb) => ({
                name: String(cb["@_name"] ?? ""),
                cType: String(cb["@_c:type"] ?? ""),
                returnType: this.parseReturnType(cb["return-value"] as Record<string, unknown> | undefined),
                parameters: this.parseParameters(
                    (cb.parameters && typeof cb.parameters === "object" && cb.parameters !== null
                        ? cb.parameters
                        : {}) as Record<string, unknown>,
                ),
                doc: extractDoc(cb),
            }));
    }

    private parseClasses(classes: Record<string, unknown>[]): RawClass[] {
        return classes.map((cls) => ({
            name: String(cls["@_name"] ?? ""),
            cType: String(cls["@_c:type"] ?? cls["@_glib:type-name"] ?? ""),
            parent: cls["@_parent"] ? String(cls["@_parent"]) : undefined,
            abstract: cls["@_abstract"] === "1",
            glibTypeName: cls["@_glib:type-name"] ? String(cls["@_glib:type-name"]) : undefined,
            glibGetType: cls["@_glib:get-type"] ? String(cls["@_glib:get-type"]) : undefined,
            cSymbolPrefix: cls["@_c:symbol-prefix"] ? String(cls["@_c:symbol-prefix"]) : undefined,
            fundamental: cls["@_glib:fundamental"] === "1",
            refFunc: cls["@_glib:ref-func"] ? String(cls["@_glib:ref-func"]) : undefined,
            unrefFunc: cls["@_glib:unref-func"] ? String(cls["@_glib:unref-func"]) : undefined,
            implements: this.parseImplements(
                cls.implements as Record<string, unknown>[] | Record<string, unknown> | undefined,
            ),
            methods: this.parseMethods(ensureArray(cls.method)),
            constructors: this.parseConstructors(ensureArray(cls.constructor)),
            functions: this.parseFunctions(ensureArray(cls.function)),
            properties: this.parseProperties(ensureArray(cls.property)),
            signals: this.parseSignals(ensureArray(cls["glib:signal"])),
            doc: extractDoc(cls),
        }));
    }

    private parseImplements(implements_: Record<string, unknown>[] | Record<string, unknown> | undefined): string[] {
        if (!implements_) return [];
        const arr = Array.isArray(implements_) ? implements_ : [implements_];
        return arr.map((impl) => String(impl["@_name"] ?? "")).filter(Boolean);
    }

    private parseInterfaces(interfaces: Record<string, unknown>[]): RawInterface[] {
        if (!interfaces || !Array.isArray(interfaces)) {
            return [];
        }
        return interfaces.map((iface) => ({
            name: String(iface["@_name"] ?? ""),
            cType: String(iface["@_c:type"] ?? iface["@_glib:type-name"] ?? ""),
            glibTypeName: iface["@_glib:type-name"] ? String(iface["@_glib:type-name"]) : undefined,
            prerequisites: this.parsePrerequisites(
                iface.prerequisite as Record<string, unknown>[] | Record<string, unknown> | undefined,
            ),
            methods: this.parseMethods(ensureArray(iface.method)),
            properties: this.parseProperties(ensureArray(iface.property)),
            signals: this.parseSignals(ensureArray(iface["glib:signal"])),
            doc: extractDoc(iface),
        }));
    }

    private parsePrerequisites(
        prerequisites: Record<string, unknown>[] | Record<string, unknown> | undefined,
    ): string[] {
        if (!prerequisites) return [];
        const arr = Array.isArray(prerequisites) ? prerequisites : [prerequisites];
        return arr.map((prereq) => String(prereq["@_name"] ?? "")).filter(Boolean);
    }

    private parseMethods(methods: Record<string, unknown>[]): RawMethod[] {
        if (!methods || !Array.isArray(methods)) {
            return [];
        }
        return methods
            .filter((method) => method["@_introspectable"] !== "0")
            .map((method) => {
                const returnValue = method["return-value"] as Record<string, unknown> | undefined;
                const finishFunc = method["@_glib:finish-func"] as string | undefined;
                const shadows = method["@_shadows"] as string | undefined;
                const shadowedBy = method["@_shadowed-by"] as string | undefined;
                const parametersNode =
                    method.parameters && typeof method.parameters === "object" && method.parameters !== null
                        ? (method.parameters as Record<string, unknown>)
                        : {};
                return {
                    name: String(method["@_name"] ?? ""),
                    cIdentifier: String(method["@_c:identifier"] ?? ""),
                    returnType: this.parseReturnType(returnValue),
                    parameters: this.parseParameters(parametersNode),
                    instanceParameter: this.parseInstanceParameter(parametersNode),
                    throws: method["@_throws"] === "1",
                    doc: extractDoc(method),
                    returnDoc: returnValue ? extractDoc(returnValue) : undefined,
                    finishFunc: finishFunc || undefined,
                    shadows: shadows || undefined,
                    shadowedBy: shadowedBy || undefined,
                };
            });
    }

    private parseConstructors(constructors: Record<string, unknown>[]): RawConstructor[] {
        if (!constructors || !Array.isArray(constructors)) {
            return [];
        }
        return constructors
            .filter((ctor) => ctor["@_introspectable"] !== "0")
            .map((ctor) => {
                const returnValue = ctor["return-value"] as Record<string, unknown> | undefined;
                const shadows = ctor["@_shadows"] as string | undefined;
                const shadowedBy = ctor["@_shadowed-by"] as string | undefined;
                return {
                    name: String(ctor["@_name"] ?? ""),
                    cIdentifier: String(ctor["@_c:identifier"] ?? ""),
                    returnType: this.parseReturnType(returnValue),
                    parameters: this.parseParameters(
                        (ctor.parameters && typeof ctor.parameters === "object" && ctor.parameters !== null
                            ? ctor.parameters
                            : {}) as Record<string, unknown>,
                    ),
                    throws: ctor["@_throws"] === "1",
                    doc: extractDoc(ctor),
                    returnDoc: returnValue ? extractDoc(returnValue) : undefined,
                    shadows: shadows || undefined,
                    shadowedBy: shadowedBy || undefined,
                };
            });
    }

    private parseFunctions(functions: Record<string, unknown>[]): RawFunction[] {
        if (!functions || !Array.isArray(functions)) {
            return [];
        }
        return functions
            .filter((func) => func["@_introspectable"] !== "0")
            .map((func) => {
                const returnValue = func["return-value"] as Record<string, unknown> | undefined;
                const shadows = func["@_shadows"] as string | undefined;
                const shadowedBy = func["@_shadowed-by"] as string | undefined;
                return {
                    name: String(func["@_name"] ?? ""),
                    cIdentifier: String(func["@_c:identifier"] ?? ""),
                    returnType: this.parseReturnType(returnValue),
                    parameters: this.parseParameters(
                        (func.parameters && typeof func.parameters === "object" && func.parameters !== null
                            ? func.parameters
                            : {}) as Record<string, unknown>,
                    ),
                    throws: func["@_throws"] === "1",
                    doc: extractDoc(func),
                    returnDoc: returnValue ? extractDoc(returnValue) : undefined,
                    shadows: shadows || undefined,
                    shadowedBy: shadowedBy || undefined,
                };
            });
    }

    private parseParameters(parametersNode: Record<string, unknown>): RawParameter[] {
        if (!parametersNode?.parameter) {
            return [];
        }

        const params = Array.isArray(parametersNode.parameter) ? parametersNode.parameter : [parametersNode.parameter];

        return params.map((param: Record<string, unknown>) => this.parseSingleParameter(param));
    }

    private parseInstanceParameter(parametersNode: Record<string, unknown>): RawParameter | undefined {
        const instanceParam = parametersNode?.["instance-parameter"] as Record<string, unknown> | undefined;
        if (!instanceParam) {
            return undefined;
        }
        return this.parseSingleParameter(instanceParam);
    }

    private parseSingleParameter(param: Record<string, unknown>): RawParameter {
        const scope = param["@_scope"] as string | undefined;
        const closure = param["@_closure"] as string | undefined;
        const destroy = param["@_destroy"] as string | undefined;
        const transferOwnership = param["@_transfer-ownership"] as string | undefined;
        const callerAllocates = param["@_caller-allocates"] as string | undefined;
        return {
            name: String(param["@_name"] ?? ""),
            type: this.parseType((param.type ?? param.array) as Record<string, unknown> | undefined),
            direction: (String(param["@_direction"] ?? "in") as "in" | "out" | "inout") || "in",
            callerAllocates: callerAllocates === "1",
            nullable: param["@_nullable"] === "1",
            optional: param["@_allow-none"] === "1" || param["@_optional"] === "1",
            scope: scope as "async" | "call" | "notified" | undefined,
            closure: closure !== undefined ? parseInt(closure, 10) : undefined,
            destroy: destroy !== undefined ? parseInt(destroy, 10) : undefined,
            transferOwnership:
                transferOwnership === "none" || transferOwnership === "full" || transferOwnership === "container"
                    ? transferOwnership
                    : undefined,
            doc: extractDoc(param),
        };
    }

    private parseReturnType(returnValue: Record<string, unknown> | undefined): RawType {
        if (!returnValue) {
            return { name: "void" };
        }
        const type = this.parseType((returnValue.type ?? returnValue.array) as Record<string, unknown> | undefined);
        const transferOwnership = returnValue["@_transfer-ownership"] as string | undefined;
        if (transferOwnership === "none" || transferOwnership === "full" || transferOwnership === "container") {
            type.transferOwnership = transferOwnership;
        }
        if (returnValue["@_nullable"] === "1") {
            type.nullable = true;
        }
        return type;
    }

    private parseType(typeNode: Record<string, unknown> | undefined): RawType {
        if (!typeNode) {
            return { name: "void" };
        }

        const typeName = typeNode["@_name"] ? String(typeNode["@_name"]) : undefined;
        const cType = typeNode["@_c:type"] ? String(typeNode["@_c:type"]) : undefined;

        const containerResult = this.parseGLibContainerType(typeName, typeNode, cType);
        if (containerResult) {
            return containerResult;
        }

        if (typeName) {
            return { name: typeName, cType };
        }

        const isArrayNode =
            typeNode.type ||
            typeNode["@_zero-terminated"] !== undefined ||
            typeNode["@_fixed-size"] !== undefined ||
            typeNode["@_length"] !== undefined;

        if (isArrayNode) {
            const lengthAttr = typeNode["@_length"];
            const zeroTerminatedAttr = typeNode["@_zero-terminated"];
            const fixedSizeAttr = typeNode["@_fixed-size"];

            return {
                name: "array",
                isArray: true,
                elementType: typeNode.type ? this.parseType(typeNode.type as Record<string, unknown>) : undefined,
                lengthParamIndex: lengthAttr !== undefined ? Number(lengthAttr) : undefined,
                zeroTerminated: zeroTerminatedAttr !== undefined ? zeroTerminatedAttr !== "0" : undefined,
                fixedSize: fixedSizeAttr !== undefined ? Number(fixedSizeAttr) : undefined,
            };
        }

        return { name: "void" };
    }

    private extractTypeParameters(typeNode: Record<string, unknown>): RawType[] {
        const types: RawType[] = [];
        const typeChildren = typeNode.type;

        if (Array.isArray(typeChildren)) {
            for (const child of typeChildren) {
                types.push(this.parseType(child as Record<string, unknown>));
            }
        } else if (typeChildren) {
            types.push(this.parseType(typeChildren as Record<string, unknown>));
        }

        return types;
    }

    private parseGLibContainerType(
        typeName: string | undefined,
        typeNode: Record<string, unknown>,
        cType: string | undefined,
    ): RawType | null {
        if (typeName === "GLib.HashTable") {
            const typeParams = this.extractTypeParameters(typeNode);
            return {
                name: "GLib.HashTable",
                cType,
                isArray: false,
                containerType: "ghashtable" as ContainerType,
                typeParameters: typeParams.length >= 2 ? typeParams : undefined,
                elementType: typeParams[1],
            };
        }

        if (typeName === "GLib.PtrArray" || typeName === "GLib.Array") {
            const typeParams = this.extractTypeParameters(typeNode);
            return {
                name: typeName,
                cType,
                isArray: true,
                containerType: (typeName === "GLib.PtrArray" ? "gptrarray" : "garray") as ContainerType,
                typeParameters: typeParams.length > 0 ? typeParams : undefined,
                elementType: typeParams[0],
            };
        }

        if (typeName === "GLib.List" || typeName === "GLib.SList") {
            const innerType = (typeNode.type ?? typeNode.array) as Record<string, unknown> | undefined;
            const elementType = innerType ? this.parseType(innerType) : undefined;
            return {
                name: "array",
                cType,
                isArray: true,
                containerType: (typeName === "GLib.List" ? "glist" : "gslist") as ContainerType,
                typeParameters: elementType ? [elementType] : undefined,
                elementType,
            };
        }

        return null;
    }

    private parseProperties(properties: Record<string, unknown>[]): RawProperty[] {
        if (!properties || !Array.isArray(properties)) {
            return [];
        }
        return properties.map((prop) => {
            let getter = prop["@_getter"] ? String(prop["@_getter"]) : undefined;
            let setter = prop["@_setter"] ? String(prop["@_setter"]) : undefined;

            const attributes = prop.attribute as Record<string, unknown>[] | Record<string, unknown> | undefined;
            if (attributes) {
                const attrList = Array.isArray(attributes) ? attributes : [attributes];
                for (const attr of attrList) {
                    const attrName = attr["@_name"];
                    const attrValue = attr["@_value"];
                    if (attrName === "org.gtk.Property.get" && attrValue) {
                        getter = String(attrValue);
                    } else if (attrName === "org.gtk.Property.set" && attrValue) {
                        setter = String(attrValue);
                    }
                }
            }

            return {
                name: String(prop["@_name"] ?? ""),
                type: this.parseType((prop.type ?? prop.array) as Record<string, unknown> | undefined),
                readable: prop["@_readable"] !== "0",
                writable: prop["@_writable"] === "1",
                constructOnly: prop["@_construct-only"] === "1",
                defaultValueRaw: prop["@_default-value"] !== undefined ? String(prop["@_default-value"]) : undefined,
                getter,
                setter,
                doc: extractDoc(prop),
            };
        });
    }

    private parseSignals(signals: Record<string, unknown>[]): RawSignal[] {
        if (!signals || !Array.isArray(signals)) {
            return [];
        }
        return signals.map((signal) => {
            const whenValue = String(signal["@_when"] ?? "last");
            const validWhen = whenValue === "first" || whenValue === "last" || whenValue === "cleanup";
            return {
                name: String(signal["@_name"] ?? ""),
                when: validWhen ? (whenValue as "first" | "last" | "cleanup") : "last",
                returnType: signal["return-value"]
                    ? this.parseReturnType(signal["return-value"] as Record<string, unknown>)
                    : undefined,
                parameters:
                    signal.parameters && typeof signal.parameters === "object" && signal.parameters !== null
                        ? this.parseParameters(signal.parameters as Record<string, unknown>)
                        : [],
                doc: extractDoc(signal),
            };
        });
    }

    private parseRecords(records: Record<string, unknown>[]): RawRecord[] {
        if (!records || !Array.isArray(records)) {
            return [];
        }
        return records.map((record) => ({
            name: String(record["@_name"] ?? ""),
            cType: String(record["@_c:type"] ?? record["@_glib:type-name"] ?? ""),
            opaque: record["@_opaque"] === "1",
            disguised: record["@_disguised"] === "1",
            glibTypeName: record["@_glib:type-name"] ? String(record["@_glib:type-name"]) : undefined,
            glibGetType: record["@_glib:get-type"] ? String(record["@_glib:get-type"]) : undefined,
            isGtypeStructFor: record["@_glib:is-gtype-struct-for"]
                ? String(record["@_glib:is-gtype-struct-for"])
                : undefined,
            copyFunction: record["@_copy-function"] ? String(record["@_copy-function"]) : undefined,
            freeFunction: record["@_free-function"] ? String(record["@_free-function"]) : undefined,
            fields: this.parseFields(ensureArray(record.field)),
            methods: this.parseMethods(ensureArray(record.method)),
            constructors: this.parseConstructors(ensureArray(record.constructor)),
            functions: this.parseFunctions(ensureArray(record.function)),
            doc: extractDoc(record),
        }));
    }

    private parseFields(fields: Record<string, unknown>[]): RawField[] {
        if (!fields || !Array.isArray(fields)) {
            return [];
        }
        return fields
            .filter((field) => {
                const hasCallback = field.callback !== undefined;
                return !hasCallback;
            })
            .map((field) => ({
                name: String(field["@_name"] ?? ""),
                type: this.parseType((field.type ?? field.array) as Record<string, unknown> | undefined),
                writable: field["@_writable"] === "1",
                readable: field["@_readable"] !== "0",
                private: field["@_private"] === "1",
                doc: extractDoc(field),
            }));
    }

    private parseEnumerations(enumerations: Record<string, unknown>[]): RawEnumeration[] {
        if (!enumerations || !Array.isArray(enumerations)) {
            return [];
        }
        return enumerations.map((enumeration) => {
            const glibGetType = enumeration["@_glib:get-type"];
            return {
                name: String(enumeration["@_name"] ?? ""),
                cType: String(enumeration["@_c:type"] ?? ""),
                members: this.parseEnumerationMembers(ensureArray(enumeration.member)),
                glibGetType: typeof glibGetType === "string" ? glibGetType : undefined,
                doc: extractDoc(enumeration),
            };
        });
    }

    private parseEnumerationMembers(members: Record<string, unknown>[]): RawEnumerationMember[] {
        if (!members || !Array.isArray(members)) {
            return [];
        }
        return members.map((member) => ({
            name: String(member["@_name"] ?? ""),
            value: String(member["@_value"] ?? ""),
            cIdentifier: String(member["@_c:identifier"] ?? ""),
            doc: extractDoc(member),
        }));
    }

    private parseConstants(constants: Record<string, unknown>[]): RawConstant[] {
        if (!constants || !Array.isArray(constants)) {
            return [];
        }
        return constants.map((constant) => ({
            name: String(constant["@_name"] ?? ""),
            cType: String(constant["@_c:type"] ?? ""),
            value: String(constant["@_value"] ?? ""),
            type: this.parseType((constant.type ?? constant.array) as Record<string, unknown> | undefined),
            doc: extractDoc(constant),
        }));
    }
}
