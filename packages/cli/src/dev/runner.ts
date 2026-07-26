import type { InlineConfig, Plugin } from "vite";
import { error } from "@gtkx/utils";
import { createRefreshTracker, type RefreshTracker } from "./refresh-tracker.js";
import { RESTART_EXIT_CODE } from "./supervisor.js";
import { createDevServerConfig, type DevServer } from "./vite-dev-server.js";

export type { DevServer } from "./vite-dev-server.js";

const APPLICATION_MOUNT_TIMEOUT_MS = 10_000;

export type DevRunnerDeps = {
    createServer(config: InlineConfig): Promise<DevServer>;
    waitForApplicationId(timeoutMs: number): Promise<string | null>;
    getConfiguredApplicationId(root: string): Promise<string | undefined>;
    startMcpClient(
        applicationId: string,
        loadAppModule: (id: string) => Promise<Record<string, unknown>>,
    ): Promise<unknown>;
    stopMcpClient(): void;
    watchApplicationShutdown(onShutdown: () => void): void;
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

const requestRestart = async (server: DevServer, deps: DevRunnerDeps): Promise<never> => {
    deps.log("Full restart (process restart)");
    await server.close();
    return deps.exit(RESTART_EXIT_CODE);
};

const handleFileChange = async (server: DevServer, deps: DevRunnerDeps, changedPath: string): Promise<void> => {
    const module = server.moduleGraph.getModuleById(changedPath);
    if (!module) return;

    deps.log(`File changed: ${changedPath}`);

    const loadedExports = module.ssrModule;
    if (loadedExports && !deps.isRefreshBoundary(loadedExports)) {
        await requestRestart(server, deps);
        return;
    }

    server.moduleGraph.invalidateModule(module);
    for (const importer of module.importers) {
        server.moduleGraph.invalidateModule(importer);
    }

    const newMod = await server.ssrLoadModule(changedPath);
    if (deps.isRefreshBoundary(newMod)) {
        deps.log("Running Fast Refresh...");
        deps.performRefresh();
        deps.log("Fast Refresh complete");
        return;
    }

    await requestRestart(server, deps);
};

const createShutdownController = (server: DevServer, deps: DevRunnerDeps): ShutdownController => {
    let shuttingDown = false;

    return {
        isShuttingDown: () => shuttingDown,
        shutdown: async (quitApplication: () => void): Promise<void> => {
            if (shuttingDown) return;
            shuttingDown = true;
            quitApplication();
            deps.stopMcpClient();
            await server.close();
        },
    };
};

const reloadChangedFile = async (server: DevServer, deps: DevRunnerDeps, changedPath: string): Promise<void> => {
    try {
        await handleFileChange(server, deps, changedPath);
    } catch (error_) {
        error("Hot reload failed:", error_);
    }
};

const onFileChange =
    (server: DevServer, deps: DevRunnerDeps, controller: ShutdownController): ((changedPath: string) => void) =>
        (changedPath) => {
            if (controller.isShuttingDown()) return;
            void reloadChangedFile(server, deps, changedPath);
        };

const onShutdownSignal =
    (deps: DevRunnerDeps, controller: ShutdownController): (() => Promise<void>) =>
        async () => {
            if (controller.isShuttingDown()) return;
            deps.log("Received shutdown signal - stopping dev runner...");
            await controller.shutdown(() => deps.quitDefaultApplication());
        };

const closeAndExit = async (deps: DevRunnerDeps, controller: ShutdownController): Promise<never> => {
    try {
        await controller.shutdown(() => {});
    } catch (error_) {
        error("Error closing server:", error_);
        return deps.exit(1);
    }

    return deps.exit(0);
};

const onApplicationShutdown =
    (deps: DevRunnerDeps, refreshTracker: RefreshTracker, controller: ShutdownController): (() => void) =>
        () => {
            if (controller.isShuttingDown()) return;
            if (refreshTracker.isRefreshing()) {
                deps.log("Application unmounted during Fast Refresh - restarting dev runner...");
                return deps.exit(RESTART_EXIT_CODE);
            }
            deps.log("Application quit - stopping dev runner...");
            void closeAndExit(deps, controller);
        };

export const createDevRunner = (deps: DevRunnerDeps): DevRunner => ({
    async run(entryPath: string): Promise<void> {
        const root = process.cwd();
        const server = await deps.createServer(createDevServerConfig(root, deps.plugins()));

        const refreshTracker = createRefreshTracker(deps.performRefresh);
        const refreshTrackingDeps: DevRunnerDeps = { ...deps, performRefresh: refreshTracker.performRefresh };
        const controller = createShutdownController(server, deps);

        deps.installShutdownHandlers(onShutdownSignal(deps, controller));
        server.watcher.on("change", onFileChange(server, refreshTrackingDeps, controller));

        deps.log(`Loading entry: ${entryPath}`);
        await server.ssrLoadModule(entryPath);

        // React 19 mounts the application asynchronously, so poll for it rather than
        // reading a single snapshot immediately after loading the entry.
        const liveApplicationId = await deps.waitForApplicationId(APPLICATION_MOUNT_TIMEOUT_MS);
        if (liveApplicationId) {
            deps.watchApplicationShutdown(onApplicationShutdown(deps, refreshTracker, controller));

            const applicationId = (await deps.getConfiguredApplicationId(root)) ?? liveApplicationId;
            deps.log(`Connected application ID: ${applicationId}`);
            await deps.startMcpClient(applicationId, (id) => server.ssrLoadModule(id));
        } else {
            deps.log("Entry did not mount an application - MCP client not started.");
        }

        deps.log("HMR enabled - watching for changes...");
    },
});
