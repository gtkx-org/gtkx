import { type Config, loadConfig } from "@gtkx/config";
import { configDependenciesFor } from "@gtkx/config/internal";

type CodegenContext = {
    root: string;
    config: Config;
    configFile: string;
    configDependencies: string[];
};

const resolveCodegenContext = async (cwd: string, mode?: string, selectedConfig?: string): Promise<CodegenContext> => {
    const loaded = await loadConfig(cwd, { mode, configFile: selectedConfig });
    const { config, configFile } = loaded;

    return { root: cwd, config, configFile, configDependencies: configDependenciesFor(loaded) };
};

export { resolveCodegenContext, type CodegenContext };
