import { isPathInside, warn } from "@gtkx/utils";
import { loadConfig as loadConfigFile } from "c12";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { missingConfigFileError } from "./config-error.ts";
import {
    type Config,
    graduatedFutureKeys,
    resolveConfig,
    type ResolvedConfig,
    validateConfig,
} from "./config.ts";
import { assertSupportedNodeVersion } from "./node-version.ts";

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
} & Partial<Record<"configFile", string | undefined>>;

/** Reads a project's configuration once per directory, caching what it loads and what it resolves. */
type ConfigLoader = {
    /** Loads the configuration file the given directory resolves to, as {@link loadConfig} does. */
    load: (cwd: string) => Promise<LoadedConfig>;
    /** Loads the configuration for the given directory and reduces it to what the build and the app need. */
    resolve: (cwd: string) => Promise<ResolvedConfig>;
};

const GRADUATED_FUTURE_ENV = "GTKX_GRADUATED_FUTURE_SHOWN";
const graduatedFutureWarnings: Map<string, string> = new Map();

const selectedConfigFile = (root: string, configured: string | undefined): string | undefined => {
    if (configured === undefined) {
        return undefined;
    }

    const path = resolve(root, configured);

    if (!isPathInside(root, path)) {
        throw new Error(`Configuration file ${configured} must be inside the project root ${root}`);
    }

    return path;
};

const warnGraduatedFuture = (config: unknown, root: string): void => {
    const keys = graduatedFutureKeys(config);
    const signature = keys.join(",");

    if (
        keys.length === 0 ||
        graduatedFutureWarnings.get(root) === signature ||
        process.env[GRADUATED_FUTURE_ENV] === signature
    ) {
        return;
    }

    graduatedFutureWarnings.set(root, signature);
    process.env[GRADUATED_FUTURE_ENV] = signature;
    warn(`GTKX 2 ignores graduated future flags: ${keys.join(", ")}. Remove them from gtkx.config.ts.`);
};

/**
 * Loads and validates the `gtkx.config.ts` file for a project.
 * @param cwd Directory the configuration file is looked up in; parent directories are not searched.
 * @param options Loading options, such as the environment mode whose overrides are applied.
 * @throws When that directory holds no configuration file, or when the configuration fails validation.
 */
const loadConfig = async (cwd: string, options: LoadConfigOptions = {}): Promise<LoadedConfig> => {
    assertSupportedNodeVersion();
    const searched = resolve(cwd);
    const requestedConfigFile = selectedConfigFile(searched, options.configFile);

    const result = await loadConfigFile<Config>({
        name: "gtkx",
        cwd: searched,
        rcFile: false,
        globalRc: false,
        packageJson: false,
        context: { mode: options.mode },
        ...(requestedConfigFile !== undefined && { configFile: requestedConfigFile }),
        ...((options.mode !== undefined) && { envName: options.mode }),
    });

    const configFile = result.configFile;

    if (configFile === undefined || !existsSync(resolve(searched, configFile))) {
        throw missingConfigFileError(searched, requestedConfigFile);
    }

    const config = result.config;
    const root = result.cwd ?? searched;
    validateConfig(config, configFile);
    warnGraduatedFuture(config, root);

    return {
        config,
        configFile,
        root,
    };
};

const createConfigLoader = (options: LoadConfigOptions = {}): ConfigLoader => {
    assertSupportedNodeVersion();
    const loaded: Map<string, Promise<LoadedConfig>> = new Map();
    const resolved: Map<string, Promise<ResolvedConfig>> = new Map();

    const load = (cwd: string): Promise<LoadedConfig> =>
        loaded.getOrInsertComputed(resolve(cwd), (root) => loadConfig(root, options));

    const resolveAt = async (root: string): Promise<ResolvedConfig> => {
        const { config, root: configRoot } = await load(root);

        return resolveConfig(config, configRoot);
    };

    return {
        load,
        resolve: (cwd: string): Promise<ResolvedConfig> => resolved.getOrInsertComputed(resolve(cwd), resolveAt),
    };
};

export { loadConfig, createConfigLoader, type LoadedConfig, type ConfigLoader };
