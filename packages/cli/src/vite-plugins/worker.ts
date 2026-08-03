import type { Plugin, Rollup } from "vite";
import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import { stripQuery } from "./strip-query.js";

type WorkerReplacement = {
    start: number;
    end: number;
    fileName: string;
};

type EmitContext = {
    context: Rollup.PluginContext;
    emitted: Map<string, string>;
};

type SourceRange = {
    start: number;
    end: number;
};

type ScanContext = {
    code: string;
    id: string;
    nonCode: SourceRange[];
};

type HoistedWorkerUrl = {
    name: string;
    specifier: string;
};

type TransformResult = {
    code: string;
    map: null;
} | null;

const RELATIVE_SPECIFIER = String.raw`(?<quote>["'])(?<specifier>\.{1,2}\/[^"']+)\k<quote>`;
const URL_CALL = String.raw`new\s+URL\s*\(\s*${RELATIVE_SPECIFIER}\s*,\s*import\.meta\.url\s*\)`;
const URL_DECLARATION = String.raw`(?:const|let|var)\s+(?<name>[A-Za-z_$][\w$]*)\s*(?::[^=;\n]+)?=\s*`;
const BLOCK_COMMENT = String.raw`\/\*[\s\S]*?\*\/`;
const LINE_COMMENT = String.raw`\/\/[^\n]*`;
const DOUBLE_QUOTED = String.raw`"(?:[^"\\\n]|\\[\s\S])*"`;
const SINGLE_QUOTED = String.raw`'(?:[^'\\\n]|\\[\s\S])*'`;
const TEMPLATE_LITERAL = String.raw`\`(?:[^\`\\]|\\[\s\S])*\``;
const WORKER_URL = new RegExp(URL_CALL, "g");
const HOISTED_WORKER_URL = new RegExp(URL_DECLARATION + URL_CALL, "g");
const WORKER_CONSTRUCTION = /new\s+(?:\w+\.)?Worker\s*\(\s*$/;

const NON_CODE = new RegExp(
    [BLOCK_COMMENT, LINE_COMMENT, DOUBLE_QUOTED, SINGLE_QUOTED, TEMPLATE_LITERAL].join("|"),
    "g",
);

const SUGGESTED_EXTENSIONS: Record<string, string[]> = {
    ".cjs": [".cts"],
    ".js": [".ts", ".tsx"],
    ".jsx": [".tsx"],
    ".mjs": [".mts"],
};

const workerFileName = (id: string): string => {
    const path = stripQuery(id);
    const stem = basename(path, extname(path));
    const digest = createHash("sha256").update(id).digest("hex").slice(0, 8);

    return `workers/${stem}-${digest}.js`;
};

const nonCodeRanges = (code: string): SourceRange[] =>
    code
        .matchAll(NON_CODE)
        .map((match) => ({ start: match.index, end: match.index + match[0].length }))
        .toArray();

const isCodePosition = (scan: ScanContext, index: number): boolean =>
    scan.nonCode.every((range) => index < range.start || index >= range.end);

const isWorkerConstruction = (code: string, matchIndex: number): boolean =>
    WORKER_CONSTRUCTION.test(code.slice(0, matchIndex));

const hasWorkerCandidate = (code: string): boolean => code.includes("import.meta.url") && code.includes("Worker");

const workerUrlExpression = (fileName: string): string => {
    const specifier = JSON.stringify(`./${fileName}`);

    return `new URL(${specifier}, import.meta.url)`;
};

const inlineWorkerExample = (specifier: string): string =>
    `new Worker(new URL(${JSON.stringify(specifier)}, import.meta.url))`;

const hoistedWorkerError = (scan: ScanContext, hoisted: HoistedWorkerUrl): Error =>
    new Error(
        `${stripQuery(scan.id)}: the worker URL for ${JSON.stringify(hoisted.specifier)} is bound to ` +
        `"${hoisted.name}" before it reaches "new Worker". gtkx build emits a worker chunk only for a URL ` +
        `written inside the construction. Write ${inlineWorkerExample(hoisted.specifier)} instead.`,
    );

const unresolvedWorkerError = (scan: ScanContext, specifier: string, suggestion: string | null): Error =>
    new Error(
        `${stripQuery(scan.id)}: the worker specifier ${JSON.stringify(specifier)} does not resolve to a module, ` +
        "so no worker chunk can be emitted. " +
        (suggestion === null
            ? "Correct the path so it names the worker source file as it exists on disk."
            : `Write ${inlineWorkerExample(suggestion)} instead.`),
    );

const suggestionFor = async (emit: EmitContext, scan: ScanContext, specifier: string): Promise<string | null> => {
    const extension = extname(specifier);
    const stem = specifier.slice(0, specifier.length - extension.length);
    const candidates = SUGGESTED_EXTENSIONS[extension] ?? [];

    for (const candidate of candidates) {
        const resolved = await emit.context.resolve(stem + candidate, scan.id);

        if (resolved !== null) {
            return stem + candidate;
        }
    }

    return null;
};

const claimWorker = (emit: EmitContext, resolvedId: string): string => {
    const existing = emit.emitted.get(resolvedId);

    if (existing !== undefined) {
        return existing;
    }

    const fileName = workerFileName(resolvedId);
    emit.emitted.set(resolvedId, fileName);
    emit.context.emitFile({ type: "chunk", id: resolvedId, fileName });

    return fileName;
};

const isRewritableUrl = (scan: ScanContext, match: RegExpExecArray): boolean =>
    isCodePosition(scan, match.index) && isWorkerConstruction(scan.code, match.index);

const replacementFor = async (
    emit: EmitContext,
    scan: ScanContext,
    match: RegExpExecArray,
): Promise<WorkerReplacement | null> => {
    const specifier = match.groups?.specifier;

    if (specifier === undefined || !isRewritableUrl(scan, match)) {
        return null;
    }

    const resolved = await emit.context.resolve(specifier, scan.id);

    if (resolved === null) {
        throw unresolvedWorkerError(scan, specifier, await suggestionFor(emit, scan, specifier));
    }

    return { start: match.index, end: match.index + match[0].length, fileName: claimWorker(emit, resolved.id) };
};

const collectReplacements = async (emit: EmitContext, scan: ScanContext): Promise<WorkerReplacement[]> => {
    const pending = scan.code.matchAll(WORKER_URL).map((match) => replacementFor(emit, scan, match)).toArray();
    const found = await Promise.all(pending);

    return found.filter((entry) => entry !== null);
};

const hasWorkerArgument = (scan: ScanContext, name: string): boolean => {
    const escaped = name.replaceAll("$", String.raw`\$`);
    const pattern = new RegExp(String.raw`new\s+(?:\w+\.)?Worker\s*\(\s*${escaped}\s*[,)]`, "g");

    return scan.code.matchAll(pattern).some((match) => isCodePosition(scan, match.index));
};

const hoistedUrlFor = (scan: ScanContext, match: RegExpExecArray): HoistedWorkerUrl | null => {
    const name = match.groups?.name;
    const specifier = match.groups?.specifier;

    if (name === undefined || specifier === undefined || !isCodePosition(scan, match.index)) {
        return null;
    }

    return { name, specifier };
};

const findHoistedWorkerUrl = (scan: ScanContext): HoistedWorkerUrl | null =>
    scan.code
        .matchAll(HOISTED_WORKER_URL)
        .map((match) => hoistedUrlFor(scan, match))
        .find((entry) => entry !== null && hasWorkerArgument(scan, entry.name)) ?? null;

const applyReplacements = (code: string, replacements: WorkerReplacement[]): string => {
    let output = "";
    let cursor = 0;

    for (const { start, end, fileName } of replacements) {
        output += code.slice(cursor, start) + workerUrlExpression(fileName);
        cursor = end;
    }

    return output + code.slice(cursor);
};

const transformWorkerUrls = async (emit: EmitContext, code: string, id: string): Promise<TransformResult> => {
    if (!hasWorkerCandidate(code)) {
        return null;
    }

    const scan: ScanContext = { code, id, nonCode: nonCodeRanges(code) };
    const hoisted = findHoistedWorkerUrl(scan);

    if (hoisted !== null) {
        throw hoistedWorkerError(scan, hoisted);
    }

    const replacements = await collectReplacements(emit, scan);

    return replacements.length === 0 ? null : { code: applyReplacements(code, replacements), map: null };
};

function gtkxWorker(): Plugin {
    const emitted: Map<string, string> = new Map();

    return {
        name: "gtkx:worker",
        apply: "build",

        transform(code, id) {
            return transformWorkerUrls({ context: this, emitted }, code, id);
        },
    };
}

export { gtkxWorker };
