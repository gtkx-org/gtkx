import { pascalCase, sortStringsBy } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirCallable } from "../gir/parameter.js";
import type { TypeId } from "../gir/type-id.js";
import { collectInheritedMethods, conflictRename } from "../analysis/inheritance.js";
import { renderHandlerParameters, renderHandlerResultType } from "../analysis/param-structure.js";
import { recordTypeTarget, renderBaseType, type TsTypeTarget } from "../analysis/ts-type.js";
import { dedupeCallables, instanceScope, renderInstanceMethodSignature } from "../store/gi/callables.js";
import { methodExportName } from "../store/gi/method.js";
import { ModuleContext } from "../writer/context.js";
import { gtkDocToMarkdown } from "../writer/gtk-doc.js";

type SignatureEntry = {
    name: string;
    signature: string;
    doc: string;
};

type OriginSignatureEntry = SignatureEntry & { origin: string | undefined };

const DOCS_DEFAULT_VALUES: Record<string, string> = { TRUE: "true", FALSE: "false", NULL: "null" };
const FENCE_LINE = /^\s*(```|~~~)/;
const HEADING_LINE = /^#{1,5}\s/;
const LEADING_NAMESPACES = ["Gtk", "Adw"];
const DOCS_SIGNATURE_NAMESPACE = "$docs";

const docsTarget = (library: Library): TsTypeTarget =>
    recordTypeTarget(
        library,
        (name) => `${name.namespaceName}.${name.typeName}`,
        () => "GObject.Type",
    );

const renderDocsType = (library: Library, ref: TypeId | undefined, isNullable: boolean): string => {
    const base = renderBaseType(library, docsTarget(library), ref);

    return isNullable ? `${base} | null` : base;
};

const renderDocsHandlerResultType = (library: Library, signal: GirCallable): string =>
    renderHandlerResultType({
        library,
        signal,
        renderType: (ref, nullable) => renderDocsType(library, ref, nullable),
        includeCallerAllocated: false,
        optOut: true,
    });

const renderDocsHandlerParameters = (library: Library, signal: GirCallable): string[] =>
    renderHandlerParameters(signal.parameters, (ref, nullable) => renderDocsType(library, ref, nullable));

const renderDocsSignalSignature = (library: Library, signal: GirCallable, selfType: string): string => {
    const params = [...renderDocsHandlerParameters(library, signal), `self: ${selfType}`];

    return `(${params.join(", ")}) => ${renderDocsHandlerResultType(library, signal)}`;
};

const renderDocsSignalHandlerType = (library: Library, signal: GirCallable): string =>
    `(${renderDocsHandlerParameters(library, signal).join(", ")}) => ${renderDocsHandlerResultType(library, signal)}`;

const docsDefaultValue = (value: string): string => DOCS_DEFAULT_VALUES[value] ?? value;

const stripDocMedia = (markdown: string): string =>
    markdown
        .replaceAll(/<picture[\s\S]*?<\/picture>/g, "")
        .replaceAll(/<video[\s\S]*?(?:<\/video>|\/>)/g, "")
        .replaceAll(/<img[^>]*>/g, "");

const demoteLine = (line: string, isInFence: boolean): { text: string; inFence: boolean } => {
    if (FENCE_LINE.test(line)) {
        return { text: line, inFence: !isInFence };
    }

    if (isInFence) {
        return { text: line, inFence: isInFence };
    }

    return { text: HEADING_LINE.test(line) ? `#${line}` : line, inFence: isInFence };
};

const demoteHeadings = (markdown: string): string => {
    let isInFence = false;
    const lines: string[] = [];

    for (const line of markdown.split("\n")) {
        const result = demoteLine(line, isInFence);
        isInFence = result.inFence;
        lines.push(result.text);
    }

    return lines.join("\n");
};

const docMarkdown = (doc: string | undefined): string =>
    doc === undefined || doc.length === 0 ? "" : demoteHeadings(stripDocMedia(gtkDocToMarkdown(doc))).trim();

const stripMarkdown = (markdown: string): string =>
    markdown
        .replaceAll(/```[\s\S]*?```/g, " ")
        .replaceAll(/`([^`]*)`/g, "$1")
        .replaceAll(/\[([^[\]]*)\]\([^)]*\)/g, "$1")
        .replaceAll(/[*_#>]/g, "")
        .replaceAll(/\s+/g, " ")
        .trim();

const firstSentence = (doc: string | undefined): string => {
    const text = stripMarkdown(docMarkdown(doc));

    if (text.length === 0) {
        return "";
    }

    const match = /^.*?[.!?](?=\s|$)/.exec(text);
    const sentence = match?.[0] ?? text;

    return sentence.length > 220 ? `${sentence.slice(0, 217)}...` : sentence;
};

const elementSlug = (className: string): string =>
    className
        .replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replaceAll(/([A-Z])(?=[A-Z][a-z])/g, "$1-")
        .toLowerCase();

const implementsLine = (names: string[]): string[] => {
    if (names.length === 0) {
        return [];
    }

    const quotedNames = names.map((name) => `\`${name}\``).join(", ");

    return [`Implements ${quotedNames}.`];
};

const joinSections = (sections: string[]): string =>
    `${sections.filter((section) => section.length > 0).join("\n\n")}\n`;

const metaBlock = (name: string, meta: string, doc: string): string => {
    const lines = [`### \`${name}\``, "", meta];

    if (doc.length > 0) {
        lines.push("", doc);
    }

    return lines.join("\n");
};

const signatureBlock = (name: string, signature: string, notes: string[]): string => {
    const lines = [`### \`${name}\``, "", `\`\`\`ts\n${signature}\n\`\`\``];

    for (const note of notes) {
        if (note.length > 0) {
            lines.push("", note);
        }
    }

    return lines.join("\n");
};

const namespaceOrder = (name: string): string => {
    const index = LEADING_NAMESPACES.indexOf(name);

    return index === -1 ? `1${name}` : `0${String(index)}`;
};

const docsSignatureContext = (namespace: GirNamespace, library: Library): ModuleContext =>
    new ModuleContext({ ...namespace, name: DOCS_SIGNATURE_NAMESPACE }, library);

const originSignatureBlocks = (entries: OriginSignatureEntry[]): string[] =>
    sortStringsBy(entries, (item) => item.name).map((item) =>
        signatureBlock(item.name, item.signature, [
            item.origin === undefined ? "" : `From \`${item.origin}\`.`,
            item.doc,
        ]),
    );

const classMethodEntries = (library: Library, namespace: GirNamespace, klass: GirClass): SignatureEntry[] => {
    const realContext = new ModuleContext(namespace, library);
    const signatureContext = docsSignatureContext(namespace, library);
    const className = pascalCase(klass.name);
    const inherited = collectInheritedMethods(realContext, klass);

    return instanceMethodEntries(signatureContext, klass, (method) =>
        conflictRename(realContext, method, inherited, className),
    );
};

const methodsSectionBlocks = (entries: SignatureEntry[], intro: string): string[] =>
    entries.length === 0
        ? []
        : ["## Methods", intro, ...entries.map((item) => signatureBlock(item.name, item.signature, [item.doc]))];

const instanceMethodEntries = (
    signatureContext: ModuleContext,
    klass: GirClass,
    rename: (fn: GirFunction) => string | undefined,
): SignatureEntry[] => {
    const deduped = dedupeCallables(klass.methods);

    const scope = instanceScope(pascalCase(klass.name), {
        constructors: dedupeCallables(klass.constructors),
        functions: dedupeCallables(klass.functions),
        methods: deduped,
    });

    const entries: SignatureEntry[] = [];

    for (const method of deduped) {
        const nameOverride = rename(method);

        const rendered = renderInstanceMethodSignature(
            signatureContext,
            { ...method, doc: undefined },
            scope,
            nameOverride,
        );

        if (rendered === undefined) {
            continue;
        }

        entries.push({
            name: nameOverride ?? methodExportName(method),
            signature: rendered.trim().replace(/;$/, ""),
            doc: docMarkdown(method.doc),
        });
    }

    return sortStringsBy(entries, (entry) => entry.name);
};

export {
    renderDocsType,
    renderDocsSignalSignature,
    renderDocsSignalHandlerType,
    docsDefaultValue,
    docMarkdown,
    firstSentence,
    elementSlug,
    implementsLine,
    joinSections,
    metaBlock,
    signatureBlock,
    namespaceOrder,
    docsSignatureContext,
    originSignatureBlocks,
    classMethodEntries,
    methodsSectionBlocks,
    instanceMethodEntries,
    type SignatureEntry,
    type OriginSignatureEntry,
};
