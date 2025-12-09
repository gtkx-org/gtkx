import { update } from "@gtkx/react";
import react from "@vitejs/plugin-react";
import { createServer, type InlineConfig, type ViteDevServer } from "vite";

export interface DevServerOptions {
    /** Path to the app entry file (e.g., "./src/app.tsx") */
    entry: string;
    /** Vite configuration overrides */
    vite?: InlineConfig;
}

interface AppModule {
    default: () => React.ReactNode;
}

/**
 * Creates and starts a GTKX development server with HMR support.
 */
export const createDevServer = async (options: DevServerOptions): Promise<ViteDevServer> => {
    const { entry, vite: viteConfig } = options;

    const server = await createServer({
        ...viteConfig,
        appType: "custom",
        plugins: [react()],
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
        return server.ssrLoadModule(entry) as Promise<AppModule>;
    };

    const invalidateAllModules = (): void => {
        for (const module of server.moduleGraph.idToModuleMap.values()) {
            server.moduleGraph.invalidateModule(module);
        }
    };

    server.watcher.on("change", async (changedPath) => {
        console.log(`[gtkx] File changed: ${changedPath}`);

        invalidateAllModules();

        try {
            const mod = await loadModule();
            const App = mod.default;

            if (typeof App !== "function") {
                console.error("[gtkx] Entry file must export a default function component");
                return;
            }

            console.log("[gtkx] Hot reloading...");
            update(<App />);
            console.log("[gtkx] Hot reload complete");
        } catch (error) {
            console.error("[gtkx] Hot reload failed:", error);
        }
    });

    return server;
};

export type { ViteDevServer };
