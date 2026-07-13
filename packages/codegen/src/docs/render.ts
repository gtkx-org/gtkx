import { sortStringsBy, toPascalCase } from "@gtkx/utils";
import { collectInheritedMethods, conflictRename } from "../analysis/inheritance.js";
import { renderHandlerParameters, renderHandlerResultType } from "../analysis/param-structure.js";
import { renderBaseTypeFor, type TsTypeTarget } from "../analysis/ts-type.js";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirSignal } from "../gir/parameter.js";
import type { TypeId } from "../gir/type-id.js";
import { dedupeCallables, indexMethodsByName, renderInstanceMethodSignature } from "../store/gi/callables.js";
import { methodExportName } from "../store/gi/method.js";
import { ModuleContext } from "../writer/context.js";
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

const renderDocsHandlerResultType = (library: Library, signal: GirSignal): string =>
    renderHandlerResultType({
        library,
        signal,
        renderType: (ref, nullable) => renderDocsType(library, ref, nullable),
        includeCallerAllocated: false,
        optOut: true,
    });

const renderDocsHandlerParameters = (library: Library, signal: GirSignal): string[] =>
    renderHandlerParameters(signal.parameters, (ref, nullable) => renderDocsType(library, ref, nullable));

export const renderDocsSignalSignature = (library: Library, signal: GirSignal, selfType: string): string => {
    const params = [...renderDocsHandlerParameters(library, signal), `self: ${selfType}`];
    return `(${params.join(", ")}) => ${renderDocsHandlerResultType(library, signal)}`;
};

export const renderDocsSignalHandlerType = (library: Library, signal: GirSignal): string =>
    `(${renderDocsHandlerParameters(library, signal).join(", ")}) => ${renderDocsHandlerResultType(library, signal)}`;

const DOCS_DEFAULT_VALUES: Record<string, string> = { TRUE: "true", FALSE: "false", NULL: "null" };

export const docsDefaultValue = (value: string): string => DOCS_DEFAULT_VALUES[value] ?? value;

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

export const joinSections = (sections: string[]): string =>
    `${sections.filter((section) => section.length > 0).join("\n\n")}\n`;

export const metaBlock = (name: string, meta: string, doc: string): string => {
    const lines = [`### \`${name}\``, "", meta];
    if (doc.length > 0) lines.push("", doc);
    return lines.join("\n");
};

export const signatureBlock = (name: string, signature: string, notes: string[]): string => {
    const lines = [`### \`${name}\``, "", `\`\`\`ts\n${signature}\n\`\`\``];
    for (const note of notes) {
        if (note.length > 0) lines.push("", note);
    }
    return lines.join("\n");
};

const DOCS_SIGNATURE_NAMESPACE = "$docs";

export const docsSignatureContext = (namespace: GirNamespace, library: Library): ModuleContext =>
    new ModuleContext({ ...namespace, name: DOCS_SIGNATURE_NAMESPACE }, library);

export type SignatureEntry = {
    name: string;
    signature: string;
    doc: string;
};

export type OriginSignatureEntry = SignatureEntry & { origin: string | undefined };

export const originSignatureBlocks = (entries: OriginSignatureEntry[]): string[] =>
    sortStringsBy(entries, (item) => item.name).map((item) =>
        signatureBlock(item.name, item.signature, [
            item.origin === undefined ? "" : `From \`${item.origin}\`.`,
            item.doc,
        ]),
    );

export const classMethodEntries = (library: Library, namespace: GirNamespace, klass: GirClass): SignatureEntry[] => {
    const realContext = new ModuleContext(namespace, library);
    const signatureContext = docsSignatureContext(namespace, library);
    const className = toPascalCase(klass.name);
    const inherited = collectInheritedMethods(realContext, klass);
    return instanceMethodEntries(signatureContext, klass.methods, (method) =>
        conflictRename(realContext, method, inherited, className),
    );
};

export const methodsSectionBlocks = (entries: SignatureEntry[], intro: string): string[] =>
    entries.length === 0
        ? []
        : ["## Methods", intro, ...entries.map((item) => signatureBlock(item.name, item.signature, [item.doc]))];

export const instanceMethodEntries = (
    signatureContext: ModuleContext,
    methods: GirFunction[],
    rename: (fn: GirFunction) => string | undefined,
): SignatureEntry[] => {
    const deduped = dedupeCallables(methods);
    const siblings = indexMethodsByName(deduped);
    const entries: SignatureEntry[] = [];
    for (const method of deduped) {
        const nameOverride = rename(method);
        const rendered = renderInstanceMethodSignature(
            signatureContext,
            { ...method, doc: undefined },
            siblings,
            nameOverride,
        );
        if (rendered === undefined) continue;
        entries.push({
            name: nameOverride ?? methodExportName(method),
            signature: rendered.trim().replace(/;$/, ""),
            doc: docMarkdown(method.doc),
        });
    }
    return sortStringsBy(entries, (entry) => entry.name);
};
