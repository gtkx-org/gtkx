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

const WORKER_URL = /new\s+URL\s*\(\s*(["'])(\.{1,2}\/[^"']+)\1\s*,\s*import\.meta\.url\s*\)/g;
const WORKER_CONSTRUCTION = /new\s+(?:\w+\.)?Worker\s*\(\s*$/;

const workerFileName = (id: string): string => {
    const path = stripQuery(id);
    const stem = basename(path, extname(path));
    const digest = createHash("sha256").update(id).digest("hex").slice(0, 8);

    return `workers/${stem}-${digest}.js`;
};

const isWorkerConstruction = (code: string, matchIndex: number): boolean =>
    WORKER_CONSTRUCTION.test(code.slice(0, matchIndex));

const hasWorkerCandidate = (code: string): boolean => code.includes("new URL(") && code.includes("Worker");

const workerUrlExpression = (fileName: string): string => {
    const specifier = JSON.stringify(`./${fileName}`);

    return `new URL(${specifier}, import.meta.url)`;
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

const replacementFor = async (
    emit: EmitContext,
    match: RegExpExecArray,
    id: string,
): Promise<WorkerReplacement | null> => {
    const specifier = match[2];

    if (specifier === undefined || !isWorkerConstruction(match.input, match.index)) {
        return null;
    }

    const resolved = await emit.context.resolve(specifier, id);

    if (resolved === null) {
        return null;
    }

    return { start: match.index, end: match.index + match[0].length, fileName: claimWorker(emit, resolved.id) };
};

const collectReplacements = async (emit: EmitContext, code: string, id: string): Promise<WorkerReplacement[]> => {
    const pending = code.matchAll(WORKER_URL).map((match) => replacementFor(emit, match, id)).toArray();
    const found = await Promise.all(pending);

    return found.filter((entry) => entry !== null);
};

const applyReplacements = (code: string, replacements: WorkerReplacement[]): string => {
    let output = "";
    let cursor = 0;

    for (const { start, end, fileName } of replacements) {
        output += code.slice(cursor, start) + workerUrlExpression(fileName);
        cursor = end;
    }

    return output + code.slice(cursor);
};

function gtkxWorker(): Plugin {
    const emitted: Map<string, string> = new Map();

    return {
        name: "gtkx:worker",
        apply: "build",

        async transform(code, id) {
            if (!hasWorkerCandidate(code)) {
                return null;
            }

            const replacements = await collectReplacements({ context: this, emitted }, code, id);

            return replacements.length === 0 ? null : { code: applyReplacements(code, replacements), map: null };
        },
    };
}

export { gtkxWorker };
