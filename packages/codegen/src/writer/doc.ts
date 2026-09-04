import { type DocConverters, type JsDocSpec, renderDocTagLines, stripDocMedia } from "./doc-tags.js";
import { gtkDocToMarkdown } from "./gtk-doc.js";
import { stripManualMemoryManagement, stripStandaloneMemoryManagement } from "./memory-management.js";

type DocSanitizer = (markdown: string) => string;

const escapeCommentTerminators = (doc: string): string => doc.replaceAll("*/", String.raw`*\/`);

const convertDoc = (doc: string, identifiers: Map<string, string> | undefined, sanitize: DocSanitizer): string => {
    const markdown = stripDocMedia(gtkDocToMarkdown(doc, identifiers));

    return escapeCommentTerminators(sanitize(markdown));
};

const docConverters = (identifiers: Map<string, string> | undefined): DocConverters => ({
    description: (text) => convertDoc(text, identifiers, stripStandaloneMemoryManagement),
    value: (text) => convertDoc(text, identifiers, stripManualMemoryManagement),
});

const renderJsDocLines = (lines: string[], isCollapsible: boolean): string => {
    const [single, ...rest] = lines;

    if (isCollapsible && single !== undefined && rest.length === 0) {
        return `/** ${single} */\n`;
    }

    const body = lines.map((line) => (line.length === 0 ? " *" : ` * ${line}`)).join("\n");

    return `/**\n${body}\n */\n`;
};

const docLines = (doc: string | undefined, identifiers: Map<string, string> | undefined): string[] => {
    if (doc === undefined || doc.length === 0) {
        return [];
    }

    const converted = docConverters(identifiers).description(doc);

    return converted.length === 0 ? [] : converted.split("\n");
};

const appendNote = (lines: string[], note: string): string[] =>
    lines.length === 0 ? note.split("\n") : [...lines, "", ...note.split("\n")];

const appendTags = (lines: string[], tagLines: string[]): string[] => {
    if (lines.length === 0 || tagLines.length === 0) {
        return [...lines, ...tagLines];
    }

    return [...lines, "", ...tagLines];
};

const specLines = (spec: JsDocSpec | undefined): string[] =>
    spec === undefined ? [] : renderDocTagLines(spec, docConverters(spec.identifiers));

const renderJsDoc = (doc: string | undefined, note?: string, spec?: JsDocSpec): string => {
    const described = docLines(doc, spec?.identifiers);
    const withNote = note === undefined ? described : appendNote(described, note);
    const tagLines = specLines(spec);
    const lines = appendTags(withNote, tagLines);

    return lines.length === 0 ? "" : renderJsDocLines(lines, tagLines.length === 0);
};

export { type JsDocSpec } from "./doc-tags.js";
export { renderJsDoc };
