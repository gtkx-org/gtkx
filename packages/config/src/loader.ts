import { getOrInsert } from "@gtkx/utils";
import { loadConfig as loadConfigFile } from "c12";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { type Config, resolveConfig, type ResolvedConfig, validateConfig } from "./config.ts";

/** Result of loading a project's `gtkx.config.ts` file. */
type LoadedConfig = {
    /** The parsed and validated configuration. */
    config: Config;
    /** Absolute path of the configuration file that was loaded. */
    configFile: string;
    /** Absolute path of the project root the configuration was resolved against. */
    root: string;
};

/** How a configuration file is read, shared by {@link loadConfig} and `createConfigLoader`. */
type LoadConfigOptions = {
    /**
     * Environment name such as `development`: the config's matching `$<mode>` block is layered over the
     * top-level values, and the name is passed to a config authored as a function.
     */
    mode?: string | undefined;
};

/** Reads a project's configuration once per directory, caching what it loads and what it resolves. */
type ConfigLoader = {
    /** Loads the configuration file the given directory resolves to, as {@link loadConfig} does. */
    load: (cwd: string) => Promise<LoadedConfig>;
    /** Loads the configuration for the given directory and reduces it to what the build and the app need. */
    resolve: (cwd: string) => Promise<ResolvedConfig>;
};

/**
 * Loads and validates the `gtkx.config.ts` file for a project.
 * @param cwd Directory the configuration file is looked up in.
 * @param options Loading options, such as the environment mode whose overrides are applied.
 * @throws When the configuration fails validation, or when no configuration file is found.
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

export { loadConfig, createConfigLoader, type LoadedConfig, type ConfigLoader };
