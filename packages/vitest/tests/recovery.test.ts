import { isProcessAlive, type ProcessIdentity, readProcessIdentity, resolveExecutable } from "@gtkx/utils";
import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { type CompositorId, findStaleHeadlessDisplays, reapStaleHeadlessDisplays } from "../src/headless.js";

type DisplayOwner = {
    child: ChildProcess;
    runtimeDir: string;
    helpers: ProcessIdentity[];
};

const startOwner = async (compositor: CompositorId = "sway"): Promise<DisplayOwner> => {
    const entry = new URL("../dist/headless.js", import.meta.url).href;
    const script = `
        import { readFileSync } from "node:fs";
        import { startHeadlessDisplay, resolveHeadlessOptions } from ${JSON.stringify(entry)};
        const stop = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480", compositor: ${JSON.stringify(compositor)} }));
        process.on("exit", stop);
        process.on("message", () => { stop(); process.exit(0); });
        const children = readFileSync(
            "/proc/" + process.pid + "/task/" + process.pid + "/children", "utf8"
        ).trim().split(/\\s+/).map(Number);
        process.send({ runtimeDir: process.env.XDG_RUNTIME_DIR, children });
    `;
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script], {
        stdio: ["ignore", "ignore", "pipe", "ipc"],
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

it.each([
    { compositor: "sway", state: "intact" },
    { compositor: "sway", state: "damaged" },
    { compositor: "weston", state: "intact" },
] satisfies { compositor: CompositorId; state: string }[])(
    "recovers a killed owner's $compositor helpers and $state runtime while preserving an active display",
    async ({ compositor, state }) => {
        const abandoned = await startOwner(compositor);
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
