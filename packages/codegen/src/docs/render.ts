import { sanitizeTypeIdentifier, sortStringsBy } from "@gtkx/utils";
import type { GirAnnotations } from "../gir/annotations.js";
import type { GirClass } from "../gir/class.js";
import type { Library } from "../gir/library.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirCallable } from "../gir/parameter.js";
import type { GirProperty } from "../gir/property.js";
import type { TypeId } from "../gir/type-id.js";
import type { JsDocDeprecation, JsDocParam, JsDocSpec } from "../writer/doc-tags.js";
import { renderHandlerParameters, renderHandlerResultType } from "../analysis/param-structure.js";
import { recordTypeTarget, renderBaseType, type TsTypeTarget } from "../analysis/ts-type.js";
import {
    dedupeCallables,
    instanceMemberSpec,
    instanceScope,
    renderInstanceMethodSignature,
} from "../store/gi/callables.js";
import { annotationSpec, handlerSpec, selfHandlerSpec } from "../store/gi/doc-spec.js";
import { methodExportName } from "../store/gi/method.js";
import { ModuleContext } from "../writer/context.js";
import { stripDocMedia } from "../writer/doc-tags.js";
import { gtkDocToMarkdown } from "../writer/gtk-doc.js";

type SignatureEntry = {
    name: string;
    signature: string;
    doc: string;
    tags?: JsDocSpec | undefined;
};

type OriginSignatureEntry = SignatureEntry & { origin: string | undefined };

type MetaDocEntry = {
    name: string;
    meta: string;
    doc: string;
    tags?: JsDocSpec | undefined;
};

type PropertyMetaOptions = {
    type: string;
    property: GirProperty;
    accessNotes: string[];
    origin: string | undefined;
};

const DOCS_DEFAULT_VALUES: Record<string, string> = { TRUE: "true", FALSE: "false", NULL: "null" };
const FENCE_LINE = /^\s*(```|~~~)/;
const HEADING_LINE = /^#{1,5}\s/;
const LEADING_NAMESPACES = ["Gtk", "Adw"];
const DOCS_SIGNATURE_NAMESPACE = "$docs";
const WHITESPACE_RUN = /\s+/g;

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
        shouldIncludeCallerAllocated: false,
        isOptOut: true,
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

const demoteLine = (line: string, isInFence: boolean): { text: string; isInFence: boolean } => {
    if (FENCE_LINE.test(line)) {
        return { text: line, isInFence: !isInFence };
    }

    if (isInFence) {
        return { text: line, isInFence };
    }

    return { text: HEADING_LINE.test(line) ? `#${line}` : line, isInFence };
};

const demoteHeadings = (markdown: string): string => {
    let isInFence = false;
    const lines: string[] = [];

    for (const line of markdown.split("\n")) {
        const result = demoteLine(line, isInFence);
        isInFence = result.isInFence;
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
        .replaceAll(/[*#>]/g, "")
        .replaceAll(WHITESPACE_RUN, " ")
        .trim();

const inlineMarkdown = (doc: string | undefined): string => docMarkdown(doc).replaceAll(WHITESPACE_RUN, " ").trim();
const plainText = (doc: string | undefined): string => stripMarkdown(docMarkdown(doc));

const firstSentence = (doc: string | undefined): string => {
    const text = plainText(doc);

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

const paramNotes = (params: JsDocParam[] | undefined): string[] => {
    const entries = (params ?? [])
        .map((param) => ({ name: param.name, text: inlineMarkdown(param.doc) }))
        .filter((entry) => entry.text.length > 0);

    if (entries.length === 0) {
        return [];
    }

    const bullets = entries.map((entry) => `- \`${entry.name}\`: ${entry.text}`);

    return [["**Parameters**", "", ...bullets].join("\n")];
};

const labelledNote = (label: string, text: string): string[] => (text.length === 0 ? [] : [`${label} ${text}`]);

const deprecationNote = (deprecation: JsDocDeprecation | undefined): string[] => {
    if (deprecation === undefined) {
        return [];
    }

    const since = deprecation.since;
    const heading = since === undefined ? "**Deprecated.**" : `**Deprecated since ${since}.**`;
    const text = inlineMarkdown(deprecation.doc);
    const body = text.length === 0 ? heading : `${heading} ${text}`;

    return [`> ${body}`];
};

const sinceNote = (since: string | undefined): string[] =>
    since === undefined || since.length === 0 ? [] : [`_Available since ${since}._`];

const tagNotes = (spec: JsDocSpec | undefined): string[] => {
    if (spec === undefined) {
        return [];
    }

    return [
        ...paramNotes(spec.params),
        ...labelledNote("**Returns**", docMarkdown(spec.returns)),
        ...labelledNote("**Throws**", inlineMarkdown(spec.throws)),
        ...deprecationNote(spec.deprecated),
        ...sinceNote(spec.since),
    ];
};

const deprecationMeta = (annotations: GirAnnotations): string[] => {
    if (!annotations.isDeprecated) {
        return [];
    }

    const since = annotations.deprecatedSince;

    return [since === undefined ? "deprecated" : `deprecated since ${since}`];
};

const annotationNotes = (annotations: GirAnnotations): string[] => tagNotes(annotationSpec(annotations));

const signalTags = (signal: GirCallable, isSelfIncluded: boolean): JsDocSpec =>
    isSelfIncluded ? selfHandlerSpec(signal) : handlerSpec(signal, signal.parameters);

const metaBlock = (entry: MetaDocEntry): string => {
    const lines = [`### \`${entry.name}\``, "", entry.meta];

    for (const note of [entry.doc, ...tagNotes(entry.tags)]) {
        if (note.length > 0) {
            lines.push("", note);
        }
    }

    return lines.join("\n");
};

const sortedMetaBlocks = (entries: MetaDocEntry[]): string[] =>
    sortStringsBy(entries, (item) => item.name).map((item) => metaBlock(item));

const propertyMetaLine = ({ type, property, accessNotes, origin }: PropertyMetaOptions): string => {
    const meta = [`\`${type}\``];

    if (property.defaultValue !== undefined) {
        meta.push(`default \`${docsDefaultValue(property.defaultValue)}\``);
    }

    if (property.constructOnly) {
        meta.push("construct-only");
    }

    meta.push(...accessNotes, ...deprecationMeta(property.annotations));

    if (origin !== undefined) {
        meta.push(`from \`${origin}\``);
    }

    return meta.join(" · ");
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

const signatureEntryBlock = (entry: SignatureEntry, leadingNotes: string[] = []): string =>
    signatureBlock(entry.name, entry.signature, [...leadingNotes, entry.doc, ...tagNotes(entry.tags)]);

const namespaceOrder = (name: string): string => {
    const index = LEADING_NAMESPACES.indexOf(name);

    return index === -1 ? `1${name}` : `0${String(index)}`;
};

const docsSignatureContext = (namespace: GirNamespace, library: Library): ModuleContext =>
    new ModuleContext({ ...namespace, name: DOCS_SIGNATURE_NAMESPACE }, library);

const originSignatureBlocks = (entries: OriginSignatureEntry[]): string[] =>
    sortStringsBy(entries, (item) => item.name).map((item) =>
        signatureEntryBlock(item, item.origin === undefined ? [] : [`From \`${item.origin}\`.`]),
    );

const qualifiedClassName = (namespaceName: string, className: string): string =>
    `${namespaceName}.${sanitizeTypeIdentifier(className)}`;

const classMethodEntries = (library: Library, namespace: GirNamespace, klass: GirClass): SignatureEntry[] => {
    const signatureContext = docsSignatureContext(namespace, library);

    return instanceMethodEntries(signatureContext, klass);
};

const methodsSectionBlocks = (entries: SignatureEntry[], intro: string): string[] =>
    entries.length === 0 ? [] : ["## Methods", intro, ...entries.map((item) => signatureEntryBlock(item))];

const instanceMethodEntries = (
    signatureContext: ModuleContext,
    klass: GirClass,
): SignatureEntry[] => {
    const deduped = dedupeCallables(klass.methods);

    const scope = instanceScope(sanitizeTypeIdentifier(klass.name), {
        constructors: dedupeCallables(klass.constructors),
        functions: dedupeCallables(klass.functions),
        methods: deduped,
    });

    const entries: SignatureEntry[] = [];

    for (const method of deduped) {
        const rendered = renderInstanceMethodSignature(signatureContext, method, scope);

        if (rendered === undefined) {
            continue;
        }

        entries.push({
            name: methodExportName(method),
            signature: signatureText(rendered),
            doc: docMarkdown(method.doc),
            tags: instanceMemberSpec(signatureContext, method, scope),
        });
    }

    return sortStringsBy(entries, (entry) => entry.name);
};

const signatureText = (rendered: string): string => {
    const start = rendered.startsWith("/**") ? rendered.indexOf("*/") + 2 : 0;

    return rendered.slice(start).trim().replace(/;$/, "");
};

export {
    renderDocsType,
    renderDocsSignalSignature,
    renderDocsSignalHandlerType,
    annotationNotes,
    deprecationMeta,
    docMarkdown,
    firstSentence,
    elementSlug,
    implementsLine,
    joinSections,
    plainText,
    propertyMetaLine,
    signalTags,
    signatureBlock,
    signatureEntryBlock,
    sortedMetaBlocks,
    namespaceOrder,
    docsSignatureContext,
    originSignatureBlocks,
    classMethodEntries,
    methodsSectionBlocks,
    qualifiedClassName,
    tagNotes,
    type MetaDocEntry,
    type SignatureEntry,
    type OriginSignatureEntry,
};
