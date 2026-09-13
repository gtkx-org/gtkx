import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { ParseContext, TypeId } from "./type-id.js";
import { documentedFromNode, type GirAnnotations } from "./annotations.js";
import { callbackFromNode, type GirCallback } from "./callback.js";
import { classFromNode, type GirClass } from "./class.js";
import { enumFromNode, type GirEnum } from "./enum.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, getChild, getChildren, nameAttr, type RawNode } from "./parse.js";
import { type GirRecord, isVtableRecord, recordFromNode } from "./record.js";
import { typeRefFromNode } from "./type-ref.js";

type GirConstant = {
    name: string;
    doc: string | undefined;
    annotations: GirAnnotations;
    value: string;
    type: TypeId | undefined;
};

type GirAlias = {
    name: string;
    doc: string | undefined;
    annotations: GirAnnotations;
    cType: string | undefined;
    target: TypeId | undefined;
    targetCType: string | undefined;
};

type GirNamespace = {
    id: number;
    name: string;
    girFile: string;
    sharedLibrary: string | undefined;
    cSymbolPrefixes: string[];
    classes: GirClass[];
    interfaces: GirClass[];
    records: GirRecord[];
    enums: GirEnum[];
    callbacks: GirCallback[];
    functions: GirFunction[];
    constants: GirConstant[];
    aliases: GirAlias[];
};

type NamespaceInclude = {
    name: string;
    version: string;
};

type NamespaceHeader = {
    name: string;
    girFile: string;
    sharedLibrary: string | undefined;
    cSymbolPrefixes: string[];
    includes: NamespaceInclude[];
    namespaceNode: RawNode;
};

const namespaceDirectory = (namespace: Pick<GirNamespace, "name">): string => namespace.name.toLowerCase();

const parseNamespaceHeader = (repositoryNode: RawNode, path: string): NamespaceHeader => {
    const includes = getChildren(repositoryNode, "include").map<NamespaceInclude>((include) => ({
        name: nameAttr(include),
        version: attr(include, "version") ?? "",
    }));

    const namespaceNode = getChildren(repositoryNode, "namespace")[0];

    if (namespaceNode === undefined) {
        throw new Error(`GIR file at ${path} has no <namespace> child in its <repository>`);
    }

    return {
        name: nameAttr(namespaceNode),
        girFile: path,
        sharedLibrary: attr(namespaceNode, "shared-library"),
        cSymbolPrefixes: splitPrefixes(attr(namespaceNode, "c:symbol-prefixes")),
        includes,
        namespaceNode,
    };
};

const createNamespaceShell = (header: NamespaceHeader, id: number): GirNamespace => ({
    id,
    name: header.name,
    girFile: header.girFile,
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

const declaredTypeNames = (namespace: GirNamespace): Set<string> =>
    new Set(
        [
            ...namespace.classes,
            ...namespace.interfaces,
            ...namespace.records,
            ...namespace.enums,
            ...namespace.callbacks,
            ...namespace.aliases,
        ].map((entry) => sanitizeTypeIdentifier(entry.name)),
    );

export {
    declaredTypeNames,
    namespaceDirectory,
    parseNamespaceHeader,
    createNamespaceShell,
    populateNamespaceBody,
    type GirConstant,
    type GirAlias,
    type GirNamespace,
    type NamespaceHeader,
};
