import { renderHandlerParameters, renderHandlerResultType } from "../analysis/param-structure.js";
import { renderBaseTypeFor, type TsTypeTarget } from "../analysis/ts-type.js";
import type { Library } from "../gir/library.js";
import type { GirSignal } from "../gir/parameter.js";
import type { TypeId } from "../gir/type-id.js";
import { gtkDocToMarkdown } from "../writer/gtk-doc.js";

const docsTarget = (library: Library): TsTypeTarget => ({
    containerStyle: "record",
    callbackType: "((...args: unknown[]) => unknown)",
    byteArrayAsNumber: false,
    renderNamed: (resolved, name) => {
        if (resolved?.kind === "alias") {
            return resolved.value.target === undefined
                ? "number"
                : renderBaseTypeFor(library, docsTarget(library), resolved.value.target);
        }
        return `${name.namespaceName}.${name.typeName}`;
    },
    renderGtype: () => "GObject.Type",
});

export const renderDocsType = (library: Library, ref: TypeId | undefined, isNullable: boolean): string => {
    const base = renderBaseTypeFor(library, docsTarget(library), ref);
    return isNullable ? `${base} | null` : base;
};

export const renderDocsSignalSignature = (library: Library, signal: GirSignal, selfType: string): string => {
    const params = [
        ...renderHandlerParameters(signal.parameters, (ref, nullable) => renderDocsType(library, ref, nullable)),
        `self: ${selfType}`,
    ];
    const result = renderHandlerResultType({
        library,
        signal,
        renderType: (ref, nullable) => renderDocsType(library, ref, nullable),
        includeCallerAllocated: false,
        optOut: true,
    });
    return `(${params.join(", ")}) => ${result}`;
};

const stripDocMedia = (markdown: string): string =>
    markdown
        .replace(/<picture[\s\S]*?<\/picture>/g, "")
        .replace(/<video[\s\S]*?(?:<\/video>|\/>)/g, "")
        .replace(/<img[^>]*>/g, "");

const demoteHeadings = (markdown: string): string => {
    let inFence = false;
    return markdown
        .split("\n")
        .map((line) => {
            if (/^\s*(```|~~~)/.test(line)) {
                inFence = !inFence;
                return line;
            }
            if (inFence) return line;
            return /^#{1,5}\s/.test(line) ? `#${line}` : line;
        })
        .join("\n");
};

export const docMarkdown = (doc: string | undefined): string =>
    doc === undefined || doc.length === 0 ? "" : demoteHeadings(stripDocMedia(gtkDocToMarkdown(doc))).trim();

const stripMarkdown = (markdown: string): string =>
    markdown
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*_#>]/g, "")
        .replace(/\s+/g, " ")
        .trim();

export const firstSentence = (doc: string | undefined): string => {
    const text = stripMarkdown(docMarkdown(doc));
    if (text.length === 0) return "";
    const match = text.match(/^.*?[.!?](?=\s|$)/);
    const sentence = match?.[0] ?? text;
    return sentence.length > 220 ? `${sentence.slice(0, 217)}...` : sentence;
};

export const elementSlug = (className: string): string =>
    className
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
