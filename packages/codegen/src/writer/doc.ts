import { gtkDocToMarkdown } from "./gtk-doc.js";

const escapeCommentTerminators = (doc: string): string => doc.replaceAll("*/", "*\\/");

export const renderJsDoc = (doc: string | undefined): string => {
    if (doc === undefined || doc.length === 0) return "";
    const lines = escapeCommentTerminators(gtkDocToMarkdown(doc)).split("\n");
    if (lines.length === 1) return `/** ${lines[0]} */\n`;
    const body = lines.map((line) => (line.length === 0 ? " *" : ` * ${line}`)).join("\n");
    return `/**\n${body}\n */\n`;
};
