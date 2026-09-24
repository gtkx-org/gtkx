import { spawnWithParentDeathSignal } from "@gtkx/utils";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FIXTURES = {
    "process-exit-owner": new URL("fixtures/process-exit-owner.ts", import.meta.url),
    "process-exit-closure": new URL("fixtures/process-exit-closure.ts", import.meta.url),
};
const CASES = [
    { fixture: "process-exit-owner", mode: "empty", status: 0 },
    { fixture: "process-exit-owner", mode: "natural", status: 0 },
    { fixture: "process-exit-owner", mode: "explicit", status: 0 },
    { fixture: "process-exit-owner", mode: "explicit-error", status: 23 },
    { fixture: "process-exit-closure", mode: "natural", status: 0 },
    { fixture: "process-exit-closure", mode: "explicit", status: 0 },
    { fixture: "process-exit-closure", mode: "explicit-error", status: 23 },
] satisfies { fixture: keyof typeof FIXTURES; mode: string; status: number }[];

const runFixture = async (
    fixture: keyof typeof FIXTURES,
    mode: string,
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> => {
    const filename = fileURLToPath(FIXTURES[fixture]);
    const child = spawnWithParentDeathSignal(process.execPath, [
        "--conditions=source", "--import", "tsx", "--expose-gc", filename, mode,
    ], { stdio: "ignore" });
    const closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }> = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => {
            resolve({ code, signal });
        });
    });
    const timeout = setTimeout(() => {
        child.kill("SIGKILL");
    }, 20_000);

    try {
        return await closed;
    } finally {
        clearTimeout(timeout);
        child.kill("SIGKILL");
    }
};

describe("process exit after native owner cleanup is queued", () => {
    it.each(CASES)("preserves status $status through $fixture $mode", async ({ fixture, mode, status }) => {
        expect(await runFixture(fixture, mode)).toEqual({ code: status, signal: null });
    }, 30_000);
});
