import { resolve } from "node:path";
import type { InlineConfig, Plugin, ViteDevServer } from "vite";
import { RELOAD_EXIT_CODE } from "./dev-protocol.js";

const ENTRY_ARG_INDEX = 2;

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
    startMcpClient(appId: string): Promise<unknown>;
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
export type DevRunner = {
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

        const appId = deps.getApplicationId();
        if (appId) {
            deps.log(`Connected app id: ${appId}`);
            await deps.startMcpClient(appId);
        } else {
            deps.log("Entry did not call render() — MCP client not started.");
        }

        deps.log("HMR enabled - watching for changes...");
    },
});

/**
 * Runner entry point invoked by the CLI supervisor.
 *
 * Reads the entry path from `process.argv`, builds the production runner via
 * a dynamic import of `dev-runner-deps.ts`, and runs it. Exits with code `1`
 * if the supervisor failed to pass an entry path.
 */
export const main = async (): Promise<void> => {
    const cwd = process.cwd();
    const entryArg = process.argv[ENTRY_ARG_INDEX];

    if (!entryArg) {
        console.error("[gtkx-dev-runner] Missing entry argument");
        process.exit(1);
    }

    const entryPath = resolve(cwd, entryArg);
    const { defaultDevRunnerDeps } = await import("./dev-runner-deps.js");
    const runner = createDevRunner(defaultDevRunnerDeps());
    await runner.run(entryPath);
};
