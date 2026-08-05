import { type JsDocSpec, renderDocTagLines, stripDocMedia } from "./doc-tags.js";
import { gtkDocToMarkdown } from "./gtk-doc.js";

const escapeCommentTerminators = (doc: string): string => doc.replaceAll("*/", String.raw`*\/`);

const convertDoc = (doc: string, identifiers: Map<string, string> | undefined): string =>
    escapeCommentTerminators(stripDocMedia(gtkDocToMarkdown(doc, identifiers)));

const renderJsDocLines = (lines: string[], isCollapsible: boolean): string => {
    const [single, ...rest] = lines;

    if (isCollapsible && single !== undefined && rest.length === 0) {
        return `/** ${single} */\n`;
    }

    const body = lines.map((line) => (line.length === 0 ? " *" : ` * ${line}`)).join("\n");

    return `/**\n${body}\n */\n`;
};

const docLines = (doc: string | undefined, identifiers: Map<string, string> | undefined): string[] =>
    doc === undefined || doc.length === 0 ? [] : convertDoc(doc, identifiers).split("\n");

const appendNote = (lines: string[], note: string): string[] =>
    lines.length === 0 ? note.split("\n") : [...lines, "", ...note.split("\n")];

const appendTags = (lines: string[], tagLines: string[]): string[] => {
    if (lines.length === 0 || tagLines.length === 0) {
        return [...lines, ...tagLines];
    }

    return [...lines, "", ...tagLines];
};

const specLines = (spec: JsDocSpec | undefined): string[] =>
    spec === undefined ? [] : renderDocTagLines(spec, (text) => convertDoc(text, spec.identifiers));

const renderJsDoc = (doc: string | undefined, note?: string, spec?: JsDocSpec): string => {
    const described = docLines(doc, spec?.identifiers);
    const withNote = note === undefined ? described : appendNote(described, note);
    const tagLines = specLines(spec);
    const lines = appendTags(withNote, tagLines);

    return lines.length === 0 ? "" : renderJsDocLines(lines, tagLines.length === 0);
};

export { type JsDocSpec } from "./doc-tags.js";
export { renderJsDoc };
