import type { Nodes, PhrasingContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";

type Note = {
    name: string;
    text: string;
    modified: number;
    excerpt: string;
};

const plainText = (nodes: PhrasingContent[]): string =>
    nodes
        .map((node) => {
            switch (node.type) {
                case "text":
                case "inlineCode":
                case "html":
                    return node.value;
                case "image":
                case "imageReference":
                    return node.alt ?? "";
                case "break":
                    return " ";
                case "footnoteReference":
                    return "";
                default:
                    return plainText(node.children);
            }
        })
        .join("");

const firstParagraph = (node: Nodes): string | null => {
    if (node.type === "paragraph") {
        return plainText(node.children);
    }
    if (!("children" in node) || node.type === "heading") {
        return null;
    }
    for (const child of node.children) {
        const text = firstParagraph(child);
        if (text !== null) {
            return text;
        }
    }

    return null;
};

const toNote = (name: string, text: string, modified: number): Note => ({
    name,
    text,
    modified,
    excerpt: firstParagraph(fromMarkdown(text)) ?? "",
});

export { type Note, toNote };
