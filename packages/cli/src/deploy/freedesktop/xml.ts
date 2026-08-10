type XmlNode = {
    tag: string;
    attributes?: Record<string, string>;
    children?: XmlNode[];
    text?: string;
};

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const INDENT = " ".repeat(4);

const ESCAPES: Record<string, string> = {
    '"': "&quot;",
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
};

const escapeXml = (value: string): string =>
    value.replaceAll(/["&<>]/g, (character) => ESCAPES[character] ?? character);

const renderAttributes = (attributes: Record<string, string> | undefined): string =>
    Object.entries(attributes ?? {})
        .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
        .join("");

const element = (tag: string, attributes: Record<string, string>, children: XmlNode[]): XmlNode => ({
    tag,
    attributes,
    children,
});

const text = (tag: string, value: string): XmlNode => ({ tag, text: value });

const renderNode = (node: XmlNode, depth: number): string[] => {
    const padding = INDENT.repeat(depth);
    const open = `${padding}<${node.tag}${renderAttributes(node.attributes)}`;

    if (node.text !== undefined) {
        return [`${open}>${escapeXml(node.text)}</${node.tag}>`];
    }

    const children = node.children ?? [];

    if (children.length === 0) {
        return [`${open}/>`];
    }

    return [`${open}>`, ...children.flatMap((child) => renderNode(child, depth + 1)), `${padding}</${node.tag}>`];
};

const renderDocument = (root: XmlNode): string => [XML_DECLARATION, ...renderNode(root, 0), ""].join("\n");

export { element, renderDocument, text, type XmlNode };
