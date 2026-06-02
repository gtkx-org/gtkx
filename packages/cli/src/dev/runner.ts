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
    startMcpClient(applicationId: string): Promise<unknown>;
    stopMcpClient(): void;
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
     * `Gio.Application`. Resolves once the runner is fully wired and HMR is
     * active; never resolves if the entry triggers a process exit.
     *
     * @param entryPath - Absolute path of the user's entry module.
     */
    run(entryPath: string): Promise<void>;
};

const buildConfig = (root: string, plugins: Plugin[]): InlineConfig => ({
    root,
    appType: "custom",
    plugins,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { external: true },
});

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
            handleFileChange(server, deps, changedPath).catch((error) => {
                console.error("[gtkx] Hot reload failed:", error);
            });
        });

        deps.log(`Loading entry: ${entryPath}`);
        await server.ssrLoadModule(entryPath);

        const applicationId = deps.getApplicationId();
        if (applicationId) {
            deps.log(`Connected application id: ${applicationId}`);
            await deps.startMcpClient(applicationId);
        } else {
            deps.log("Entry did not call render() — MCP client not started.");
        }

        deps.log("HMR enabled - watching for changes...");
    },
});
