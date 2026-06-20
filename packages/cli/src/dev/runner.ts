import type { InlineConfig, Plugin } from "vite";
import { error } from "../internal/log.js";
import { RELOAD_EXIT_CODE } from "./protocol.js";
import { createRefreshTracker } from "./refresh-tracker.js";
import { buildConfig, type DevServer } from "./vite-dev-server.js";

export type { DevServer } from "./vite-dev-server.js";

/**
 * Collaborators the dev runner uses to talk to the outside world.
 *
 * Production wires this to Vite, the GLib runtime, and the MCP client; tests
 * inject deterministic mocks via {@link createDevRunner}.
 */
export type DevRunnerDeps = {
    createServer(config: InlineConfig): Promise<DevServer>;
    getApplicationId(): string | null;
    getConfiguredApplicationId(root: string): Promise<string | undefined>;
    startMcpClient(
        applicationId: string,
        loadAppModule: (id: string) => Promise<Record<string, unknown>>,
    ): Promise<unknown>;
    stopMcpClient(): void;
    installApplicationLifecycle(
        loadAppModule: (id: string) => Promise<Record<string, unknown>>,
        onQuit: (runDefaultQuit: () => void) => void,
    ): Promise<void>;
    installShutdownHandlers(onSignal: () => void | Promise<void>): void;
    quitDefaultApplication(): void;
    performRefresh(): void;
    isReactRefreshBoundary(module: Record<string, unknown>): boolean;
    plugins(): Plugin[];
    log(message: string): void;
    exit(code: number): never;
};

/**
 * The dev runner exposes a single `run` method; everything else is
 * encapsulated by the closure returned from {@link createDevRunner}.
 */
type DevRunner = {
    /**
     * Starts the Vite dev server, registers file watchers, loads the user's
     * entry, and connects the MCP client when the entry registers a
     * `Gio.Application`. The client registers under the `applicationId` from
     * `gtkx.config.ts` when one is declared, else under the live application's
     * id. Resolves once the runner is fully wired and HMR is active; never
     * resolves if the entry triggers a process exit.
     *
     * @param entryPath - Absolute path of the user's entry module.
     */
    run(entryPath: string): Promise<void>;
};

const requestReload = async (server: DevServer, deps: DevRunnerDeps): Promise<never> => {
    deps.log("Full reload (process restart)");
    await server.close();
    return deps.exit(RELOAD_EXIT_CODE);
};

const handleFileChange = async (server: DevServer, deps: DevRunnerDeps, changedPath: string): Promise<void> => {
    const module = server.moduleGraph.getModuleById(changedPath);
    if (!module) return;

    deps.log(`File changed: ${changedPath}`);

    server.moduleGraph.invalidateModule(module);
    for (const importer of module.importers) {
        server.moduleGraph.invalidateModule(importer);
    }

    const newMod = await server.ssrLoadModule(changedPath);
    if (deps.isReactRefreshBoundary(newMod)) {
        deps.log("Fast refreshing...");
        deps.performRefresh();
        deps.log("Fast refresh complete");
        return;
    }

    await requestReload(server, deps);
};

/**
 * Builds a configured dev runner.
 *
 * The factory takes every side-effecting collaborator via `deps`, leaving
 * the runner's logic pure and observable from tests.
 *
 * @param deps - Side-effecting collaborators.
 * @returns The configured {@link DevRunner}.
 */
export const createDevRunner = (deps: DevRunnerDeps): DevRunner => ({
    async run(entryPath: string): Promise<void> {
        const root = process.cwd();
        const server = await deps.createServer(buildConfig(root, deps.plugins()));

        const refreshTracker = createRefreshTracker(deps.performRefresh);
        const refreshTrackingDeps: DevRunnerDeps = { ...deps, performRefresh: refreshTracker.performRefresh };

        let isShuttingDown = false;
        const shutdown = async (quitApplication: () => void): Promise<void> => {
            if (isShuttingDown) return;
            isShuttingDown = true;
            quitApplication();
            deps.stopMcpClient();
            await server.close();
        };

        deps.installShutdownHandlers(async () => {
            if (isShuttingDown) return;
            deps.log("Received shutdown signal - stopping dev runner...");
            await shutdown(() => deps.quitDefaultApplication());
        });

        server.watcher.on("change", (changedPath) => {
            if (isShuttingDown) return;
            handleFileChange(server, refreshTrackingDeps, changedPath).catch((cause) => {
                error("Hot reload failed:", cause);
            });
        });

        deps.log(`Loading entry: ${entryPath}`);
        await server.ssrLoadModule(entryPath);

        await deps.installApplicationLifecycle(
            (id) => server.ssrLoadModule(id),
            (runDefaultQuit) => {
                if (isShuttingDown) return;
                if (refreshTracker.isRefreshing()) {
                    deps.log("Application unmounted during Fast Refresh - restarting dev runner...");
                    return deps.exit(RELOAD_EXIT_CODE);
                }
                deps.log("Application quit - stopping dev runner...");
                shutdown(runDefaultQuit).catch((error: unknown) => {
                    console.error("[gtkx-dev-runner] Error closing server:", error);
                });
            },
        );

        const liveApplicationId = deps.getApplicationId();
        if (liveApplicationId) {
            const applicationId = (await deps.getConfiguredApplicationId(root)) ?? liveApplicationId;
            deps.log(`Connected application id: ${applicationId}`);
            await deps.startMcpClient(applicationId, (id) => server.ssrLoadModule(id));
        } else {
            deps.log("Entry did not mount an application — MCP client not started.");
        }

        deps.log("HMR enabled - watching for changes...");
    },
});
