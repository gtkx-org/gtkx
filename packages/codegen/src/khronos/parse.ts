import { readFileSync } from "node:fs";
import { createXmlParser } from "../xml.js";

type OrderedNode = Record<string, unknown>;

const ATTRIBUTES_KEY = ":@";
const TEXT_KEY = "#text";

const PARSER = createXmlParser({
    trimValues: false,
    preserveOrder: true,
});

const parseRegistryFile = (path: string): OrderedNode[] => {
    const xml = readFileSync(path, "utf8");
    const documentNodes = PARSER.parse(xml) as OrderedNode[];

    for (const node of documentNodes) {
        if (nodeTag(node) === "registry") {
            return nodeChildren(node);
        }
    }

    throw new Error(`No <registry> root element found in ${path}`);
};

const nodeTag = (node: OrderedNode): string => {
    for (const key of Object.keys(node)) {
        if (key !== ATTRIBUTES_KEY && key !== TEXT_KEY) {
            return key;
        }
    }

    return TEXT_KEY;
};

const nodeChildren = (node: OrderedNode): OrderedNode[] => {
    const tag = nodeTag(node);

    if (tag === TEXT_KEY) {
        return [];
    }

    const children = node[tag];

    return Array.isArray(children) ? (children as OrderedNode[]) : [];
};

const nodeAttr = (node: OrderedNode, name: string): string | undefined => {
    const attributes = node[ATTRIBUTES_KEY];

    if (typeof attributes !== "object" || attributes === null) {
        return undefined;
    }

    const value = (attributes as Record<string, unknown>)[`@_${name}`];

    return typeof value === "string" ? value : undefined;
};

const nodeText = (node: OrderedNode): string | undefined => {
    const value = node[TEXT_KEY];

    return typeof value === "string" ? value : undefined;
};

const collectText = (node: OrderedNode, skipTags: Set<string>): string => {
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

export { parseRegistryFile, nodeTag, nodeChildren, nodeAttr, collectText, type OrderedNode };
