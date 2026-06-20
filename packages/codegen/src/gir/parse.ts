import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

export type RawNode = {
    [attributeOrChild: string]: unknown;
};

const MULTI_TAGS: Set<string> = new Set([
    "include",
    "class",
    "interface",
    "record",
    "enumeration",
    "bitfield",
    "callback",
    "function",
    "constant",
    "alias",
    "union",
    "method",
    "constructor",
    "property",
    "field",
    "glib:signal",
    "implements",
    "prerequisite",
    "member",
    "parameter",
]);

export const GIR_CONSTRUCTOR_TAG = "gir-constructor";

const RESERVED_TAG_RENAMES: Map<string, string> = new Map([["constructor", GIR_CONSTRUCTOR_TAG]]);

const renameReservedTag = (tag: string): string => RESERVED_TAG_RENAMES.get(tag) ?? tag;

const RENAMED_MULTI_TAGS: Set<string> = new Set([...MULTI_TAGS].map(renameReservedTag));

const PARSER = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    transformTagName: renameReservedTag,
    isArray: (name) => RENAMED_MULTI_TAGS.has(name),
});

export const parseGirFile = (path: string): RawNode => {
    const xml = readFileSync(path, "utf-8");
    return PARSER.parse(xml) as RawNode;
};

export const attr = (node: RawNode | undefined, name: string): string | undefined => {
    if (node === undefined) return undefined;
    const value = node[`@_${name}`];
    return typeof value === "string" ? value : undefined;
};

export const attrBool = (node: RawNode | undefined, name: string, fallback = false): boolean => {
    const value = attr(node, name);
    if (value === undefined) return fallback;
    return value === "1";
};

export const nameAttr = (node: RawNode): string => attr(node, "name") ?? "";

export const intAttr = (node: RawNode, name: string): number | undefined => {
    const raw = attr(node, name);
    return raw === undefined ? undefined : Number.parseInt(raw, 10);
};

export const parseEnumAttr = <T extends string, F extends T | undefined>(
    raw: string | undefined,
    members: Set<T>,
    fallback: F,
    label: string,
): T | F => {
    if (raw === undefined) return fallback;
    for (const member of members) {
        if (member === raw) return member;
    }
    throw new Error(`Unknown ${label} value "${raw}"`);
};

export const childrenOf = (node: RawNode | undefined, tag: string): RawNode[] => {
    if (node === undefined) return [];
    const value = node[tag];
    if (value === undefined) return [];
    if (Array.isArray(value)) return value as RawNode[];
    return [value as RawNode];
};

export const childOf = (node: RawNode | undefined, tag: string): RawNode | undefined => {
    if (node === undefined) return undefined;
    const value = node[tag];
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
        return value.length === 0 ? undefined : (value[0] as RawNode);
    }
    return value as RawNode;
};
