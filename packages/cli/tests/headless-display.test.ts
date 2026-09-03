import {
    killProcessGroup,
    type ProcessGroupIdentity,
    processGroupIdentity,
    spawnWithParentDeathSignal,
} from "@gtkx/utils";
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

type ProcessIdentity = {
    parentId: number;
    processGroupId: number;
    sessionId: number;
    startTime: string;
    state: string;
};
type ProcessEntry = ProcessIdentity & { pid: number; args: string[] };
type DisplayProbe = {
    child: ChildProcess;
    runtimeDir: string;
    processes: ProcessEntry[];
    processGroups: ProcessGroupIdentity[];
    guard: ProcessGroupIdentity;
};

const PROCESS_TIMEOUT_MS = 30_000;
const POLL_MS = 50;
const NODE_TYPESCRIPT_ARGS = ["--conditions=source", "--import", "tsx", "--input-type=module", "-e"];
const HEADLESS_MODULE = new URL("../../vitest/src/headless.ts", import.meta.url).href;
const HEADLESS_PROBE =
    `const { resolveHeadlessOptions, startHeadlessDisplay } = await import(${JSON.stringify(HEADLESS_MODULE)});` +
    "await startHeadlessDisplay(resolveHeadlessOptions({ size: \"640x480\" }));" +
    String.raw`process.stdout.write(JSON.stringify({ runtimeDir: process.env.XDG_RUNTIME_DIR }) + "\n");` +
    "setInterval(() => {}, 1000);";
const GUARDED_PROCESS_PROBE =
    String.raw`process.stdout.write((process.env.GTKX_PROCESS_GUARD ?? "") + "\n");` +
    "process.stdin.resume();";
const DECOY_PROCESS_PROBE = "setInterval(() => {}, 1000);";

const processIdentity = (pid: number): ProcessIdentity | undefined => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ");
        const state = fields[0];
        const parentId = Number(fields[1]);
        const processGroupId = Number(fields[2]);
        const sessionId = Number(fields[3]);
        const startTime = fields[19];

        return state !== undefined &&
            startTime !== undefined &&
            Number.isSafeInteger(parentId) &&
            Number.isSafeInteger(processGroupId) &&
            Number.isSafeInteger(sessionId)
            ? { parentId, processGroupId, sessionId, startTime, state }
            : undefined;
    } catch {
        return undefined;
    }
};

const childProcesses = (parentId: number): ProcessEntry[] =>
    readdirSync("/proc")
        .map(Number)
        .filter((pid) => Number.isSafeInteger(pid) && pid > 1)
        .flatMap((pid): ProcessEntry[] => {
            const identity = processIdentity(pid);

            if (identity?.parentId !== parentId) {
                return [];
            }

            try {
                const args = readFileSync(`/proc/${String(pid)}/cmdline`)
                    .toString()
                    .split("\0")
                    .filter((argument) => argument.length > 0);

                return [{ pid, ...identity, args }];
            } catch {
                return [];
            }
        });

const isRunning = (entry: Pick<ProcessEntry, "pid" | "startTime">): boolean => {
    const current = processIdentity(entry.pid);

    return current?.startTime === entry.startTime &&
        current.state !== "Z" &&
        current.state !== "X" &&
        current.state !== "x";
};

const isPidRunning = (pid: number): boolean => {
    const state = processIdentity(pid)?.state;

    return state !== undefined && state !== "Z" && state !== "X" && state !== "x";
};

const waitUntil = async (isReady: () => boolean): Promise<void> => {
    const deadline = Date.now() + PROCESS_TIMEOUT_MS;

    while (!isReady() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }

    if (!isReady()) {
        throw new Error("Process condition did not settle");
    }
};

const firstOutputLine = (child: ChildProcess): Promise<string> =>
    new Promise((resolve, reject) => {
        const output = child.stdout;

        if (output === null) {
            reject(new Error("Probe stdout is unavailable"));

            return;
        }

        let buffered = "";

        const stop = (): void => {
            output.removeListener("data", onData);
            child.removeListener("exit", onExit);
            child.removeListener("error", onError);
        };

        const onData = (chunk: Buffer): void => {
            buffered += chunk.toString();
            const newline = buffered.indexOf("\n");

            if (newline !== -1) {
                stop();
                resolve(buffered.slice(0, newline));
            }
        };

        const onExit = (): void => {
            stop();
            reject(new Error("Probe exited before becoming ready"));
        };

        const onError = (error: Error): void => {
            stop();
            reject(error);
        };

        output.on("data", onData);
        child.once("exit", onExit);
        child.once("error", onError);
    });

const hasProcessMarker = (pid: number): boolean => {
    try {
        return readFileSync(`/proc/${String(pid)}/environ`, "utf8")
            .split("\0")
            .some((entry) => entry.startsWith("GTKX_PROCESS_GUARD="));
    } catch {
        return false;
    }
};

const processEntries = (): ProcessEntry[] =>
    readdirSync("/proc")
        .map(Number)
        .filter((pid) => Number.isSafeInteger(pid) && pid > 1)
        .flatMap((pid): ProcessEntry[] => {
            const identity = processIdentity(pid);

            if (identity === undefined) {
                return [];
            }

            try {
                const args = readFileSync(`/proc/${String(pid)}/cmdline`)
                    .toString()
                    .split("\0")
                    .filter((argument) => argument.length > 0);

                return [{ pid, ...identity, args }];
            } catch {
                return [];
            }
        });

const ownedDisplayProcesses = (runtimeDir: string): ProcessEntry[] => {
    const entries = processEntries();
    const groups = new Set(
        entries
            .filter((entry) =>
                entry.pid === entry.processGroupId &&
                hasProcessMarker(entry.pid) &&
                entry.args.some((argument) => argument.includes(runtimeDir)),
            )
            .map((entry) => entry.processGroupId),
    );

    return entries.filter((entry) => groups.has(entry.processGroupId));
};

const ownedProcessGroups = (processes: ProcessEntry[]): ProcessGroupIdentity[] =>
    processes.flatMap((entry): ProcessGroupIdentity[] => {
        if (entry.pid !== entry.processGroupId || entry.pid !== entry.sessionId) {
            return [];
        }

        const group = processGroupIdentity(entry.pid);

        return group === undefined ? [] : [group];
    });

const startDisplayProbe = async (): Promise<DisplayProbe> => {
    const child = spawn(process.execPath, [...NODE_TYPESCRIPT_ARGS, HEADLESS_PROBE], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
    });
    const ready = JSON.parse(await firstOutputLine(child)) as { runtimeDir?: string };
    const runtimeDir = ready.runtimeDir;
    const parentId = child.pid;

    if (runtimeDir === undefined || parentId === undefined) {
        throw new Error("Headless display probe returned no runtime identity");
    }

    const processes = ownedDisplayProcesses(runtimeDir);
    const guardProcess = childProcesses(parentId).find((entry) =>
        entry.args.some((argument) => argument.includes("process-guard")),
    );
    const guard = guardProcess === undefined ? undefined : processGroupIdentity(guardProcess.pid);
    const processGroups = ownedProcessGroups(processes);

    if (guard === undefined || processes.length < 3 || processGroups.length < 2) {
        throw new Error("Headless display probe returned no owned processes");
    }

    return { child, runtimeDir, processes, processGroups, guard };
};

const killOwnedProcessGroups = (groups: ProcessGroupIdentity[]): void => {
    for (const group of groups) {
        killProcessGroup(group);
    }
};

const stopProbe = (probe: DisplayProbe): void => {
    if (probe.child.exitCode === null && probe.child.signalCode === null) {
        probe.child.kill("SIGKILL");
    }

    killProcessGroup(probe.guard);
    killOwnedProcessGroups(probe.processGroups);
    rmSync(probe.runtimeDir, { recursive: true, force: true });
};

describe("headless display process ownership", () => {
    it("kills its exact display process groups when its parent is hard-killed", async () => {
        const probe = await startDisplayProbe();

        try {
            probe.child.kill("SIGKILL");
            await waitUntil(() =>
                probe.processes.every((entry) => !isRunning(entry)) && !existsSync(probe.runtimeDir),
            );
            expect(probe.processes.some((entry) => entry.args[0]?.endsWith("/sway") === true)).toBe(true);
            expect(probe.processes.some((entry) => entry.args[0]?.endsWith("/dbus-daemon") === true)).toBe(true);
            expect(existsSync(probe.runtimeDir)).toBe(false);
        } finally {
            stopProbe(probe);
        }
    });

    it("cleans up when its Node guard and parent are hard-killed", async () => {
        const probe = await startDisplayProbe();

        try {
            killProcessGroup(probe.guard);
            probe.child.kill("SIGKILL");
            await waitUntil(() =>
                probe.processes.every((entry) => !isRunning(entry)) && !existsSync(probe.runtimeDir),
            );
            expect(probe.processes.some((entry) => entry.args[0]?.endsWith("/sway") === true)).toBe(true);
            expect(existsSync(probe.runtimeDir)).toBe(false);
        } finally {
            stopProbe(probe);
        }
    });

    it("does not kill a process whose guard marker merely extends another job marker", async () => {
        const guarded = spawnWithParentDeathSignal(
            process.execPath,
            ["--input-type=module", "-e", GUARDED_PROCESS_PROBE],
            { stdio: ["pipe", "pipe", "pipe"] },
        );
        const marker = await firstOutputLine(guarded);
        const decoy = spawn(process.execPath, ["--input-type=module", "-e", DECOY_PROCESS_PROBE], {
            env: { ...process.env, GTKX_PROCESS_GUARD: `${marker}suffix` },
            stdio: "ignore",
        });

        try {
            const guardedExit: Promise<void> = new Promise((resolve) => {
                guarded.once("exit", () => {
                    resolve();
                });
            });
            guarded.stdin?.end();
            await guardedExit;
            expect(decoy.pid === undefined ? false : isPidRunning(decoy.pid)).toBe(true);
        } finally {
            guarded.kill("SIGKILL");
            decoy.kill("SIGKILL");
        }
    });

    it("throws for an unidentified cleanup directory", () => {
        const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-guard-rollback-"));

        try {
            expect(() => spawnWithParentDeathSignal(
                process.execPath,
                ["--input-type=module", "-e", DECOY_PROCESS_PROBE],
                { cleanupDirectories: [runtimeDir, join(runtimeDir, "missing")] },
            )).toThrow();
        } finally {
            rmSync(runtimeDir, { recursive: true, force: true });
        }
    });
});

describe("gtkx dev headless arguments", () => {
    it("rejects a display size without headless mode", () => {
        using project = createCliProject({ prefix: "gtkx-headless-args-" });

        expect(() => runCliOrThrow(project, ["dev", "--size", "800x600"])).toThrow();
    });
});
