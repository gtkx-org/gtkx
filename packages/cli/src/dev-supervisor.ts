import { type ChildProcess, fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exitCodeForSignal, installGracefulShutdown } from "@gtkx/utils";
import { RELOAD_EXIT_CODE } from "./dev-protocol.js";

const DEV_RUNNER_URL = new URL("../bin/gtkx-dev-runner.js", import.meta.url);
const FORCE_KILL_TIMEOUT_MS = 5000;

const forwardSignal = (child: ChildProcess, signal: NodeJS.Signals): void => {
    if (!child.killed) {
        child.kill(signal);
    }
};

const forceKillChild = (child: ChildProcess | null): void => {
    if (!child?.pid || child.exitCode !== null || child.killed) return;
    try {
        process.kill(child.pid, "SIGKILL");
    } catch {}
};

/**
 * Supervises the dev-runner child process for the lifetime of `gtkx dev`.
 *
 * Forks `bin/gtkx-dev-runner.js`, forwards `SIGINT`/`SIGTERM`/`SIGHUP` to it,
 * and relaunches the runner whenever it exits with {@link RELOAD_EXIT_CODE}.
 * The returned promise never resolves: control returns only when the runner
 * exits non-reloadably and the supervisor calls `process.exit`.
 *
 * @param entryPath - Absolute path of the user's entry module.
 */
export const runDevSupervisor = async (entryPath: string): Promise<never> => {
    const runnerPath = fileURLToPath(DEV_RUNNER_URL);
    let child: ChildProcess | null = null;
    let shuttingDown = false;
    let capturedChildExit: number | undefined;

    const launch = (): void => {
        child = fork(runnerPath, [entryPath], { stdio: "inherit" });
        child.on("exit", (code, signal) => {
            child = null;
            if (shuttingDown) {
                if (code !== null) {
                    capturedChildExit = code;
                } else if (signal) {
                    capturedChildExit = exitCodeForSignal(signal);
                }
                return;
            }
            if (code === RELOAD_EXIT_CODE) {
                console.log("[gtkx] Restarting dev runner...");
                launch();
                return;
            }
            process.exit(code ?? exitCodeForSignal(signal));
        });
    };

    installGracefulShutdown({
        onSignal: (signal) =>
            new Promise<void>((resolve) => {
                shuttingDown = true;
                if (!child) {
                    resolve();
                    return;
                }
                child.once("exit", () => resolve());
                forwardSignal(child, signal);
            }),
        onForce: () => forceKillChild(child),
        forceKillAfterMs: FORCE_KILL_TIMEOUT_MS,
        exitCode: (signal) => capturedChildExit ?? exitCodeForSignal(signal),
    });

    launch();

    return new Promise<never>(() => {});
};
