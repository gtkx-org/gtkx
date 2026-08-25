import type { ApplicationInstance } from "@gtkx/runtime/internal";
import type { InlineConfig, Plugin } from "vite";
import { error, warn } from "@gtkx/utils";
import { loadModuleExclusively, withExclusiveLoad } from "../internal/module-loads.js";
import { createChangeQueue, type WatchedChange } from "./change-queue.js";
import { createFailureTracker, type FailureTracker } from "./failure-tracker.js";
import { isMissingImport, missingImportName } from "./missing-import.js";
import { createRefreshTracker, type RefreshTracker } from "./refresh-tracker.js";
import { RESTART_EXIT_CODE } from "./supervisor.js";
import {
    createDevServerConfig,
    type DevServer,
    type DevServerChangedModule,
    type DevServerWatchEvent,
    isServerConfigFile,
} from "./vite-dev-server.js";

type LoadAppModule = (id: string) => Promise<Record<string, unknown>>;

type DevRunnerDeps = {
    createServer(config: InlineConfig): Promise<DevServer>;
    waitForApplicationId(timeoutMs: number, shouldKeepWaiting: () => boolean): Promise<string | null>;
    getConfiguredApplicationId(root: string): Promise<string | undefined>;
    startMcpClient(applicationId: string, loadAppModule: LoadAppModule): Promise<unknown>;
    stopMcpClient(): void;
    watchApplicationShutdown(onShutdown: () => void): void;
    watchUncaughtErrors(onUncaughtError: (cause: unknown) => void): void;
    getApplicationInstance(): ApplicationInstance;
    installShutdownHandlers(onSignal: () => void | Promise<void>): void;
    quitDefaultApplication(): void;
    performRefresh: () => void;
    isRefreshBoundary(module: Record<string, unknown>): boolean;
    staleExportName(previous: Record<string, unknown>, current: Record<string, unknown>): string | null;
    readFileRevision(path: string): Promise<string>;
    plugins(entryPath: string): Plugin[];
    log(message: string): void;
    exit(code: number): never;
};

type DevRunner = {
    run(entryPath: string): Promise<void>;
};

type ShutdownController = {
    isShuttingDown: () => boolean;
    shutdown: (quitApplication: () => void) => Promise<void>;
};

type DevSession = {
    server: DevServer;
    deps: DevRunnerDeps;
    controller: ShutdownController;
    refreshTracker: RefreshTracker;
    failure: FailureTracker;
    pendingSaves: Map<string, string>;
};

type SettledLoad = {
    loadedExports: Record<string, unknown>;
    isSettled: boolean;
};

type SettleAttempt = {
    loadedExports: Record<string, unknown> | null;
    module: DevServerChangedModule;
};

const APPLICATION_MOUNT_TIMEOUT_MS = 10_000;
const OWNED_ID_EXIT_CODE = 1;
const LOAD_ATTEMPT_LIMIT = 5;
const WATCH_EVENTS: DevServerWatchEvent[] = ["add", "change", "unlink"];
const SKIP_REASON = `did not settle in ${String(LOAD_ATTEMPT_LIMIT)} attempts; save it again to patch the window.`;
const DROPPED_REFRESH = "Fast Refresh dropped";
const SAVE_ACTION = "File changed";
const RETRY_ACTION = "Retrying pending save";

const announceFailure = (server: DevServer, cause: unknown): void => {
    if (cause instanceof Error) {
        server.ssrFixStacktrace(cause);
    }

    error("Application error; keeping the dev server up. Fix the error and save again.", cause);
};

const parkSession = (session: DevSession): void => {
    session.deps.log("Waiting for a change to restart the application...");
};

const requestRestart = async (session: DevSession): Promise<never> => {
    session.deps.log("Full restart (process restart)");

    try {
        await session.server.close();
    } catch (error_) {
        error("Error closing server before the restart:", error_);
    }

    return session.deps.exit(RESTART_EXIT_CODE);
};

const requiresRestart = (session: DevSession, module: DevServerChangedModule): boolean => {
    if (session.failure.isDown()) {
        return true;
    }

    const loadedExports = module.ssrModule;

    if (!loadedExports) {
        return false;
    }

    return !session.deps.isRefreshBoundary(loadedExports);
};

const invalidateChangedModule = (session: DevSession, module: DevServerChangedModule): void => {
    session.server.moduleGraph.invalidateModule(module);

    for (const importer of module.importers) {
        session.server.moduleGraph.invalidateModule(importer);
    }
};

const isEvaluationCurrent = (
    session: DevSession,
    changedPath: string,
    loadedExports: Record<string, unknown>,
): boolean => {
    const evaluated = session.server.moduleGraph.getModuleById(changedPath);

    if (!evaluated?.ssrTransformResult) {
        return false;
    }

    return evaluated.ssrModule === loadedExports;
};

const loadInvalidatedModule = (
    session: DevSession,
    changedPath: string,
    module: DevServerChangedModule,
): Promise<SettledLoad> =>
    withExclusiveLoad(session.server, async () => {
        const revision = await session.deps.readFileRevision(changedPath);
        invalidateChangedModule(session, module);
        const loadedExports = await session.server.ssrLoadModule(changedPath);
        const settledRevision = await session.deps.readFileRevision(changedPath);

        return {
            loadedExports,
            isSettled: settledRevision === revision && isEvaluationCurrent(session, changedPath, loadedExports),
        };
    });

const settleAttempt = async (
    session: DevSession,
    changedPath: string,
    module: DevServerChangedModule,
): Promise<SettleAttempt> => {
    const { loadedExports, isSettled } = await loadInvalidatedModule(session, changedPath, module);

    if (isSettled) {
        return { loadedExports, module };
    }

    return { loadedExports: null, module: session.server.moduleGraph.getModuleById(changedPath) ?? module };
};

const loadSettledExports = async (
    session: DevSession,
    changedPath: string,
    changedModule: DevServerChangedModule,
): Promise<Record<string, unknown> | null> => {
    let module = changedModule;

    for (let round = 0; round < LOAD_ATTEMPT_LIMIT && !session.controller.isShuttingDown(); round++) {
        const attempt = await settleAttempt(session, changedPath, module);

        if (attempt.loadedExports) {
            return attempt.loadedExports;
        }

        module = attempt.module;
    }

    return null;
};

const droppedExportName = (previous: Record<string, unknown>, current: Record<string, unknown>): string | null => {
    const kept = new Set(Object.keys(current));

    for (const name of Object.keys(previous)) {
        if (!kept.has(name)) {
            return name;
        }
    }

    return null;
};

const unpatchedExportReason = (
    session: DevSession,
    previous: Record<string, unknown> | null,
    current: Record<string, unknown>,
): string | null => {
    if (!previous) {
        return null;
    }

    const dropped = droppedExportName(previous, current);

    if (dropped !== null) {
        return `no longer exports ${dropped}, which its importers still hold`;
    }

    const stale = session.deps.staleExportName(previous, current);

    if (stale === null) {
        return null;
    }

    return `renamed the component it exports as ${stale}, which the window is still rendering`;
};

const refreshChangedModule = async (
    session: DevSession,
    changedPath: string,
    changedModule: DevServerChangedModule,
    previous: Record<string, unknown> | null,
): Promise<void> => {
    const loadedExports = await loadSettledExports(session, changedPath, changedModule);

    if (session.controller.isShuttingDown()) {
        return;
    }

    if (!loadedExports) {
        warn(`Fast Refresh skipped: ${changedPath} ${SKIP_REASON}`);

        return;
    }

    if (!session.deps.isRefreshBoundary(loadedExports)) {
        await requestRestart(session);

        return;
    }

    const unpatched = unpatchedExportReason(session, previous, loadedExports);

    if (unpatched !== null) {
        warn(`${DROPPED_REFRESH}: ${changedPath} ${unpatched}`);
        await requestRestart(session);

        return;
    }

    session.pendingSaves.delete(changedPath);
    session.deps.log("Running Fast Refresh...");
    session.deps.performRefresh();
    session.deps.log("Fast Refresh complete");
};

const applyModuleChange = async (session: DevSession, changedPath: string, action: string): Promise<void> => {
    const module = session.server.moduleGraph.getModuleById(changedPath);

    if (!module) {
        return;
    }

    session.deps.log(`${action}: ${changedPath}`);

    if (requiresRestart(session, module)) {
        await requestRestart(session);

        return;
    }

    await refreshChangedModule(session, changedPath, module, module.ssrModule ?? null);
};

const awaitMissingImport = (session: DevSession, changedPath: string, cause: unknown): void => {
    const missingName = missingImportName(cause);

    if (missingName === null) {
        session.pendingSaves.delete(changedPath);

        return;
    }

    session.pendingSaves.set(changedPath, missingName);
};

const applySave = async (session: DevSession, changedPath: string, action: string): Promise<void> => {
    try {
        await applyModuleChange(session, changedPath, action);
    } catch (error_) {
        if (session.controller.isShuttingDown()) {
            return;
        }

        awaitMissingImport(session, changedPath, error_);
        error("Hot reload failed:", error_);
    }
};

const savesAwaiting = (session: DevSession, createdPath: string): string[] =>
    [...session.pendingSaves]
        .filter(([, missingName]) => isMissingImport(createdPath, missingName))
        .map(([changedPath]) => changedPath);

const retryPendingSaves = async (session: DevSession, waiting: string[]): Promise<void> => {
    for (const changedPath of waiting) {
        if (session.controller.isShuttingDown()) {
            return;
        }

        session.pendingSaves.delete(changedPath);
        await applySave(session, changedPath, RETRY_ACTION);
    }
};

const handleFileCreate = async (session: DevSession, createdPath: string): Promise<void> => {
    const waiting = savesAwaiting(session, createdPath);

    if (waiting.length === 0) {
        return;
    }

    session.deps.log(`File created: ${createdPath}`);

    if (session.failure.isDown()) {
        await requestRestart(session);

        return;
    }

    await retryPendingSaves(session, waiting);
};

const handleFileRemove = async (session: DevSession, removedPath: string): Promise<void> => {
    if (!session.server.moduleGraph.getModuleById(removedPath)) {
        return;
    }

    session.deps.log(`File removed: ${removedPath}`);
    await requestRestart(session);
};

const createShutdownController = (server: DevServer, deps: DevRunnerDeps): ShutdownController => {
    let isShuttingDown = false;

    return {
        isShuttingDown: () => isShuttingDown,
        shutdown: async (quitApplication: () => void): Promise<void> => {
            if (isShuttingDown) {
                return;
            }

            isShuttingDown = true;
            quitApplication();
            deps.stopMcpClient();
            await server.close();
        },
    };
};

const restartForServerConfig = async (session: DevSession, changedPath: string): Promise<void> => {
    session.deps.log(`Server config changed: ${changedPath}`);
    await requestRestart(session);
};

const applyChange = async (session: DevSession, change: WatchedChange): Promise<void> => {
    if (session.controller.isShuttingDown()) {
        return;
    }

    if (isServerConfigFile(session.server.config, change.path)) {
        await restartForServerConfig(session, change.path);

        return;
    }

    if (change.event === "add") {
        await handleFileCreate(session, change.path);

        return;
    }

    if (change.event === "unlink") {
        await handleFileRemove(session, change.path);

        return;
    }

    await applySave(session, change.path, SAVE_ACTION);
};

const watchProjectFiles = (session: DevSession): void => {
    const queue = createChangeQueue((change) => applyChange(session, change));

    for (const event of WATCH_EVENTS) {
        session.server.watcher.on(event, (path) => {
            queue.enqueue({ event, path });
        });
    }
};

const onShutdownSignal = (session: DevSession): (() => Promise<void>) => async () => {
    if (session.controller.isShuttingDown()) {
        return;
    }

    session.deps.log("Received shutdown signal - stopping dev runner...");

    await session.controller.shutdown(() => {
        session.deps.quitDefaultApplication();
    });
};

const closeAndExit = async (session: DevSession, code = 0): Promise<never> => {
    try {
        await session.controller.shutdown((): void => undefined);
    } catch (error_) {
        error("Error closing server:", error_);

        return session.deps.exit(1);
    }

    return session.deps.exit(code);
};

const isSessionInactive = (session: DevSession): boolean => {
    if (session.controller.isShuttingDown()) {
        return true;
    }

    if (!session.failure.isDown()) {
        return false;
    }

    parkSession(session);

    return true;
};

const stopForApplicationQuit = (session: DevSession): Promise<never> => {
    session.deps.log("Application quit - stopping dev runner...");

    return closeAndExit(session);
};

const settleUnmount = (session: DevSession, wasRefreshing: boolean): void => {
    if (isSessionInactive(session)) {
        return;
    }

    if (!wasRefreshing) {
        void stopForApplicationQuit(session);

        return;
    }

    session.deps.log("Application unmounted during Fast Refresh - restarting dev runner...");
    session.deps.exit(RESTART_EXIT_CODE);
};

const handleApplicationShutdown = (session: DevSession): void => {
    if (isSessionInactive(session)) {
        return;
    }

    const wasRefreshing = session.refreshTracker.isRefreshing();

    session.failure.settleUnmount(() => {
        settleUnmount(session, wasRefreshing);
    });
};

const onApplicationShutdown = (session: DevSession): (() => void) => () => {
    handleApplicationShutdown(session);
};

const refusedExitCode = (): number => (process.exitCode === undefined ? 1 : Number(process.exitCode));

const connectApplication = async (session: DevSession, liveApplicationId: string): Promise<void> => {
    const { deps, server } = session;
    deps.watchApplicationShutdown(onApplicationShutdown(session));
    const applicationId = (await deps.getConfiguredApplicationId(process.cwd())) ?? liveApplicationId;
    deps.log(`Connected application ID: ${applicationId}`);
    await deps.startMcpClient(applicationId, (id) => loadModuleExclusively(server, id));
};

const stopForOwnedApplicationId = async (session: DevSession, liveApplicationId: string): Promise<void> => {
    session.deps.log(
        `Another process already owns ${liveApplicationId}, so this session can never show a window - ` +
        "stopping dev runner. Quit that instance or change applicationId, then start gtkx dev again.",
    );

    await closeAndExit(session, OWNED_ID_EXIT_CODE);
};

const stopForStoppedApplication = async (session: DevSession, instance: ApplicationInstance): Promise<void> => {
    if (session.failure.hasReported()) {
        session.deps.log("Application stopped before the dev runner attached.");
        session.failure.fail();

        return;
    }

    if (instance === "shutDown") {
        await stopForApplicationQuit(session);

        return;
    }

    session.deps.log("Application refused its command line - stopping dev runner...");
    await closeAndExit(session, refusedExitCode());
};

const connectLiveApplication = async (session: DevSession, liveApplicationId: string): Promise<void> => {
    const instance = session.deps.getApplicationInstance();

    if (instance === "primary") {
        await connectApplication(session, liveApplicationId);

        return;
    }

    if (instance === "remote") {
        await stopForOwnedApplicationId(session, liveApplicationId);

        return;
    }

    await stopForStoppedApplication(session, instance);
};

const attachApplication = async (session: DevSession): Promise<void> => {
    const { deps, failure } = session;

    const liveApplicationId = await deps.waitForApplicationId(
        APPLICATION_MOUNT_TIMEOUT_MS,
        () => !failure.isDown(),
    );

    if (failure.isDown()) {
        return;
    }

    if (liveApplicationId === null) {
        deps.log("Entry did not mount an application - MCP client not started.");

        return;
    }

    await connectLiveApplication(session, liveApplicationId);
};

const loadEntry = async (session: DevSession, entryPath: string): Promise<void> => {
    session.deps.log(`Loading entry: ${entryPath}`);

    try {
        await loadModuleExclusively(session.server, entryPath);
    } catch (error_) {
        awaitMissingImport(session, entryPath, error_);
        session.failure.fail(error_);
    }
};

const hasApplicationStopped = (instance: ApplicationInstance): boolean =>
    instance === "shutDown" || instance === "unregistered";

const isApplicationLost = (session: DevSession): boolean =>
    session.failure.hasReported() && hasApplicationStopped(session.deps.getApplicationInstance());

const announceReady = (session: DevSession): void => {
    if (isApplicationLost(session)) {
        session.failure.fail();
    }

    if (isSessionInactive(session)) {
        return;
    }

    session.deps.log("HMR enabled - watching for changes...");
};

const createSession = (server: DevServer, deps: DevRunnerDeps): DevSession => {
    const refreshTracker = createRefreshTracker(deps.performRefresh);

    return {
        server,
        deps: { ...deps, performRefresh: refreshTracker.performRefresh },
        controller: createShutdownController(server, deps),
        refreshTracker,
        failure: createFailureTracker((cause) => {
            announceFailure(server, cause);
        }, refreshTracker.isRefreshing),
        pendingSaves: new Map(),
    };
};

const createDevRunner = (deps: DevRunnerDeps): DevRunner => ({
    async run(entryPath: string): Promise<void> {
        const server = await deps.createServer(createDevServerConfig(process.cwd(), deps.plugins(entryPath)));
        const session = createSession(server, deps);
        deps.installShutdownHandlers(onShutdownSignal(session));

        deps.watchUncaughtErrors((cause) => {
            session.failure.report(cause);
        });

        watchProjectFiles(session);
        await loadEntry(session, entryPath);
        await attachApplication(session);
        announceReady(session);
    },
});

export { createDevRunner, type DevRunnerDeps };
