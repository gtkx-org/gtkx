import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import type { Plugin } from "vitest/config";
import type { Reporter, TestSpecification, Vitest } from "vitest/node";

const getStateDir = (): string => join(tmpdir(), `gtkx-vitest-${process.pid}`);

const getBaseDisplay = (): number => {
    const slot = process.pid % 500;
    return 50 + slot * 10;
};

const waitForDisplay = (display: number, timeout = 5000): Promise<boolean> =>
    new Promise((resolve) => {
        const start = Date.now();

        const check = (): void => {
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

const gtkx = (): Plugin => {
    const workerSetupPath = join(import.meta.dirname, "setup.js");
    const stateDir = getStateDir();

    const xvfbProcesses: ChildProcess[] = [];
    let handlersRegistered = false;
    let tornDown = false;

    const setup = async (vitest: Vitest): Promise<void> => {
        const configuredWorkers = vitest.config.maxWorkers;
        const maxWorkers = typeof configuredWorkers === "number" ? configuredWorkers : availableParallelism();

        if (existsSync(stateDir)) {
            rmSync(stateDir, { recursive: true, force: true });
        }

        mkdirSync(stateDir, { recursive: true });

        const baseDisplay = getBaseDisplay();
        const displays: number[] = [];
        const results = await Promise.all(Array.from({ length: maxWorkers }, (_, i) => startXvfb(baseDisplay + i)));

        for (let i = 0; i < results.length; i++) {
            const xvfb = results[i];

            if (xvfb) {
                xvfbProcesses.push(xvfb);
                displays.push(baseDisplay + i);
            }
        }

        if (displays.length === 0) {
            throw new Error("Failed to start any Xvfb instances");
        }

        for (const display of displays) {
            writeFileSync(join(stateDir, `display-${display}.available`), "");
        }
    };

    const teardown = (): void => {
        if (tornDown) {
            return;
        }

        tornDown = true;

        for (const xvfb of xvfbProcesses) {
            try {
                xvfb.kill("SIGTERM");
            } catch {}
        }

        if (existsSync(stateDir)) {
            rmSync(stateDir, { recursive: true, force: true });
        }
    };

    const reporter: Reporter = {
        onInit(): void {
            if (handlersRegistered) {
                return;
            }

            handlersRegistered = true;
            process.on("exit", teardown);
            process.on("SIGTERM", teardown);
            process.on("SIGINT", teardown);
        },
        async onTestRunStart(specifications: readonly TestSpecification[]): Promise<void> {
            const firstSpec = specifications[0];

            if (firstSpec && xvfbProcesses.length === 0) {
                await setup(firstSpec.project.vitest);
            }
        },
        onTestRunEnd(): void {
            teardown();
        },
    };

    return {
        name: "gtkx",
        config(config) {
            const setupFiles = config.test?.setupFiles ?? [];

            process.env.GTKX_STATE_DIR = stateDir;

            return {
                test: {
                    setupFiles: [workerSetupPath, ...(Array.isArray(setupFiles) ? setupFiles : [setupFiles])],
                    pool: "forks",
                },
            };
        },
        configureVitest({ vitest }) {
            vitest.config.reporters.push(reporter);
        },
    };
};

export default gtkx;
