import XMLBuilder from "fast-xml-builder";

type XmlNode = {
    tag: string;
    attributes?: Record<string, string>;
    children?: XmlNode[];
    text?: string;
};

type OrderedNode = Record<string, unknown>;

const XML_ENCODING = ["UTF", "8"].join("-");

const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    indentBy: " ".repeat(4),
    preserveOrder: true,
    suppressEmptyNode: true,
});

const orderedNode = (node: XmlNode): OrderedNode => ({
    [node.tag]: node.text === undefined
        ? (node.children ?? []).map((child) => orderedNode(child))
        : [{ "#text": node.text }],
    ...(node.attributes && {
        ":@": Object.fromEntries(Object.entries(node.attributes).map(([key, value]) => [`@_${key}`, value])),
    }),
});

const element = (tag: string, attributes: Record<string, string>, children: XmlNode[]): XmlNode => ({
    tag,
    attributes,
    children,
});

const text = (tag: string, value: string): XmlNode => ({ tag, text: value });

const renderDocument = (root: XmlNode): string =>
    `${builder.build([
        { "?xml": [{ "#text": "" }], ":@": { "@_version": "1.0", "@_encoding": XML_ENCODING } },
        orderedNode(root),
    ])}\n`;

export { element, renderDocument, text, type XmlNode };
