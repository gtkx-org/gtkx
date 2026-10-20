import { isProcessAlive, type ProcessIdentity, readProcessIdentity, resolveExecutable } from "@gtkx/utils";
import { type ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
    existsSync,
    mkdirSync,
    mkdtempDisposableSync,
    readFileSync,
    renameSync,
    rmSync,
    utimesSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { findStaleHeadlessDisplays, reapStaleHeadlessDisplays } from "../src/headless.js";

type DisplayOwner = {
    child: ChildProcess;
    runtimeDir: string;
    helpers: ProcessIdentity[];
};

const startOwner = async (env?: NodeJS.ProcessEnv): Promise<DisplayOwner> => {
    const entry = new URL("../dist/headless.js", import.meta.url).href;
    const script = `
        import { readFileSync } from "node:fs";
        import { startHeadlessDisplay, resolveHeadlessOptions } from ${JSON.stringify(entry)};
        const stop = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        process.on("exit", stop);
        process.on("message", () => { stop(); process.exit(0); });
        const children = readFileSync(
            "/proc/" + process.pid + "/task/" + process.pid + "/children", "utf8"
        ).trim().split(/\\s+/).map(Number);
        process.send({ runtimeDir: process.env.XDG_RUNTIME_DIR, children });
    `;
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
        stdio: ["ignore", "ignore", "pipe", "ipc"],
        ...(env && { env: { ...process.env, ...env } }),
    });
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
    });
    const report = await new Promise<{ runtimeDir: string; children: number[] }>((resolve, reject) => {
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error(`Headless owner did not become ready: ${stderr}`));
        }, 20_000);
        child.once("message", (message) => {
            clearTimeout(timer);
            if (
                typeof message !== "object" ||
                message === null ||
                !("runtimeDir" in message) ||
                typeof message.runtimeDir !== "string" ||
                !("children" in message) ||
                !Array.isArray(message.children) ||
                !message.children.every((pid) => typeof pid === "number")
            ) {
                child.kill("SIGKILL");
                reject(new Error("Invalid headless startup report"));
                return;
            }
            resolve({ runtimeDir: message.runtimeDir, children: message.children });
        });
        child.once("error", (error) => {
            clearTimeout(timer);
            child.kill("SIGKILL");
            reject(error);
        });
        child.once("exit", () => {
            clearTimeout(timer);
            reject(new Error(`Headless owner exited before startup: ${stderr}`));
        });
    });
    const helpers = report.children.flatMap((pid) => {
        const identity = readProcessIdentity(pid);
        return identity === undefined ? [] : [identity];
    });
    return { child, runtimeDir: report.runtimeDir, helpers };
};

const killOwner = async ({ child }: DisplayOwner): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
};

const removeDisplay = async (display: DisplayOwner): Promise<void> => {
    if (display.child.exitCode === null && display.child.signalCode === null) {
        const exited = once(display.child, "exit");
        display.child.send("stop");
        await exited;
    }
    for (const helper of display.helpers) {
        if (readProcessIdentity(helper.pid)?.startTime === helper.startTime) {
            try {
                process.kill(helper.pid, "SIGKILL");
            } catch {
                continue;
            }
        }
    }
    rmSync(display.runtimeDir, { recursive: true, force: true });
};

const ageRuntime = (runtimeDir: string): void => {
    const earlier = new Date(Date.now() - 10_000);
    utimesSync(runtimeDir, earlier, earlier);
};

const writeCompositorWithDescendant = (directory: string): void => {
    const descendant = `import ctypes, json, os, signal
assert ctypes.CDLL(None).prctl(4, 0, 0, 0, 0) == 0
signal.signal(signal.SIGTERM, signal.SIG_IGN)
with open(os.environ["GTKX_DESCENDANT_REPORT"], "w") as report:
    json.dump({"pid": os.getpid(), "leader": os.getsid(0)}, report)
signal.pause()
`;
    writeFileSync(
        join(directory, "sway"),
        `#!/usr/bin/env python3
import os, subprocess, sys
subprocess.Popen([sys.executable, "-c", ${JSON.stringify(descendant)}])
os.execv(${JSON.stringify(resolveExecutable("sway"))}, ["sway", *sys.argv[1:]])
`,
        { mode: 0o755 },
    );
};

const withUnreadableDescendant = async (
    run: (display: DisplayOwner, descendant: ProcessIdentity, leader: ProcessIdentity) => Promise<void>,
): Promise<void> => {
    using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-headless-descendant-"));
    writeCompositorWithDescendant(directory.path);
    const reportPath = join(directory.path, "descendant.json");
    const display = await startOwner({
        PATH: `${directory.path}:${process.env.PATH ?? ""}`,
        GTKX_DESCENDANT_REPORT: reportPath,
    });
    let descendant: ProcessIdentity | undefined;
    try {
        await expect.poll(() => existsSync(reportPath)).toBe(true);
        const report: unknown = JSON.parse(readFileSync(reportPath, "utf8"));
        if (
            typeof report !== "object" ||
            report === null ||
            !("pid" in report) ||
            typeof report.pid !== "number" ||
            !("leader" in report) ||
            typeof report.leader !== "number"
        ) {
            throw new Error("Invalid descendant startup report");
        }
        descendant = readProcessIdentity(report.pid);
        const leader = display.helpers.find((helper) => helper.pid === report.leader);
        if (descendant === undefined || leader === undefined)
            throw new Error("Missing compositor descendant or leader");
        await run(display, descendant, leader);
    } finally {
        if (descendant !== undefined && readProcessIdentity(descendant.pid)?.startTime === descendant.startTime) {
            process.kill(descendant.pid, "SIGKILL");
        }
        await removeDisplay(display);
    }
};

it("stops an unreadable descendant that ignores termination after its compositor exits", async () => {
    await withUnreadableDescendant(async (display, descendant) => {
        const exited = once(display.child, "exit");
        display.child.send("stop");
        await exited;
        expect(isProcessAlive(descendant.pid)).toBe(false);
        expect(existsSync(display.runtimeDir)).toBe(false);
    });
});

it("recovers an unreadable descendant after its display owner is killed", async () => {
    await withUnreadableDescendant(async (display, descendant) => {
        await killOwner(display);
        ageRuntime(display.runtimeDir);
        const candidates = findStaleHeadlessDisplays().filter((entry) => entry.runtimeDir === display.runtimeDir);
        expect(candidates).toHaveLength(1);
        expect(reapStaleHeadlessDisplays(candidates)).toEqual([display.runtimeDir]);
        expect(isProcessAlive(descendant.pid)).toBe(false);
        expect(existsSync(display.runtimeDir)).toBe(false);
    });
});

it("preserves an unreadable descendant's recovery metadata when its compositor leader is gone", async () => {
    await withUnreadableDescendant(async (display, descendant, leader) => {
        process.kill(leader.pid, "SIGKILL");
        await expect.poll(() => isProcessAlive(leader.pid)).toBe(false);
        await killOwner(display);
        ageRuntime(display.runtimeDir);
        const candidates = findStaleHeadlessDisplays().filter((entry) => entry.runtimeDir === display.runtimeDir);
        expect(candidates).toHaveLength(1);
        expect(reapStaleHeadlessDisplays(candidates)).toEqual([]);
        expect(isProcessAlive(descendant.pid)).toBe(true);
        expect(existsSync(join(display.runtimeDir, ".gtkx-headless-runtime"))).toBe(true);
        process.kill(descendant.pid, "SIGKILL");
        await expect.poll(() => isProcessAlive(descendant.pid)).toBe(false);
        expect(reapStaleHeadlessDisplays(candidates)).toEqual([display.runtimeDir]);
        expect(existsSync(display.runtimeDir)).toBe(false);
    });
});

it.each([
    { mode: 0o755, operation: "scan" },
    { mode: 0o700, operation: "scan" },
    { mode: 0o755, operation: "reap" },
    { mode: 0o700, operation: "reap" },
])("ignores a FIFO runtime marker during $operation with directory mode $mode", ({ mode, operation }) => {
    using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-recovery-scan-"));
    const runtimeDir = join(directory.path, "gtkx-xdg-AbCd12");
    mkdirSync(runtimeDir, { mode });
    const marker = join(runtimeDir, ".gtkx-headless-runtime");
    execFileSync(resolveExecutable("mkfifo"), ["-m", "600", marker]);
    ageRuntime(runtimeDir);
    const entry = new URL("../dist/headless.js", import.meta.url).href;
    const script = `
        import { cleanupDirectoryIdentity } from "@gtkx/utils";
        import { findStaleHeadlessDisplays, reapStaleHeadlessDisplays } from ${JSON.stringify(entry)};
        const runtimeDir = ${JSON.stringify(runtimeDir)};
        const cleanupDirectory = cleanupDirectoryIdentity(runtimeDir);
        if (cleanupDirectory === undefined) throw new Error("Missing runtime directory");
        const result = ${JSON.stringify(operation)} === "scan"
            ? findStaleHeadlessDisplays()
            : reapStaleHeadlessDisplays([{ runtimeDir, cleanupDirectory }]);
        process.stdout.write(JSON.stringify(result));
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
        env: { ...process.env, TMPDIR: directory.path },
        encoding: "utf8",
        timeout: 5000,
        killSignal: "SIGKILL",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("[]");
    expect(existsSync(marker)).toBe(true);
});

it.each(["intact", "damaged"])(
    "recovers a killed owner's helpers and %s runtime while preserving an active display",
    async (state) => {
        const abandoned = await startOwner();
        let active: DisplayOwner | undefined;
        try {
            active = await startOwner();
            await killOwner(abandoned);
            expect(abandoned.helpers.some((helper) => isProcessAlive(helper.pid))).toBe(true);
            if (state === "damaged") {
                rmSync(join(abandoned.runtimeDir, "session.conf"));
                writeFileSync(join(abandoned.runtimeDir, "sway.conf"), "incomplete");
            }
            ageRuntime(abandoned.runtimeDir);
            ageRuntime(active.runtimeDir);
            const stale = findStaleHeadlessDisplays();
            expect(stale.some((entry) => entry.runtimeDir === active?.runtimeDir)).toBe(false);
            const candidates = stale.filter((entry) => entry.runtimeDir === abandoned.runtimeDir);
            expect(candidates).toHaveLength(1);
            expect(reapStaleHeadlessDisplays(candidates)).toEqual([abandoned.runtimeDir]);
            expect(existsSync(abandoned.runtimeDir)).toBe(false);
            await expect.poll(() => abandoned.helpers.some((helper) => isProcessAlive(helper.pid))).toBe(false);
            expect(existsSync(active.runtimeDir)).toBe(true);
            expect(active.helpers.every((helper) => isProcessAlive(helper.pid))).toBe(true);
        } finally {
            await removeDisplay(abandoned);
            if (active !== undefined) await removeDisplay(active);
        }
    },
);

it.each(["missing", "corrupt"])("stops owned helpers and descendants with a %s runtime marker", async (markerState) => {
    await withUnreadableDescendant(async (display, descendant) => {
        const marker = join(display.runtimeDir, ".gtkx-headless-runtime");
        if (markerState === "missing") rmSync(marker);
        else writeFileSync(marker, "incomplete");
        const exited = once(display.child, "exit");
        display.child.send("stop");
        await exited;
        expect(display.helpers.some((helper) => isProcessAlive(helper.pid))).toBe(false);
        expect(isProcessAlive(descendant.pid)).toBe(false);
        expect(existsSync(display.runtimeDir)).toBe(false);
    });
});

it.each(["missing", "corrupt"])("restores a %s marker when a helper leader is already gone", async (markerState) => {
    await withUnreadableDescendant(async (display, descendant, leader) => {
        process.kill(leader.pid, "SIGKILL");
        await expect.poll(() => isProcessAlive(leader.pid)).toBe(false);
        const marker = join(display.runtimeDir, ".gtkx-headless-runtime");
        if (markerState === "missing") rmSync(marker);
        else writeFileSync(marker, "incomplete");
        const exited = once(display.child, "exit");
        display.child.send("stop");
        await exited;
        expect(isProcessAlive(descendant.pid)).toBe(true);
        ageRuntime(display.runtimeDir);
        const candidates = findStaleHeadlessDisplays().filter((entry) => entry.runtimeDir === display.runtimeDir);
        expect(candidates).toHaveLength(1);
        expect(reapStaleHeadlessDisplays(candidates)).toEqual([]);
        expect(existsSync(marker)).toBe(true);
        process.kill(descendant.pid, "SIGKILL");
        await expect.poll(() => isProcessAlive(descendant.pid)).toBe(false);
        expect(reapStaleHeadlessDisplays(candidates)).toEqual([display.runtimeDir]);
    });
});

it("stops owned helpers without adopting a replacement runtime directory or its processes", async () => {
    await withUnreadableDescendant(async (display, descendant) => {
        using directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-headless-replacement-"));
        renameSync(display.runtimeDir, join(directory.path, "original-runtime"));
        mkdirSync(display.runtimeDir, { mode: 0o700 });
        const sentinel = join(display.runtimeDir, "unrelated");
        writeFileSync(sentinel, "preserve");
        const unrelated = spawn(process.execPath, ["--eval", 'process.send("ready"); setInterval(() => {}, 1000);'], {
            stdio: ["ignore", "ignore", "ignore", "ipc"],
            env: { ...process.env, XDG_RUNTIME_DIR: display.runtimeDir, GTKX_HEADLESS_RUNTIME: display.runtimeDir },
        });
        try {
            await once(unrelated, "message");
            const exited = once(display.child, "exit");
            display.child.send("stop");
            await exited;
            expect(display.helpers.some((helper) => isProcessAlive(helper.pid))).toBe(false);
            expect(isProcessAlive(descendant.pid)).toBe(false);
            expect(isProcessAlive(unrelated.pid)).toBe(true);
            expect(readFileSync(sentinel, "utf8")).toBe("preserve");
        } finally {
            if (unrelated.exitCode === null && unrelated.signalCode === null) {
                const exited = once(unrelated, "exit");
                unrelated.kill("SIGKILL");
                await exited;
            }
        }
    });
});

it("preserves running helpers when their runtime ownership marker is corrupt", async () => {
    const display = await startOwner();
    try {
        await killOwner(display);
        writeFileSync(join(display.runtimeDir, ".gtkx-headless-runtime"), "incomplete");
        ageRuntime(display.runtimeDir);
        expect(findStaleHeadlessDisplays().some((entry) => entry.runtimeDir === display.runtimeDir)).toBe(false);
        expect(display.helpers.some((helper) => isProcessAlive(helper.pid))).toBe(true);
        expect(existsSync(display.runtimeDir)).toBe(true);
    } finally {
        await removeDisplay(display);
    }
});

it("retains recovery metadata while an unrecorded helper has an unreadable environment", async () => {
    const display = await startOwner();
    const helper = spawn(
        resolveExecutable("python3"),
        [
            "-c",
            'import ctypes, signal; assert ctypes.CDLL(None).prctl(4, 0, 0, 0, 0) == 0; print("ready", flush=True); signal.pause()',
            `--config-file=${join(display.runtimeDir, "session.conf")}`,
        ],
        {
            stdio: ["ignore", "pipe", "inherit"],
            env: { ...process.env, XDG_RUNTIME_DIR: display.runtimeDir, GTKX_HEADLESS_RUNTIME: display.runtimeDir },
        },
    );
    try {
        if (helper.stdout === null) throw new Error("Missing helper readiness stream");
        await Promise.race([
            once(helper.stdout, "data"),
            once(helper, "exit").then(() => {
                throw new Error("The helper exited before becoming ready");
            }),
        ]);
        await killOwner(display);
        ageRuntime(display.runtimeDir);
        const candidates = findStaleHeadlessDisplays().filter((entry) => entry.runtimeDir === display.runtimeDir);
        expect(candidates).toHaveLength(1);
        expect(reapStaleHeadlessDisplays(candidates)).toEqual([]);
        expect(isProcessAlive(helper.pid)).toBe(true);
        expect(existsSync(join(display.runtimeDir, ".gtkx-headless-runtime"))).toBe(true);
        const exited = once(helper, "exit");
        helper.kill("SIGKILL");
        await exited;
        expect(reapStaleHeadlessDisplays(candidates)).toEqual([display.runtimeDir]);
    } finally {
        helper.kill("SIGKILL");
        await removeDisplay(display);
    }
});
