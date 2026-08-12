import type { InlineConfig, Plugin } from "vite";

type DevServerModule = object;

type DevServerChangedModule = DevServerModule & {
    importers: Iterable<DevServerModule>;
    ssrModule?: Record<string, unknown> | null;
};

type DevServerModuleGraph = {
    getModuleById(id: string): DevServerChangedModule | undefined;
    invalidateModule(module: DevServerModule): void;
};

type DevServer = {
    close(): Promise<void>;
    moduleGraph: DevServerModuleGraph;
    ssrLoadModule(id: string): Promise<Record<string, unknown>>;
    ssrFixStacktrace(cause: Error): void;
    watcher: {
        on(event: "change", listener: (changedPath: string) => void): void;
    };
};

const WRITE_STABILITY_THRESHOLD_MS = 50;
const WRITE_POLL_INTERVAL_MS = 10;

const createDevServerConfig = (root: string, plugins: Plugin[]): InlineConfig => ({
    root,
    appType: "custom",
    plugins,
    server: {
        middlewareMode: true,
        watch: {
            awaitWriteFinish: {
                stabilityThreshold: WRITE_STABILITY_THRESHOLD_MS,
                pollInterval: WRITE_POLL_INTERVAL_MS,
            },
        },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: {
        external: true,
        noExternal: [/^@gtkx\/(?!(?:native|gi|gl|runtime|utils|css)(?:\/|$))/, /[/\\]\.gtkx[/\\]/],
    },
});

export { createDevServerConfig, type DevServer, type DevServerChangedModule };
