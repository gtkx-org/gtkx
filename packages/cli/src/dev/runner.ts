import type { InlineConfig, Plugin, ViteDevServer } from "vite";
import { RELOAD_EXIT_CODE } from "./protocol.js";

/**
 * Collaborators the dev runner uses to talk to the outside world.
 *
 * Production wires this to Vite, the GLib runtime, and the MCP client; tests
 * inject deterministic mocks via {@link createDevRunner}.
 */
export type DevRunnerDeps = {
    createServer(config: InlineConfig): Promise<ViteDevServer>;
    whenStopped(): Promise<void>;
    getApplicationId(): string | null;
    getConfiguredApplicationId(root: string): Promise<string | undefined>;
    startMcpClient(
        applicationId: string,
        loadAppModule: (id: string) => Promise<Record<string, unknown>>,
    ): Promise<unknown>;
    stopMcpClient(): void;
    installApplicationTeardown(
        loadAppModule: (id: string) => Promise<Record<string, unknown>>,
        onTeardown: (runDefaultTeardown: () => void) => void,
    ): Promise<void>;
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

/**
 * The dev server's inline Vite config. SSR externalizes every dependency so
 * the FFI runtime, the generated `@gtkx/gi` store, and the native module load
 * through Node under a single module identity — except the packages that
 * import `virtual:gtkx-config` or `@gtkx/react`: those run through Vite's
 * pipeline, where the `gtkx:config` plugin serves the virtual module and the
 * one transformed `@gtkx/react` instance is shared by app code, the generated
 * `@gtkx/jsx` modules, and `@gtkx/animate`.
 */
const buildConfig = (root: string, plugins: Plugin[]): InlineConfig => ({
    root,
    appType: "custom",
    plugins,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { external: true, noExternal: [/^@gtkx\/(config|react|jsx|animate)(\/|$)/, /[/\\]\.gtkx[/\\]/] },
});

type RefreshTracker = {
    performRefresh(): void;
    isRefreshing(): boolean;
};

/**
 * Wraps `performRefresh` so the runner can tell a refresh-induced application
 * unmount apart from an organic quit. React flushes the sync work a refresh
 * schedules on a microtask, so the refresh window stays open for one macrotask
 * after the refresh call returns.
 *
 * @param performRefresh - The underlying Fast Refresh trigger.
 * @returns The wrapped trigger and the window predicate.
 */
const createRefreshTracker = (performRefresh: () => void): RefreshTracker => {
    let refreshing = false;
    return {
        performRefresh: () => {
            refreshing = true;
            try {
                performRefresh();
            } finally {
                setTimeout(() => {
                    refreshing = false;
                }, 0);
            }
        },
        isRefreshing: () => refreshing,
    };
};

const requestReload = async (server: ViteDevServer, deps: DevRunnerDeps): Promise<never> => {
    deps.log("Full reload (process restart)");
    await server.close();
    return deps.exit(RELOAD_EXIT_CODE);
};

const handleFileChange = async (server: ViteDevServer, deps: DevRunnerDeps, changedPath: string): Promise<void> => {
    const module = server.moduleGraph.getModuleById(changedPath);
    if (!module) return;

    deps.log(`File changed: ${changedPath}`);

    server.moduleGraph.invalidateModule(module);
    for (const importer of module.importers) {
        server.moduleGraph.invalidateModule(importer);
    }

    const newMod = (await server.ssrLoadModule(changedPath)) as Record<string, unknown>;
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
        deps.whenStopped()
            .then(async () => {
                isShuttingDown = true;
                deps.stopMcpClient();
                await server.close();
            })
            .catch((error: unknown) => {
                console.error("[gtkx-dev-runner] Error closing server:", error);
            });

        server.watcher.on("change", (changedPath) => {
            if (isShuttingDown) return;
            handleFileChange(server, refreshTrackingDeps, changedPath).catch((error) => {
                console.error("[gtkx] Hot reload failed:", error);
            });
        });

        deps.log(`Loading entry: ${entryPath}`);
        await server.ssrLoadModule(entryPath);

        await deps.installApplicationTeardown(
            (id) => server.ssrLoadModule(id),
            (runDefaultTeardown) => {
                if (isShuttingDown) return;
                if (refreshTracker.isRefreshing()) {
                    deps.log("Application unmounted during Fast Refresh - restarting dev runner...");
                    return deps.exit(RELOAD_EXIT_CODE);
                }
                deps.log("Application quit - stopping dev runner...");
                runDefaultTeardown();
            },
        );

        const liveApplicationId = deps.getApplicationId();
        if (liveApplicationId) {
            const applicationId = (await deps.getConfiguredApplicationId(root)) ?? liveApplicationId;
            deps.log(`Connected application id: ${applicationId}`);
            await deps.startMcpClient(applicationId, (id) => server.ssrLoadModule(id));
        } else {
            deps.log("Entry did not call render() — MCP client not started.");
        }

        deps.log("HMR enabled - watching for changes...");
    },
});
