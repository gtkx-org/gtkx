/**
 * Vitest setup file that scopes shape capture to one test file.
 *
 * `beforeAll` resets the recorder; `afterAll` flushes the sorted union of
 * distinct shapes to a per-test `.shapes` file under `.codegen-golden/`.
 *
 * Activation is gated on `GTKX_CODEGEN_TRACE=1`.
 */

import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { afterAll, beforeAll } from "vitest";

import { recorder } from "./recorder.js";

const OUTPUT_ROOT_ENV = "GTKX_CODEGEN_TRACE_DIR";
const ENABLED_ENV = "GTKX_CODEGEN_TRACE";

const isEnabled = (): boolean => process.env[ENABLED_ENV] === "1";

const outputRoot = (): string => process.env[OUTPUT_ROOT_ENV] ?? join(process.cwd(), ".codegen-golden");

const repoRoot = (): string => {
    const explicit = process.env.GTKX_REPO_ROOT;
    if (explicit !== undefined && explicit.length > 0) return explicit;
    return process.cwd();
};

const traceFileFor = (testFilepath: string): string => {
    const rel = relative(repoRoot(), testFilepath);
    return join(outputRoot(), `${rel}.shapes`);
};

const filepathOf = (suiteOrFile: { filepath?: string; file?: { filepath?: string } }): string => {
    if ("filepath" in suiteOrFile && typeof suiteOrFile.filepath === "string") return suiteOrFile.filepath;
    return suiteOrFile.file?.filepath ?? "<unknown>";
};

/**
 * Vitest's worker module runner evaluates the setup file more than once per
 * test file (the file is re-imported during the file-level context spin-up,
 * but the recorder module — which holds the accumulated set — survives).
 * Without guards, a second `recorder.begin()` would discard everything the
 * first run captured, and a second `afterAll` would truncate the flushed
 * snapshot. The shared global flags pin both to first-call semantics.
 */
type TraceGlobal = { __codegenTraceBegun?: boolean; __codegenTraceFlushed?: boolean };
const traceGlobal = globalThis as TraceGlobal;

if (isEnabled()) {
    if (!traceGlobal.__codegenTraceBegun) {
        traceGlobal.__codegenTraceBegun = true;
        recorder.begin();
    }

    afterAll(({}, suiteOrFile) => {
        if (traceGlobal.__codegenTraceFlushed) return;
        traceGlobal.__codegenTraceFlushed = true;
        const outputPath = traceFileFor(filepathOf(suiteOrFile));
        mkdirSync(dirname(outputPath), { recursive: true });
        const fd = openSync(outputPath, "w");
        try {
            recorder.end((line) => writeSync(fd, `${line}\n`));
        } finally {
            closeSync(fd);
        }
    });
}
