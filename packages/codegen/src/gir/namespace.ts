import type { ParseContext, TypeId } from "./type-id.js";
import { documentedFromNode, type GirAnnotations } from "./annotations.js";
import { callbackFromNode, type GirCallback } from "./callback.js";
import { classFromNode, type GirClass } from "./class.js";
import { enumFromNode, type GirEnum } from "./enum.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, getChild, getChildren, nameAttr, type RawNode } from "./parse.js";
import { type GirRecord, isVtableRecord, recordFromNode } from "./record.js";
import { typeRefFromNode } from "./type-ref.js";

/** A compile-time constant declared by a namespace. */
type GirConstant = {
    /** Local name within the namespace. */
    name: string;
    /** Documentation text carried by the GIR node. */
    doc: string | undefined;
    /** Release and deprecation annotations GIR carries on the constant. */
    annotations: GirAnnotations;
    /** Literal as written in the GIR, still to be interpreted according to {@link GirConstant.type}. */
    value: string;
    /** Type of the constant, unresolved until looked up in the library's type tables. */
    type: TypeId | undefined;
};

/** A named alias for another type. */
type GirAlias = {
    /** Local name within the namespace. */
    name: string;
    /** Documentation text carried by the GIR node. */
    doc: string | undefined;
    /** Release and deprecation annotations GIR carries on the alias. */
    annotations: GirAnnotations;
    /** C typedef name introduced by the alias. */
    cType: string | undefined;
    /** Type the alias stands for, unresolved until looked up in the library's type tables. */
    target: TypeId | undefined;
    /** C type name of the target, which decides how the alias marshals. */
    targetCType: string | undefined;
};

/** Everything one GIR namespace declares, keyed into the library that parsed it. */
type GirNamespace = {
    /** Identifier of the namespace's type table within its library. */
    id: number;
    /** Namespace name as it appears in the GIR, such as `Gtk`. */
    name: string;
    /** The `shared-library` attribute verbatim: the objects to load symbols from, separated by commas. */
    sharedLibrary: string | undefined;
    /** Prefixes stripped off C identifiers to derive export names, such as `gtk`. */
    cSymbolPrefixes: string[];
    /** GObject classes declared by the namespace. */
    classes: GirClass[];
    /** GObject interfaces declared by the namespace. */
    interfaces: GirClass[];
    /** Structs and unions declared by the namespace. */
    records: GirRecord[];
    /** Enumerations and bitfields declared by the namespace. */
    enums: GirEnum[];
    /** Callback types declared by the namespace. */
    callbacks: GirCallback[];
    /** Free functions declared by the namespace. */
    functions: GirFunction[];
    /** Compile-time values, emitted as module-level `const` bindings. */
    constants: GirConstant[];
    /** Typedefs, emitted as TypeScript type aliases and resolvable as types themselves. */
    aliases: GirAlias[];
};

/** Another namespace a GIR repository depends on. */
type NamespaceInclude = {
    /** Name of the included namespace, such as `Gio`. */
    name: string;
    /** Version of the included namespace, such as `2.0`. */
    version: string;
};

/** A namespace's declaration and dependencies, read before its body is parsed. */
type NamespaceHeader = {
    /** Namespace name as it appears in the GIR, such as `Gtk`. */
    name: string;
    /** The `shared-library` attribute verbatim: the objects to load symbols from, separated by commas. */
    sharedLibrary: string | undefined;
    /** Prefixes stripped off C identifiers to derive export names, such as `gtk`. */
    cSymbolPrefixes: string[];
    /** Namespaces this repository includes, each of which is parsed in turn. */
    includes: NamespaceInclude[];
    /** The `<namespace>` node whose children hold the declarations. */
    namespaceNode: RawNode;
};

const namespaceDirectory = (namespace: Pick<GirNamespace, "name">): string => namespace.name.toLowerCase();

const parseNamespaceHeader = (repositoryNode: RawNode): NamespaceHeader => {
    const includes = getChildren(repositoryNode, "include").map<NamespaceInclude>((include) => ({
        name: nameAttr(include),
        version: attr(include, "version") ?? "",
    }));

    const namespaceNode = getChildren(repositoryNode, "namespace")[0];

    if (namespaceNode === undefined) {
        throw new Error("GIR repository has no <namespace> child");
    }

    return {
        name: nameAttr(namespaceNode),
        sharedLibrary: attr(namespaceNode, "shared-library"),
        cSymbolPrefixes: splitPrefixes(attr(namespaceNode, "c:symbol-prefixes")),
        includes,
        namespaceNode,
    };
};

const createNamespaceShell = (header: NamespaceHeader, id: number): GirNamespace => ({
    id,
    name: header.name,
    sharedLibrary: header.sharedLibrary,
    cSymbolPrefixes: header.cSymbolPrefixes,
    classes: [],
    interfaces: [],
    records: [],
    enums: [],
    callbacks: [],
    functions: [],
    constants: [],
    aliases: [],
});

const populateNamespaceBody = (shell: GirNamespace, namespaceNode: RawNode, context: ParseContext): void => {
    shell.classes = getChildren(namespaceNode, "class").map((klass) => classFromNode(klass, false, context));
    shell.interfaces = getChildren(namespaceNode, "interface").map((iface) => classFromNode(iface, true, context));
    shell.records = collectRecords(namespaceNode, context);
    shell.enums = collectEnums(namespaceNode);
    shell.callbacks = getChildren(namespaceNode, "callback").map((callback) => callbackFromNode(callback, context));
    shell.functions = getChildren(namespaceNode, "function").map((fn) => functionFromNode(fn, context));

    shell.constants = getChildren(namespaceNode, "constant").map((constant) => ({
        ...documentedFromNode(constant),
        value: attr(constant, "value") ?? "",
        type: typeRefFromNode(constant, context),
    }));

    shell.aliases = getChildren(namespaceNode, "alias").map((alias) => ({
        ...documentedFromNode(alias),
        cType: attr(alias, "c:type"),
        target: typeRefFromNode(alias, context),
        targetCType: attr(getChild(alias, "type"), "c:type"),
    }));
};

const splitPrefixes = (raw: string | undefined): string[] =>
    (raw ?? "").split(",").filter((prefix) => prefix.length > 0);

const collectRecords = (namespaceNode: RawNode, context: ParseContext): GirRecord[] => [
    ...getChildren(namespaceNode, "record").map((record) =>
        recordFromNode(record, isVtableRecord(record), false, context),
    ),
    ...getChildren(namespaceNode, "union").map((union) => recordFromNode(union, isVtableRecord(union), true, context)),
];

const collectEnums = (namespaceNode: RawNode): GirEnum[] => [
    ...getChildren(namespaceNode, "enumeration").map((enumeration) => enumFromNode(enumeration, "enumeration")),
    ...getChildren(namespaceNode, "bitfield").map((bitfield) => enumFromNode(bitfield, "bitfield")),
];

export {
    namespaceDirectory,
    parseNamespaceHeader,
    createNamespaceShell,
    populateNamespaceBody,
    type GirConstant,
    type GirAlias,
    type GirNamespace,
    type NamespaceHeader,
};
