import type { InlineConfig, Plugin } from "vite";
import { join } from "node:path";

type DevServerModule = object;
type DevServerWatchEvent = "add" | "change" | "unlink";

type DevServerChangedModule = DevServerModule & {
    importers: Iterable<DevServerModule>;
    ssrModule?: Record<string, unknown> | null;
    ssrTransformResult?: object | null;
};

type DevServerModuleGraph = {
    getModuleById(id: string): DevServerChangedModule | undefined;
    invalidateModule(module: DevServerModule): void;
};

type DevServerConfig = {
    configFile: string | undefined;
    configFileDependencies: string[];
    envDir: string | false;
    mode: string;
    root: string;
};

type DevServer = {
    close(): Promise<void>;
    config: DevServerConfig;
    moduleGraph: DevServerModuleGraph;
    ssrLoadModule(id: string): Promise<Record<string, unknown>>;
    ssrFixStacktrace(cause: Error): void;
    watcher: {
        on(event: DevServerWatchEvent, listener: (changedPath: string) => void): void;
    };
};

const WRITE_STABILITY_THRESHOLD_MS = 50;
const WRITE_POLL_INTERVAL_MS = 10;
const ENV_FILE_SUFFIXES = ["", ".local"];

const envFilesForMode = (config: DevServerConfig): string[] => {
    const envDir = config.envDir;

    if (envDir === false) {
        return [];
    }

    return ENV_FILE_SUFFIXES.flatMap((suffix) => [
        join(envDir, `.env${suffix}`),
        join(envDir, `.env.${config.mode}${suffix}`),
    ]);
};

const isServerConfigFile = (config: DevServerConfig, changedPath: string): boolean => {
    if (changedPath === config.configFile || config.configFileDependencies.includes(changedPath)) {
        return true;
    }

    return envFilesForMode(config).includes(changedPath);
};

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

export {
    createDevServerConfig,
    type DevServer,
    type DevServerChangedModule,
    type DevServerWatchEvent,
    isServerConfigFile,
};
