import { type ChildProcess, spawn } from "node:child_process";
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
const TSX_LOADER = new URL("../../../scripts/register-workspace-loader.ts", import.meta.url).href;
const FIXTURE_ARGS = ["--import", TSX_LOADER, FIXTURE];
const READY_MARKER = "READY";
const READY_SUBJECT = "the exit fixture";
const EXIT_MARKER = "ONEXIT RAN";
const READY_TIMEOUT_MS = 20_000;
const HANDLED_EXIT_CODE = 7;
const CLOSE_TIMEOUT_MS = 20_000;

const waitForClose = (child: ChildProcess): Promise<SignalledExit> =>
    new Promise<SignalledExit>((resolve) => {
        child.once("close", (code, signal) => {
            resolve({ code, signal });
        });
    });

const runUntilSignalled = async (signal: NodeJS.Signals, mode?: string): Promise<SignalledRun> => {
    const args = mode === undefined ? FIXTURE_ARGS : [...FIXTURE_ARGS, mode];
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    const read = collectOutput(child);
    const closed = waitForClose(child);

    try {
        await waitForMarker({
            child,
            read,
            marker: READY_MARKER,
            subject: READY_SUBJECT,
            timeoutMs: READY_TIMEOUT_MS,
        });

        child.kill(signal);
        const exit = await closed;
        return { output: read(), ...exit };
    } finally {
        child.kill("SIGKILL");
        await closed;
    }
};

const runToCompletion = async (mode: string): Promise<SignalledRun> => {
    const child = spawn(process.execPath, [...FIXTURE_ARGS, mode], { stdio: ["ignore", "pipe", "pipe"] });
    const read = collectOutput(child);
    const timer = setTimeout(() => {
        child.kill("SIGKILL");
    }, CLOSE_TIMEOUT_MS);

    try {
        const exit = await waitForClose(child);
        return { output: read(), ...exit };
    } finally {
        clearTimeout(timer);
    }
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

describe("a process ended by native code", () => {
    it("exits with the native status when a native call exits the process", async () => {
        const run = await runToCompletion("native-exit");
        expect(run.output).toContain("--help-gapplication");
        expect(run.output).not.toContain("panic");
        expect(run.code).toBe(0);
    });
});
