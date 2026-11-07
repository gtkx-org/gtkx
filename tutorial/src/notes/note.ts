import type { Nodes, PhrasingContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { parse } from "yaml";

type Note = {
    name: string;
    text: string;
    modified: number;
    body: string;
    tags: string[];
    excerpt: string;
};

const FRONT_MATTER = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

const parseYaml = (source: string): unknown => {
    try {
        return parse(source);
    } catch {
        return null;
    }
};

const toTags = (value: unknown): string[] => {
    const values: unknown[] = Array.isArray(value) ? value : [value];
    const tags = values
        .filter((tag) => typeof tag === "string")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter((tag) => tag !== "");

    return [...new Set(tags)];
};

const splitFrontMatter = (text: string): { tags: string[]; body: string } => {
    const match = FRONT_MATTER.exec(text);
    if (match === null) {
        return { tags: [], body: text };
    }
    const data = parseYaml(match[1] ?? "");
    const tags = typeof data === "object" && data !== null && "tags" in data ? toTags(data.tags) : [];

    return { tags, body: text.slice(match[0].length) };
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

const toNote = (name: string, text: string, modified: number): Note => {
    const { tags, body } = splitFrontMatter(text);

    return { name, text, modified, body, tags, excerpt: firstParagraph(fromMarkdown(body)) ?? "" };
};

export { type Note, toNote };
