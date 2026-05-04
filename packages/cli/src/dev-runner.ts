import { resolve } from "node:path";
import { events } from "@gtkx/ffi";
import * as Gio from "@gtkx/ffi/gio";
import { createServer, type ViteDevServer } from "vite";
import { RELOAD_EXIT_CODE } from "./dev-protocol.js";
import { startMcpClient, stopMcpClient } from "./mcp-client.js";
import { isReactRefreshBoundary, performRefresh } from "./refresh-runtime.js";
import { gtkxAssets } from "./vite-plugin-gtkx-assets.js";
import { gtkxGSettings } from "./vite-plugin-gtkx-gsettings.js";
import { gtkxRefresh } from "./vite-plugin-gtkx-refresh.js";
import { swcSsrRefresh } from "./vite-plugin-swc-ssr-refresh.js";

/**
 * Argv slot the CLI supervisor uses to pass the entry path to the runner.
 * Anything beyond `argv[2]` is reserved for future runner flags.
 */
export const ENTRY_ARG_INDEX = 2;

/**
 * Logs a runner-prefixed message to stdout.
 *
 * @param message - The message text to emit.
 */
export const log = (message: string): void => {
    console.log(`[gtkx] ${message}`);
};

/**
 * Creates the Vite dev server used by the runner.
 *
 * Wires the GTKX plugins, disables file discovery, and configures custom
 * middleware mode so the runner controls module loading via SSR.
 *
 * @param root - Project root directory.
 */
export const createViteDevServer = async (root: string): Promise<ViteDevServer> => {
    return createServer({
        root,
        appType: "custom",
        plugins: [
            gtkxGSettings(),
            gtkxAssets(),
            swcSsrRefresh(),
            gtkxRefresh(),
            {
                name: "gtkx:remove-react-dom-optimized",
                enforce: "post",
                config(config) {
                    config.optimizeDeps ??= {};
                    config.optimizeDeps.include = config.optimizeDeps.include?.filter(
                        (dep) => dep !== "react-dom" && !dep.startsWith("react-dom/"),
                    );
                },
            },
        ],
        server: { middlewareMode: true },
        optimizeDeps: { noDiscovery: true, include: [] },
        ssr: { external: true },
    });
};

/**
 * Closes the Vite dev server and exits with {@link RELOAD_EXIT_CODE}.
 *
 * The CLI supervisor watches for this exit code to relaunch the runner.
 *
 * @param server - The active Vite dev server to shut down.
 */
export const requestReload = async (server: ViteDevServer): Promise<never> => {
    log("Full reload (process restart)");
    await server.close();
    process.exit(RELOAD_EXIT_CODE);
};

/**
 * Reacts to a watched file change by invalidating modules and either fast
 * refreshing or requesting a full reload.
 *
 * Returns silently when the changed file is not part of the module graph.
 * Performs a React fast-refresh when the reloaded module is a refresh
 * boundary; otherwise delegates to {@link requestReload}.
 *
 * @param server - The active Vite dev server.
 * @param changedPath - Absolute path of the changed file.
 */
export const handleFileChange = async (server: ViteDevServer, changedPath: string): Promise<void> => {
    const module = server.moduleGraph.getModuleById(changedPath);
    if (!module) return;

    log(`File changed: ${changedPath}`);

    server.moduleGraph.invalidateModule(module);
    for (const importer of module.importers) {
        server.moduleGraph.invalidateModule(importer);
    }

    const newMod = (await server.ssrLoadModule(changedPath)) as Record<string, unknown>;
    if (isReactRefreshBoundary(newMod)) {
        log("Fast refreshing...");
        performRefresh();
        log("Fast refresh complete");
        return;
    }

    await requestReload(server);
};

/**
 * Runner entry point invoked by the CLI supervisor.
 *
 * Reads the entry path from `process.argv`, starts the Vite dev server,
 * registers watchers, and loads the user entry. When the entry calls
 * `render()` (registering a `Gio.Application`), connects to the MCP socket
 * server using the app id.
 */
export const main = async (): Promise<void> => {
    const cwd = process.cwd();
    const entryArg = process.argv[ENTRY_ARG_INDEX];

    if (!entryArg) {
        console.error("[gtkx-dev-runner] Missing entry argument");
        process.exit(1);
    }

    const entryPath = resolve(cwd, entryArg);
    const server = await createViteDevServer(cwd);

    events.on("stop", () => {
        stopMcpClient();
        server.close().catch((error: unknown) => {
            console.error("[gtkx-dev-runner] Error closing server:", error);
        });
    });

    server.watcher.on("change", (changedPath) => {
        handleFileChange(server, changedPath).catch((error) => {
            console.error("[gtkx] Hot reload failed:", error);
        });
    });

    log(`Loading entry: ${entryPath}`);
    await server.ssrLoadModule(entryPath);

    const application = Gio.Application.getDefault();
    const appId = application?.applicationId;
    if (appId) {
        log(`Connected app id: ${appId}`);
        await startMcpClient(appId);
    } else {
        log("Entry did not call render() — MCP client not started.");
    }

    log("HMR enabled - watching for changes...");
};
