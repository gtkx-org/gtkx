import type { Plugin, UserConfig } from "vite";
import { type ConfigLoader, createConfigLoader } from "./loader.ts";
import { GTKX_CONFIG_VIRTUAL_ID, renderConfigModule, RESOLVED_GTKX_CONFIG_VIRTUAL_ID } from "./virtual.ts";
import { viteProjectRoot } from "./vite-root.ts";

/** State the plugin carries from Vite's `config` hook to the virtual module it serves. */
type PluginState = {
    /** Project root taken from Vite's `config` hook, falling back to the working directory. */
    root: string;
};

const resolveVirtualId = (id: string): string | null =>
    id === GTKX_CONFIG_VIRTUAL_ID ? RESOLVED_GTKX_CONFIG_VIRTUAL_ID : null;

const loadVirtualModule = async (
    id: string,
    loadConfig: ConfigLoader,
    state: PluginState,
): Promise<string | undefined> => {
    if (id !== RESOLVED_GTKX_CONFIG_VIRTUAL_ID) {
        return undefined;
    }

    return renderConfigModule(await loadConfig.resolve(state.root));
};

/**
 * Creates a Vite plugin serving `virtual:gtkx-config`, the module carrying the project's resolved
 * `gtkx.config.ts`.
 */
const createConfigPlugin = (options: {
    /** Name the plugin is registered under in Vite. */
    name: string;
    /** Loader the configuration is resolved through, defaulting to a fresh caching loader. */
    loadConfig?: ConfigLoader;
    /** Extra Vite configuration contributed from the plugin's `config` hook, given the user's own configuration. */
    config?: (config: UserConfig) => Omit<UserConfig, "plugins">;
}): Plugin => {
    const loadConfig = options.loadConfig ?? createConfigLoader();
    const state: PluginState = { root: process.cwd() };

    return {
        name: options.name,
        config(config: UserConfig) {
            state.root = viteProjectRoot(config);

            return options.config?.(config);
        },
        resolveId: (id: string) => resolveVirtualId(id),
        load: (id: string) => loadVirtualModule(id, loadConfig, state),
    };
};

export default createConfigPlugin;
