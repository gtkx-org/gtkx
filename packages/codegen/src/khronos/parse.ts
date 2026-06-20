import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

export type OrderedNode = { [key: string]: unknown };

const ATTRIBUTES_KEY = ":@";
const TEXT_KEY = "#text";

const PARSER = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: false,
    preserveOrder: true,
});

export const parseRegistryFile = (path: string): OrderedNode[] => {
    const xml = readFileSync(path, "utf-8");
    const documentNodes = PARSER.parse(xml) as OrderedNode[];
    for (const node of documentNodes) {
        if (nodeTag(node) === "registry") return nodeChildren(node);
    }
    throw new Error(`No <registry> root element found in ${path}`);
};

export const nodeTag = (node: OrderedNode): string => {
    for (const key of Object.keys(node)) {
        if (key !== ATTRIBUTES_KEY && key !== TEXT_KEY) return key;
    }
    return TEXT_KEY;
};

export const nodeChildren = (node: OrderedNode): OrderedNode[] => {
    const tag = nodeTag(node);
    if (tag === TEXT_KEY) return [];
    const children = node[tag];
    return Array.isArray(children) ? (children as OrderedNode[]) : [];
};

export const nodeAttr = (node: OrderedNode, name: string): string | undefined => {
    const attributes = node[ATTRIBUTES_KEY];
    if (typeof attributes !== "object" || attributes === null) return undefined;
    const value = (attributes as Record<string, unknown>)[`@_${name}`];
    return typeof value === "string" ? value : undefined;
};

export const nodeText = (node: OrderedNode): string | undefined => {
    const value = node[TEXT_KEY];
    return typeof value === "string" ? value : undefined;
};

export const collectText = (node: OrderedNode, skipTags: Set<string>): string => {
    let text = "";
    for (const child of nodeChildren(node)) {
        const childText = nodeText(child);
        if (childText !== undefined) {
            text += childText;
            continue;
        }
        if (!skipTags.has(nodeTag(child))) {
            text += collectText(child, skipTags);
        }
    }
    return text;
};
