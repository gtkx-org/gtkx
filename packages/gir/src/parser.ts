import { XMLParser } from "fast-xml-parser";
import type {
    GirClass,
    GirConstructor,
    GirEnumeration,
    GirEnumerationMember,
    GirField,
    GirFunction,
    GirInterface,
    GirMethod,
    GirNamespace,
    GirParameter,
    GirProperty,
    GirRecord,
    GirSignal,
    GirType,
} from "./types.js";

const ARRAY_ELEMENT_PATHS = new Set<string>([
    "namespace.class",
    "namespace.interface",
    "namespace.function",
    "namespace.enumeration",
    "namespace.bitfield",
    "namespace.record",
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
]);

const extractDoc = (node: Record<string, unknown>): string | undefined => {
    const doc = node.doc as Record<string, unknown> | undefined;
    if (!doc) return undefined;
    const text = doc["#text"] as string | undefined;
    return text?.trim();
};

/**
 * Parser for GObject Introspection (GIR) XML files.
 * Converts GIR XML into structured TypeScript interfaces.
 */
export class GirParser {
    private parser: XMLParser;

    /** Creates a new GIR parser instance. */
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
     * Parses a GIR XML string into a structured namespace definition.
     * @param girXml - The GIR XML content to parse
     * @returns The parsed namespace containing all type definitions
     * @throws Error if the XML is invalid or missing required elements
     */
    parse(girXml: string): GirNamespace {
        const parsed = this.parser.parse(girXml);
        const repository = parsed.repository;

        if (!repository?.namespace) {
            throw new Error("Invalid GIR file: missing repository or namespace");
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
        };
    }

    private parseClasses(classes: Record<string, unknown>[]): GirClass[] {
        return classes.map((cls) => ({
            name: String(cls["@_name"] ?? ""),
            cType: String(cls["@_c:type"] ?? cls["@_glib:type-name"] ?? ""),
            parent: String(cls["@_parent"] ?? ""),
            abstract: cls["@_abstract"] === "1",
            implements: this.parseImplements(
                cls.implements as Record<string, unknown>[] | Record<string, unknown> | undefined,
            ),
            methods: this.parseMethods(Array.isArray(cls.method) ? (cls.method as Record<string, unknown>[]) : []),
            constructors: this.parseConstructors(
                Array.isArray(cls.constructor) ? (cls.constructor as Record<string, unknown>[]) : [],
            ),
            functions: this.parseFunctions(
                Array.isArray(cls.function) ? (cls.function as Record<string, unknown>[]) : [],
            ),
            properties: this.parseProperties(
                Array.isArray(cls.property) ? (cls.property as Record<string, unknown>[]) : [],
            ),
            signals: this.parseSignals(
                Array.isArray(cls["glib:signal"]) ? (cls["glib:signal"] as Record<string, unknown>[]) : [],
            ),
            doc: extractDoc(cls),
        }));
    }

    private parseImplements(implements_: Record<string, unknown>[] | Record<string, unknown> | undefined): string[] {
        if (!implements_) return [];
        const arr = Array.isArray(implements_) ? implements_ : [implements_];
        return arr.map((impl) => String(impl["@_name"] ?? "")).filter(Boolean);
    }

    private parseInterfaces(interfaces: Record<string, unknown>[]): GirInterface[] {
        if (!interfaces || !Array.isArray(interfaces)) {
            return [];
        }
        return interfaces.map((iface) => ({
            name: String(iface["@_name"] ?? ""),
            cType: String(iface["@_c:type"] ?? iface["@_glib:type-name"] ?? ""),
            methods: this.parseMethods(Array.isArray(iface.method) ? (iface.method as Record<string, unknown>[]) : []),
            properties: this.parseProperties(
                Array.isArray(iface.property) ? (iface.property as Record<string, unknown>[]) : [],
            ),
            signals: this.parseSignals(
                Array.isArray(iface["glib:signal"]) ? (iface["glib:signal"] as Record<string, unknown>[]) : [],
            ),
            doc: extractDoc(iface),
        }));
    }

    private parseMethods(methods: Record<string, unknown>[]): GirMethod[] {
        if (!methods || !Array.isArray(methods)) {
            return [];
        }
        return methods.map((method) => ({
            name: String(method["@_name"] ?? ""),
            cIdentifier: String(method["@_c:identifier"] ?? ""),
            returnType: this.parseReturnType(method["return-value"] as Record<string, unknown> | undefined),
            parameters: this.parseParameters(
                (method.parameters && typeof method.parameters === "object" && method.parameters !== null
                    ? method.parameters
                    : {}) as Record<string, unknown>,
            ),
            throws: method["@_throws"] === "1",
            doc: extractDoc(method),
        }));
    }

    private parseConstructors(constructors: Record<string, unknown>[]): GirConstructor[] {
        if (!constructors || !Array.isArray(constructors)) {
            return [];
        }
        return constructors.map((ctor) => ({
            name: String(ctor["@_name"] ?? ""),
            cIdentifier: String(ctor["@_c:identifier"] ?? ""),
            returnType: this.parseReturnType(ctor["return-value"] as Record<string, unknown> | undefined),
            parameters: this.parseParameters(
                (ctor.parameters && typeof ctor.parameters === "object" && ctor.parameters !== null
                    ? ctor.parameters
                    : {}) as Record<string, unknown>,
            ),
            doc: extractDoc(ctor),
        }));
    }

    private parseFunctions(functions: Record<string, unknown>[]): GirFunction[] {
        if (!functions || !Array.isArray(functions)) {
            return [];
        }
        return functions.map((func) => ({
            name: String(func["@_name"] ?? ""),
            cIdentifier: String(func["@_c:identifier"] ?? ""),
            returnType: this.parseReturnType(func["return-value"] as Record<string, unknown> | undefined),
            parameters: this.parseParameters(
                (func.parameters && typeof func.parameters === "object" && func.parameters !== null
                    ? func.parameters
                    : {}) as Record<string, unknown>,
            ),
            throws: func["@_throws"] === "1",
            doc: extractDoc(func),
        }));
    }

    private parseParameters(parametersNode: Record<string, unknown>): GirParameter[] {
        if (!parametersNode?.parameter) {
            return [];
        }

        const params = Array.isArray(parametersNode.parameter) ? parametersNode.parameter : [parametersNode.parameter];

        return params.map((param: Record<string, unknown>) => {
            const scope = param["@_scope"] as string | undefined;
            const closure = param["@_closure"] as string | undefined;
            return {
                name: String(param["@_name"] ?? ""),
                type: this.parseType((param.type ?? param.array) as Record<string, unknown> | undefined),
                direction: (String(param["@_direction"] ?? "in") as "in" | "out" | "inout") || "in",
                nullable: param["@_nullable"] === "1",
                optional: param["@_allow-none"] === "1",
                scope: scope as "async" | "call" | "notified" | undefined,
                closure: closure !== undefined ? parseInt(closure, 10) : undefined,
                doc: extractDoc(param),
            };
        });
    }

    private parseReturnType(returnValue: Record<string, unknown> | undefined): GirType {
        if (!returnValue) {
            return { name: "void" };
        }
        return this.parseType((returnValue.type ?? returnValue.array) as Record<string, unknown> | undefined);
    }

    private parseType(typeNode: Record<string, unknown> | undefined): GirType {
        if (!typeNode) {
            return { name: "void" };
        }

        if (typeNode["@_name"]) {
            return {
                name: String(typeNode["@_name"] ?? ""),
                cType: typeNode["@_c:type"] ? String(typeNode["@_c:type"]) : undefined,
            };
        }

        const isArrayNode =
            typeNode.type ||
            typeNode["@_zero-terminated"] !== undefined ||
            typeNode["@_fixed-size"] !== undefined ||
            typeNode["@_length"] !== undefined;

        if (isArrayNode) {
            return {
                name: "array",
                isArray: true,
                elementType: typeNode.type ? this.parseType(typeNode.type as Record<string, unknown>) : undefined,
            };
        }

        return { name: "void" };
    }

    private parseProperties(properties: Record<string, unknown>[]): GirProperty[] {
        if (!properties || !Array.isArray(properties)) {
            return [];
        }
        return properties.map((prop) => ({
            name: String(prop["@_name"] ?? ""),
            type: this.parseType((prop.type ?? prop.array) as Record<string, unknown> | undefined),
            readable: prop["@_readable"] !== "0",
            writable: prop["@_writable"] === "1",
            constructOnly: prop["@_construct-only"] === "1",
            hasDefault: prop["@_default-value"] !== undefined,
            doc: extractDoc(prop),
        }));
    }

    private parseSignals(signals: Record<string, unknown>[]): GirSignal[] {
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

    private parseRecords(records: Record<string, unknown>[]): GirRecord[] {
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
            fields: this.parseFields(Array.isArray(record.field) ? (record.field as Record<string, unknown>[]) : []),
            methods: this.parseMethods(
                Array.isArray(record.method) ? (record.method as Record<string, unknown>[]) : [],
            ),
            constructors: this.parseConstructors(
                Array.isArray(record.constructor) ? (record.constructor as Record<string, unknown>[]) : [],
            ),
            functions: this.parseFunctions(
                Array.isArray(record.function) ? (record.function as Record<string, unknown>[]) : [],
            ),
            doc: extractDoc(record),
        }));
    }

    private parseFields(fields: Record<string, unknown>[]): GirField[] {
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

    private parseEnumerations(enumerations: Record<string, unknown>[]): GirEnumeration[] {
        if (!enumerations || !Array.isArray(enumerations)) {
            return [];
        }
        return enumerations.map((enumeration) => ({
            name: String(enumeration["@_name"] ?? ""),
            cType: String(enumeration["@_c:type"] ?? ""),
            members: this.parseEnumerationMembers(
                Array.isArray(enumeration.member) ? (enumeration.member as Record<string, unknown>[]) : [],
            ),
            doc: extractDoc(enumeration),
        }));
    }

    private parseEnumerationMembers(members: Record<string, unknown>[]): GirEnumerationMember[] {
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
}
