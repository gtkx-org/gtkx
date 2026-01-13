import { events } from "@gtkx/ffi";
import { setHotReloading, update } from "@gtkx/react";
import { createServer, type InlineConfig, type ViteDevServer } from "vite";
import { isReactRefreshBoundary, performRefresh } from "./refresh-runtime.js";
import { gtkxRefresh } from "./vite-plugin-gtkx-refresh.js";
import { swcSsrRefresh } from "./vite-plugin-swc-ssr-refresh.js";

/**
 * Options for the GTKX development server.
 */
export type DevServerOptions = {
    /** Path to the entry file (e.g., "src/dev.tsx") */
    entry: string;
    /** Additional Vite configuration */
    vite?: InlineConfig;
};

type AppModule = {
    default: () => React.ReactNode;
};

/**
 * Creates a Vite-based development server with hot module replacement.
 *
 * Provides fast refresh for React components and full reload for other changes.
 * The server watches for file changes and automatically updates the running
 * GTK application.
 *
 * @param options - Server configuration including entry point and Vite options
 * @returns A Vite development server instance
 *
 * @example
 * ```tsx
 * import { createDevServer } from "@gtkx/cli";
 * import { render } from "@gtkx/react";
 *
 * const server = await createDevServer({
 * entry: "./src/dev.tsx",
 * });
 *
 * const mod = await server.ssrLoadModule("./src/dev.tsx");
 * render(<mod.default />, mod.appId);
 * ```
 *
 * @see {@link DevServerOptions} for configuration options
 */
export const createDevServer = async (options: DevServerOptions): Promise<ViteDevServer> => {
    const { entry, vite: viteConfig } = options;

    const moduleExports = new Map<string, Record<string, unknown>>();

    const server = await createServer({
        ...viteConfig,
        appType: "custom",
        plugins: [
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
        server: {
            ...viteConfig?.server,
            middlewareMode: true,
        },
        optimizeDeps: {
            ...viteConfig?.optimizeDeps,
            noDiscovery: true,
            include: [],
        },
        ssr: {
            ...viteConfig?.ssr,
            external: true,
        },
    });

    const loadModule = async (): Promise<AppModule> => {
        const mod = (await server.ssrLoadModule(entry)) as AppModule;
        moduleExports.set(entry, { ...mod });
        return mod;
    };

    const invalidateAllModules = (): void => {
        for (const module of server.moduleGraph.idToModuleMap.values()) {
            server.moduleGraph.invalidateModule(module);
        }
    };

    const invalidateModuleAndImporters = (filePath: string): void => {
        const module = server.moduleGraph.getModuleById(filePath);

        if (module) {
            server.moduleGraph.invalidateModule(module);

            for (const importer of module.importers) {
                server.moduleGraph.invalidateModule(importer);
            }
        }
    };

    events.on("stop", () => {
        server.close();
    });

    server.watcher.on("change", async (changedPath) => {
        try {
            const module = server.moduleGraph.getModuleById(changedPath);

            if (!module) {
                return;
            }

            console.log(`[gtkx] File changed: ${changedPath}`);

            invalidateModuleAndImporters(changedPath);

            const newMod = (await server.ssrLoadModule(changedPath)) as Record<string, unknown>;
            moduleExports.set(changedPath, { ...newMod });

            if (isReactRefreshBoundary(newMod)) {
                console.log("[gtkx] Fast refreshing...");
                performRefresh();
                console.log("[gtkx] Fast refresh complete");
                return;
            }

            console.log("[gtkx] Full reload...");
            invalidateAllModules();

            const mod = await loadModule();
            const App = mod.default;

            if (typeof App !== "function") {
                console.error("[gtkx] Entry file must export a default function component");
                return;
            }

            setHotReloading(true);
            try {
                await update(<App />);
            } finally {
                setHotReloading(false);
            }
            console.log("[gtkx] Full reload complete");
        } catch (error) {
            console.error("[gtkx] Hot reload failed:", error);
        }
    });

    return server;
};

export type { ViteDevServer };
