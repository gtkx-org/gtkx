import { isProcessAlive, type ProcessIdentity, readProcessIdentity } from "@gtkx/utils";
import { resolveHeadlessOptions, startHeadlessDisplay } from "@gtkx/vitest/headless";
import { type ChildProcess, fork, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProject } from "./project.js";

type Exit = { code: number | null; signal: NodeJS.Signals | null };

const cliPath = fileURLToPath(new URL("../bin/gtkx.js", import.meta.url));
const runnerPath = fileURLToPath(new URL("../bin/gtkx-dev-runner.js", import.meta.url));

const observeChild = (child: ChildProcess) => {
    let output = "";
    const capture = (chunk: Buffer) => {
        output += chunk.toString();
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    const exited = new Promise<Exit>((resolve, reject) => {
        child.once("exit", (code, signal) => resolve({ code, signal }));
        child.once("error", reject);
    });
    const waitForExit = async (): Promise<Exit> => {
        let timeout: NodeJS.Timeout | undefined;
        try {
            return await Promise.race([
                exited,
                new Promise<never>((_resolve, reject) => {
                    timeout = setTimeout(() => reject(new Error(`Child did not exit:\n${output}`)), 10_000);
                }),
            ]);
        } finally {
            clearTimeout(timeout);
        }
    };
    const waitForFile = async (path: string): Promise<void> => {
        await Promise.race([
            expect.poll(() => existsSync(path), { timeout: 30_000 }).toBe(true),
            exited.then((exit) => {
                throw new Error(`Child exited before loading the application (${JSON.stringify(exit)}):\n${output}`);
            }),
        ]);
    };
    const stop = async (runner: ProcessIdentity | undefined): Promise<void> => {
        child.kill("SIGTERM");
        const timeout = setTimeout(() => {
            child.kill("SIGKILL");
            if (runner !== undefined && readProcessIdentity(runner.pid)?.startTime === runner.startTime) {
                process.kill(runner.pid, "SIGKILL");
            }
        }, 5000);
        try {
            await waitForExit();
        } finally {
            clearTimeout(timeout);
            if (runner !== undefined && readProcessIdentity(runner.pid)?.startTime === runner.startTime) {
                process.kill(runner.pid, "SIGKILL");
            }
        }
    };
    return { child, output: () => output, waitForExit, waitForFile, stop };
};

const withDevProcess = async (
    start: (root: string) => ChildProcess,
    stop: (child: ChildProcess) => void,
): Promise<void> => {
    using project = createProject();
    const readyPath = join(project.root, "ready.txt");
    const cleanupPath = join(project.root, "cleanup.txt");
    project.write(
        "src/index.ts",
        `import { onExit } from "@gtkx/runtime";
        import { writeFileSync } from "node:fs";
        onExit(() => writeFileSync(${JSON.stringify(cleanupPath)}, String(process.pid)));
        writeFileSync(${JSON.stringify(readyPath)}, String(process.pid));`,
    );
    const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
    try {
        let runner: ProcessIdentity | undefined;
        const running = observeChild(start(project.root));
        try {
            await running.waitForFile(readyPath);
            const runnerPid = Number(readFileSync(readyPath, "utf8"));
            runner = readProcessIdentity(runnerPid);
            expect(runner).toBeDefined();
            stop(running.child);
            expect(await running.waitForExit()).toEqual({ code: 0, signal: null });
            expect(readFileSync(cleanupPath, "utf8")).toBe(String(runnerPid));
            expect(isProcessAlive(runnerPid)).toBe(false);
        } finally {
            await running.stop(runner);
        }
    } finally {
        stopDisplay();
    }
};

describe("development process shutdown", () => {
    it.each(["SIGTERM", "SIGINT"] as const)("forwards %s and waits for application cleanup", async (signal) => {
        await withDevProcess(
            (root) => spawn(process.execPath, [cliPath, "dev", "--cwd", root], { stdio: "pipe" }),
            (child) => {
                expect(child.kill(signal)).toBe(true);
            },
        );
    });

    it("stops without a module error when interrupted while the entry is still loading", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        project.write("src/later.ts", 'export const later = "loaded";');
        project.write(
            "src/index.ts",
            `import { writeFileSync } from "node:fs";
            writeFileSync(${JSON.stringify(readyPath)}, String(process.pid));
            for (let round = 0; ; round++) {
                const specifier = "./later.js?round=" + String(round);
                await import(/* @vite-ignore */ specifier);
            }`,
        );
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            const running = observeChild(
                spawn(process.execPath, [cliPath, "dev", "--cwd", project.root], { stdio: "pipe" }),
            );
            try {
                await running.waitForFile(readyPath);
                expect(running.child.kill("SIGINT")).toBe(true);
                expect(await running.waitForExit()).toEqual({ code: 0, signal: null });
                expect(running.output()).not.toContain("Error when evaluating");
            } finally {
                await running.stop(undefined);
            }
        } finally {
            stopDisplay();
        }
    });

    it("keeps the session bus available during cleanup after a terminal interrupt", async () => {
        using project = createProject({ codegen: true, libraries: ["Gio-2.0"] });
        const readyPath = join(project.root, "ready.txt");
        const cleanupPath = join(project.root, "cleanup.txt");
        project.write(
            "src/index.ts",
            `import { BusType, DBusCallFlags, busGetSync } from "@gtkx/gi/gio";
            import { onExit } from "@gtkx/runtime";
            import { writeFileSync } from "node:fs";
            const bus = busGetSync(BusType.SESSION, null);
            bus.setExitOnClose(false);
            onExit(() => {
                bus.callSync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetId", null, null, DBusCallFlags.NONE, 1000, null);
                writeFileSync(${JSON.stringify(cleanupPath)}, "bus available");
            });
            writeFileSync(${JSON.stringify(readyPath)}, String(process.pid));`,
        );
        const running = observeChild(
            spawn(process.execPath, [cliPath, "dev", "--cwd", project.root, "--headless", "--size", "640x480"], {
                stdio: "pipe",
                detached: true,
            }),
        );
        let runner: ProcessIdentity | undefined;
        try {
            await running.waitForFile(readyPath);
            const runnerPid = Number(readFileSync(readyPath, "utf8"));
            runner = readProcessIdentity(runnerPid);
            const supervisorPid = running.child.pid;
            if (supervisorPid === undefined) {
                throw new Error("The dev supervisor did not start");
            }
            process.kill(-supervisorPid, "SIGINT");
            expect(await running.waitForExit()).toEqual({ code: 0, signal: null });
            expect(readFileSync(cleanupPath, "utf8")).toBe("bus available");
            expect(isProcessAlive(runnerPid)).toBe(false);
        } finally {
            await running.stop(runner);
        }
    });

    it("cleans up the application when the runner's IPC connection closes", async () => {
        await withDevProcess(
            (root) => {
                const child = fork(runnerPath, [], { cwd: root, silent: true, execArgv: [] });
                child.once("message", () => {
                    child.send({ entryPath: "src/index.ts", configFile: "gtkx.config.ts" });
                });
                return child;
            },
            (child) => {
                expect(child.connected).toBe(true);
                child.disconnect();
            },
        );
    });
});
