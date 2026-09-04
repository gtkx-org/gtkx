import { sanitizeTypeIdentifier, sortStringsBy } from "@gtkx/utils";
import type { GirAnnotations } from "../gir/annotations.js";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { GirNamespace } from "../gir/namespace.js";
import type { GirCallable } from "../gir/parameter.js";
import type { GirProperty } from "../gir/property.js";
import type { TypeId } from "../gir/type-id.js";
import type { JsDocDeprecation, JsDocParam, JsDocSpec } from "../writer/doc-tags.js";
import { renderHandlerParameters, renderHandlerResultType } from "../analysis/param-structure.js";
import { recordTypeTarget, renderBaseType, type TsTypeTarget } from "../analysis/ts-type.js";
import { callableSpec } from "../store/gi/callable-doc.js";
import {
    dedupeCallables,
    instanceMemberSpec,
    instanceScope,
    matchStaticFinishFunction,
    renderInstanceMethodSignature,
    renderStaticSignature,
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

type StaticSectionOptions = {
    title: string;
    intro: string;
    context: ModuleContext;
    callables: GirFunction[];
    siblings: GirFunction[];
    returnTypeOverride?: string;
};

const DOCS_DEFAULT_VALUES: Record<string, string> = { TRUE: "true", FALSE: "false", NULL: "null" };
const FENCE_LINE = /^\s*(```|~~~)/;
const HEADING_LINE = /^#{1,5}\s/;
const LEADING_NAMESPACES = ["Gtk", "Adw"];
const DOCS_SIGNATURE_NAMESPACE = "$docs";
const WHITESPACE_RUN = /\s+/g;
const CLEANUP_TOKEN = String.fromCodePoint(0xE0_01);
const FENCE_TOKEN = String.fromCodePoint(0xE0_02);
const FENCED_CLEANUP_COMMENT = /^(?:\/\/|#|\/\*|\*)[^\n]*\b(?:free|unref)\b/i;
const FENCED_CLEANUP_INSTRUCTION =
    /\b(?:do\s+not|don't|must|should|needs?\s+to|(?:have|has)\s+to)\s+(?:free|unref)\b/i;
const C_CLEANUP_CALL = /\b[a-z]\w*_(?:free(?:_[a-z]\w*)?|freev|unref|unset|destroy)\s*\(\)/i;
const C_STRFREEV_CALL = /\bg_\w*freev?\s*\(\)/i;
const GI_CLEANUP_CALL = /\b(?:[A-Z]\w*\.)+(?:free|strfreev|unref|unset|destroy)\s*\(\)/;
const FREE_CALL = /\bfree\s*\(\)/i;
const FREE_ACTION = /\bfree(?:d|ing)?\b/i;
const UNREF_ACTION = /\bunref(?:s|fed|fing|erence[sd]?|erencing)?\b/i;
const QUOTED_UNREF_ACTION = /\bunref(?:'ed|'d)\b/i;
const OTHER_CLEANUP_ACTION = /\b(?:unset(?:ting)?|release[sd]?|destroy(?:ed|ing)?)\b/i;
const ACTIVE_CLEANUP_MODAL = /\b(?:can|must|should|shouldn't|don't)\b/i;
const PASSIVE_CLEANUP_MODAL = /\b(?:must|should)\b/i;
const CLEANUP_PHRASAL_EXPECTATION = /\b(?:do\s+not|will\s+need\s+to|need\s+not|needs?\s+to)\b/i;
const CLEANUP_TO_EXPECTATION = /\b(?:have|has|safe)\s+to\b/i;
const CANNOT_CLEANUP = /\b(?:cannot|can't)\b/i;
const PASSIVE_VOICE = /\b(?:not\s+)?be\b/i;
const MAY_NOT_CLEANUP = /\bmay\s+not\s+be\b/i;
const REFERENCE_RELEASE = /\brelease\s+(?:any\s+|the\s+|a\s+)?references?\b/i;
const C_DESTROY_NOTIFY = /\bGDestroyNotify\b/;
const CALLBACK_CLEANUP_CONFIGURATION = /\bspecify\s+(?:a|the)\s+way\s+to\s+(?:free|unref|release|destroy)\b/i;
const HIDDEN_CLEANUP_PARAMETER = /\buser_data_free_func\b/i;
const HIDDEN_CLEANUP_ALTERNATIVE =
    /^Alternatively,[^.!?]*\b(?:resources?|data)\b[^.!?]*\b(?:released|freed|destroyed)\b/i;
const DIRECT_MEMORY_CLEANUP = /^(?:to\s+)?(?:free(?![-\s]+text\b)|unref)\b/i;
const CLEANUP_DIRECTIVE = /\b(?:call(?:ed|ing)?|use|do not|drop)\b|\bdon't\b/i;
const DIRECT_CLEANUP_START = /^(?:use|call|do not|don't|in particular|instead|alternatively|the only function)\b/i;
const SECOND_PERSON_CLEANUP_START = /^you\s+(?:should|must|need\s+to|have\s+to)\b/i;
const RETURNED_CLEANUP_START = /^(?:(?:the|a|an)\s+)?returned\b/i;
const RETURN_VALUE_CLEANUP_START = /^(?:the\s+)?return(?:ed)?\s+(?:value|result)\b/i;
const VALUE_CLEANUP_START =
    /^(?:(?:the|this|a|an|both)\s+)?(?:value|array|list|result|string|object|path|paths|reference)\b/i;
const CALLER_OWNERSHIP = /\bbelongs?\s+to\s+(?:the\s+)?caller\b/i;
const OWNED_BY_CALLER = /\bowned\s+by\s+(?:the\s+)?caller\b/i;
const OBJECT_OWNERSHIP = /\bobjects?\s+(?:are|is)\s+(?:referenced|owned)\b/i;
const TAKES_OWNERSHIP = /\btakes?\s+(?:the\s+)?ownership\b/i;
const TRAILING_CLEANUP_CLAUSE =
    /,\s+(?:so|otherwise|and\s+(?:it|they)\s+(?:should|must|need|will|can|is|are))\b/i;
const CLEANUP_CLAUSE_BOUNDARIES = [
    /[,;:]\s*/g,
    /(?:,\s*)?\b(?:which|that)\s+(?=(?:should|must|needs?|is|are|can)\b)/gi,
    /(?:,\s*)?\band\s+(?=(?:then\s+)?(?:free|unref|use|call|do not|don't)\b)/gi,
    /(?:,\s*)?\band\s+(?=(?:the\s+)?caller\b)/gi,
    /(?:,\s*)?\band\s+(?=(?:must|should)\s+(?:not\s+)?(?:free|unref)\b)/gi,
];
const INSUBSTANTIAL_CLEANUP_PREFIX = /^(?:as such|for this reason|in general|otherwise)$/i;
const DEPENDENT_CLEANUP_PREFIX = /^(?:if|when|unless|while|since|to)\b/i;
const BLANK_LINES = /(\n{2,})/;
const EXCESS_BLANK_LINES = /\n{3,}/g;
const SENTENCE_BOUNDARY = /(?<=[.!?])(?=\s|[A-Z`]|$)/;

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

const cleanupToken = (index: number): string => `${CLEANUP_TOKEN}${String(index)}${CLEANUP_TOKEN}`;
const fenceToken = (index: number): string => `${FENCE_TOKEN}${String(index)}${FENCE_TOKEN}`;

const fenceMarker = (line: string): string | undefined => {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("```")) {
        return "```";
    }

    return trimmed.startsWith("~~~") ? "~~~" : undefined;
};

type FenceProtection = {
    block: string[];
    fences: string[];
    marker: string | undefined;
    output: string[];
};

const startFenceOrCopyLine = (state: FenceProtection, line: string): void => {
    const marker = fenceMarker(line);

    if (marker === undefined) {
        state.output.push(line);

        return;
    }

    state.marker = marker;
    state.block = [line];
};

const appendFenceLine = (state: FenceProtection, line: string): void => {
    state.block.push(line);

    if (line.trim() !== state.marker) {
        return;
    }

    state.output.push(fenceToken(state.fences.length));
    const hasCLanguage = state.block[0]?.trimStart().startsWith("```c") === true;
    const hasCCall = state.block.some((entry) => /\bg_\w+\s*\(/.test(entry));
    const isC = hasCLanguage || hasCCall;
    const block = isC
        ? state.block.filter((entry) => !FENCED_CLEANUP_COMMENT.test(entry.trim()))
        : state.block;
    state.fences.push(block.join("\n"));
    state.marker = undefined;
    state.block = [];
};

const protectFencedBlocks = (markdown: string, fences: string[]): string => {
    const state: FenceProtection = { block: [], fences, marker: undefined, output: [] };

    for (const line of markdown.split("\n")) {
        const append = state.marker === undefined ? startFenceOrCopyLine : appendFenceLine;
        append(state, line);
    }

    if (state.block.length > 0) {
        state.output.push(...state.block);
    }

    return state.output.join("\n");
};

const restoreFencedBlocks = (markdown: string, fences: string[]): string => {
    let restored = markdown;

    for (const [index, fence] of fences.entries()) {
        restored = restored.replaceAll(fenceToken(index), () => fence);
    }

    return restored;
};

const isFenceToken = (text: string): boolean => text.startsWith(FENCE_TOKEN) && text.endsWith(FENCE_TOKEN);

const isCleanupCExample = (text: string): boolean =>
    /\bg_\w+\s*\(/.test(text) && FENCED_CLEANUP_INSTRUCTION.test(text);

const isCExampleIntroduction = (text: string): boolean =>
    /\b(?:code|example|pattern)\b/i.test(text) && /\b(?:from|for)\s+C\b/i.test(text);

const paragraphStart = (boundary: number): number => (boundary === -1 ? 0 : boundary + 2);

const skipBlankSeparator = (markdown: string, start: number): number =>
    start + (markdown.startsWith("\n\n", start) ? 2 : 0);

const stripCleanupCExample = (markdown: string, index: number, fence: string): string => {
    if (!isCleanupCExample(fence)) {
        return markdown;
    }

    const token = fenceToken(index);
    const tokenStart = markdown.indexOf(token);

    if (tokenStart === -1) {
        return markdown;
    }

    const introductionEnd = markdown.lastIndexOf("\n\n", tokenStart - 1);

    if (introductionEnd === -1) {
        return markdown;
    }

    const introductionBoundary = markdown.lastIndexOf("\n\n", introductionEnd - 1);
    const introductionStart = paragraphStart(introductionBoundary);
    const introduction = markdown.slice(introductionStart, introductionEnd).trim();

    if (!isCExampleIntroduction(introduction)) {
        return markdown;
    }

    const suffixStart = skipBlankSeparator(markdown, tokenStart + token.length);

    return `${markdown.slice(0, introductionStart)}${markdown.slice(suffixStart)}`;
};

const stripCleanupCExamples = (markdown: string, fences: string[]): string => {
    let stripped = markdown;

    for (const [index, fence] of fences.entries()) {
        stripped = stripCleanupCExample(stripped, index, fence);
    }

    return stripped;
};

const isCleanupCall = (text: string): boolean =>
    C_CLEANUP_CALL.test(text) ||
    C_STRFREEV_CALL.test(text) ||
    GI_CLEANUP_CALL.test(text) ||
    FREE_CALL.test(text);

const protectCleanupCalls = (markdown: string, calls: string[]): string =>
    markdown.replaceAll(/`[^`\n]*`/g, (span) => {
        if (!isCleanupCall(span)) {
            return span;
        }

        const token = cleanupToken(calls.length);
        calls.push(span);

        return token;
    });

const hasMemoryAction = (text: string): boolean =>
    FREE_ACTION.test(text) ||
    UNREF_ACTION.test(text) ||
    QUOTED_UNREF_ACTION.test(text) ||
    OTHER_CLEANUP_ACTION.test(text);

const hasOwnershipCleanupStart = (text: string): boolean =>
    CALLER_OWNERSHIP.test(text) ||
    OWNED_BY_CALLER.test(text) ||
    OBJECT_OWNERSHIP.test(text) ||
    TAKES_OWNERSHIP.test(text);

const hasFreeOrUnrefAction = (text: string): boolean =>
    FREE_ACTION.test(text) || UNREF_ACTION.test(text) || QUOTED_UNREF_ACTION.test(text);

const hasActiveCleanupInstruction = (text: string): boolean =>
    !CALLBACK_CLEANUP_CONFIGURATION.test(text) &&
    (ACTIVE_CLEANUP_MODAL.test(text) ||
        CLEANUP_PHRASAL_EXPECTATION.test(text) ||
        CLEANUP_TO_EXPECTATION.test(text) ||
        CANNOT_CLEANUP.test(text)) &&
        (hasFreeOrUnrefAction(text) || REFERENCE_RELEASE.test(text) || C_DESTROY_NOTIFY.test(text));

const hasPassiveCleanupInstruction = (text: string): boolean =>
    ((PASSIVE_CLEANUP_MODAL.test(text) ||
        CLEANUP_PHRASAL_EXPECTATION.test(text) ||
        CLEANUP_TO_EXPECTATION.test(text)) &&
        PASSIVE_VOICE.test(text) &&
        hasMemoryAction(text)) ||
        (MAY_NOT_CLEANUP.test(text) && hasFreeOrUnrefAction(text));

const hasCleanupInstruction = (text: string): boolean =>
    hasPassiveCleanupInstruction(text) ||
    hasActiveCleanupInstruction(text) ||
    CALLER_OWNERSHIP.test(text) ||
    OWNED_BY_CALLER.test(text) ||
    DIRECT_MEMORY_CLEANUP.test(text.trimStart()) ||
    HIDDEN_CLEANUP_ALTERNATIVE.test(text.trimStart()) ||
    ((text.includes(CLEANUP_TOKEN) || isCleanupCall(text)) &&
        (hasMemoryAction(text) || CLEANUP_DIRECTIVE.test(text)));

const stripCleanupParentheticals = (text: string): string =>
    text.replaceAll(/\([^()\n]*\)/g, (part) => (hasCleanupInstruction(part) ? "" : part));

const terminalPunctuation = (text: string): string => /[.!?]\s*$/.exec(text)?.[0].trim() ?? "";

const cleanupClauseStarts = (sentence: string): number[] => {
    const starts: number[] = [];

    for (const pattern of CLEANUP_CLAUSE_BOUNDARIES) {
        for (const match of sentence.matchAll(pattern)) {
            starts.push(match.index);
        }
    }

    return starts
        .filter((index) => hasCleanupInstruction(sentence.slice(index)))
        .toSorted((left, right) => right - left);
};

const stripCleanupSentence = (sentence: string): string => {
    let stripped = sentence;

    while (hasCleanupInstruction(stripped)) {
        const [start] = cleanupClauseStarts(stripped);

        if (start === undefined) {
            return "";
        }

        const prefix = stripped.slice(0, start).trimEnd();

        if (INSUBSTANTIAL_CLEANUP_PREFIX.test(prefix.trim()) || DEPENDENT_CLEANUP_PREFIX.test(prefix.trim())) {
            return "";
        }

        stripped = `${prefix}${terminalPunctuation(stripped)}`;
    }

    return stripped;
};

const restoreCleanupCalls = (markdown: string, calls: string[]): string => {
    let restored = markdown;

    for (const [index, call] of calls.entries()) {
        restored = restored.replaceAll(cleanupToken(index), () => call);
    }

    return restored;
};

const mapDocSentences = (markdown: string, transform: (sentence: string) => string): string =>
    markdown
        .split(BLANK_LINES)
        .map((part) => {
            if (/^\n{2,}$/.test(part) || FENCE_LINE.test(part)) {
                return part;
            }

            return part
                .split(SENTENCE_BOUNDARY)
                .map((sentence) => transform(sentence))
                .join("");
        })
        .join("");

const stripManualMemoryManagement = (markdown: string): string => {
    const calls: string[] = [];
    const fences: string[] = [];
    const protectedFences = protectFencedBlocks(markdown, fences);
    const protectedMarkdown = stripCleanupParentheticals(protectCleanupCalls(protectedFences, calls));
    const stripped = mapDocSentences(protectedMarkdown, stripCleanupSentence);

    const compacted = stripped.replaceAll(EXCESS_BLANK_LINES, "\n\n");

    return restoreFencedBlocks(restoreCleanupCalls(compacted, calls), fences).trim();
};

const stripStandaloneCleanupSentence = (sentence: string): string => {
    const trimmed = sentence.trimStart();

    if (!hasCleanupInstruction(trimmed)) {
        return sentence;
    }

    const isInstructionStart =
        DIRECT_MEMORY_CLEANUP.test(trimmed) ||
        DIRECT_CLEANUP_START.test(trimmed) ||
        SECOND_PERSON_CLEANUP_START.test(trimmed) ||
        RETURNED_CLEANUP_START.test(trimmed) ||
        RETURN_VALUE_CLEANUP_START.test(trimmed) ||
        VALUE_CLEANUP_START.test(trimmed) ||
        hasOwnershipCleanupStart(trimmed);

    if (isInstructionStart) {
        return "";
    }

    return TRAILING_CLEANUP_CLAUSE.test(trimmed) || cleanupClauseStarts(trimmed).length > 0
        ? stripCleanupSentence(sentence)
        : sentence;
};

const stripStandaloneParagraph = (markdown: string): string =>
    HIDDEN_CLEANUP_PARAMETER.test(markdown)
        ? ""
        : mapDocSentences(markdown, stripStandaloneCleanupSentence);

const stripStandaloneMemoryManagement = (markdown: string): string => {
    const calls: string[] = [];
    const fences: string[] = [];
    const protectedFences = protectFencedBlocks(markdown, fences);
    const protectedMarkdown = stripCleanupCExamples(protectCleanupCalls(protectedFences, calls), fences);
    let shouldDropCleanupFence = false;
    const stripped = protectedMarkdown
        .split(BLANK_LINES)
        .map((part) => {
            if (/^\n{2,}$/.test(part)) {
                return part;
            }

            if (isFenceToken(part.trim()) || FENCE_LINE.test(part)) {
                if (shouldDropCleanupFence) {
                    shouldDropCleanupFence = false;

                    return "";
                }

                return part;
            }

            const transformed = stripStandaloneParagraph(part);
            shouldDropCleanupFence =
                transformed.trim().length === 0 && DIRECT_MEMORY_CLEANUP.test(part.trimStart());

            return transformed;
        })
        .join("");

    const compacted = stripped.replaceAll(EXCESS_BLANK_LINES, "\n\n");

    return restoreFencedBlocks(restoreCleanupCalls(compacted, calls), fences).trim();
};

const convertDocMarkdown = (doc: string, sanitize: (markdown: string) => string): string => {
    const markdown = gtkDocToMarkdown(doc);
    const withoutMedia = stripDocMedia(markdown);
    const demoted = demoteHeadings(withoutMedia);

    return sanitize(demoted);
};

const docMarkdown = (doc: string | undefined): string =>
    doc === undefined || doc.length === 0 ? "" : convertDocMarkdown(doc, stripStandaloneMemoryManagement);

const valueDocMarkdown = (doc: string | undefined): string =>
    doc === undefined || doc.length === 0 ? "" : convertDocMarkdown(doc, stripManualMemoryManagement);

const stripMarkdown = (markdown: string): string =>
    markdown
        .replaceAll(/```[\s\S]*?```/g, " ")
        .replaceAll(/`([^`]*)`/g, "$1")
        .replaceAll(/\[([^[\]]*)\]\([^)]*\)/g, "$1")
        .replaceAll(/[*#>]/g, "")
        .replaceAll(WHITESPACE_RUN, " ")
        .trim();

const inlineMarkdown = (doc: string | undefined): string => docMarkdown(doc).replaceAll(WHITESPACE_RUN, " ").trim();
const inlineValueMarkdown = (doc: string | undefined): string =>
    valueDocMarkdown(doc).replaceAll(WHITESPACE_RUN, " ").trim();
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
        .map((param) => ({ name: param.name, text: inlineValueMarkdown(param.doc) }))
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
        ...labelledNote("**Returns**", valueDocMarkdown(spec.returns)),
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

const staticEntry = (options: StaticSectionOptions, callable: GirFunction): SignatureEntry | undefined => {
    const signature = renderStaticSignature(options.context, callable, {
        returnTypeOverride: options.returnTypeOverride,
        siblings: options.siblings,
    });

    if (signature === undefined) {
        return undefined;
    }

    const finishFn = matchStaticFinishFunction(options.context, callable, options.siblings);

    return {
        name: signature.name,
        signature: signature.signature,
        doc: docMarkdown(callable.doc),
        tags: callableSpec(options.context, callable, { finishFn }),
    };
};

const staticSectionBlocks = (options: StaticSectionOptions): string[] => {
    const entries: SignatureEntry[] = [];

    for (const callable of dedupeCallables(options.callables)) {
        const entry = staticEntry(options, callable);

        if (entry !== undefined) {
            entries.push(entry);
        }
    }

    if (entries.length === 0) {
        return [];
    }

    const blocks = sortStringsBy(entries, (item) => item.name).map((item) => signatureEntryBlock(item));

    return [options.title, options.intro, ...blocks];
};

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
    staticSectionBlocks,
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
