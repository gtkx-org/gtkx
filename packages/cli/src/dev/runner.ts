import type { InlineConfig, Plugin } from "vite";
import { error } from "@gtkx/utils";
import { createFailureTracker, type FailureTracker } from "./failure-tracker.js";
import { createRefreshTracker, type RefreshTracker } from "./refresh-tracker.js";
import { RESTART_EXIT_CODE } from "./supervisor.js";
import { createDevServerConfig, type DevServer, type DevServerChangedModule } from "./vite-dev-server.js";

type LoadAppModule = (id: string) => Promise<Record<string, unknown>>;

type DevRunnerDeps = {
    createServer(config: InlineConfig): Promise<DevServer>;
    waitForApplicationId(timeoutMs: number, shouldKeepWaiting: () => boolean): Promise<string | null>;
    getConfiguredApplicationId(root: string): Promise<string | undefined>;
    startMcpClient(applicationId: string, loadAppModule: LoadAppModule): Promise<unknown>;
    stopMcpClient(): void;
    watchApplicationShutdown(onShutdown: () => void): void;
    watchUncaughtErrors(onUncaughtError: (cause: unknown) => void): void;
    isApplicationRegistered(): boolean;
    installShutdownHandlers(onSignal: () => void | Promise<void>): void;
    quitDefaultApplication(): void;
    performRefresh: () => void;
    isRefreshBoundary(module: Record<string, unknown>): boolean;
    plugins(): Plugin[];
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
};

const APPLICATION_MOUNT_TIMEOUT_MS = 10_000;

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
    await session.server.close();

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

const refreshChangedModule = async (session: DevSession, changedPath: string): Promise<void> => {
    const loadedExports = await session.server.ssrLoadModule(changedPath);

    if (!session.deps.isRefreshBoundary(loadedExports)) {
        await requestRestart(session);

        return;
    }

    session.deps.log("Running Fast Refresh...");
    session.deps.performRefresh();
    session.deps.log("Fast Refresh complete");
};

const handleFileChange = async (session: DevSession, changedPath: string): Promise<void> => {
    const module = session.server.moduleGraph.getModuleById(changedPath);

    if (!module) {
        return;
    }

    session.deps.log(`File changed: ${changedPath}`);

    if (requiresRestart(session, module)) {
        await requestRestart(session);

        return;
    }

    session.server.moduleGraph.invalidateModule(module);

    for (const importer of module.importers) {
        session.server.moduleGraph.invalidateModule(importer);
    }

    await refreshChangedModule(session, changedPath);
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

const reloadChangedFile = async (session: DevSession, changedPath: string): Promise<void> => {
    try {
        await handleFileChange(session, changedPath);
    } catch (error_) {
        error("Hot reload failed:", error_);
    }
};

const onFileChange = (session: DevSession): ((changedPath: string) => void) => (changedPath) => {
    if (session.controller.isShuttingDown()) {
        return;
    }

    void reloadChangedFile(session, changedPath);
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

const settleUnmount = (session: DevSession, wasRefreshing: boolean): void => {
    if (session.controller.isShuttingDown()) {
        return;
    }

    if (session.failure.isDown()) {
        parkSession(session);

        return;
    }

    if (!wasRefreshing) {
        session.deps.log("Application quit - stopping dev runner...");
        void closeAndExit(session);

        return;
    }

    session.deps.log("Application unmounted during Fast Refresh - restarting dev runner...");
    session.deps.exit(RESTART_EXIT_CODE);
};

const handleApplicationShutdown = (session: DevSession): void => {
    if (session.controller.isShuttingDown()) {
        return;
    }

    if (session.failure.isDown()) {
        parkSession(session);

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
    await deps.startMcpClient(applicationId, (id) => server.ssrLoadModule(id));
};

const connectRegisteredApplication = async (session: DevSession, liveApplicationId: string): Promise<void> => {
    if (session.deps.isApplicationRegistered()) {
        await connectApplication(session, liveApplicationId);

        return;
    }

    if (session.failure.hasReported()) {
        session.deps.log("Application stopped before the dev runner attached.");
        session.failure.fail();

        return;
    }

    session.deps.log("Application refused its command line - stopping dev runner...");
    await closeAndExit(session, refusedExitCode());
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

    await connectRegisteredApplication(session, liveApplicationId);
};

const loadEntry = async (session: DevSession, entryPath: string): Promise<void> => {
    session.deps.log(`Loading entry: ${entryPath}`);

    try {
        await session.server.ssrLoadModule(entryPath);
    } catch (error_) {
        session.failure.fail(error_);
    }
};

const isApplicationLost = (session: DevSession): boolean =>
    session.failure.hasReported() && !session.deps.isApplicationRegistered();

const announceReady = (session: DevSession): void => {
    if (isApplicationLost(session)) {
        session.failure.fail();
    }

    if (session.failure.isDown()) {
        parkSession(session);

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
    };
};

const createDevRunner = (deps: DevRunnerDeps): DevRunner => ({
    async run(entryPath: string): Promise<void> {
        const server = await deps.createServer(createDevServerConfig(process.cwd(), deps.plugins()));
        const session = createSession(server, deps);
        deps.installShutdownHandlers(onShutdownSignal(session));

        deps.watchUncaughtErrors((cause) => {
            session.failure.report(cause);
        });

        server.watcher.on("change", onFileChange(session));
        await loadEntry(session, entryPath);
        await attachApplication(session);
        announceReady(session);
    },
});

export type { DevServer } from "./vite-dev-server.js";
export { createDevRunner, type DevRunnerDeps };
