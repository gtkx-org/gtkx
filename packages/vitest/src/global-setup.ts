import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

const getBaseDisplay = (): number => {
    const pid = process.pid;
    const slot = pid % 500;
    return 50 + slot * 10;
};

interface XvfbState {
    displays: number[];
    pids: number[];
}

const xvfbProcesses: ChildProcess[] = [];
let currentStateDir: string | null = null;

const waitForDisplay = (display: number, timeout = 5000): Promise<boolean> => {
    return new Promise((resolve) => {
        const start = Date.now();

        const check = () => {
            const lockFile = `/tmp/.X${display}-lock`;
            if (existsSync(lockFile)) {
                resolve(true);
                return;
            }

            if (Date.now() - start > timeout) {
                resolve(false);
                return;
            }

            setTimeout(check, 50);
        };

        check();
    });
};

const startXvfb = async (display: number): Promise<ChildProcess | null> => {
    const xvfb = spawn("Xvfb", [`:${display}`, "-screen", "0", "1024x768x24"], {
        stdio: "ignore",
        detached: true,
    });

    xvfb.unref();

    const ready = await waitForDisplay(display);

    if (!ready) {
        xvfb.kill();
        return null;
    }

    return xvfb;
};

export const setup = async (project: TestProject): Promise<void> => {
    const config = project.config;

    const maxWorkers =
        typeof config.maxWorkers === "number"
            ? config.maxWorkers
            : typeof config.maxWorkers === "string"
              ? Number.parseInt(config.maxWorkers, 10)
              : 4;

    const stateDir = process.env.GTKX_STATE_DIR;

    if (!stateDir) {
        throw new Error("Expected GTKX_STATE_DIR environment variable to be set");
    }

    currentStateDir = stateDir;

    if (existsSync(stateDir)) {
        rmSync(stateDir, { recursive: true, force: true });
    }

    mkdirSync(stateDir, { recursive: true });

    const baseDisplay = getBaseDisplay();
    const displays: number[] = [];
    const pids: number[] = [];

    for (let i = 0; i < maxWorkers; i++) {
        const display = baseDisplay + i;
        const xvfb = await startXvfb(display);

        if (xvfb) {
            xvfbProcesses.push(xvfb);
            displays.push(display);
            pids.push(xvfb.pid ?? 0);
        }
    }

    if (displays.length === 0) {
        throw new Error("Failed to start any Xvfb instances");
    }

    const state: XvfbState = { displays, pids };

    writeFileSync(join(stateDir, "state.json"), JSON.stringify(state));

    for (const display of displays) {
        writeFileSync(join(stateDir, `display-${display}.available`), "");
    }
};

const waitForProcessExit = (proc: ChildProcess, timeout = 1000): Promise<void> => {
    return new Promise((resolve) => {
        if (proc.exitCode !== null) {
            resolve();
            return;
        }

        const timer = setTimeout(resolve, timeout);

        proc.once("exit", () => {
            clearTimeout(timer);
            resolve();
        });

        proc.kill("SIGTERM");
    });
};

export const teardown = async (): Promise<void> => {
    await Promise.all(xvfbProcesses.map((xvfb) => waitForProcessExit(xvfb)));

    if (currentStateDir && existsSync(currentStateDir)) {
        rmSync(currentStateDir, { recursive: true, force: true });
    }
};
