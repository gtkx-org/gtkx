import { isPathInside, warn } from "@gtkx/utils";
import { loadConfig as loadConfigFile } from "c12";
import { defu } from "defu";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
    addConfigSource,
    captureConfigDependencies,
    createConfigImporter,
    setConfigDependencies,
} from "./config-dependencies.ts";
import { isRecord, missingConfigFileError } from "./config-error.ts";
import { type ConfigResolutionOptions, localConfigSourcePaths } from "./config-source.ts";
import { type Config, graduatedFutureKeys, resolveConfig, type ResolvedConfig, validateConfig } from "./config.ts";
import { assertSupportedNodeVersion } from "./node-version.ts";

/** Result of loading a project's `gtkx.config.ts` file. */
type LoadedConfig = {
    /** The parsed and validated configuration. */
    config: Config;
    /** Absolute path of the configuration file that was loaded. */
    configFile: string;
    /** Absolute path of the project root the configuration was resolved against. */
    root: string;
    /**
     * The gettext domain: the `applicationId` production builds use, so a `$development` application ID
     * shares the production catalogs.
     */
    translationDomain: string;
};

/** How a configuration file is read, shared by {@link loadConfig} and `createConfigLoader`. */
type LoadConfigOptions = {
    /**
     * Environment name such as `development`: the config's matching `$<mode>` block is layered over the
     * top-level values, and the name is passed to a config authored as a function.
     */
    mode?: string | undefined;
    /** Whether to report graduated future flags; supervising processes can own these warnings. Defaults to true. */
    shouldWarnGraduatedFuture?: boolean | undefined;
} & Partial<Record<"configFile", string | undefined>>;

/** Reads a project's configuration once per directory, caching what it loads and what it resolves. */
type ConfigLoader = {
    /** Loads the configuration file the given directory resolves to, as {@link loadConfig} does. */
    load: (cwd: string) => Promise<LoadedConfig>;
    /** Loads the configuration for the given directory and reduces it to what the build and the app need. */
    resolve: (cwd: string) => Promise<ResolvedConfig>;
};

const graduatedFutureWarnings: Map<string, string> = new Map();
const PRODUCTION_MODE = "production";
const EXTEND_KEY = "extends";

const recordOrEmpty = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const modeOverrides = (layer: Record<string, unknown>, mode: string): Record<string, unknown> => ({
    ...recordOrEmpty(layer[`$${mode}`]),
    ...recordOrEmpty(recordOrEmpty(layer.$env)[mode]),
});

const configForMode = (layers: Record<string, unknown>[], mode: string | undefined): Record<string, unknown> => {
    const merged: Record<string, unknown> = defu(
        {},
        ...layers.map((layer) => (mode ? defu(modeOverrides(layer, mode), layer) : layer)),
    );

    for (const key of Object.keys(merged)) {
        if (key === EXTEND_KEY || key.startsWith("$")) {
            Reflect.deleteProperty(merged, key);
        }
    }

    return merged;
};

const productionApplicationId = (layers: Record<string, unknown>[], config: Config): string => {
    const { applicationId } = configForMode(layers, PRODUCTION_MODE);

    return typeof applicationId === "string" ? applicationId : config.applicationId;
};

const rejectMissingLocalConfig = (source: string, options: ConfigResolutionOptions): undefined => {
    const paths = localConfigSourcePaths(source, options);

    for (const path of paths) {
        addConfigSource(path);
    }

    if (paths.length > 0 && !paths.some((path) => existsSync(path))) {
        throw new Error(`Extended configuration ${source} does not exist in ${options.cwd ?? process.cwd()}`);
    }
};

const withConfigDependencies = <T>(dependencies: string[], operation: () => T): T => {
    try {
        return operation();
    } catch (error) {
        if (typeof error === "object" && error !== null) {
            setConfigDependencies(error, dependencies);
        }

        throw error;
    }
};

const selectedConfigFile = (root: string, configured: string | undefined): string | undefined => {
    if (configured === undefined) {
        return undefined;
    }

    const path = resolve(root, configured);

    if (!isPathInside(root, path)) {
        throw new Error(`Configuration file ${configured} must be inside the project root ${root}`);
    }

    return relative(root, path);
};

const warnGraduatedFuture = (config: unknown, root: string): void => {
    const keys = graduatedFutureKeys(config);
    const signature = keys.join(",");

    if (keys.length === 0 || graduatedFutureWarnings.get(root) === signature) {
        return;
    }

    graduatedFutureWarnings.set(root, signature);
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

    const captured = await captureConfigDependencies(() =>
        loadConfigFile<Config>({
            name: "gtkx",
            cwd: searched,
            rcFile: false,
            globalRc: false,
            packageJson: false,
            envName: false,
            context: { mode: options.mode },
            jiti: createConfigImporter(),
            resolve: rejectMissingLocalConfig,
            ...(requestedConfigFile !== undefined && { configFile: requestedConfigFile }),
        }),
    );
    const result = captured.value;

    const configFile = result.configFile;
    const root = result.cwd ?? searched;
    const layerFiles = (result.layers ?? []).flatMap((layer) =>
        layer.configFile === undefined ? [] : [resolve(layer.cwd ?? root, layer.configFile)],
    );
    const dependencies = [...(configFile === undefined ? [] : [configFile]), ...layerFiles, ...captured.dependencies];

    return withConfigDependencies(dependencies, () => {
        if (configFile === undefined || !existsSync(resolve(searched, configFile))) {
            throw missingConfigFileError(searched, requestedConfigFile);
        }

        const layers = (result.layers ?? []).flatMap((layer) => (isRecord(layer.config) ? [layer.config] : []));
        const config = configForMode(layers, options.mode ?? process.env.NODE_ENV);
        validateConfig(config, configFile);
        if (options.shouldWarnGraduatedFuture !== false) {
            warnGraduatedFuture(config, root);
        }

        const loaded = {
            config,
            configFile,
            root,
            translationDomain: productionApplicationId(layers, config),
        };
        setConfigDependencies(loaded, dependencies);

        return loaded;
    });
};

const createConfigLoader = (options: LoadConfigOptions = {}): ConfigLoader => {
    assertSupportedNodeVersion();
    const loaded: Map<string, Promise<LoadedConfig>> = new Map();
    const resolved: Map<string, Promise<ResolvedConfig>> = new Map();

    const load = (cwd: string): Promise<LoadedConfig> =>
        loaded.getOrInsertComputed(resolve(cwd), (root) => loadConfig(root, options));

    const resolveAt = async (root: string): Promise<ResolvedConfig> => {
        const { config, root: configRoot, translationDomain } = await load(root);

        return resolveConfig(config, translationDomain, configRoot);
    };

    return {
        load,
        resolve: (cwd: string): Promise<ResolvedConfig> => resolved.getOrInsertComputed(resolve(cwd), resolveAt),
    };
};

export { loadConfig, createConfigLoader, type LoadedConfig, type ConfigLoader, type LoadConfigOptions };
