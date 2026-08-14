import { createXmlParser, parseXmlFile } from "../xml.js";

/** An element of the parsed GIR XML: attributes under `@_`-prefixed keys, children under their tag names. */
type RawNode = Record<string, unknown>;

const GIR_LABEL = "GIR file";

const GIR_MALFORMED_REMEDY =
    "No XML parser can read this file, so report it to whoever ships it. To get past it now, name the " +
    "libraries you need explicitly in `libraries` and leave this one out, or put a corrected copy of the " +
    "file in a directory listed in `girPath`, which is searched ahead of the system location.";

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
    "virtual-method",
    "constructor",
    "property",
    "field",
    "glib:signal",
    "implements",
    "prerequisite",
    "member",
    "parameter",
]);

const GIR_CONSTRUCTOR_TAG = "gir-constructor";
const RESERVED_TAG_RENAMES: Map<string, string> = new Map([["constructor", GIR_CONSTRUCTOR_TAG]]);
const RENAMED_MULTI_TAGS: Set<string> = new Set([...MULTI_TAGS].map((tag) => renameReservedTag(tag)));

const PARSER = createXmlParser({
    trimValues: true,
    transformTagName: renameReservedTag,
    isArray: (name) => RENAMED_MULTI_TAGS.has(name),
});

function renameReservedTag(tag: string): string {
    return RESERVED_TAG_RENAMES.get(tag) ?? tag;
}

const parseGirFile = (path: string): RawNode =>
    parseXmlFile({ parser: PARSER, label: GIR_LABEL, path, malformedRemedy: GIR_MALFORMED_REMEDY }) as RawNode;

const attr = (node: RawNode | undefined, name: string): string | undefined => {
    if (node === undefined) {
        return undefined;
    }

    const value = node[`@_${name}`];

    return typeof value === "string" ? value : undefined;
};

const isAttrTrue = (node: RawNode | undefined, name: string, isTrueByDefault = false): boolean => {
    const value = attr(node, name);

    if (value === undefined) {
        return isTrueByDefault;
    }

    return value === "1";
};

const nameAttr = (node: RawNode): string => attr(node, "name") ?? "";

const intAttr = (node: RawNode, name: string): number | undefined => {
    const raw = attr(node, name);

    return raw === undefined ? undefined : Number(raw);
};

const enumMember = <T extends string>(raw: string, members: Set<T>, label: string): T => {
    for (const member of members) {
        if (member === raw) {
            return member;
        }
    }

    throw new Error(`Unknown ${label} value "${raw}"`);
};

const parseEnumAttr = <T extends string, F extends T | undefined>(
    raw: string | undefined,
    members: Set<T>,
    fallback: F,
    label: string,
): T | F => (raw === undefined ? fallback : enumMember(raw, members, label));

const getChildren = (node: RawNode | undefined, tag: string): RawNode[] => {
    if (node === undefined) {
        return [];
    }

    const value = node[tag];

    if (value === undefined) {
        return [];
    }

    if (Array.isArray(value)) {
        return value as RawNode[];
    }

    return [value as RawNode];
};

const getChild = (node: RawNode | undefined, tag: string): RawNode | undefined => {
    if (node === undefined) {
        return undefined;
    }

    const value = node[tag];

    if (value === undefined) {
        return undefined;
    }

    if (Array.isArray(value)) {
        return value.length === 0 ? undefined : (value[0] as RawNode);
    }

    return value as RawNode;
};

const normalizeDoc = (text: string): string | undefined => {
    const trimmed = text.trim();

    return trimmed.length === 0 ? undefined : trimmed;
};

const firstDocValue = (raw: unknown): unknown => (Array.isArray(raw) ? raw[0] : raw);

const docTextFromObject = (value: object): string | undefined => {
    const text = (value as RawNode)["#text"];

    return typeof text === "string" ? normalizeDoc(text) : undefined;
};

const docElementText = (node: RawNode | undefined, tag: string): string | undefined => {
    if (node === undefined) {
        return undefined;
    }

    const value = firstDocValue(node[tag]);

    if (typeof value === "string") {
        return normalizeDoc(value);
    }

    if (value === null || typeof value !== "object") {
        return undefined;
    }

    return docTextFromObject(value);
};

const getDoc = (node: RawNode | undefined): string | undefined => docElementText(node, "doc");
const getDocDeprecated = (node: RawNode | undefined): string | undefined => docElementText(node, "doc-deprecated");

export {
    GIR_CONSTRUCTOR_TAG,
    parseGirFile,
    attr,
    isAttrTrue,
    nameAttr,
    intAttr,
    parseEnumAttr,
    getChildren,
    getChild,
    getDoc,
    getDocDeprecated,
    type RawNode,
};
