import type { Readable } from "node:stream";
import { type ChildProcess, type ChildProcessByStdio, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type HarnessProcess = ChildProcessByStdio<null, Readable, Readable>;

type Harness = {
    process: ChildProcess;
    output: () => string;
    waitForReady: () => Promise<void>;
    waitForExit: () => Promise<number | null>;
    childPid: () => number | undefined;
};

const HARNESS_PATH = fileURLToPath(new URL("fixtures/supervisor-harness.ts", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const READY_TIMEOUT_MS = 15_000;
const EXIT_TIMEOUT_MS = 15_000;
const READY_MARKER = "CHILD_READY";

const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timer: NodeJS.Timeout | undefined;

    const expiry: Promise<never> = new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${String(ms)}ms`));
        }, ms);

        timer.unref();
    });

    try {
        return await Promise.race([promise, expiry]);
    } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
    } finally {
        clearTimeout(timer);
    }
};

const readyPromise = (child: HarnessProcess, output: () => string): Promise<void> => {
    if (output().includes(READY_MARKER)) {
        return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
        const check = (): void => {
            if (output().includes(READY_MARKER)) {
                resolve();
            }
        };

        child.stdout.on("data", check);

        child.once("exit", () => {
            reject(new Error(`harness exited before ready:\n${output()}`));
        });
    });
};

const startHarness = (): Harness => {
    const child = spawn(process.execPath, ["--conditions=source", "--import", "tsx", HARNESS_PATH], {
        cwd: REPO_ROOT,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
    });

    let buffer = "";

    child.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
    });

    const exitPromise: Promise<number | null> = new Promise((resolve) => {
        child.once("exit", (code) => {
            resolve(code);
        });
    });

    const waitForReady = (): Promise<void> =>
        withTimeout(
            readyPromise(child, () => buffer),
            READY_TIMEOUT_MS,
            "harness ready",
        );

    const childPid = (): number | undefined => {
        const match = /CHILD_PID (\d+)/.exec(buffer);

        return match?.[1] ? Number(match[1]) : undefined;
    };

    return {
        process: child,
        output: () => buffer,
        waitForReady,
        waitForExit: () => withTimeout(exitPromise, EXIT_TIMEOUT_MS, "harness exit"),
        childPid,
    };
};

const didKill = (pid: number): boolean => {
    try {
        process.kill(pid, "SIGKILL");

        return true;
    } catch {
        return false;
    }
};

const killGroup = (pid: number | undefined): void => {
    if (pid === undefined) {
        return;
    }

    didKill(-pid);
    didKill(pid);
};

describe.skipIf(process.platform === "win32")("dev supervisor Ctrl+C", () => {
    let harness: Harness | undefined;

    afterEach(() => {
        if (!harness) {
            return;
        }

        killGroup(harness.process.pid);
        killGroup(harness.childPid());
        harness = undefined;
    });

    const expectCleanShutdown = async (deliverSignals: (groupPid: number) => void): Promise<void> => {
        harness = startHarness();
        await harness.waitForReady();
        const groupPid = harness.process.pid;
        expect(groupPid).toBeGreaterThan(0);

        if (groupPid === undefined) {
            throw new Error("harness has no pid");
        }

        deliverSignals(groupPid);
        const code = await harness.waitForExit();
        const output = harness.output();
        const signalsReceived = output.match(/SIGRECV/g)?.length ?? 0;
        expect(signalsReceived, `child should receive exactly one signal:\n${output}`).toBe(1);
        expect(code, `harness should exit 0:\n${output}`).toBe(0);
    };

    it("shuts the child down cleanly on a single group SIGINT", async () => {
        await expectCleanShutdown((groupPid) => {
            process.kill(-groupPid, "SIGINT");
        });
    });

    it("shuts down cleanly when one Ctrl+C arrives as duplicate signals", async () => {
        await expectCleanShutdown((groupPid) => {
            process.kill(-groupPid, "SIGINT");
            process.kill(groupPid, "SIGINT");
        });
    });
});
