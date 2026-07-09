import { fork as nodeFork } from "node:child_process";
import { type FSWatcher, watch as watchFs } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { error, exitCodeForSignal, info, installGracefulShutdown } from "@gtkx/utils";

const DEV_RUNNER_URL = new URL("../../bin/gtkx-dev-runner.js", import.meta.url);
const FORCE_KILL_TIMEOUT_MS = 5000;
const CONFIG_DEBOUNCE_MS = 150;

export const RESTART_EXIT_CODE = 75;

export type SupervisedChild = {
    killed: boolean;
    pid?: number | undefined;
    exitCode: number | null;
    kill(signal?: number | NodeJS.Signals): boolean;
    on(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
    once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
};

export type ForkRunner = (modulePath: string, args: string[], cwd: string) => SupervisedChild;

export const defaultForkRunner: ForkRunner = (modulePath, args, cwd) =>
    nodeFork(modulePath, [...args], { cwd, stdio: "inherit", detached: true });

export type DevWatch = {
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
    shuttingDown: boolean;
    restarting: boolean;
    capturedChildExit: number | undefined;
};

const forwardSignal = (child: SupervisedChild, signal: NodeJS.Signals): void => {
    if (!child.killed) {
        child.kill(signal);
    }
};

const forceKillChild = (child: SupervisedChild | null): void => {
    if (!child?.pid || child.exitCode !== null || child.killed) return;
    try {
        process.kill(child.pid, "SIGKILL");
    } catch {}
};

const launch = (state: SupervisorState): void => {
    const child = state.fork(state.runnerPath, [state.entryPath], state.cwd);
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
        if (code === RESTART_EXIT_CODE) {
            info("Restarting dev runner...");
            launch(state);
            return;
        }
        process.exit(code ?? exitCodeForSignal(signal));
    });
};

const restart = async (state: SupervisorState): Promise<void> => {
    if (state.restarting || state.shuttingDown || state.watch === undefined) return;
    state.restarting = true;
    info("gtkx.config.ts changed; regenerating bindings...");
    try {
        await state.watch.regenerate();
    } catch (cause) {
        error("Codegen failed; keeping the current dev runner. Fix the error and save again.", cause);
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
            info("Restarting dev runner...");
            launch(state);
        }
    });
    forwardSignal(current, "SIGTERM");
};

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
        exitCode: (signal, graceful) => state.capturedChildExit ?? (graceful ? 0 : exitCodeForSignal(signal)),
    });
};

export const runDevSupervisor = async (
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
        shuttingDown: false,
        restarting: false,
        capturedChildExit: undefined,
    };

    installConfigWatchers(state);
    installShutdown(state);
    launch(state);

    return new Promise<never>(() => {});
};
