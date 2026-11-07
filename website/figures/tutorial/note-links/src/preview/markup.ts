import * as GLib from "@gtkx/gi/glib";
import type { PhrasingContent } from "mdast";

const escape = (text: string): string => GLib.markupEscapeText(text, -1);

const toMarkup = (nodes: PhrasingContent[]): string =>
    nodes.map(nodeMarkup).join("");

const nodeMarkup = (node: PhrasingContent): string => {
    switch (node.type) {
        case "text":
        case "html":
            return escape(node.value);
        case "inlineCode":
            return `<tt>${escape(node.value)}</tt>`;
        case "emphasis":
            return `<i>${toMarkup(node.children)}</i>`;
        case "strong":
            return `<b>${toMarkup(node.children)}</b>`;
        case "delete":
            return `<s>${toMarkup(node.children)}</s>`;
        case "link":
            return `<a href="${escape(node.url)}">${toMarkup(node.children)}</a>`;
        case "linkReference":
            return toMarkup(node.children);
        case "image":
        case "imageReference":
            return escape(node.alt ?? "");
        case "break":
            return "\n";
        case "footnoteReference":
            return `<sup>${escape(node.label ?? node.identifier)}</sup>`;
    }
};

export { toMarkup };
