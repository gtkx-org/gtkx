import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

/**
 * One node of the order-preserving Khronos registry parse.
 *
 * `fast-xml-parser`'s `preserveOrder` mode represents every element as an
 * object with a single tag-named key holding the ordered child list, an
 * optional `":@"` key holding the attributes, and text as `{"#text": value}`
 * nodes. Mixed-content elements (`<proto>`, `<param>`) need this mode because
 * their C type is split across text fragments around `<ptype>` and `<name>`
 * children, and the default mode discards the ordering.
 */
export type OrderedNode = { readonly [key: string]: unknown };

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

/**
 * Parses a Khronos XML registry file (e.g. the vendored `gl.xml`) and returns
 * the ordered child list of its `<registry>` root element.
 *
 * @param path - Absolute path to the registry XML file
 */
export const parseRegistryFile = (path: string): readonly OrderedNode[] => {
    const xml = readFileSync(path, "utf-8");
    const documentNodes = PARSER.parse(xml) as readonly OrderedNode[];
    for (const node of documentNodes) {
        if (nodeTag(node) === "registry") return nodeChildren(node);
    }
    throw new Error(`No <registry> root element found in ${path}`);
};

/**
 * Returns the element tag of an ordered node: the single key that is neither
 * the attribute bag nor a text payload.
 *
 * @param node - The ordered node
 */
export const nodeTag = (node: OrderedNode): string => {
    for (const key of Object.keys(node)) {
        if (key !== ATTRIBUTES_KEY && key !== TEXT_KEY) return key;
    }
    return TEXT_KEY;
};

/**
 * Returns the ordered child list of an ordered element node, or an empty list
 * for text nodes.
 *
 * @param node - The ordered node
 */
export const nodeChildren = (node: OrderedNode): readonly OrderedNode[] => {
    const tag = nodeTag(node);
    if (tag === TEXT_KEY) return [];
    const children = node[tag];
    return Array.isArray(children) ? (children as readonly OrderedNode[]) : [];
};

/**
 * Reads an attribute from an ordered node, or `undefined` when absent.
 *
 * @param node - The ordered node
 * @param name - The attribute name (without the parser's `@_` prefix)
 */
export const nodeAttr = (node: OrderedNode, name: string): string | undefined => {
    const attributes = node[ATTRIBUTES_KEY];
    if (typeof attributes !== "object" || attributes === null) return undefined;
    const value = (attributes as Record<string, unknown>)[`@_${name}`];
    return typeof value === "string" ? value : undefined;
};

/**
 * Returns the text payload of a `#text` node, or `undefined` for elements.
 *
 * @param node - The ordered node
 */
export const nodeText = (node: OrderedNode): string | undefined => {
    const value = node[TEXT_KEY];
    return typeof value === "string" ? value : undefined;
};

/**
 * Concatenates the text content of a node's children, recursing into nested
 * elements, while skipping children whose tag is in `skipTags`. Used to
 * reconstruct the C type of a mixed-content `<proto>`/`<param>` element by
 * collecting everything around the `<name>` child.
 *
 * @param node - The ordered element node
 * @param skipTags - Child element tags whose content is excluded
 */
export const collectText = (node: OrderedNode, skipTags: ReadonlySet<string>): string => {
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
