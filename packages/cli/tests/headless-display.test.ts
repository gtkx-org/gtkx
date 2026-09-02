import {
    killProcessGroup,
    type ProcessGroupIdentity,
    processGroupIdentity,
    resolveExecutable,
    spawnWithParentDeathSignal,
} from "@gtkx/utils";
import {
    findLegacyHeadlessDisplays,
    type LegacyHeadlessDisplay,
    reapLegacyHeadlessDisplays,
} from "@gtkx/vitest/headless";
import { type ChildProcess, spawn } from "node:child_process";
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

type ProcessEntry = { pid: number; processGroup: ProcessGroupIdentity; args: string[] };
type DisplayProbe = { child: ChildProcess; runtimeDir: string; processes: ProcessEntry[] };
type LegacyProbe = {
    swayPid: number;
    busPid: number;
    swayGroup: ProcessGroupIdentity;
    busGroup: ProcessGroupIdentity;
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

const processIdentity = (pid: number): { parentId: number; processGroupId: number } | undefined => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ");
        const parentId = Number(fields[1]);
        const processGroupId = Number(fields[2]);

        return Number.isSafeInteger(parentId) && Number.isSafeInteger(processGroupId)
            ? { parentId, processGroupId }
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
                const processGroup = processGroupIdentity(pid);

                return processGroup === undefined ? [] : [{ pid, processGroup, args }];
            } catch {
                return [];
            }
        });

const isRunning = (pid: number): boolean => {
    try {
        return process.kill(pid, 0);
    } catch {
        return false;
    }
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

const ownedDisplayProcesses = (parentId: number, runtimeDir: string): ProcessEntry[] =>
    childProcesses(parentId).filter((entry) =>
        entry.args.some((argument) => argument.includes(runtimeDir)),
    );

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

    const processes = ownedDisplayProcesses(parentId, runtimeDir);

    if (processes.length < 2) {
        throw new Error("Headless display probe returned no owned processes");
    }

    return { child, runtimeDir, processes };
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

    killOwnedProcessGroups(probe.processes.map((entry) => entry.processGroup));
    rmSync(probe.runtimeDir, { recursive: true, force: true });
};

const legacyConfig = (size: string): string =>
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

const legacyBusConfig = (runtimeDir: string): string =>
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

const LEGACY_PROBE =
    'const { spawn } = await import("node:child_process");' +
    'const { join } = await import("node:path");' +
    "const runtimeDir = process.argv[1];" +
    "const sway = process.argv[2];" +
    "const dbus = process.argv[3];" +
    'const busChild = spawn(dbus, [`--config-file=${join(runtimeDir, "session.conf")}`], {' +
    "detached: true, stdio: \"ignore\" });" +
    'const swayChild = spawn(sway, ["-c", join(runtimeDir, "sway.conf")], {' +
    "detached: true, stdio: \"ignore\", env: { ...process.env, XDG_RUNTIME_DIR: runtimeDir, " +
    "WLR_BACKENDS: \"headless\", WLR_RENDERER: \"pixman\", WLR_RENDERER_ALLOW_SOFTWARE: \"1\", " +
    "WLR_LIBINPUT_NO_DEVICES: \"1\", WLR_HEADLESS_OUTPUTS: \"1\" } });" +
    "const spawned = child => new Promise((resolve, reject) => { child.once(\"spawn\", resolve); " +
    "child.once(\"error\", reject); });" +
    "await Promise.all([spawned(busChild), spawned(swayChild)]);" +
    "busChild.unref(); swayChild.unref();" +
    String.raw`process.stdout.write(JSON.stringify({ swayPid: swayChild.pid, busPid: busChild.pid }) + "\n");`;

const startLegacyProbe = async (runtimeDir: string): Promise<LegacyProbe> => {
    const parent = spawn(
        process.execPath,
        [
            ...NODE_TYPESCRIPT_ARGS,
            LEGACY_PROBE,
            runtimeDir,
            resolveExecutable("sway"),
            resolveExecutable("dbus-daemon"),
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
    );
    const result = JSON.parse(await firstOutputLine(parent)) as Partial<{ swayPid: number; busPid: number }>;
    const swayPid = result.swayPid;
    const busPid = result.busPid;

    if (
        swayPid === undefined ||
        busPid === undefined ||
        !Number.isSafeInteger(swayPid) ||
        !Number.isSafeInteger(busPid) ||
        swayPid < 2 ||
        busPid < 2
    ) {
        throw new Error("Legacy display probe returned no process ID");
    }

    await waitUntil(() =>
        processIdentity(swayPid)?.parentId !== parent.pid && processIdentity(busPid)?.parentId !== parent.pid,
    );
    const swayGroup = processGroupIdentity(swayPid);
    const busGroup = processGroupIdentity(busPid);

    if (swayGroup === undefined || busGroup === undefined) {
        throw new Error("Legacy display probe returned no stable process group identity");
    }

    return { swayPid, busPid, swayGroup, busGroup };
};

const findLegacyProbe = async (pid: number): Promise<LegacyHeadlessDisplay> => {
    let match = findLegacyHeadlessDisplays().find((entry) => entry.pid === pid);

    await waitUntil(() => {
        match = findLegacyHeadlessDisplays().find((entry) => entry.pid === pid);

        return match !== undefined;
    });

    if (match === undefined) {
        throw new Error("Legacy display probe was not identified");
    }

    return match;
};

describe("headless display process ownership", () => {
    it("kills its exact display process groups when its parent is hard-killed", async () => {
        const probe = await startDisplayProbe();

        try {
            probe.child.kill("SIGKILL");
            await waitUntil(() =>
                probe.processes.every((entry) => !isRunning(entry.pid)) && !existsSync(probe.runtimeDir),
            );
            expect(probe.processes.some((entry) => entry.args[0]?.endsWith("/sway") === true)).toBe(true);
            expect(probe.processes.some((entry) => entry.args[0]?.endsWith("/dbus-daemon") === true)).toBe(true);
            expect(existsSync(probe.runtimeDir)).toBe(false);
        } finally {
            stopProbe(probe);
        }
    });

    it("reaps only an explicitly selected legacy display", async () => {
        const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-xdg-"));
        chmodSync(runtimeDir, 0o700);
        writeFileSync(join(runtimeDir, "sway.conf"), legacyConfig("731x487"));
        writeFileSync(join(runtimeDir, "session.conf"), legacyBusConfig(runtimeDir));
        let probe: LegacyProbe | undefined;

        try {
            probe = await startLegacyProbe(runtimeDir);
            const { swayPid, busPid } = probe;
            const candidate = await findLegacyProbe(swayPid);
            using project = createCliProject({ prefix: "gtkx-headless-cleanup-" });
            runCliOrThrow(project, ["cleanup", "--pid", String(candidate.pid), "--dry-run"]);
            expect(isRunning(swayPid)).toBe(true);
            expect(isRunning(busPid)).toBe(true);
            runCliOrThrow(project, ["cleanup", "--pid", String(candidate.pid)]);
            await waitUntil(() => !isRunning(candidate.pid) && !isRunning(busPid));
            expect(existsSync(runtimeDir)).toBe(false);
        } finally {
            if (probe !== undefined) {
                killOwnedProcessGroups([probe.swayGroup, probe.busGroup]);
            }

            rmSync(runtimeDir, { recursive: true, force: true });
        }
    });

    it("keeps a replacement directory while reaping a captured legacy display", async () => {
        const runtimeDir = mkdtempSync(join(tmpdir(), "gtkx-xdg-"));
        const originalDir = `${runtimeDir}-original`;
        chmodSync(runtimeDir, 0o700);
        writeFileSync(join(runtimeDir, "sway.conf"), legacyConfig("731x487"));
        writeFileSync(join(runtimeDir, "session.conf"), legacyBusConfig(runtimeDir));
        let probe: LegacyProbe | undefined;

        try {
            const startedProbe = await startLegacyProbe(runtimeDir);
            probe = startedProbe;
            const candidate = await findLegacyProbe(startedProbe.swayPid);
            renameSync(runtimeDir, originalDir);
            mkdirSync(runtimeDir, { mode: 0o700 });
            writeFileSync(join(runtimeDir, "sway.conf"), legacyConfig("731x487"));
            writeFileSync(join(runtimeDir, "session.conf"), legacyBusConfig(runtimeDir));
            writeFileSync(join(runtimeDir, "keep.txt"), "keep");

            reapLegacyHeadlessDisplays([candidate]);
            await waitUntil(() => !isRunning(startedProbe.swayPid) && !isRunning(startedProbe.busPid));
            expect(readFileSync(join(runtimeDir, "keep.txt"), "utf8")).toBe("keep");
        } finally {
            if (probe !== undefined) {
                killOwnedProcessGroups([probe.swayGroup, probe.busGroup]);
            }

            rmSync(runtimeDir, { recursive: true, force: true });
            rmSync(originalDir, { recursive: true, force: true });
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
            expect(decoy.pid === undefined ? false : isRunning(decoy.pid)).toBe(true);
        } finally {
            guarded.kill("SIGKILL");
            decoy.kill("SIGKILL");
        }
    });

    it("throws after rolling back a spawn with an unidentified cleanup directory", () => {
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

    it("rejects an invalid cleanup process ID", () => {
        using project = createCliProject({ prefix: "gtkx-headless-cleanup-error-" });

        expect(() => runCliOrThrow(project, ["cleanup", "--pid", "not-a-pid"])).toThrow();
    });
});
