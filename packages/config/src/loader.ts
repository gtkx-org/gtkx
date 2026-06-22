import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "c12";
import { type GtkxConfig, type ResolvedGtkxConfig, resolveGtkxConfig, validateGtkxConfig } from "./config.js";

export type LoadedConfig = {
    config: GtkxConfig;
    configFile: string | undefined;
    rootDir: string;
};

export class GtkxConfigNotFoundError extends Error {
    constructor(cwd: string) {
        super(
            `No gtkx.config.ts found in ${cwd}.\n` +
                `Create one with:\n` +
                `\n` +
                `  // gtkx.config.ts\n` +
                `  import { defineConfig } from "@gtkx/config";\n` +
                `\n` +
                `  export default defineConfig({\n` +
                `      libraries: ["Gtk-4.0", "Adw-1"],\n` +
                `  });\n`,
        );
        this.name = "GtkxConfigNotFoundError";
    }
}

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
    });

    if (!result.configFile || !result.config || !existsSync(resolve(cwd, result.configFile))) {
        throw new GtkxConfigNotFoundError(cwd);
    }

    validateGtkxConfig(result.config);

    return {
        config: result.config,
        configFile: result.configFile,
        rootDir: result.cwd ?? cwd,
    };
};

export type LoadResolvedGtkxConfigOptions = LoadGtkxConfigOptions & {
    allowMissing?: boolean;
};

export const loadResolvedGtkxConfig = async (
    cwd: string,
    options: LoadResolvedGtkxConfigOptions = {},
): Promise<ResolvedGtkxConfig> => {
    try {
        const { config } = await loadGtkxConfig(cwd, options.mode === undefined ? {} : { mode: options.mode });
        return resolveGtkxConfig(config);
    } catch (error) {
        if (options.allowMissing && error instanceof GtkxConfigNotFoundError) {
            return resolveGtkxConfig({});
        }
        throw error;
    }
};

export type GtkxConfigLoader = (cwd: string) => Promise<ResolvedGtkxConfig>;

export const createGtkxConfigLoader = (options: LoadResolvedGtkxConfigOptions = {}): GtkxConfigLoader => {
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
