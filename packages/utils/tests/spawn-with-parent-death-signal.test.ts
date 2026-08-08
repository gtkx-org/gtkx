import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawnWithParentDeathSignal } from "../src/process/index.js";

type Fixture = { spawned: ChildProcess[]; pids: number[]; directories: string[] };
type Tree = { driver: ChildProcess; handlePid: number; escapeePid: number };
type Outcome = { code: number | null; signal: NodeJS.Signals | null };

const POLL_INTERVAL_MS = 20;
const POLL_TIMEOUT_MS = 15_000;
const DRIVER_PATH = join(import.meta.dirname, "fixtures", "spawn-driver.mjs");
const PAYLOAD_PATH = join(import.meta.dirname, "fixtures", "spawn-escapee.mjs");
const fixture: Fixture = { spawned: [], pids: [], directories: [] };

const DRIVER_OUTCOMES: Record<string, Outcome> = {
    exit: { code: 0, signal: null },
    drain: { code: 0, signal: null },
    throw: { code: 1, signal: null },
    SIGTERM: { code: null, signal: "SIGTERM" },
    SIGKILL: { code: null, signal: "SIGKILL" },
};

const readStatFields = (pid: number): string[] | null => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");

        return stat.slice(stat.lastIndexOf(")") + 2).split(" ", 5);
    } catch {
        return null;
    }
};

const getProcessState = (pid: number): string | null => readStatFields(pid)?.[0] ?? null;

const getSessionId = (pid: number): number | null => {
    const fields = readStatFields(pid);

    return fields === null ? null : Number(fields[3]);
};

const isProcessAlive = (pid: number): boolean => {
    const state = getProcessState(pid);

    return state !== null && state !== "Z";
};

const readPid = (path: string): number | null => {
    try {
        const pid = Number(readFileSync(path, "utf8").trim());

        return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
    } catch {
        return null;
    }
};

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

/* eslint-disable-next-line unicorn/consistent-boolean-name -- reports whether the condition was met */
const pollUntil = async (isSatisfied: () => boolean): Promise<boolean> => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (isSatisfied()) {
            return true;
        }

        await delay(POLL_INTERVAL_MS);
    }

    return isSatisfied();
};

const waitForExit = (child: ChildProcess): Promise<Outcome> =>
    new Promise((resolve) => {
        child.on("exit", (code, signal) => {
            resolve({ code, signal });
        });
    });

const describeSurvivors = (tree: Tree): string =>
    [
        `handle=${String(getProcessState(tree.handlePid))}`,
        `escapee=${String(getProcessState(tree.escapeePid))}`,
        `driver=${String(getProcessState(tree.driver.pid ?? 0))}`,
    ].join(" ");

const killPid = (pid: number): void => {
    try {
        process.kill(pid, "SIGKILL");
    } catch {
        return;
    }
};

const cleanUp = (fixture: Fixture): void => {
    for (const child of fixture.spawned) {
        child.kill("SIGKILL");
    }

    for (const pid of fixture.pids) {
        killPid(pid);
    }

    for (const directory of fixture.directories) {
        rmSync(directory, { recursive: true, force: true });
    }

    fixture.spawned.length = 0;
    fixture.pids.length = 0;
    fixture.directories.length = 0;
};

const makeDirectory = (fixture: Fixture): string => {
    const directory = mkdtempSync(join(tmpdir(), "gtkx-pdeath-"));
    fixture.directories.push(directory);

    return directory;
};

const trackPid = (fixture: Fixture, pid: number | null): number => {
    expect(pid).not.toBeNull();
    fixture.pids.push(pid ?? 0);

    return pid ?? 0;
};

const startTree = async (fixture: Fixture, mode: string): Promise<Tree> => {
    const directory = makeDirectory(fixture);
    const escapeePidPath = join(directory, "escapee.pid");
    const handlePidPath = join(directory, "handle.pid");

    const driver = spawn(process.execPath, [DRIVER_PATH, escapeePidPath, handlePidPath, mode], {
        stdio: ["pipe", "ignore", "ignore"],
    });

    fixture.spawned.push(driver);
    const isReady = await pollUntil(() => readPid(escapeePidPath) !== null && readPid(handlePidPath) !== null);
    expect(isReady).toBe(true);

    return {
        driver,
        handlePid: trackPid(fixture, readPid(handlePidPath)),
        escapeePid: trackPid(fixture, readPid(escapeePidPath)),
    };
};

const endDriver = (tree: Tree, mode: string): void => {
    if (mode === "SIGTERM" || mode === "SIGKILL") {
        tree.driver.kill(mode);

        return;
    }

    tree.driver.stdin?.write("go\n");
};

afterEach(() => {
    cleanUp(fixture);
});

describe("spawnWithParentDeathSignal reaping", () => {
    const modes = ["exit", "drain", "throw", "SIGTERM", "SIGKILL"];

    it.each(modes)("reaps the escaped tree when the parent ends by %s", async (mode) => {
        const tree = await startTree(fixture, mode);
        expect(isProcessAlive(tree.escapeePid)).toBe(true);
        expect(getSessionId(tree.escapeePid)).toBe(tree.escapeePid);
        const exited = waitForExit(tree.driver);
        endDriver(tree, mode);
        await expect(exited).resolves.toEqual(DRIVER_OUTCOMES[mode]);
        const isReaped = await pollUntil(() => !isProcessAlive(tree.handlePid) && !isProcessAlive(tree.escapeePid));
        expect(isReaped ? "reaped" : describeSurvivors(tree)).toBe("reaped");
    });

    it("reaps a descendant that escaped into its own session when the handle is killed", async () => {
        const directory = makeDirectory(fixture);
        const escapeePidPath = join(directory, "escapee.pid");
        const child = spawnWithParentDeathSignal(process.execPath, [PAYLOAD_PATH, escapeePidPath]);
        fixture.spawned.push(child);
        expect(await pollUntil(() => readPid(escapeePidPath) !== null)).toBe(true);
        const escapeePid = trackPid(fixture, readPid(escapeePidPath));
        expect(getSessionId(escapeePid)).toBe(escapeePid);
        child.kill("SIGKILL");
        expect(await pollUntil(() => !isProcessAlive(escapeePid))).toBe(true);
    });

    it("leaves the calling process alive once the tree is reaped", async () => {
        const tree = await startTree(fixture, "SIGKILL");
        endDriver(tree, "SIGKILL");
        await pollUntil(() => !isProcessAlive(tree.escapeePid));
        expect(isProcessAlive(process.pid)).toBe(true);
    });
});

describe("spawnWithParentDeathSignal wiring", () => {
    it("propagates the command's exit code", async () => {
        const child = spawnWithParentDeathSignal(process.execPath, ["-e", "process.exit(42)"]);
        fixture.spawned.push(child);
        await expect(waitForExit(child)).resolves.toEqual({ code: 42, signal: null });
    });

    it("propagates the signal that killed the command", async () => {
        const child = spawnWithParentDeathSignal("sleep", ["600"]);
        fixture.spawned.push(child);
        const exited = waitForExit(child);
        child.kill("SIGTERM");
        await expect(exited).resolves.toEqual({ code: null, signal: "SIGTERM" });
    });

    it("forwards a piped stream from the command", async () => {
        const child = spawnWithParentDeathSignal("echo", ["hello"], { stdio: ["ignore", "pipe", "ignore"] });
        fixture.spawned.push(child);
        const chunks: Buffer[] = [];

        child.stdout?.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
        });

        await waitForExit(child);
        expect(Buffer.concat(chunks).toString("utf8")).toBe("hello\n");
    });

    it("throws a named error when the command is not on PATH", () => {
        expect(() => spawnWithParentDeathSignal("gtkx-nonexistent-binary-xyz", [])).toThrow(
            /gtkx-nonexistent-binary-xyz/,
        );
    });
});
