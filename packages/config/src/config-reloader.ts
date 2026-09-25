import { relative, resolve } from "node:path";
import { configDependenciesFor } from "./config-dependencies.ts";
import { loadConfig, type LoadConfigOptions, type LoadedConfig } from "./loader.ts";
import { resolveConfigDependencies } from "./static-dependencies.ts";

type ConfigReloader = {
    reload: () => Promise<LoadedConfig>;
    resolvePaths: () => string[];
};

const createConfigReloader = async (
    cwd: string,
    options: LoadConfigOptions = {},
    initialDependencies: string[] = [],
): Promise<ConfigReloader> => {
    let selectedConfigFile: string;
    let knownDependencies = initialDependencies;

    if (options.configFile === undefined) {
        const loaded = await loadConfig(cwd, options);
        selectedConfigFile = loaded.configFile;
        knownDependencies = [...knownDependencies, ...configDependenciesFor(loaded)];
    } else {
        selectedConfigFile = resolve(cwd, options.configFile);
    }

    const selectedConfigName = relative(cwd, selectedConfigFile);
    const resolvePaths = (): string[] => [
        ...new Set(
            [selectedConfigFile, ...knownDependencies]
                .flatMap((path) => resolveConfigDependencies(path, selectedConfigName, cwd)),
        ),
    ];

    return {
        resolvePaths,
        reload: async () => {
            let loaded: LoadedConfig;

            try {
                loaded = await loadConfig(cwd, { ...options, configFile: selectedConfigFile });
            } catch (error) {
                knownDependencies = [...new Set([...knownDependencies, ...configDependenciesFor(error)])];
                throw error;
            }

            knownDependencies = configDependenciesFor(loaded);

            return loaded;
        },
    };
};

export { createConfigReloader };
