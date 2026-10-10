import { mkdirSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector/promises";
import { dirname, join, relative } from "node:path";
import { afterAll, beforeAll, expect, inject } from "vitest";
import type {} from "../context.d.ts";

const { coverageDirectory: directory } = inject("nativeTest");

if (directory !== undefined) {
    const session = new Session();

    beforeAll(async () => {
        session.connect();
        await session.post("Debugger.enable");
        await session.post("Profiler.enable");
        await session.post("Profiler.startPreciseCoverage", { callCount: true, detailed: false });
    });

    afterAll(async () => {
        try {
            const { result } = await session.post("Profiler.takePreciseCoverage");
            const scripts = result.filter((script) =>
                /\/(gimarshallingtests|regress)\/\1\.js(?:\?|$)/.test(script.url),
            );
            const reports = await Promise.all(
                scripts.map(async (script) => ({
                    ...script,
                    source: (await session.post("Debugger.getScriptSource", { scriptId: script.scriptId }))
                        .scriptSource,
                })),
            );
            const testPath = expect.getState().testPath;
            if (testPath === undefined) throw new Error("Native coverage requires the running test file path");
            const reportPath = join(directory, `${relative(join(import.meta.dirname, ".."), testPath)}.json`);
            mkdirSync(dirname(reportPath), { recursive: true });
            writeFileSync(reportPath, JSON.stringify(reports));
        } finally {
            await session.post("Profiler.stopPreciseCoverage");
            await session.post("Debugger.disable");
            session.disconnect();
        }
    });
}
