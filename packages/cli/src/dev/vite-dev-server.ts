import type { InlineConfig, Plugin } from "vite";

type DevServerModule = object;

type DevServerChangedModule = DevServerModule & {
    importers: Iterable<DevServerModule>;
};

type DevServerModuleGraph = {
    getModuleById(id: string): DevServerChangedModule | undefined;
    invalidateModule(module: DevServerModule): void;
};

export type DevServer = {
    close(): Promise<void>;
    moduleGraph: DevServerModuleGraph;
    ssrLoadModule(id: string): Promise<Record<string, unknown>>;
    watcher: {
        on(event: "change", listener: (changedPath: string) => void): void;
    };
};

export const createDevServerConfig = (root: string, plugins: Plugin[]): InlineConfig => ({
    root,
    appType: "custom",
    plugins,
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: {
        external: true,
        noExternal: [/^@gtkx\/(?!(?:native|gi|gl|ffi|utils|css)(?:\/|$))/, /[/\\]\.gtkx[/\\]/],
    },
});
