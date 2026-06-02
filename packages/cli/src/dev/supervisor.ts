import { type ChildProcess, fork } from "node:child_process";
import { type FSWatcher, watch as watchFs } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exitCodeForSignal, installGracefulShutdown } from "@gtkx/utils";
import { RELOAD_EXIT_CODE } from "./protocol.js";

const DEV_RUNNER_URL = new URL("../../bin/gtkx-dev-runner.js", import.meta.url);
const FORCE_KILL_TIMEOUT_MS = 5000;
const CONFIG_DEBOUNCE_MS = 150;

/**
 * Lets `gtkx dev` regenerate bindings and restart the runner when the project's
 * `gtkx.config.ts` changes — e.g. after editing the `libraries` list.
 */
export type DevWatch = {
    /** Absolute paths whose change triggers a regenerate-and-restart. */
    readonly paths: readonly string[];
    /**
     * Regenerates the bindings for the current configuration. The runner is
     * relaunched only when this resolves; a rejection leaves the running
     * process in place so a broken config never tears down a working app.
     */
    readonly regenerate: () => Promise<void>;
};

/** Mutable state shared by the supervisor's collaborating helpers. */
type SupervisorState = {
    readonly runnerPath: string;
    readonly entryPath: string;
    readonly watch: DevWatch | undefined;
    readonly watchers: FSWatcher[];
    child: ChildProcess | null;
    shuttingDown: boolean;
    restarting: boolean;
    capturedChildExit: number | undefined;
};

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
 * Forks the dev runner and wires its exit handling: relaunch on
 * {@link RELOAD_EXIT_CODE}, stay quiet while a config-driven restart is in
 * flight, capture the code during shutdown, otherwise exit the supervisor.
 */
const launch = (state: SupervisorState): void => {
    const child = fork(state.runnerPath, [state.entryPath], { stdio: "inherit" });
    state.child = child;
    child.on("exit", (code, signal) => {
        state.child = null;
        if (state.restarting) return;
        if (state.shuttingDown) {
            if (code !== null) {
                state.capturedChildExit = code;
            } else if (signal) {
                state.capturedChildExit = exitCodeForSignal(signal);
            }
            return;
        }
        if (code === RELOAD_EXIT_CODE) {
            console.log("[gtkx] Restarting dev runner...");
            launch(state);
            return;
        }
        process.exit(code ?? exitCodeForSignal(signal));
    });
};

/**
 * Regenerates the bindings, then restarts the runner so the new process imports
 * the freshly generated `@gtkx/gi`. A failed regeneration leaves the current
 * runner in place; the restart relaunches once the old child has exited.
 */
const restart = async (state: SupervisorState): Promise<void> => {
    if (state.restarting || state.shuttingDown || state.watch === undefined) return;
    state.restarting = true;
    console.log("[gtkx] gtkx.config.ts changed; regenerating bindings...");
    try {
        await state.watch.regenerate();
    } catch (error) {
        console.error("[gtkx] Codegen failed; keeping the current dev runner. Fix the error and save again.", error);
        state.restarting = false;
        return;
    }
    if (state.shuttingDown) {
        state.restarting = false;
        return;
    }
    const current = state.child;
    if (current === null) {
        state.restarting = false;
        launch(state);
        return;
    }
    current.once("exit", () => {
        state.restarting = false;
        if (!state.shuttingDown) {
            console.log("[gtkx] Restarting dev runner...");
            launch(state);
        }
    });
    forwardSignal(current, "SIGTERM");
};

/**
 * Watches each {@link DevWatch} path's directory and schedules a debounced
 * restart when a watched file changes. Watching the directory (and filtering by
 * filename) survives the write-then-rename atomic saves many editors perform.
 */
const installConfigWatchers = (state: SupervisorState): void => {
    const watch = state.watch;
    if (watch === undefined || watch.paths.length === 0) return;
    let timer: NodeJS.Timeout | null = null;
    const namesByDirectory = new Map<string, Set<string>>();
    for (const path of watch.paths) {
        const directory = dirname(path);
        const names = namesByDirectory.get(directory) ?? new Set<string>();
        names.add(basename(path));
        namesByDirectory.set(directory, names);
    }
    for (const [directory, names] of namesByDirectory) {
        const watcher = watchFs(directory, (_event, filename) => {
            if (state.shuttingDown) return;
            if (filename === null || !names.has(basename(filename.toString()))) return;
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(() => void restart(state), CONFIG_DEBOUNCE_MS);
        });
        watcher.on("error", () => {});
        state.watchers.push(watcher);
    }
};

/**
 * Installs signal handling: forwards the signal to the child, closes the config
 * watchers, and propagates the child's exit code (or the signal-mapped code).
 */
const installShutdown = (state: SupervisorState): void => {
    installGracefulShutdown({
        onSignal: (signal) =>
            new Promise<void>((resolve) => {
                state.shuttingDown = true;
                for (const watcher of state.watchers) watcher.close();
                if (!state.child) {
                    resolve();
                    return;
                }
                state.child.once("exit", () => resolve());
                forwardSignal(state.child, signal);
            }),
        onForce: () => forceKillChild(state.child),
        forceKillAfterMs: FORCE_KILL_TIMEOUT_MS,
        exitCode: (signal) => state.capturedChildExit ?? exitCodeForSignal(signal),
    });
};

/**
 * Supervises the dev-runner child process for the lifetime of `gtkx dev`.
 *
 * Forks `bin/gtkx-dev-runner.js`, forwards `SIGINT`/`SIGTERM`/`SIGHUP` to it,
 * and relaunches the runner whenever it exits with {@link RELOAD_EXIT_CODE}.
 * When a {@link DevWatch} is supplied, a change to one of its paths regenerates
 * the bindings and restarts the runner so the new process imports the freshly
 * generated `@gtkx/gi`. The returned promise never resolves: control returns
 * only when the runner exits non-reloadably and the supervisor calls
 * `process.exit`.
 *
 * @param entryPath - Absolute path of the user's entry module.
 * @param watch - Optional config-watch descriptor for regenerate-and-restart.
 */
export const runDevSupervisor = async (entryPath: string, watch?: DevWatch): Promise<never> => {
    const state: SupervisorState = {
        runnerPath: fileURLToPath(DEV_RUNNER_URL),
        entryPath,
        watch,
        watchers: [],
        child: null,
        shuttingDown: false,
        restarting: false,
        capturedChildExit: undefined,
    };

    installConfigWatchers(state);
    installShutdown(state);
    launch(state);

    return new Promise<never>(() => {});
};
