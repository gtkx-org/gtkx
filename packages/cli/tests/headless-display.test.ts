import {
    killProcessGroup,
    type ProcessGroupIdentity,
    processGroupIdentity,
    spawnWithParentDeathSignal,
} from "@gtkx/utils";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import {
    chmodSync,
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    utimesSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
type WatchedDisplayProbe = {
    owner: ChildProcess;
    worker: Pick<ProcessEntry, "pid" | "startTime">;
    runtimeDir: string;
    processes: ProcessEntry[];
    processGroups: ProcessGroupIdentity[];
};
type StaleRuntime = Disposable & {
    environment: NodeJS.ProcessEnv;
    runtimeDir: string;
};

const PROCESS_TIMEOUT_MS = 30_000;
const POLL_MS = 50;
const NODE_TYPESCRIPT_ARGS = ["--conditions=source", "--import", "tsx", "--input-type=module", "-e"];
const HEADLESS_MODULE = new URL("../../vitest/src/headless.ts", import.meta.url).href;
const VITEST_PLUGIN_MODULE = new URL("../../vitest/src/index.ts", import.meta.url).href;
const VITEST_DIST_PLUGIN_MODULE = new URL("../../vitest/dist/index.js", import.meta.url).href;
const VITEST_ENTRY = fileURLToPath(new URL("../../../node_modules/vitest/vitest.mjs", import.meta.url));
const headlessProbe = (compositor: "sway" | "weston"): string =>
    `const { resolveHeadlessOptions, startHeadlessDisplay } = await import(${JSON.stringify(HEADLESS_MODULE)});` +
    "await startHeadlessDisplay(resolveHeadlessOptions({ size: \"640x480\", " +
    `compositor: ${JSON.stringify(compositor)} }));` +
    String.raw`process.stdout.write(JSON.stringify({ runtimeDir: process.env.XDG_RUNTIME_DIR }) + "\n");` +
    "setInterval(() => {}, 1000);";
const GUARDED_PROCESS_PROBE =
    String.raw`process.stdout.write((process.env.GTKX_PROCESS_GUARD ?? "") + "\n");` +
    "process.stdin.resume();";
const DECOY_PROCESS_PROBE = "setInterval(() => {}, 1000);";
const PLUGIN_START_PROBE = `const { default: gtkx } = await import(${JSON.stringify(VITEST_PLUGIN_MODULE)}); gtkx();`;

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

const hasRuntimeEnvironment = (pid: number, runtimeDir: string): boolean => {
    try {
        return readFileSync(`/proc/${String(pid)}/environ`, "utf8")
            .split("\0")
            .includes(`XDG_RUNTIME_DIR=${runtimeDir}`);
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
                (
                    entry.args.some((argument) => argument.includes(runtimeDir)) ||
                    hasRuntimeEnvironment(entry.pid, runtimeDir)
                ),
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

const startDisplayProbe = async (compositor: "sway" | "weston" = "sway"): Promise<DisplayProbe> => {
    const child = spawn(process.execPath, [...NODE_TYPESCRIPT_ARGS, headlessProbe(compositor)], {
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

    if (guard === undefined || processes.length < 2 || processGroups.length < 2) {
        throw new Error("Headless display probe returned no owned processes");
    }

    return { child, runtimeDir, processes, processGroups, guard };
};

const startVitestDisplayProbe = async (): Promise<WatchedDisplayProbe & { root: string }> => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-vitest-owner-"));
    const readyPath = join(root, "ready.json");
    writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
    writeFileSync(
        join(root, "vitest.config.ts"),
        `import gtkx from ${JSON.stringify(VITEST_DIST_PLUGIN_MODULE)};
export default { plugins: [gtkx()], test: { include: ["slow.test.ts"], maxWorkers: 1 } };
`,
    );
    writeFileSync(
        join(root, "slow.test.ts"),
        `import { writeFileSync } from "node:fs";
it("waits", async () => {
    const ready = { workerPid: process.pid, runtimeDir: process.env.XDG_RUNTIME_DIR };
    writeFileSync(${JSON.stringify(readyPath)}, JSON.stringify(ready));
    await new Promise(resolve => setTimeout(resolve, 90_000));
});
`,
    );
    const owner = spawn(process.execPath, [VITEST_ENTRY, "run", "--config", "vitest.config.ts"], {
        cwd: root,
        env: process.env,
        stdio: "ignore",
    });

    try {
        await waitUntil(() => existsSync(readyPath));
        const ready = JSON.parse(readFileSync(readyPath, "utf8")) as { runtimeDir?: string; workerPid?: number };
        const runtimeDir = ready.runtimeDir;
        const workerPid = ready.workerPid;
        const workerIdentity = workerPid === undefined ? undefined : processIdentity(workerPid);

        if (
            runtimeDir === undefined ||
            workerPid === undefined ||
            workerIdentity === undefined ||
            workerIdentity.parentId !== owner.pid
        ) {
            throw new Error("Vitest display probe returned no direct worker identity");
        }

        const processes = ownedDisplayProcesses(runtimeDir);
        const processGroups = ownedProcessGroups(processes);

        if (processes.length < 3 || processGroups.length < 2) {
            throw new Error("Vitest display probe returned no owned processes");
        }

        return {
            owner,
            worker: { pid: workerPid, startTime: workerIdentity.startTime },
            runtimeDir,
            processes,
            processGroups,
            root,
        };
    } catch (error) {
        owner.kill("SIGKILL");
        rmSync(root, { recursive: true, force: true });
        throw error;
    }
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

const stopWatchedProbe = (probe: WatchedDisplayProbe): void => {
    probe.owner.kill("SIGKILL");

    if (isRunning(probe.worker)) {
        process.kill(probe.worker.pid, "SIGKILL");
    }

    killOwnedProcessGroups(probe.processGroups);
    rmSync(probe.runtimeDir, { recursive: true, force: true });
};

const staleSwayConfig = (size: string): string =>
    [
        "xwayland disable",
        "default_border none",
        "default_floating_border none",
        `output HEADLESS-1 resolution ${size}`,
        "output HEADLESS-1 bg #000000 solid_color",
        'for_window [app_id=".*"] floating enable, border none',
        'for_window [title=".*"] floating enable, border none',
        "",
    ].join("\n");

const staleBusConfig = (runtimeDir: string): string =>
    [
        '<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN" ' +
        '"https://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">',
        "<busconfig>",
        "  <type>session</type>",
        `  <listen>unix:path=${join(runtimeDir, "bus")}</listen>`,
        "  <auth>EXTERNAL</auth>",
        '  <policy context="default">',
        '    <allow send_destination="*" eavesdrop="true"/>',
        '    <allow eavesdrop="true"/>',
        '    <allow own="*"/>',
        "  </policy>",
        "</busconfig>",
    ].join("\n");

const createStaleRuntime = (compositor: "sway" | "weston" = "sway"): StaleRuntime => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-headless-cleanup-root-"));

    try {
        const runtimeDir = mkdtempSync(join(root, "gtkx-xdg-"));
        chmodSync(runtimeDir, 0o700);

        if (compositor === "sway") {
            writeFileSync(join(runtimeDir, "sway.conf"), staleSwayConfig("731x487"));
        } else {
            const markerPath = join(runtimeDir, ".gtkx-headless-runtime");
            writeFileSync(markerPath, ["gtkx-headless-runtime-v1", `runtime=${runtimeDir}`, ""].join("\n"), {
                mode: 0o600,
            });
            chmodSync(markerPath, 0o600);
        }

        writeFileSync(join(runtimeDir, "session.conf"), staleBusConfig(runtimeDir));
        const staleTime = new Date(Date.now() - 10_000);
        utimesSync(runtimeDir, staleTime, staleTime);

        return {
            environment: { TMPDIR: root },
            runtimeDir,
            [Symbol.dispose]: () => {
                rmSync(root, { recursive: true, force: true });
            },
        };
    } catch (error) {
        rmSync(root, { recursive: true, force: true });
        throw error;
    }
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

    it("kills a Vitest worker display when the Vitest main process is hard-killed", async () => {
        const probe = await startVitestDisplayProbe();

        try {
            probe.owner.kill("SIGKILL");
            await waitUntil(() =>
                !isRunning(probe.worker) &&
                probe.processes.every((entry) => !isRunning(entry)) &&
                !existsSync(probe.runtimeDir),
            );
            expect(isRunning(probe.worker)).toBe(false);
            expect(existsSync(probe.runtimeDir)).toBe(false);
        } finally {
            stopWatchedProbe(probe);
            rmSync(probe.root, { recursive: true, force: true });
        }
    });

    it("keeps a live display running when its supervisor receives SIGCONT", async () => {
        const probe = await startDisplayProbe();

        try {
            const supervisor = probe.processes.find((entry) =>
                entry.args.includes("gtkx-process-supervisor"),
            );

            if (supervisor === undefined) {
                throw new Error("Headless display probe returned no supervisor");
            }

            process.kill(supervisor.pid, "SIGSTOP");
            await waitUntil(() => processIdentity(supervisor.pid)?.state === "T");
            process.kill(supervisor.pid, "SIGCONT");
            await waitUntil(() => processIdentity(supervisor.pid)?.state !== "T");
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(probe.processes.every((entry) => isRunning(entry))).toBe(true);
            expect(existsSync(probe.runtimeDir)).toBe(true);
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

describe("headless runtime cleanup", () => {
    it("removes verified stale runtime directories through the CLI", () => {
        using runtime = createStaleRuntime();
        using project = createCliProject({ prefix: "gtkx-headless-cleanup-" });
        runCliOrThrow(project, ["cleanup", "--dry-run"], runtime.environment);
        expect(existsSync(runtime.runtimeDir)).toBe(true);
        runCliOrThrow(project, ["cleanup"], runtime.environment);
        expect(existsSync(runtime.runtimeDir)).toBe(false);
    });

    it("removes verified stale Weston runtime directories", () => {
        using runtime = createStaleRuntime("weston");
        using project = createCliProject({ prefix: "gtkx-headless-cleanup-weston-" });
        runCliOrThrow(project, ["cleanup"], runtime.environment);
        expect(existsSync(runtime.runtimeDir)).toBe(false);
    });

    it("keeps lookalike runtime directories", () => {
        using runtime = createStaleRuntime();
        writeFileSync(
            join(runtime.runtimeDir, "sway.conf"),
            staleSwayConfig("731x487").replace("xwayland", "xwayland_mode"),
        );
        using project = createCliProject({ prefix: "gtkx-headless-cleanup-edge-" });
        runCliOrThrow(project, ["cleanup"], runtime.environment);
        expect(existsSync(runtime.runtimeDir)).toBe(true);
    });

    it("keeps lookalike Weston runtime directories", () => {
        using runtime = createStaleRuntime("weston");
        writeFileSync(
            join(runtime.runtimeDir, ".gtkx-headless-runtime"),
            ["gtkx-headless-runtime-v2", `runtime=${runtime.runtimeDir}`, ""].join("\n"),
        );
        using project = createCliProject({ prefix: "gtkx-headless-cleanup-weston-edge-" });
        runCliOrThrow(project, ["cleanup"], runtime.environment);
        expect(existsSync(runtime.runtimeDir)).toBe(true);
    });

    it("keeps runtime directories that still have a live display", async () => {
        const probe = await startDisplayProbe();

        try {
            const staleTime = new Date(Date.now() - 10_000);
            utimesSync(probe.runtimeDir, staleTime, staleTime);
            using project = createCliProject({ prefix: "gtkx-headless-cleanup-live-" });
            runCliOrThrow(project, ["cleanup"]);
            expect(probe.processes.every((entry) => isRunning(entry))).toBe(true);
            expect(existsSync(probe.runtimeDir)).toBe(true);
        } finally {
            stopProbe(probe);
        }
    });

    it("keeps a live Weston runtime directory", async () => {
        const probe = await startDisplayProbe("weston");

        try {
            const staleTime = new Date(Date.now() - 10_000);
            utimesSync(probe.runtimeDir, staleTime, staleTime);
            using project = createCliProject({ prefix: "gtkx-headless-cleanup-weston-live-" });
            runCliOrThrow(project, ["cleanup"]);
            expect(probe.processes.some((entry) => entry.args[0]?.endsWith("/weston") === true)).toBe(true);
            expect(probe.processes.every((entry) => isRunning(entry))).toBe(true);
            expect(existsSync(probe.runtimeDir)).toBe(true);
        } finally {
            stopProbe(probe);
        }
    });

    it("removes verified stale runtime directories when the Vitest plugin starts", () => {
        using runtime = createStaleRuntime();
        const result = spawnSync(process.execPath, [...NODE_TYPESCRIPT_ARGS, PLUGIN_START_PROBE], {
            cwd: process.cwd(),
            env: { ...process.env, ...runtime.environment },
            encoding: "utf8",
        });

        if (result.status !== 0) {
            throw new Error(`${result.stdout}${result.stderr}`);
        }

        expect(existsSync(runtime.runtimeDir)).toBe(false);
    });

    it("removes verified stale runtime directories when gtkx dev starts", () => {
        using runtime = createStaleRuntime();
        using project = createCliProject({
            prefix: "gtkx-headless-cleanup-dev-",
            config: 'export default { applicationId: "com.gtkx.cleanup", codegen: false };\n',
            files: { "src/index.ts": "process.exit(0);\n" },
            hasStore: true,
        });
        runCliOrThrow(project, ["dev"], runtime.environment);
        expect(existsSync(runtime.runtimeDir)).toBe(false);
    });
});
