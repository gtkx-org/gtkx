import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig as loadConfigFile } from "c12";
import { type Config, type ResolvedConfig, resolveConfig, validateConfig } from "./config.js";

/**
 * Result of loading a `gtkx.config.ts` file: the parsed configuration, the
 * resolved config file path (`undefined` when none was found), and the project
 * root it was loaded from.
 */
export type LoadedConfig = {
    config: Config;
    configFile: string | undefined;
    root: string;
};

/**
 * Options controlling how a configuration file is loaded.
 */
export type LoadConfigOptions = {
    /** Environment mode used to select mode-specific configuration overrides. */
    mode?: string | undefined;
};

/**
 * Loads and validates the `gtkx.config.ts` file for a project, returning the
 * parsed configuration together with the config file path and project root.
 * @param cwd Directory from which to search for the configuration file.
 * @param options Loading options, such as the environment mode.
 */
export const loadConfig = async (cwd: string, options: LoadConfigOptions = {}): Promise<LoadedConfig> => {
    const result = await loadConfigFile<Config>({
        name: "gtkx",
        cwd,
        rcFile: false,
        globalRc: false,
        packageJson: false,
        context: { mode: options.mode },
        ...(options.mode !== undefined ? { envName: options.mode } : {}),
    });

    const config = result.config;
    const found = result.configFile !== undefined && existsSync(resolve(cwd, result.configFile));

    if (found) validateConfig(config);

    return {
        config,
        configFile: found ? result.configFile : undefined,
        root: result.cwd ?? cwd,
    };
};

/**
 * Function that loads and resolves the configuration for a project directory,
 * returning a {@link ResolvedConfig}.
 */
export type ConfigLoader = (cwd: string) => Promise<ResolvedConfig>;

export const createConfigLoader = (options: LoadConfigOptions = {}): ConfigLoader => {
    const cache = new Map<string, Promise<ResolvedConfig>>();
    const loadResolved = async (root: string): Promise<ResolvedConfig> => {
        const { config } = await loadConfig(root, options);
        validateConfig(config);
        return resolveConfig(config);
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
