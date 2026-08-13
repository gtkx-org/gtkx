import type { ChildProcess } from "node:child_process";
import { spawnWithParentDeathSignal } from "@gtkx/utils";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectOutput, waitForMarker } from "./helpers/child-output.js";

type SignalledExit = {
    code: number | null;
    signal: NodeJS.Signals | null;
};

type SignalledRun = SignalledExit & {
    output: string;
};

const FIXTURE = fileURLToPath(new URL("fixtures/exit-signal.ts", import.meta.url));
const FIXTURE_ARGS = ["--conditions=source", "--import", "tsx", FIXTURE];
const READY_MARKER = "READY";
const READY_SUBJECT = "the exit fixture";
const EXIT_MARKER = "ONEXIT RAN";
const READY_TIMEOUT_MS = 20_000;
const HANDLED_EXIT_CODE = 7;

const waitForClose = (child: ChildProcess): Promise<SignalledExit> =>
    new Promise<SignalledExit>((resolve) => {
        child.once("close", (code, signal) => {
            resolve({ code, signal });
        });
    });

const runUntilSignalled = async (signal: NodeJS.Signals, mode?: string): Promise<SignalledRun> => {
    const args = mode === undefined ? FIXTURE_ARGS : [...FIXTURE_ARGS, mode];
    const child = spawnWithParentDeathSignal(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    const read = collectOutput(child);

    await waitForMarker({
        child,
        read,
        marker: READY_MARKER,
        subject: READY_SUBJECT,
        timeoutMs: READY_TIMEOUT_MS,
    });

    const closed = waitForClose(child);
    child.kill(signal);
    const exit = await closed;

    return { output: read(), ...exit };
};

describe("onExit for a process stopped by a signal", () => {
    it("runs the registered callbacks on SIGINT, then dies of the signal", async () => {
        const run = await runUntilSignalled("SIGINT");
        expect(run.output).toContain(EXIT_MARKER);
        expect(run.signal).toBe("SIGINT");
    });

    it("runs the registered callbacks on SIGTERM, then dies of the signal", async () => {
        const run = await runUntilSignalled("SIGTERM");
        expect(run.output).toContain(EXIT_MARKER);
        expect(run.signal).toBe("SIGTERM");
    });

    it("leaves the exit to a handler the process installed itself", async () => {
        const run = await runUntilSignalled("SIGTERM", "handled");
        expect(run.code).toBe(HANDLED_EXIT_CODE);
        expect(run.output).toContain(EXIT_MARKER);
    });
});
