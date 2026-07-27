import { loadConfig as loadConfigFile } from "c12";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type Config, resolveConfig, type ResolvedConfig, validateConfig } from "./config.js";

/**
 * Result of loading a `gtkx.config.ts` file: the parsed configuration, the
 * resolved config file path (`undefined` when none was found), and the project
 * root it was loaded from.
 */
type LoadedConfig = {
    config: Config;
    configFile: string | undefined;
    root: string;
};

type LoadConfigOptions = {
    mode?: string | undefined;
};

type ConfigLoader = (cwd: string) => Promise<ResolvedConfig>;

/**
 * Loads and validates the `gtkx.config.ts` file for a project, returning the
 * parsed configuration together with the config file path and project root.
 * @param cwd Directory from which to search for the configuration file.
 * @param options Loading options, such as the environment mode.
 */
const loadConfig = async (cwd: string, options: LoadConfigOptions = {}): Promise<LoadedConfig> => {
    const result = await loadConfigFile<Config>({
        name: "gtkx",
        cwd,
        rcFile: false,
        globalRc: false,
        packageJson: false,
        context: { mode: options.mode },
        ...((options.mode !== undefined) && { envName: options.mode }),
    });

    const config = result.config;
    const isFound = result.configFile !== undefined && existsSync(resolve(cwd, result.configFile));

    if (isFound) {
        validateConfig(config);
    }

    return {
        config,
        configFile: isFound ? result.configFile : undefined,
        root: result.cwd ?? cwd,
    };
};

const createConfigLoader = (options: LoadConfigOptions = {}): ConfigLoader => {
    const cache: Map<string, Promise<ResolvedConfig>> = new Map();

    const loadResolved = async (root: string): Promise<ResolvedConfig> => {
        const { config } = await loadConfig(root, options);
        validateConfig(config);

        return resolveConfig(config, root);
    };

    return (cwd: string): Promise<ResolvedConfig> => {
        const root = resolve(cwd);
        let pending = cache.get(root);

        if (!pending) {
            pending = loadResolved(root);
            cache.set(root, pending);
        }

        return pending;
    };
};

export { loadConfig, createConfigLoader, type LoadedConfig, type LoadConfigOptions, type ConfigLoader };
