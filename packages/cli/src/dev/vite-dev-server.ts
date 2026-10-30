import { createLogger, type InlineConfig, type Logger, type Plugin, type ResolvedConfig } from "vite";
import { warn } from "@gtkx/utils";
import { join } from "node:path";
import { crawlFrameworkPkgs } from "vitefu";
import { createWatchIgnore } from "./watch-ignore.js";

type DevServerWatchEvent = "add" | "change" | "unlink";

type DevLogger = {
    logger: Logger;
    silenceErrors(): void;
};

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

const runnerUpdatesPlugin = (): Plugin => ({
    name: "gtkx:runner-updates",
    enforce: "post",

    hotUpdate() {
        return [];
    },
});

const dependsOnRenderer = (manifest: Record<string, Record<string, string> | undefined>): boolean =>
    [manifest["dependencies"], manifest["peerDependencies"]].some(
        (dependencies) => dependencies !== undefined && Object.hasOwn(dependencies, "@gtkx/react"),
    );

const rendererLibrariesPlugin = (): Plugin => ({
    name: "gtkx:renderer-libraries",

    async config(config) {
        const crawled = await crawlFrameworkPkgs({
            root: config.root ?? process.cwd(),
            isBuild: false,
            viteUserConfig: config,
            isFrameworkPkgByJson: dependsOnRenderer,
        });

        return { ssr: { noExternal: crawled.ssr.noExternal } };
    },
});

const createDevLogger = (): DevLogger => {
    const logger = createLogger();
    let isSilenced = false;

    return {
        logger: {
            ...logger,
            get hasWarned() {
                return logger.hasWarned;
            },
            error: (message, options) => {
                if (!isSilenced) {
                    logger.error(message, options);
                }
            },
        },
        silenceErrors: () => {
            isSilenced = true;
        },
    };
};

const createDevServerConfig = (
    root: string,
    deployOutDir: string | undefined,
    plugins: Plugin[],
    logger: Logger,
): InlineConfig => ({
    root,
    appType: "custom",
    customLogger: logger,
    plugins: [watchErrorPlugin(), rendererLibrariesPlugin(), ...plugins, runnerUpdatesPlugin()],
    server: {
        middlewareMode: true,
        ws: false,
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

export { createDevLogger, createDevServerConfig, type DevLogger, type DevServerWatchEvent, isServerConfigFile };
