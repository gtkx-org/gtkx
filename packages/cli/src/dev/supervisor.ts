import { error, exitCodeForSignal, info, installGracefulShutdown } from "@gtkx/utils";
import { type FSWatcher, watch as watchFs } from "chokidar";
import { type ChildProcess, fork as nodeFork } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { basename, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WORKER_PRELOAD_ARGS } from "../internal/worker-preload-args.js";
import { DEV_RUNNER_READY, type DevRunnerBootstrap } from "./bootstrap.js";

type DevWatch = {
    paths: string[];
    resolvePaths: () => string[];
    regenerate: () => Promise<string[]>;
};

type SupervisorState = {
    finish: (code: number) => void;
    fail: (error: Error) => void;
    runnerPath: string;
    entryPath: string;
    configFile: string;
    storybookConfig: string | undefined;
    mcpSocketPath: string | undefined;
    cwd: string;
    args: string[];
    watch: DevWatch | undefined;
    watchers: Map<string, FSWatcher>;
    changedPaths: Set<string>;
    restartTimer: DebounceTimer;
    child: ChildProcess | null;
    isShuttingDown: boolean;
    isRestarting: boolean;
    isRestartPending: boolean;
    capturedChildExit: number | undefined;
};

type DevSupervisorOptions = {
    signal?: AbortSignal;
    entryPath: string;
    configFile: string;
    storybookConfig?: string | undefined;
    mcpSocketPath?: string | undefined;
    cwd: string;
    args?: string[] | undefined;
    watch?: DevWatch | undefined;
};

type DebounceTimer = { handle: NodeJS.Timeout | null };

const DEV_RUNNER_URL = new URL("../../bin/gtkx-dev-runner.js", import.meta.url);
const FORCE_KILL_TIMEOUT_MS = 5000;
const CONFIG_DEBOUNCE_MS = 150;
const RESTART_EXIT_CODE = 75;
const forkRunner = (modulePath: string, args: string[], cwd: string): ChildProcess =>
    nodeFork(modulePath, args, {
        cwd,
        stdio: "inherit",
        detached: true,
        execArgv: [...process.execArgv, ...WORKER_PRELOAD_ARGS],
    });

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

    state.finish(code ?? exitCodeForSignal(signal));
};

const launch = (state: SupervisorState): void => {
    const child = forkRunner(state.runnerPath, state.args, state.cwd);

    state.child = child;
    child.once("error", state.fail);
    const isCurrentRunner = (): boolean => !state.isShuttingDown && state.child === child && !child.killed;

    child.once("message", (message: unknown) => {
        if (!isCurrentRunner()) {
            return;
        }

        if (message !== DEV_RUNNER_READY) {
            child.kill("SIGTERM");
            state.fail(new Error("Unexpected dev runner startup message"));

            return;
        }

        const bootstrap: DevRunnerBootstrap = {
            entryPath: state.entryPath,
            configFile: state.configFile,
            storybookConfig: state.storybookConfig,
            mcpSocketPath: state.mcpSocketPath,
        };
        child.send(bootstrap, (error) => {
            if (error !== null && isCurrentRunner()) {
                state.fail(error);
            }
        });
    });

    child.on("exit", (code, signal) => {
        handleChildExit(state, code, signal);
    });
};

const runPendingRestart = (state: SupervisorState): void => {
    state.isRestarting = false;

    if (!state.isRestartPending || state.isShuttingDown) {
        return;
    }

    state.isRestartPending = false;
    void restart(state);
};

const relaunchAfterExit = (state: SupervisorState): void => {
    if (state.isShuttingDown) {
        state.isRestarting = false;

        return;
    }

    info("Restarting dev runner...");
    launch(state);
    runPendingRestart(state);
};

const isSupervisorShuttingDown = (state: SupervisorState): boolean => state.isShuttingDown;

const reconcileConfigWatchers = async (
    state: SupervisorState,
    paths: string[],
    ignoreInitial = false,
): Promise<void> => {
    const watch = state.watch;

    if (watch === undefined || state.isShuttingDown) {
        return;
    }

    const added = paths.filter((path) => !watch.paths.includes(path) && existsSync(path));
    watch.paths = paths;
    const targets = new Set(paths.map(configWatchDirectory));
    const pending: Promise<void>[] = [];

    for (const [path, watcher] of state.watchers) {
        if (!targets.has(path)) {
            state.watchers.delete(path);
            pending.push(watcher.close());
        }
    }

    for (const path of targets) {
        if (state.watchers.has(path)) {
            continue;
        }

        const watcher = watchFs(path, { depth: 0, ignoreInitial });
        state.watchers.set(path, watcher);
        watcher.on("all", (event, changed) => {
            if (
                !state.isShuttingDown &&
                state.watchers.get(path) === watcher &&
                watch.paths.some((target) => target === changed || target.startsWith(changed + sep))
            ) {
                if (event === "unlinkDir" && changed === path) {
                    state.watchers.delete(path);
                    void watcher.close();
                }

                scheduleRestart(state, [changed]);
            }
        });
        watcher.on("error", (cause) => {
            error(`Configuration watch failed for ${path}`, cause);
        });
        if (ignoreInitial) {
            pending.push(
                new Promise<void>((resolve) => {
                    watcher
                        .once("ready", resolve)
                        .once("error", () => resolve())
                        .on("unlinkDir", (removed) => {
                            if (removed === path) resolve();
                        });
                }),
            );
        }
    }

    await Promise.all(pending);

    if (!ignoreInitial && added.length > 0 && !state.isRestartPending && !state.isShuttingDown) {
        scheduleRestart(state, added);
    }
};

const consumeChangedPaths = (state: SupervisorState): string => {
    const changed = [...state.changedPaths].map((path) => relative(state.cwd, path));
    state.changedPaths.clear();

    return changed.length === 0 ? basename(state.configFile) : changed.join(", ");
};

const restart = async (state: SupervisorState): Promise<void> => {
    const watch = state.watch;

    if (watch === undefined || state.isShuttingDown) {
        return;
    }

    if (state.isRestarting) {
        state.isRestartPending = true;

        return;
    }

    state.isRestarting = true;
    info(`${consumeChangedPaths(state)} changed; regenerating bindings...`);
    await reconcileConfigWatchers(state, watch.resolvePaths());

    try {
        const paths = await watch.regenerate();
        await reconcileConfigWatchers(state, paths);
    } catch (error_) {
        await reconcileConfigWatchers(state, watch.resolvePaths());
        error("Codegen failed; keeping the current dev runner. Fix the error and save again.", error_);
        runPendingRestart(state);

        return;
    }

    if (isSupervisorShuttingDown(state)) {
        state.isRestarting = false;

        return;
    }

    const current = state.child;

    if (current === null) {
        launch(state);
        runPendingRestart(state);

        return;
    }

    current.once("exit", () => {
        relaunchAfterExit(state);
    });

    current.kill("SIGTERM");
};

const scheduleRestart = (state: SupervisorState, changedPaths: string[] = []): void => {
    const timer = state.restartTimer;

    for (const path of changedPaths) {
        state.changedPaths.add(path);
    }

    if (timer.handle !== null) {
        clearTimeout(timer.handle);
    }

    timer.handle = setTimeout(() => {
        timer.handle = null;
        void restart(state);
    }, CONFIG_DEBOUNCE_MS);
};

const isDirectory = (path: string): boolean => {
    try {
        return statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
    } catch {
        return false;
    }
};

const configWatchDirectory = (path: string): string => {
    let directory = dirname(path);

    while (!isDirectory(directory)) {
        const parent = dirname(directory);

        if (parent === directory) {
            break;
        }

        directory = parent;
    }

    return directory;
};

const closeWatchers = async (state: SupervisorState): Promise<void> => {
    const watchers = [...state.watchers.values()];
    state.watchers.clear();
    await Promise.all(watchers.map((watcher) => watcher.close()));
};

const shutdownOnSignal = async (state: SupervisorState, signal: NodeJS.Signals): Promise<void> => {
    state.isShuttingDown = true;
    const closed = closeWatchers(state);

    if (state.restartTimer.handle !== null) {
        clearTimeout(state.restartTimer.handle);
        state.restartTimer.handle = null;
    }

    const child = state.child;

    if (child !== null) {
        await new Promise<void>((resolve) => {
            child.once("exit", resolve);
            child.kill(signal);
        });
    }

    await closed;
};

const installShutdown = (state: SupervisorState): (() => void) => {
    return installGracefulShutdown({
        onSignal: (signal) => shutdownOnSignal(state, signal),
        onForce: () => state.child?.kill("SIGKILL"),
        forceKillAfterMs: FORCE_KILL_TIMEOUT_MS,
        exitCode: (signal, graceful) => state.capturedChildExit ?? (graceful ? 0 : exitCodeForSignal(signal)),
    });
};

const runDevSupervisor = async (options: DevSupervisorOptions): Promise<number> => {
    const completion = Promise.withResolvers<number>();
    const { entryPath, configFile, storybookConfig, mcpSocketPath, cwd, args = [], watch } = options;

    const state: SupervisorState = {
        finish: completion.resolve,
        fail: completion.reject,
        runnerPath: fileURLToPath(DEV_RUNNER_URL),
        entryPath,
        configFile,
        storybookConfig,
        mcpSocketPath,
        cwd,
        args,
        watch,
        watchers: new Map(),
        changedPaths: new Set(),
        restartTimer: { handle: null },
        child: null,
        isShuttingDown: false,
        isRestarting: true,
        isRestartPending: false,
        capturedChildExit: undefined,
    };

    const stop = (): void => {
        const timer = setTimeout(() => state.child?.kill("SIGKILL"), FORCE_KILL_TIMEOUT_MS);
        void shutdownOnSignal(state, "SIGTERM").then(
            () => {
                clearTimeout(timer);
                completion.resolve(state.capturedChildExit ?? 0);
            },
            (error: unknown) => {
                clearTimeout(timer);
                completion.reject(error);
            },
        );
    };
    options.signal?.throwIfAborted();
    const disposeShutdown = options.signal === undefined ? installShutdown(state) : undefined;
    options.signal?.addEventListener("abort", stop, { once: true });
    try {
        await Promise.race([reconcileConfigWatchers(state, watch?.paths ?? [], true), completion.promise]);
        if (!state.isShuttingDown) {
            launch(state);
            runPendingRestart(state);
        }
        const code = await completion.promise;
        if (options.signal === undefined) process.exitCode = code;
        return code;
    } finally {
        options.signal?.removeEventListener("abort", stop);
        disposeShutdown?.();
        await closeWatchers(state);
        if (state.restartTimer.handle !== null) clearTimeout(state.restartTimer.handle);
    }
};

export { RESTART_EXIT_CODE, runDevSupervisor, type DevWatch };
