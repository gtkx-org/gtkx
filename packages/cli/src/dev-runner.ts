import "./refresh-runtime.js";

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
const ENTRY_ARG_INDEX = 2;

const log = (message: string): void => {
    console.log(`[gtkx] ${message}`);
};

const createViteDevServer = async (root: string): Promise<ViteDevServer> => {
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

const requestReload = async (server: ViteDevServer): Promise<never> => {
    log("Full reload (process restart)");
    await server.close();
    process.exit(RELOAD_EXIT_CODE);
};

const handleFileChange = async (server: ViteDevServer, changedPath: string): Promise<void> => {
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

const main = async (): Promise<void> => {
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
        void server.close();
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

main().catch((error) => {
    console.error("[gtkx-dev-runner] Fatal:", error);
    process.exit(1);
});
