import { gtkDocToMarkdown } from "./gtk-doc.js";

const escapeCommentTerminators = (doc: string): string => doc.replaceAll("*/", String.raw`*\/`);

const renderJsDocLines = (lines: string[]): string => {
    const [single, ...rest] = lines;

    if (single !== undefined && rest.length === 0) {
        return `/** ${single} */\n`;
    }

    const body = lines.map((line) => (line.length === 0 ? " *" : ` * ${line}`)).join("\n");

    return `/**\n${body}\n */\n`;
};

const renderJsDoc = (doc: string | undefined): string => {
    if (doc === undefined || doc.length === 0) {
        return "";
    }

    return renderJsDocLines(escapeCommentTerminators(gtkDocToMarkdown(doc)).split("\n"));
};

export { renderJsDoc };
