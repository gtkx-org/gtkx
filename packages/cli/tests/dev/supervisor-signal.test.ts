import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const HARNESS_PATH = fileURLToPath(new URL("./fixtures/supervisor-harness.ts", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const READY_TIMEOUT_MS = 15000;
const EXIT_TIMEOUT_MS = 15000;

type Harness = {
    process: ChildProcess;
    output: () => string;
    waitForReady: () => Promise<void>;
    waitForExit: () => Promise<number | null>;
    childPid: () => number | undefined;
};

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        timer.unref();
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (reason: unknown) => {
                clearTimeout(timer);
                reject(reason instanceof Error ? reason : new Error(String(reason)));
            },
        );
    });

const startHarness = (): Harness => {
    const child = spawn(process.execPath, ["--conditions=source", "--import", "tsx", HARNESS_PATH], {
        cwd: REPO_ROOT,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
    });

    let buffer = "";
    child.stdout?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
    });

    const exitPromise = new Promise<number | null>((resolve) => {
        child.once("exit", (code) => resolve(code));
    });

    const waitForReady = (): Promise<void> =>
        withTimeout(
            new Promise<void>((resolve, reject) => {
                const check = (): boolean => {
                    if (buffer.includes("CHILD_READY")) {
                        resolve();
                        return true;
                    }
                    return false;
                };
                if (check()) return;
                child.stdout?.on("data", () => check());
                child.once("exit", () => reject(new Error(`harness exited before ready:\n${buffer}`)));
            }),
            READY_TIMEOUT_MS,
            "harness ready",
        );

    const childPid = (): number | undefined => {
        const match = buffer.match(/CHILD_PID (\d+)/);
        return match?.[1] ? Number.parseInt(match[1], 10) : undefined;
    };

    return {
        process: child,
        output: () => buffer,
        waitForReady,
        waitForExit: () => withTimeout(exitPromise, EXIT_TIMEOUT_MS, "harness exit"),
        childPid,
    };
};

const killGroup = (pid: number | undefined): void => {
    if (pid === undefined) return;
    try {
        process.kill(-pid, "SIGKILL");
    } catch {}
    try {
        process.kill(pid, "SIGKILL");
    } catch {}
};

describe.skipIf(process.platform === "win32")("dev supervisor Ctrl+C", () => {
    let harness: Harness | undefined;

    afterEach(() => {
        if (!harness) return;
        killGroup(harness.process.pid);
        killGroup(harness.childPid());
        harness = undefined;
    });

    const runCleanShutdown = async (deliverSignals: (groupPid: number) => void): Promise<void> => {
        harness = startHarness();
        await harness.waitForReady();

        const groupPid = harness.process.pid;
        expect(groupPid).toBeGreaterThan(0);
        if (groupPid === undefined) throw new Error("harness has no pid");

        deliverSignals(groupPid);

        const code = await harness.waitForExit();
        const output = harness.output();
        const signalsReceived = output.match(/SIGRECV/g)?.length ?? 0;

        expect(signalsReceived, `child should receive exactly one signal:\n${output}`).toBe(1);
        expect(code, `harness should exit 0:\n${output}`).toBe(0);
    };

    it("shuts the child down cleanly on a single group SIGINT", async () => {
        await runCleanShutdown((groupPid) => {
            process.kill(-groupPid, "SIGINT");
        });
    });

    it("shuts down cleanly when one Ctrl+C arrives as duplicate signals", async () => {
        await runCleanShutdown((groupPid) => {
            process.kill(-groupPid, "SIGINT");
            process.kill(groupPid, "SIGINT");
        });
    });
});
