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

const docLines = (doc: string | undefined): string[] =>
    doc === undefined || doc.length === 0 ? [] : escapeCommentTerminators(gtkDocToMarkdown(doc)).split("\n");

const appendNote = (lines: string[], note: string): string[] =>
    lines.length === 0 ? note.split("\n") : [...lines, "", ...note.split("\n")];

const renderJsDoc = (doc: string | undefined, note?: string): string => {
    const lines = note === undefined ? docLines(doc) : appendNote(docLines(doc), note);

    return lines.length === 0 ? "" : renderJsDocLines(lines);
};

export { renderJsDoc };
