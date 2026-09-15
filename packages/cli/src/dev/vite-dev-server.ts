import type { InlineConfig, Plugin, ResolvedConfig } from "vite";
import { warn } from "@gtkx/utils";
import { join } from "node:path";
import { createWatchIgnore } from "./watch-ignore.js";

type DevServerWatchEvent = "add" | "change" | "unlink";

const WRITE_STABILITY_THRESHOLD_MS = 50;
const WRITE_POLL_INTERVAL_MS = 10;
const ENV_FILE_SUFFIXES = ["", ".local"];

const envFilesForMode = (config: ResolvedConfig): string[] => {
    const envDir = config.envDir;

    if (envDir === false) {
        return [];
    }

    return ENV_FILE_SUFFIXES.flatMap((suffix) => [
        join(envDir, `.env${suffix}`),
        join(envDir, `.env.${config.mode}${suffix}`),
    ]);
};

const isServerConfigFile = (config: ResolvedConfig, changedPath: string): boolean => {
    if (changedPath === config.configFile || config.configFileDependencies.includes(changedPath)) {
        return true;
    }

    return envFilesForMode(config).includes(changedPath);
};

const watchErrorPlugin = (): Plugin => ({
    name: "gtkx:watch-errors",
    enforce: "pre",

    configureServer(server) {
        server.watcher.on("error", (cause) => {
            warn("File watch error; the dev server keeps watching.", cause);
        });
    },
});

const createDevServerConfig = (
    root: string,
    deployOutDir: string | undefined,
    plugins: Plugin[],
): InlineConfig => ({
    root,
    appType: "custom",
    plugins: [watchErrorPlugin(), ...plugins],
    server: {
        middlewareMode: true,
        watch: {
            ignored: createWatchIgnore(root, deployOutDir),
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
    type DevServerWatchEvent,
    isServerConfigFile,
};
