import { error, exitCodeForSignal, info, installGracefulShutdown } from "@gtkx/utils";
import { fork as nodeFork } from "node:child_process";
import { type FSWatcher, statSync, watch as watchFs } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEV_CONFIG_ENV, DEV_ENTRY_ENV } from "./entry-env.js";

type SupervisedChild = {
    killed: boolean;
    pid?: number | undefined;
    exitCode: number | null;
    kill(signal?: number | NodeJS.Signals): boolean;
    on(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
    once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
};

type ForkRunner = (modulePath: string, args: string[], env: NodeJS.ProcessEnv, cwd: string) => SupervisedChild;

type DevWatch = {
    paths: string[];
    resolvePaths: () => string[];
    regenerate: () => Promise<string[]>;
};

type SupervisorState = {
    runnerPath: string;
    entryPath: string;
    configFile: string;
    cwd: string;
    args: string[];
    watch: DevWatch | undefined;
    watchers: FSWatcher[];
    restartTimer: DebounceTimer;
    fork: ForkRunner;
    child: SupervisedChild | null;
    isShuttingDown: boolean;
    isRestarting: boolean;
    isRestartPending: boolean;
    capturedChildExit: number | undefined;
};

type DevSupervisorOptions = {
    entryPath: string;
    configFile: string;
    cwd: string;
    args?: string[] | undefined;
    watch?: DevWatch | undefined;
    fork?: ForkRunner | undefined;
};

type DebounceTimer = { handle: NodeJS.Timeout | null };

const DEV_RUNNER_URL = new URL("../../bin/gtkx-dev-runner.js", import.meta.url);
const FORCE_KILL_TIMEOUT_MS = 5000;
const CONFIG_DEBOUNCE_MS = 150;
const RESTART_EXIT_CODE = 75;
const CONDITION_FLAG = /^(?:--conditions|-C)(?:=.*)?$/;
const SPLIT_CONDITION_FLAG = /^(?:--conditions|-C)$/;

const withoutConditions = (argv: string[]): string[] =>
    argv.filter(
        (argument, index) => !CONDITION_FLAG.test(argument) && !SPLIT_CONDITION_FLAG.test(argv[index - 1] ?? ""),
    );

const getNodeOptions = (env: NodeJS.ProcessEnv): string | undefined => {
    const options = env.NODE_OPTIONS;

    return options === undefined ? undefined : withoutConditions(options.split(/\s+/)).join(" ");
};

const defaultForkRunner: ForkRunner = (modulePath, args, env, cwd) => {
    const nodeOptions = getNodeOptions(env);

    return nodeFork(modulePath, args, {
        cwd,
        env: { ...env, ...(nodeOptions !== undefined && { NODE_OPTIONS: nodeOptions }) },
        stdio: "inherit",
        detached: true,
        execArgv: withoutConditions(process.execArgv),
    });
};

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
    const child = state.fork(
        state.runnerPath,
        state.args,
        { ...process.env, [DEV_CONFIG_ENV]: state.configFile, [DEV_ENTRY_ENV]: state.entryPath },
        state.cwd,
    );

    state.child = child;

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

const reconcileConfigWatchers = (
    state: SupervisorState,
    paths: string[],
    previous: ReadonlyMap<string, string | null>,
): void => {
    const didChange = didWatchPathsChange(previous, paths);

    closeWatchers(state);

    if (state.watch !== undefined) {
        state.watch.paths = paths;
    }

    if (state.isShuttingDown) {
        return;
    }

    installConfigWatchers(state);

    if (didChange && !state.isRestartPending) {
        scheduleRestart(state);
    }
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
    info(`${basename(state.configFile)} changed; regenerating bindings...`);
    closeWatchers(state);
    watch.paths = watch.resolvePaths();
    const previous = snapshotWatchPaths(watch.paths);
    installConfigWatchers(state);

    try {
        const paths = await watch.regenerate();
        reconcileConfigWatchers(state, paths, previous);
    } catch (error_) {
        reconcileConfigWatchers(state, watch.resolvePaths(), previous);
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

    forwardSignal(current, "SIGTERM");
};

const scheduleRestart = (state: SupervisorState): void => {
    const timer = state.restartTimer;

    if (timer.handle !== null) {
        clearTimeout(timer.handle);
    }

    timer.handle = setTimeout(() => {
        timer.handle = null;
        void restart(state);
    }, CONFIG_DEBOUNCE_MS);
};

const isWatchedChange = (state: SupervisorState, names: Set<string>, filename: string | Buffer | null): boolean => {
    if (filename === null || state.isShuttingDown) {
        return false;
    }

    return names.has(basename(filename.toString()));
};

const isDirectory = (path: string): boolean => {
    try {
        return statSync(path, { throwIfNoEntry: false })?.isDirectory() === true;
    } catch {
        return false;
    }
};

const nearestWatchTarget = (path: string): { directory: string; name: string } => {
    let directory = dirname(path);
    let name = basename(path);

    while (!isDirectory(directory)) {
        const parent = dirname(directory);

        if (parent === directory) {
            break;
        }

        name = basename(directory);
        directory = parent;
    }

    return { directory, name };
};

const watchTargets = (paths: string[]): Set<string> =>
    new Set(paths.flatMap((path) => {
        const { directory, name } = nearestWatchTarget(path);

        return [path, join(directory, name)];
    }));

const watchPathState = (path: string): string | null => {
    try {
        const stat = statSync(path, { bigint: true, throwIfNoEntry: false });

        return stat === undefined
            ? null
            : [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
    } catch {
        return null;
    }
};

const snapshotWatchPaths = (paths: string[]): Map<string, string | null> =>
    new Map([...watchTargets(paths)].map((path) => [path, watchPathState(path)]));

const didWatchPathsChange = (
    previous: ReadonlyMap<string, string | null>,
    paths: string[],
): boolean => {
    for (const path of watchTargets(paths)) {
        const current = watchPathState(path);

        if (previous.has(path) ? previous.get(path) !== current : current !== null) {
            return true;
        }
    }

    return false;
};

const groupWatchNamesByDirectory = (paths: string[]): Map<string, Set<string>> => {
    const namesByDirectory: Map<string, Set<string>> = new Map();

    for (const path of paths) {
        const { directory, name } = nearestWatchTarget(path);
        const names = namesByDirectory.get(directory) ?? new Set<string>();
        names.add(name);
        namesByDirectory.set(directory, names);
    }

    return namesByDirectory;
};

const watchConfigDirectory = (
    state: SupervisorState,
    directory: string,
    names: Set<string>,
): void => {
    try {
        const watcher = watchFs(directory, (_event, filename) => {
            if (isWatchedChange(state, names, filename)) {
                scheduleRestart(state);
            }
        });

        watcher.on("error", (cause) => {
            error(`Configuration watch failed for ${directory}`, cause);
        });
        state.watchers.push(watcher);
    } catch (error_) {
        error(`Configuration watch failed for ${directory}`, error_);
    }
};

const installConfigWatchers = (state: SupervisorState): void => {
    const watch = state.watch;

    if (watch === undefined || watch.paths.length === 0) {
        return;
    }

    for (const [directory, names] of groupWatchNamesByDirectory(watch.paths)) {
        watchConfigDirectory(state, directory, names);
    }
};

const closeWatchers = (state: SupervisorState): void => {
    for (const watcher of state.watchers) {
        watcher.close();
    }

    state.watchers = [];
};

const shutdownOnSignal = (state: SupervisorState, signal: NodeJS.Signals): Promise<void> =>
    new Promise<void>((resolve) => {
        state.isShuttingDown = true;
        closeWatchers(state);

        if (state.restartTimer.handle !== null) {
            clearTimeout(state.restartTimer.handle);
            state.restartTimer.handle = null;
        }

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

const runDevSupervisor = async (options: DevSupervisorOptions): Promise<never> => {
    const { entryPath, configFile, cwd, args = [], watch, fork = defaultForkRunner } = options;

    const state: SupervisorState = {
        runnerPath: fileURLToPath(DEV_RUNNER_URL),
        entryPath,
        configFile,
        cwd,
        args,
        watch,
        watchers: [],
        restartTimer: { handle: null },
        fork,
        child: null,
        isShuttingDown: false,
        isRestarting: false,
        isRestartPending: false,
        capturedChildExit: undefined,
    };

    installConfigWatchers(state);
    installShutdown(state);
    launch(state);

    return new Promise<never>((): void => undefined);
};

export {
    RESTART_EXIT_CODE,
    runDevSupervisor,
    type DevWatch,
};
