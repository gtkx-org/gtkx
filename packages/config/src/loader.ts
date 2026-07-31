import { getOrInsert } from "@gtkx/utils";
import { loadConfig as loadConfigFile } from "c12";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type Config, resolveConfig, type ResolvedConfig, validateConfig } from "./config.js";

/**
 * Result of loading a `gtkx.config.ts` file: the parsed configuration, the
 * resolved config file path, and the project root it was loaded from.
 */
type LoadedConfig = {
    config: Config;
    configFile: string;
    root: string;
};

type LoadConfigOptions = {
    mode?: string | undefined;
};

/**
 * Caching accessor for a project's configuration: `load` yields the validated authored config together with
 * its file path, and `resolve` yields the projection an app needs at runtime.
 */
type ConfigLoader = {
    load: (cwd: string) => Promise<LoadedConfig>;
    resolve: (cwd: string) => Promise<ResolvedConfig>;
};

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
    const configFile = result.configFile;
    validateConfig(config);

    if (configFile === undefined || !existsSync(resolve(cwd, configFile))) {
        throw new Error(`gtkx.config.ts: no configuration file was found from ${cwd}`);
    }

    return {
        config,
        configFile,
        root: result.cwd ?? cwd,
    };
};

const createConfigLoader = (options: LoadConfigOptions = {}): ConfigLoader => {
    const loaded: Map<string, Promise<LoadedConfig>> = new Map();
    const resolved: Map<string, Promise<ResolvedConfig>> = new Map();

    const load = (cwd: string): Promise<LoadedConfig> =>
        getOrInsert(loaded, resolve(cwd), (root) => loadConfig(root, options));

    const resolveAt = async (root: string): Promise<ResolvedConfig> => {
        const { config, root: configRoot } = await load(root);

        return resolveConfig(config, configRoot);
    };

    return {
        load,
        resolve: (cwd: string): Promise<ResolvedConfig> => getOrInsert(resolved, resolve(cwd), resolveAt),
    };
};

export { loadConfig, createConfigLoader, type LoadedConfig, type LoadConfigOptions, type ConfigLoader };
