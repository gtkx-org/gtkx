import { isProcessAlive, type ProcessIdentity, readProcessIdentity } from "@gtkx/utils";
import { resolveHeadlessOptions, startHeadlessDisplay } from "@gtkx/vitest/headless";
import { type ChildProcess, fork, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProject, linkWorkspaceBindings } from "./project.js";

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

    it("reports a shutdown only when stopped, not when restarting for a configuration change", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        const launchesPath = join(project.root, "launches.txt");
        project.write(
            "src/index.ts",
            `import { appendFileSync, writeFileSync } from "node:fs";
            appendFileSync(${JSON.stringify(launchesPath)}, "x");
            writeFileSync(${JSON.stringify(readyPath)}, String(process.pid));`,
        );
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            const running = observeChild(
                spawn(process.execPath, [cliPath, "dev", "--cwd", project.root], { stdio: "pipe" }),
            );
            try {
                await running.waitForFile(readyPath);
                project.write("gtkx.config.ts", `${readFileSync(join(project.root, "gtkx.config.ts"), "utf8")}\n`);
                await expect.poll(() => readFileSync(launchesPath, "utf8"), { timeout: 30_000 }).toBe("xx");
                expect(running.output()).toContain("Restarting dev runner");
                expect(running.output()).not.toContain("Received shutdown signal");
                expect(running.child.kill("SIGTERM")).toBe(true);
                expect(await running.waitForExit()).toEqual({ code: 0, signal: null });
                expect(running.output().match(/Received shutdown signal/g)).toHaveLength(1);
            } finally {
                await running.stop(undefined);
            }
        } finally {
            stopDisplay();
        }
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

    it("restarts without a module error when a file changes while the entry is still loading", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        const launchesPath = join(project.root, "launches.txt");
        project.write("src/later.ts", 'export const later = "loaded";');
        project.write(
            "src/index.ts",
            `import { appendFileSync, writeFileSync } from "node:fs";
            appendFileSync(${JSON.stringify(launchesPath)}, "x");
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
                project.write("src/later.ts", 'export const later = "edited";');
                await expect.poll(() => readFileSync(launchesPath, "utf8"), { timeout: 30_000 }).toBe("xx");
                expect(running.output()).not.toContain("Error when evaluating");
                expect(running.output()).not.toContain("Application error");
                expect(running.child.kill("SIGTERM")).toBe(true);
                expect(await running.waitForExit()).toEqual({ code: 0, signal: null });
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

    it("names the pending timer that outlives the application before stopping", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        linkWorkspaceBindings(project.root);
        project.write(
            "src/index.tsx",
            `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot, quit } from "@gtkx/react";
            import { writeFileSync } from "node:fs";
            import { useEffect } from "react";
            setInterval(() => undefined, 60_000);
            const QuitWhenShown = () => {
                useEffect(() => {
                    writeFileSync(${JSON.stringify(readyPath)}, String(process.pid));
                    setTimeout(quit, 0);
                }, []);
                return null;
            };
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example">
                    <AdwApplicationWindow><QuitWhenShown /></AdwApplicationWindow>
                </AdwApplication>
            );`,
        );
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            const running = observeChild(
                spawn(process.execPath, [cliPath, "dev", "--cwd", project.root], { stdio: "pipe" }),
            );
            try {
                await running.waitForFile(readyPath);
                expect(await running.waitForExit()).toEqual({ code: 0, signal: null });
                expect(running.output()).toContain("Timeout");
            } finally {
                await running.stop(undefined);
            }
        } finally {
            stopDisplay();
        }
    });

    it("stops with status 1 when another process already owns the application ID", async () => {
        using project = createProject();
        const readyPath = join(project.root, "ready.txt");
        linkWorkspaceBindings(project.root);
        project.write(
            "src/index.tsx",
            `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot } from "@gtkx/react";
            import { writeFileSync } from "node:fs";
            import { useEffect } from "react";
            const MarkShown = () => {
                useEffect(() => {
                    writeFileSync(${JSON.stringify(readyPath)}, String(process.pid));
                }, []);
                return null;
            };
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example">
                    <AdwApplicationWindow><MarkShown /></AdwApplicationWindow>
                </AdwApplication>
            );`,
        );
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            const primary = observeChild(
                spawn(process.execPath, [cliPath, "dev", "--cwd", project.root], { stdio: "pipe" }),
            );
            try {
                await primary.waitForFile(readyPath);
                const second = observeChild(
                    spawn(process.execPath, [cliPath, "dev", "--cwd", project.root], { stdio: "pipe" }),
                );
                try {
                    expect(await second.waitForExit()).toEqual({ code: 1, signal: null });
                    expect(second.output()).not.toContain("Entry did not mount an application");
                } finally {
                    await second.stop(undefined);
                }
            } finally {
                await primary.stop(undefined);
            }
        } finally {
            stopDisplay();
        }
    });

    it("does not blame the command line when the application cannot register its ID", async () => {
        using project = createProject();
        const ownedPath = join(project.root, "owned.txt");
        linkWorkspaceBindings(project.root);
        project.write(
            "owner.mjs",
            `import * as Gio from "@gtkx/gi/gio";
            import * as GLib from "@gtkx/gi/glib";
            import { writeFileSync } from "node:fs";
            const connection = Gio.busGetSync(Gio.BusType.SESSION, null);
            connection.callSync("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "RequestName",
                new GLib.Variant("(su)", ["org.gtkx.example", 4]), null, Gio.DBusCallFlags.NONE, -1, null);
            writeFileSync(${JSON.stringify(ownedPath)}, String(process.pid));
            setInterval(() => connection.getUniqueName(), 60_000);`,
        );
        project.write(
            "src/index.tsx",
            `import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
            import { createRoot } from "@gtkx/react";
            createRoot().render(
                <AdwApplication applicationId="org.gtkx.example">
                    <AdwApplicationWindow />
                </AdwApplication>
            );`,
        );
        const stopDisplay = await startHeadlessDisplay(resolveHeadlessOptions({ size: "640x480" }));
        try {
            const owner = observeChild(
                spawn(process.execPath, [join(project.root, "owner.mjs")], { cwd: project.root, stdio: "pipe" }),
            );
            try {
                await owner.waitForFile(ownedPath);
                const running = observeChild(
                    spawn(process.execPath, [cliPath, "dev", "--cwd", project.root], { stdio: "pipe" }),
                );
                try {
                    expect(await running.waitForExit()).toEqual({ code: 1, signal: null });
                    expect(running.output()).toContain("Failed to register");
                    expect(running.output()).toContain("could not register its ID");
                    expect(running.output()).not.toContain("refused its command line");
                } finally {
                    await running.stop(undefined);
                }
            } finally {
                await owner.stop(undefined);
            }
        } finally {
            stopDisplay();
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
