import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "c12";
import { type GtkxConfig, type ResolvedGtkxConfig, resolveGtkxConfig, validateGtkxConfig } from "./config.js";

export type LoadedConfig = {
    config: GtkxConfig;
    configFile: string | undefined;
    root: string;
};

export type LoadGtkxConfigOptions = {
    mode?: string;
};

export const loadGtkxConfig = async (cwd: string, options: LoadGtkxConfigOptions = {}): Promise<LoadedConfig> => {
    const result = await loadConfig<GtkxConfig>({
        name: "gtkx",
        cwd,
        rcFile: false,
        globalRc: false,
        packageJson: false,
        context: { mode: options.mode },
        ...(options.mode !== undefined ? { envName: options.mode } : {}),
    });

    const config = result.config ?? {};
    validateGtkxConfig(config);

    const found = result.configFile !== undefined && existsSync(resolve(cwd, result.configFile));

    return {
        config,
        configFile: found ? result.configFile : undefined,
        root: result.cwd ?? cwd,
    };
};

export const loadResolvedGtkxConfig = async (
    cwd: string,
    options: LoadGtkxConfigOptions = {},
): Promise<ResolvedGtkxConfig> => {
    const { config } = await loadGtkxConfig(cwd, options);
    return resolveGtkxConfig(config);
};

export type GtkxConfigLoader = (cwd: string) => Promise<ResolvedGtkxConfig>;

export const createGtkxConfigLoader = (options: LoadGtkxConfigOptions = {}): GtkxConfigLoader => {
    const cache = new Map<string, Promise<ResolvedGtkxConfig>>();
    return (cwd: string): Promise<ResolvedGtkxConfig> => {
        const root = resolve(cwd);
        let pending = cache.get(root);
        if (!pending) {
            pending = loadResolvedGtkxConfig(root, options);
            cache.set(root, pending);
        }
        return pending;
    };
};
