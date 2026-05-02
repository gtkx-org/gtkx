import { XMLParser } from "fast-xml-parser";
import type { ContainerType } from "../model/type.js";
import type {
    RawAlias,
    RawCallback,
    RawClass,
    RawConstant,
    RawConstructor,
    RawDependency,
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
    RawRepositoryHeader,
    RawSignal,
    RawType,
} from "./raw-types.js";

type XmlElements = Record<string, unknown>[] | Record<string, unknown> | undefined;

const ARRAY_ELEMENT_PATHS = new Set<string>([
    "namespace.class",
    "namespace.interface",
    "namespace.function",
    "namespace.enumeration",
    "namespace.bitfield",
    "namespace.record",
    "namespace.callback",
    "namespace.constant",
    "namespace.alias",
    "namespace.class.method",
    "namespace.class._constructor",
    "namespace.class.function",
    "namespace.class.property",
    "namespace.class.signal",
    "namespace.class.glib:signal",
    "namespace.interface.method",
    "namespace.interface.property",
    "namespace.interface.signal",
    "namespace.interface.glib:signal",
    "namespace.record.method",
    "namespace.record._constructor",
    "namespace.record.function",
    "namespace.record.field",
    "namespace.class.method.parameters.parameter",
    "namespace.class._constructor.parameters.parameter",
    "namespace.class.function.parameters.parameter",
    "namespace.function.parameters.parameter",
    "namespace.enumeration.member",
    "namespace.bitfield.member",
    "namespace.interface.method.parameters.parameter",
    "namespace.class.glib:signal.parameters.parameter",
    "namespace.interface.glib:signal.parameters.parameter",
    "namespace.record.method.parameters.parameter",
    "namespace.record._constructor.parameters.parameter",
    "namespace.record.function.parameters.parameter",
    "namespace.callback.parameters.parameter",
]);

const INCLUDE_RE = /<include\s+name="([^"]+)"\s+version="([^"]+)"/g;
const NS_NAME_RE = /<namespace\s[^>]*name="([^"]+)"/;
const NS_VERSION_RE = /<namespace\s[^>]*version="([^"]+)"/;

function extractDoc(node: Record<string, unknown>): string | undefined {
    const doc = node.doc as Record<string, unknown> | undefined;
    if (!doc) return undefined;
    const text = doc["#text"];
    if (typeof text !== "string") return undefined;
    return text.trim();
}

function ensureArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function attrString(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}

function attrStringOrUndefined(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

/**
 * Parser for GObject Introspection XML (GIR) files.
 *
 * Provides both a lightweight header parse (for dependency graph discovery)
 * and a full parse (for complete namespace extraction).
 */
export class GirParser {
    private readonly parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "@_",
            textNodeName: "#text",
            transformTagName: (tagName) => (tagName === "constructor" ? "_constructor" : tagName),
            isArray: (_name, jpath, _isLeafNode, _isAttribute) => {
                if (typeof jpath !== "string") return false;
                const path = jpath.split(".").slice(1).join(".");
                return ARRAY_ELEMENT_PATHS.has(path);
            },
            processEntities: { maxTotalExpansions: 100000 },
        });
    }

    /**
     * Lightweight header parse using regex — extracts namespace name, version,
     * and `<include>` dependencies without paying the cost of full XML parsing.
     */
    parseHeader(girXml: string): RawRepositoryHeader {
        const nameMatch = NS_NAME_RE.exec(girXml);
        const versionMatch = NS_VERSION_RE.exec(girXml);

        if (!nameMatch || !versionMatch) {
            throw new Error("Failed to parse GIR header: missing namespace name or version");
        }

        const dependencies: RawDependency[] = [];
        INCLUDE_RE.lastIndex = 0;
        for (let m = INCLUDE_RE.exec(girXml); m !== null; m = INCLUDE_RE.exec(girXml)) {
            const name = m[1];
            const version = m[2];
            if (name && version) {
                dependencies.push({ name, version });
            }
        }

        const namespaceName = nameMatch[1];
        const namespaceVersion = versionMatch[1];
        if (!namespaceName || !namespaceVersion) {
            throw new Error("Failed to parse GIR header: missing namespace name or version");
        }

        return { namespaceName, namespaceVersion, dependencies };
    }

    /**
     * Full parse of a GIR XML string into a raw namespace.
     */
    parseNamespace(girXml: string): RawNamespace {
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
            aliases: this.parseAliases(namespace.alias ?? []),
        };
    }

    private parseClasses(classes: Record<string, unknown>[]): RawClass[] {
        return classes.map((cls) => ({
            name: attrString(cls["@_name"]),
            cType: attrString(cls["@_c:type"], attrString(cls["@_glib:type-name"])),
            parent: attrStringOrUndefined(cls["@_parent"]),
            abstract: cls["@_abstract"] === "1",
            glibTypeName: attrStringOrUndefined(cls["@_glib:type-name"]),
            glibGetType: attrStringOrUndefined(cls["@_glib:get-type"]),
            cSymbolPrefix: attrStringOrUndefined(cls["@_c:symbol-prefix"]),
            fundamental: cls["@_glib:fundamental"] === "1",
            refFunc: attrStringOrUndefined(cls["@_glib:ref-func"]),
            unrefFunc: attrStringOrUndefined(cls["@_glib:unref-func"]),
            implements: this.parseImplements(cls.implements as XmlElements),
            methods: this.parseMethods(ensureArray(cls.method)),
            constructors: this.parseConstructors(ensureArray(cls._constructor)),
            functions: this.parseFunctions(ensureArray(cls.function)),
            properties: this.parseProperties(ensureArray(cls.property)),
            signals: this.parseSignals(ensureArray(cls["glib:signal"])),
            doc: extractDoc(cls),
        }));
    }

    private parseImplements(implements_: XmlElements): string[] {
        if (!implements_) return [];
        const arr = Array.isArray(implements_) ? implements_ : [implements_];
        return arr.map((impl) => attrString(impl["@_name"])).filter(Boolean);
    }

    private parseInterfaces(interfaces: Record<string, unknown>[]): RawInterface[] {
        if (!interfaces || !Array.isArray(interfaces)) return [];
        return interfaces.map((iface) => ({
            name: attrString(iface["@_name"]),
            cType: attrString(iface["@_c:type"], attrString(iface["@_glib:type-name"])),
            glibTypeName: attrStringOrUndefined(iface["@_glib:type-name"]),
            prerequisites: this.parsePrerequisites(iface.prerequisite as XmlElements),
            methods: this.parseMethods(ensureArray(iface.method)),
            properties: this.parseProperties(ensureArray(iface.property)),
            signals: this.parseSignals(ensureArray(iface["glib:signal"])),
            doc: extractDoc(iface),
        }));
    }

    private parsePrerequisites(prerequisites: XmlElements): string[] {
        if (!prerequisites) return [];
        const arr = Array.isArray(prerequisites) ? prerequisites : [prerequisites];
        return arr.map((prereq) => attrString(prereq["@_name"])).filter(Boolean);
    }

    private parseMethods(methods: Record<string, unknown>[]): RawMethod[] {
        if (!methods || !Array.isArray(methods)) return [];
        return methods
            .filter((m) => m["@_introspectable"] !== "0")
            .map((method) => {
                const returnValue = method["return-value"] as Record<string, unknown> | undefined;
                const parametersNode = this.extractParametersNode(method);
                return {
                    name: attrString(method["@_name"]),
                    cIdentifier: attrString(method["@_c:identifier"]),
                    returnType: this.parseReturnType(returnValue),
                    parameters: this.parseParameters(parametersNode),
                    instanceParameter: this.parseInstanceParameter(parametersNode),
                    throws: method["@_throws"] === "1",
                    doc: extractDoc(method),
                    returnDoc: returnValue ? extractDoc(returnValue) : undefined,
                    finishFunc: (method["@_glib:finish-func"] as string) || undefined,
                    shadows: (method["@_shadows"] as string) || undefined,
                    shadowedBy: (method["@_shadowed-by"] as string) || undefined,
                };
            });
    }

    private parseConstructors(constructors: Record<string, unknown>[]): RawConstructor[] {
        if (!constructors || !Array.isArray(constructors)) return [];
        return constructors
            .filter((c) => c["@_introspectable"] !== "0")
            .map((ctor) => {
                const returnValue = ctor["return-value"] as Record<string, unknown> | undefined;
                return {
                    name: attrString(ctor["@_name"]),
                    cIdentifier: attrString(ctor["@_c:identifier"]),
                    returnType: this.parseReturnType(returnValue),
                    parameters: this.parseParameters(this.extractParametersNode(ctor)),
                    throws: ctor["@_throws"] === "1",
                    doc: extractDoc(ctor),
                    returnDoc: returnValue ? extractDoc(returnValue) : undefined,
                    shadows: (ctor["@_shadows"] as string) || undefined,
                    shadowedBy: (ctor["@_shadowed-by"] as string) || undefined,
                };
            });
    }

    private parseFunctions(functions: Record<string, unknown>[]): RawFunction[] {
        if (!functions || !Array.isArray(functions)) return [];
        return functions
            .filter((f) => f["@_introspectable"] !== "0")
            .map((func) => {
                const returnValue = func["return-value"] as Record<string, unknown> | undefined;
                return {
                    name: attrString(func["@_name"]),
                    cIdentifier: attrString(func["@_c:identifier"]),
                    returnType: this.parseReturnType(returnValue),
                    parameters: this.parseParameters(this.extractParametersNode(func)),
                    throws: func["@_throws"] === "1",
                    doc: extractDoc(func),
                    returnDoc: returnValue ? extractDoc(returnValue) : undefined,
                    shadows: (func["@_shadows"] as string) || undefined,
                    shadowedBy: (func["@_shadowed-by"] as string) || undefined,
                };
            });
    }

    private parseCallbacks(callbacks: Record<string, unknown>[]): RawCallback[] {
        if (!callbacks || !Array.isArray(callbacks)) return [];
        return callbacks
            .filter((cb) => cb["@_introspectable"] !== "0")
            .map((cb) => ({
                name: attrString(cb["@_name"]),
                cType: attrString(cb["@_c:type"]),
                returnType: this.parseReturnType(cb["return-value"] as Record<string, unknown> | undefined),
                parameters: this.parseParameters(this.extractParametersNode(cb)),
                doc: extractDoc(cb),
            }));
    }

    private parseRecords(records: Record<string, unknown>[]): RawRecord[] {
        if (!records || !Array.isArray(records)) return [];
        return records.map((record) => ({
            name: attrString(record["@_name"]),
            cType: attrString(record["@_c:type"], attrString(record["@_glib:type-name"])),
            opaque: record["@_opaque"] === "1",
            disguised: record["@_disguised"] === "1",
            glibTypeName: attrStringOrUndefined(record["@_glib:type-name"]),
            glibGetType: attrStringOrUndefined(record["@_glib:get-type"]),
            isGtypeStructFor: record["@_glib:is-gtype-struct-for"]
                ? attrString(record["@_glib:is-gtype-struct-for"])
                : undefined,
            copyFunction: attrStringOrUndefined(record["@_copy-function"]),
            freeFunction: attrStringOrUndefined(record["@_free-function"]),
            fields: this.parseFields(ensureArray(record.field)),
            methods: this.parseMethods(ensureArray(record.method)),
            constructors: this.parseConstructors(ensureArray(record._constructor)),
            functions: this.parseFunctions(ensureArray(record.function)),
            doc: extractDoc(record),
        }));
    }

    private parseEnumerations(enumerations: Record<string, unknown>[]): RawEnumeration[] {
        if (!enumerations || !Array.isArray(enumerations)) return [];
        return enumerations.map((enumeration) => ({
            name: attrString(enumeration["@_name"]),
            cType: attrString(enumeration["@_c:type"]),
            members: this.parseEnumerationMembers(ensureArray(enumeration.member)),
            glibGetType:
                typeof enumeration["@_glib:get-type"] === "string" ? enumeration["@_glib:get-type"] : undefined,
            doc: extractDoc(enumeration),
        }));
    }

    private parseEnumerationMembers(members: Record<string, unknown>[]): RawEnumerationMember[] {
        if (!members || !Array.isArray(members)) return [];
        return members.map((member) => ({
            name: attrString(member["@_name"]),
            value: attrString(member["@_value"]),
            cIdentifier: attrString(member["@_c:identifier"]),
            doc: extractDoc(member),
        }));
    }

    private parseConstants(constants: Record<string, unknown>[]): RawConstant[] {
        if (!constants || !Array.isArray(constants)) return [];
        return constants.map((constant) => ({
            name: attrString(constant["@_name"]),
            cType: attrString(constant["@_c:type"]),
            value: attrString(constant["@_value"]),
            type: this.parseType((constant.type ?? constant.array) as Record<string, unknown> | undefined),
            doc: extractDoc(constant),
        }));
    }

    private parseAliases(aliases: Record<string, unknown>[]): RawAlias[] {
        if (!aliases || !Array.isArray(aliases)) return [];
        return aliases.map((alias) => ({
            name: attrString(alias["@_name"]),
            cType: attrString(alias["@_c:type"]),
            targetType: this.parseType(alias.type as Record<string, unknown> | undefined),
            doc: extractDoc(alias),
        }));
    }

    private parseProperties(properties: Record<string, unknown>[]): RawProperty[] {
        if (!properties || !Array.isArray(properties)) return [];
        return properties.map((prop) => {
            let getter = attrStringOrUndefined(prop["@_getter"]);
            let setter = attrStringOrUndefined(prop["@_setter"]);

            const attributes = prop.attribute as XmlElements;
            if (attributes) {
                const attrList = Array.isArray(attributes) ? attributes : [attributes];
                for (const attr of attrList) {
                    if (attr["@_name"] === "org.gtk.Property.get" && attr["@_value"]) {
                        getter = attrString(attr["@_value"]);
                    } else if (attr["@_name"] === "org.gtk.Property.set" && attr["@_value"]) {
                        setter = attrString(attr["@_value"]);
                    }
                }
            }

            return {
                name: attrString(prop["@_name"]),
                type: this.parseType((prop.type ?? prop.array) as Record<string, unknown> | undefined),
                readable: prop["@_readable"] !== "0",
                writable: prop["@_writable"] === "1",
                constructOnly: prop["@_construct-only"] === "1",
                defaultValueRaw:
                    prop["@_default-value"] === undefined ? undefined : attrString(prop["@_default-value"]),
                getter,
                setter,
                doc: extractDoc(prop),
            };
        });
    }

    private parseSignals(signals: Record<string, unknown>[]): RawSignal[] {
        if (!signals || !Array.isArray(signals)) return [];
        return signals.map((signal) => {
            const whenValue = attrString(signal["@_when"], "last");
            const when: "first" | "last" | "cleanup" =
                whenValue === "first" || whenValue === "last" || whenValue === "cleanup" ? whenValue : "last";
            return {
                name: attrString(signal["@_name"]),
                when,
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

    private parseFields(fields: Record<string, unknown>[]): RawField[] {
        if (!fields || !Array.isArray(fields)) return [];
        return fields
            .filter((field) => field.callback === undefined)
            .map((field) => ({
                name: attrString(field["@_name"]),
                type: this.parseType((field.type ?? field.array) as Record<string, unknown> | undefined),
                writable: field["@_writable"] === "1",
                readable: field["@_readable"] !== "0",
                private: field["@_private"] === "1",
                doc: extractDoc(field),
            }));
    }

    private extractParametersNode(node: Record<string, unknown>): Record<string, unknown> {
        return node.parameters && typeof node.parameters === "object" && node.parameters !== null
            ? (node.parameters as Record<string, unknown>)
            : {};
    }

    private parseParameters(parametersNode: Record<string, unknown>): RawParameter[] {
        if (!parametersNode?.parameter) return [];
        const params = Array.isArray(parametersNode.parameter) ? parametersNode.parameter : [parametersNode.parameter];
        return params.map((param: Record<string, unknown>) => this.parseSingleParameter(param));
    }

    private parseInstanceParameter(parametersNode: Record<string, unknown>): RawParameter | undefined {
        const instanceParam = parametersNode?.["instance-parameter"] as Record<string, unknown> | undefined;
        if (!instanceParam) return undefined;
        return this.parseSingleParameter(instanceParam);
    }

    private parseSingleParameter(param: Record<string, unknown>): RawParameter {
        const scope = param["@_scope"] as string | undefined;
        const closure = param["@_closure"] as string | undefined;
        const destroy = param["@_destroy"] as string | undefined;
        const transferOwnership = param["@_transfer-ownership"] as string | undefined;
        const callerAllocates = param["@_caller-allocates"] as string | undefined;
        return {
            name: attrString(param["@_name"]),
            type: this.parseType((param.type ?? param.array) as Record<string, unknown> | undefined),
            direction: (attrString(param["@_direction"], "in") as "in" | "out" | "inout") || "in",
            callerAllocates: callerAllocates === "1",
            nullable: param["@_nullable"] === "1",
            optional: param["@_allow-none"] === "1" || param["@_optional"] === "1",
            scope: scope as "async" | "call" | "notified" | "forever" | undefined,
            closure: closure === undefined ? undefined : Number.parseInt(closure, 10),
            destroy: destroy === undefined ? undefined : Number.parseInt(destroy, 10),
            transferOwnership:
                transferOwnership === "none" || transferOwnership === "full" || transferOwnership === "container"
                    ? transferOwnership
                    : undefined,
            doc: extractDoc(param),
        };
    }

    private parseReturnType(returnValue: Record<string, unknown> | undefined): RawType {
        if (!returnValue) return { name: "void" };
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
        if (!typeNode) return { name: "void" };

        const typeName = attrStringOrUndefined(typeNode["@_name"]);
        const cType = attrStringOrUndefined(typeNode["@_c:type"]);

        const containerResult = this.parseGLibContainerType(typeName, typeNode, cType);
        if (containerResult) return containerResult;

        if (typeName) return { name: typeName, cType };

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
                sizeParamIndex: typeNode["@_length"] === undefined ? undefined : Number(typeNode["@_length"]),
                zeroTerminated:
                    typeNode["@_zero-terminated"] === undefined ? undefined : typeNode["@_zero-terminated"] !== "0",
                fixedSize: typeNode["@_fixed-size"] === undefined ? undefined : Number(typeNode["@_fixed-size"]),
            };
        }

        return { name: "void" };
    }

    private extractTypeParameters(typeNode: Record<string, unknown>): RawType[] {
        const types: RawType[] = [];
        const typeChildren = typeNode.type;
        const arrayChildren = typeNode.array;

        if (Array.isArray(typeChildren)) {
            for (const child of typeChildren) {
                types.push(this.parseType(child as Record<string, unknown>));
            }
        } else if (typeChildren) {
            types.push(this.parseType(typeChildren as Record<string, unknown>));
        }

        if (Array.isArray(arrayChildren)) {
            for (const child of arrayChildren) {
                types.push(this.parseType(child as Record<string, unknown>));
            }
        } else if (arrayChildren) {
            types.push(this.parseType(arrayChildren as Record<string, unknown>));
        }

        return types;
    }

    private parseGLibContainerType(
        typeName: string | undefined,
        typeNode: Record<string, unknown>,
        cType: string | undefined,
    ): RawType | null {
        switch (typeName) {
            case "GLib.HashTable":
                return this.buildHashTableType(typeNode, cType);
            case "GLib.PtrArray":
            case "GLib.Array":
                return this.buildPtrArrayType(typeName, typeNode, cType);
            case "GLib.ByteArray":
                return this.buildByteArrayType(cType);
            case "GLib.List":
            case "GLib.SList":
                return this.buildListType(typeName, typeNode, cType);
            default:
                return null;
        }
    }

    private buildHashTableType(typeNode: Record<string, unknown>, cType: string | undefined): RawType {
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

    private buildPtrArrayType(
        typeName: "GLib.PtrArray" | "GLib.Array",
        typeNode: Record<string, unknown>,
        cType: string | undefined,
    ): RawType {
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

    private buildByteArrayType(cType: string | undefined): RawType {
        return {
            name: "GLib.ByteArray",
            cType,
            isArray: true,
            containerType: "gbytearray" as ContainerType,
            elementType: { name: "guint8", cType: "guint8" },
        };
    }

    private buildListType(
        typeName: "GLib.List" | "GLib.SList",
        typeNode: Record<string, unknown>,
        cType: string | undefined,
    ): RawType {
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
}
