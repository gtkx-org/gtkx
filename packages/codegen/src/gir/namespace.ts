import { boxedFromNode, type GirBoxed, isVtableRecord } from "./boxed.js";
import { callbackFromNode, type GirCallback } from "./callback.js";
import { classFromNode, type GirClass } from "./class.js";
import { enumFromNode, type GirEnum } from "./enum.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, childOf, childrenOf, nameAttr, type RawNode } from "./parse.js";
import type { ParseContext, TypeId } from "./type-id.js";
import { typeRefFromSlot } from "./type-ref.js";

export type GirConstant = {
    name: string;
    value: string;
    type: TypeId | undefined;
};

export type GirAlias = {
    name: string;
    target: TypeId | undefined;
    targetCType: string | undefined;
};

export type GirNamespace = {
    id: number;
    name: string;
    sharedLibrary: string | undefined;
    cSymbolPrefixes: string[];
    includes: NamespaceInclude[];
    classes: GirClass[];
    interfaces: GirClass[];
    boxeds: GirBoxed[];
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

type MutableNamespace = {
    [Key in keyof GirNamespace]: GirNamespace[Key];
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
    includes: header.includes,
    classes: [],
    interfaces: [],
    boxeds: [],
    enums: [],
    callbacks: [],
    functions: [],
    constants: [],
    aliases: [],
});

export const populateNamespaceBody = (shell: GirNamespace, namespaceNode: RawNode, context: ParseContext): void => {
    const mutable: MutableNamespace = shell;
    mutable.classes = childrenOf(namespaceNode, "class").map((klass) => classFromNode(klass, false, context));
    mutable.interfaces = childrenOf(namespaceNode, "interface").map((iface) => classFromNode(iface, true, context));
    mutable.boxeds = collectBoxeds(namespaceNode, context);
    mutable.enums = collectEnums(namespaceNode, context);
    mutable.callbacks = childrenOf(namespaceNode, "callback").map((callback) => callbackFromNode(callback, context));
    mutable.functions = childrenOf(namespaceNode, "function").map((fn) => functionFromNode(fn, "function", context));
    mutable.constants = childrenOf(namespaceNode, "constant").map((constant) => ({
        name: nameAttr(constant),
        value: attr(constant, "value") ?? "",
        type: typeRefFromSlot(constant, context),
    }));
    mutable.aliases = childrenOf(namespaceNode, "alias").map((alias) => ({
        name: nameAttr(alias),
        target: typeRefFromSlot(alias, context),
        targetCType: attr(childOf(alias, "type"), "c:type"),
    }));
};

const splitPrefixes = (raw: string | undefined): string[] =>
    (raw ?? "").split(",").filter((prefix) => prefix.length > 0);

const collectBoxeds = (namespaceNode: RawNode, context: ParseContext): GirBoxed[] => [
    ...childrenOf(namespaceNode, "record").map((record) =>
        boxedFromNode(record, isVtableRecord(record), false, context),
    ),
    ...childrenOf(namespaceNode, "union").map((union) => boxedFromNode(union, isVtableRecord(union), true, context)),
];

const collectEnums = (namespaceNode: RawNode, context: ParseContext): GirEnum[] => [
    ...childrenOf(namespaceNode, "enumeration").map((enumeration) => enumFromNode(enumeration, "enumeration", context)),
    ...childrenOf(namespaceNode, "bitfield").map((bitfield) => enumFromNode(bitfield, "bitfield", context)),
];
