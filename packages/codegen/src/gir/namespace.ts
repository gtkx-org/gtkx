import { callbackFromNode, type GirCallback } from "./callback.js";
import { classFromNode, type GirClass } from "./class.js";
import { enumFromNode, type GirEnum } from "./enum.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, childOf, childrenOf, docOf, nameAttr, type RawNode } from "./parse.js";
import { type GirRecord, isVtableRecord, recordFromNode } from "./record.js";
import type { ParseContext, TypeId } from "./type-id.js";
import { typeRefFromNode } from "./type-ref.js";

export type GirConstant = {
    name: string;
    doc: string | undefined;
    value: string;
    type: TypeId | undefined;
};

export type GirAlias = {
    name: string;
    doc: string | undefined;
    cType: string | undefined;
    target: TypeId | undefined;
    targetCType: string | undefined;
};

export type GirNamespace = {
    id: number;
    name: string;
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

export const namespaceDirectory = (namespace: Pick<GirNamespace, "name">): string => namespace.name.toLowerCase();

type NamespaceInclude = {
    name: string;
    version: string;
};

export type NamespaceHeader = {
    name: string;
    sharedLibrary: string | undefined;
    cSymbolPrefixes: string[];
    includes: NamespaceInclude[];
    namespaceNode: RawNode;
};

export const parseNamespaceHeader = (repositoryNode: RawNode): NamespaceHeader => {
    const includes = childrenOf(repositoryNode, "include").map<NamespaceInclude>((include) => ({
        name: nameAttr(include),
        version: attr(include, "version") ?? "",
    }));
    const namespaceNode = childrenOf(repositoryNode, "namespace")[0];
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

export const createNamespaceShell = (header: NamespaceHeader, id: number): GirNamespace => ({
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

export const populateNamespaceBody = (shell: GirNamespace, namespaceNode: RawNode, context: ParseContext): void => {
    shell.classes = childrenOf(namespaceNode, "class").map((klass) => classFromNode(klass, false, context));
    shell.interfaces = childrenOf(namespaceNode, "interface").map((iface) => classFromNode(iface, true, context));
    shell.records = collectRecords(namespaceNode, context);
    shell.enums = collectEnums(namespaceNode);
    shell.callbacks = childrenOf(namespaceNode, "callback").map((callback) => callbackFromNode(callback, context));
    shell.functions = childrenOf(namespaceNode, "function").map((fn) => functionFromNode(fn, context));
    shell.constants = childrenOf(namespaceNode, "constant").map((constant) => ({
        name: nameAttr(constant),
        doc: docOf(constant),
        value: attr(constant, "value") ?? "",
        type: typeRefFromNode(constant, context),
    }));
    shell.aliases = childrenOf(namespaceNode, "alias").map((alias) => ({
        name: nameAttr(alias),
        doc: docOf(alias),
        cType: attr(alias, "c:type"),
        target: typeRefFromNode(alias, context),
        targetCType: attr(childOf(alias, "type"), "c:type"),
    }));
};

const splitPrefixes = (raw: string | undefined): string[] =>
    (raw ?? "").split(",").filter((prefix) => prefix.length > 0);

const collectRecords = (namespaceNode: RawNode, context: ParseContext): GirRecord[] => [
    ...childrenOf(namespaceNode, "record").map((record) =>
        recordFromNode(record, isVtableRecord(record), false, context),
    ),
    ...childrenOf(namespaceNode, "union").map((union) => recordFromNode(union, isVtableRecord(union), true, context)),
];

const collectEnums = (namespaceNode: RawNode): GirEnum[] => [
    ...childrenOf(namespaceNode, "enumeration").map((enumeration) => enumFromNode(enumeration, "enumeration")),
    ...childrenOf(namespaceNode, "bitfield").map((bitfield) => enumFromNode(bitfield, "bitfield")),
];
