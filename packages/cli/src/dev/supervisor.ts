import { error, exitCodeForSignal, info, installGracefulShutdown } from "@gtkx/utils";
import { fork as nodeFork } from "node:child_process";
import { type FSWatcher, watch as watchFs } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

type SupervisedChild = {
    killed: boolean;
    pid?: number | undefined;
    exitCode: number | null;
    kill(signal?: number | NodeJS.Signals): boolean;
    on(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
    once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
};

type ForkRunner = (modulePath: string, args: string[], cwd: string) => SupervisedChild;

type DevWatch = {
    paths: string[];
    regenerate: () => Promise<void>;
};

type SupervisorState = {
    runnerPath: string;
    entryPath: string;
    cwd: string;
    watch: DevWatch | undefined;
    watchers: FSWatcher[];
    fork: ForkRunner;
    child: SupervisedChild | null;
    isShuttingDown: boolean;
    isRestarting: boolean;
    capturedChildExit: number | undefined;
};

type DebounceTimer = { handle: NodeJS.Timeout | null };

const DEV_RUNNER_URL = new URL("../../bin/gtkx-dev-runner.js", import.meta.url);
const FORCE_KILL_TIMEOUT_MS = 5000;
const CONFIG_DEBOUNCE_MS = 150;
const RESTART_EXIT_CODE = 75;

const defaultForkRunner: ForkRunner = (modulePath, args, cwd) =>
    nodeFork(modulePath, [...args], { cwd, stdio: "inherit", detached: true });

const forwardSignal = (child: SupervisedChild, signal: NodeJS.Signals): void => {
    if (!child.killed) {
        child.kill(signal);
    }
};

const didForceKillChild = (child: SupervisedChild | null): boolean => {
    if (!child?.pid || child.exitCode !== null || child.killed) {
        return false;
    }

    try {
        return process.kill(child.pid, "SIGKILL");
    } catch {
        return false;
    }
};

const captureShutdownExit = (state: SupervisorState, code: number | null, signal: NodeJS.Signals | null): void => {
    if (code !== null) {
        state.capturedChildExit = code;
    } else if (signal) {
        state.capturedChildExit = exitCodeForSignal(signal);
    }
};

const handleChildExit = (state: SupervisorState, code: number | null, signal: NodeJS.Signals | null): void => {
    state.child = null;

    if (state.isRestarting) {
        return;
    }

    if (state.isShuttingDown) {
        captureShutdownExit(state, code, signal);

        return;
    }

    if (code === RESTART_EXIT_CODE) {
        info("Restarting dev runner...");
        launch(state);

        return;
    }

    process.exit(code ?? exitCodeForSignal(signal));
};

const launch = (state: SupervisorState): void => {
    const child = state.fork(state.runnerPath, [state.entryPath], state.cwd);
    state.child = child;

    child.on("exit", (code, signal) => {
        handleChildExit(state, code, signal);
    });
};

const isRestartBlocked = (state: SupervisorState): boolean => state.isRestarting || state.isShuttingDown;

const relaunchAfterExit = (state: SupervisorState): void => {
    state.isRestarting = false;

    if (state.isShuttingDown) {
        return;
    }

    info("Restarting dev runner...");
    launch(state);
};

const restart = async (state: SupervisorState): Promise<void> => {
    const watch = state.watch;

    if (watch === undefined || isRestartBlocked(state)) {
        return;
    }

    state.isRestarting = true;
    info("gtkx.config.ts changed; regenerating bindings...");

    try {
        await watch.regenerate();
    } catch (error_) {
        error("Codegen failed; keeping the current dev runner. Fix the error and save again.", error_);
        state.isRestarting = false;

        return;
    }

    if (state.isShuttingDown) {
        state.isRestarting = false;

        return;
    }

    const current = state.child;

    if (current === null) {
        state.isRestarting = false;
        launch(state);

        return;
    }

    current.once("exit", () => {
        relaunchAfterExit(state);
    });

    forwardSignal(current, "SIGTERM");
};

const scheduleRestart = (state: SupervisorState, timer: DebounceTimer): void => {
    if (timer.handle !== null) {
        clearTimeout(timer.handle);
    }

    timer.handle = setTimeout(() => void restart(state), CONFIG_DEBOUNCE_MS);
};

const isWatchedChange = (state: SupervisorState, names: Set<string>, filename: string | Buffer | null): boolean => {
    if (filename === null || state.isShuttingDown) {
        return false;
    }

    return names.has(basename(filename.toString()));
};

const groupWatchNamesByDirectory = (paths: string[]): Map<string, Set<string>> => {
    const namesByDirectory: Map<string, Set<string>> = new Map();

    for (const path of paths) {
        const directory = dirname(path);
        const names = namesByDirectory.get(directory) ?? new Set<string>();
        names.add(basename(path));
        namesByDirectory.set(directory, names);
    }

    return namesByDirectory;
};

const watchConfigDirectory = (
    state: SupervisorState,
    directory: string,
    names: Set<string>,
    timer: DebounceTimer,
): void => {
    const watcher = watchFs(directory, (_event, filename) => {
        if (isWatchedChange(state, names, filename)) {
            scheduleRestart(state, timer);
        }
    });

    watcher.on("error", (): void => undefined);
    state.watchers.push(watcher);
};

const installConfigWatchers = (state: SupervisorState): void => {
    const watch = state.watch;

    if (watch === undefined || watch.paths.length === 0) {
        return;
    }

    const timer: DebounceTimer = { handle: null };

    for (const [directory, names] of groupWatchNamesByDirectory(watch.paths)) {
        watchConfigDirectory(state, directory, names, timer);
    }
};

const closeWatchers = (state: SupervisorState): void => {
    for (const watcher of state.watchers) {
        watcher.close();
    }
};

const shutdownOnSignal = (state: SupervisorState, signal: NodeJS.Signals): Promise<void> =>
    new Promise<void>((resolve) => {
        state.isShuttingDown = true;
        closeWatchers(state);

        if (!state.child) {
            resolve();

            return;
        }

        state.child.once("exit", () => {
            resolve();
        });

        forwardSignal(state.child, signal);
    });

const installShutdown = (state: SupervisorState): void => {
    installGracefulShutdown({
        onSignal: (signal) => shutdownOnSignal(state, signal),
        onForce: () => didForceKillChild(state.child),
        forceKillAfterMs: FORCE_KILL_TIMEOUT_MS,
        exitCode: (signal, graceful) => state.capturedChildExit ?? (graceful ? 0 : exitCodeForSignal(signal)),
    });
};

const runDevSupervisor = async (
    entryPath: string,
    cwd: string,
    watch?: DevWatch,
    fork: ForkRunner = defaultForkRunner,
): Promise<never> => {
    const state: SupervisorState = {
        runnerPath: fileURLToPath(DEV_RUNNER_URL),
        entryPath,
        cwd,
        watch,
        watchers: [],
        fork,
        child: null,
        isShuttingDown: false,
        isRestarting: false,
        capturedChildExit: undefined,
    };

    installConfigWatchers(state);
    installShutdown(state);
    launch(state);

    return new Promise<never>((): void => undefined);
};

export { RESTART_EXIT_CODE, defaultForkRunner, runDevSupervisor, type SupervisedChild, type ForkRunner, type DevWatch };
